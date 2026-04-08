/**
 * Tests for Consent Scheduler Tasks
 * Tests checkExpiredConsents, sendConsentReminders, purgeResume, purgeExpiredResumes
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../config/database.js', () => ({
    query: vi.fn()
}));

vi.mock('../../utils/postgresHelpers.js', () => ({
    transaction: vi.fn()
}));

vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn()
}));

vi.mock('../../services/mail/gdprMailService.js', () => ({
    gdprMailService: { sendEmail: vi.fn(() => Promise.resolve()) }
}));

vi.mock('../../services/gdprAudit.service.js', () => ({
    logGdprAction: vi.fn(() => Promise.resolve()),
    GDPR_ACTIONS: {
        CONSENT_REMINDER_SENT: 'consent_reminder_sent',
        CV_PURGED: 'cv_purged',
        AUTO_PURGE_EXECUTED: 'auto_purge_executed'
    }
}));

vi.mock('../../services/consent/emailTemplates.js', () => ({
    getFrontendUrl: vi.fn(() => 'http://localhost:3000'),
    buildConsentReminderEmailHtml: vi.fn(() => '<html>reminder</html>')
}));

import { query } from '../../config/database.js';
import { transaction } from '../../utils/postgresHelpers.js';
import { gdprMailService } from '../../services/mail/gdprMailService.js';
import {
    checkExpiredConsents,
    sendConsentReminders,
    purgeResume,
    purgeExpiredResumes
} from '../../services/consent/scheduler.js';

describe('Consent Scheduler Tasks', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('checkExpiredConsents', () => {
        it('should mark expired pending consents', async () => {
            query.mockResolvedValueOnce({ rows: [{ id: 'r1' }, { id: 'r2' }] }); // expired pending
            query.mockResolvedValueOnce({ rows: [] }); // expired retention

            const count = await checkExpiredConsents();

            expect(count).toBe(2);
            expect(query.mock.calls[0][0]).toContain("consent_status = 'expired'");
            expect(query.mock.calls[0][0]).toContain('pending_consent');
        });

        it('should mark expired retention consents', async () => {
            query.mockResolvedValueOnce({ rows: [] }); // expired pending
            query.mockResolvedValueOnce({ rows: [{ id: 'r3' }] }); // expired retention

            const count = await checkExpiredConsents();

            expect(count).toBe(1);
            expect(query.mock.calls[1][0]).toContain("consent_status = 'active'");
            expect(query.mock.calls[1][0]).toContain('retention_until');
        });

        it('should return 0 if nothing expired', async () => {
            query.mockResolvedValueOnce({ rows: [] });
            query.mockResolvedValueOnce({ rows: [] });

            expect(await checkExpiredConsents()).toBe(0);
        });
    });

    describe('sendConsentReminders', () => {
        it('should send reminders to pending resumes', async () => {
            query.mockResolvedValueOnce({
                rows: [{
                    id: 'r1', firm_id: 'f1', candidate_name: 'John',
                    candidate_email: 'j@t.com', consent_token: 'a'.repeat(64),
                    consent_token_expires_at: new Date(Date.now() + 86400000).toISOString(),
                    firm_name: 'Acme'
                }]
            });
            // UPDATE reminder tracking
            query.mockResolvedValueOnce({ rows: [] });

            const count = await sendConsentReminders();

            expect(count).toBe(1);
            expect(gdprMailService.sendEmail).toHaveBeenCalledTimes(1);
            expect(gdprMailService.sendEmail.mock.calls[0][0].to).toBe('j@t.com');
        });

        it('should return 0 if no reminders needed', async () => {
            query.mockResolvedValueOnce({ rows: [] });
            expect(await sendConsentReminders()).toBe(0);
        });

        it('should continue on email error and not count failed', async () => {
            query.mockResolvedValueOnce({
                rows: [{
                    id: 'r1', firm_id: 'f1', candidate_name: 'John',
                    candidate_email: 'j@t.com', consent_token: 'a'.repeat(64),
                    consent_token_expires_at: new Date(Date.now() + 86400000).toISOString(),
                    firm_name: 'Acme'
                }]
            });
            gdprMailService.sendEmail.mockRejectedValueOnce(new Error('SMTP error'));

            const count = await sendConsentReminders();

            expect(count).toBe(0);
        });
    });

    describe('purgeResume', () => {
        it('should delete resume and related records in transaction', async () => {
            // getResumeInfo query
            query.mockResolvedValueOnce({
                rows: [{ id: 'r1', firm_id: 'f1', candidate_name: 'John', consent_status: 'expired' }]
            });

            const mockClient = { query: vi.fn(() => ({ rows: [{ id: 'r1' }] })) };
            transaction.mockImplementationOnce(async (fn) => fn(mockClient));

            const result = await purgeResume('r1');

            expect(result).toBe(true);
            expect(mockClient.query).toHaveBeenCalledTimes(4); // versions, adaptations, submissions, resume
        });

        it('should return false if resume not found in transaction', async () => {
            query.mockResolvedValueOnce({ rows: [{ id: 'r1' }] });

            const mockClient = { query: vi.fn(() => ({ rows: [] })) };
            transaction.mockImplementationOnce(async (fn) => fn(mockClient));

            const result = await purgeResume('r1');

            expect(result).toBe(false);
        });

        it('should use provided auditInfo instead of querying', async () => {
            const mockClient = { query: vi.fn(() => ({ rows: [{ id: 'r1' }] })) };
            transaction.mockImplementationOnce(async (fn) => fn(mockClient));

            const auditInfo = { id: 'r1', firm_id: 'f1', candidate_name: 'John', consent_status: 'refused' };
            await purgeResume('r1', auditInfo);

            // Should NOT query for resume info since auditInfo is provided
            expect(query).not.toHaveBeenCalled();
        });
    });

    describe('purgeExpiredResumes', () => {
        it('should purge all refused/expired resumes', async () => {
            query.mockResolvedValueOnce({
                rows: [
                    { id: 'r1', consent_status: 'refused', candidate_name: 'A' },
                    { id: 'r2', consent_status: 'expired', candidate_name: 'B' }
                ]
            });

            const mockClient = { query: vi.fn(() => ({ rows: [{ id: 'x' }] })) };
            transaction.mockImplementation(async (fn) => fn(mockClient));

            const count = await purgeExpiredResumes();

            expect(count).toBe(2);
            expect(transaction).toHaveBeenCalledTimes(2);
        });

        it('should not count resumes that were selected but not deleted', async () => {
            query.mockResolvedValueOnce({
                rows: [
                    { id: 'r1', consent_status: 'refused', candidate_name: 'A' },
                    { id: 'r2', consent_status: 'expired', candidate_name: 'B' }
                ]
            });

            const mockClient = {
                query: vi
                    .fn()
                    .mockImplementationOnce(() => ({ rows: [{ id: 'r1' }] }))
                    .mockImplementationOnce(() => ({ rows: [{ id: 'r1' }] }))
                    .mockImplementationOnce(() => ({ rows: [{ id: 'r1' }] }))
                    .mockImplementationOnce(() => ({ rows: [{ id: 'r1' }] }))
                    .mockImplementationOnce(() => ({ rows: [{ id: 'r2' }] }))
                    .mockImplementationOnce(() => ({ rows: [{ id: 'r2' }] }))
                    .mockImplementationOnce(() => ({ rows: [{ id: 'r2' }] }))
                    .mockImplementationOnce(() => ({ rows: [] }))
            };
            transaction
                .mockImplementationOnce(async (fn) => fn(mockClient))
                .mockImplementationOnce(async (fn) => fn(mockClient));

            const count = await purgeExpiredResumes();

            expect(count).toBe(1);
            expect(transaction).toHaveBeenCalledTimes(2);
        });

        it('should return 0 if nothing to purge', async () => {
            query.mockResolvedValueOnce({ rows: [] });
            expect(await purgeExpiredResumes()).toBe(0);
        });

        it('should continue on individual purge error', async () => {
            query.mockResolvedValueOnce({
                rows: [{ id: 'r1', consent_status: 'refused' }]
            });
            transaction.mockRejectedValueOnce(new Error('Transaction error'));

            const count = await purgeExpiredResumes();

            expect(count).toBe(0);
        });
    });
});
