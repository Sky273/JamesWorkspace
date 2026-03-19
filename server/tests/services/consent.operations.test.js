/**
 * Tests for Consent Operations
 * Tests initializeConsent, validateConsentToken, recordConsentResponse,
 * getConsentStatus, generateToken, getDpoSettings
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../config/database.js', () => ({
    query: vi.fn()
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
        CONSENT_REQUEST_SENT: 'consent_request_sent',
        CONSENT_GRANTED: 'consent_granted',
        CONSENT_REFUSED: 'consent_refused'
    }
}));

vi.mock('../../services/consent/emailTemplates.js', () => ({
    getFrontendUrl: vi.fn(() => 'http://localhost:3000'),
    buildConsentRequestEmailHtml: vi.fn(() => '<html>consent</html>')
}));

import { query } from '../../config/database.js';
import {
    generateToken,
    getDpoSettings,
    initializeConsent,
    validateConsentToken,
    recordConsentResponse,
    getConsentStatus,
    CONSENT_TOKEN_EXPIRY_DAYS,
    RETENTION_PERIOD_DAYS
} from '../../services/consent/operations.js';

describe('Consent Operations', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('constants', () => {
        it('should export CONSENT_TOKEN_EXPIRY_DAYS', () => {
            expect(CONSENT_TOKEN_EXPIRY_DAYS).toBe(14);
        });

        it('should export RETENTION_PERIOD_DAYS', () => {
            expect(RETENTION_PERIOD_DAYS).toBe(730);
        });
    });

    describe('generateToken', () => {
        it('should return a 64-character hex string', () => {
            const token = generateToken();
            expect(token).toHaveLength(64);
            expect(/^[a-f0-9]{64}$/.test(token)).toBe(true);
        });

        it('should generate unique tokens', () => {
            const t1 = generateToken();
            const t2 = generateToken();
            expect(t1).not.toBe(t2);
        });
    });

    describe('getDpoSettings', () => {
        it('should return DPO settings from DB', async () => {
            query.mockResolvedValueOnce({ rows: [{ dpo_name: 'DPO', dpo_email: 'dpo@test.com' }] });

            const result = await getDpoSettings();

            expect(result.dpo_name).toBe('DPO');
            expect(query.mock.calls[0][0]).toContain('dpo_name');
        });

        it('should return empty object if no settings', async () => {
            query.mockResolvedValueOnce({ rows: [] });
            expect(await getDpoSettings()).toEqual({});
        });

        it('should return empty object on error', async () => {
            query.mockRejectedValueOnce(new Error('DB error'));
            expect(await getDpoSettings()).toEqual({});
        });
    });

    describe('initializeConsent', () => {
        it('should initialize employee consent as not_required', async () => {
            query.mockResolvedValueOnce({
                rows: [{ id: 'r1', profile_type: 'employee', consent_status: 'not_required' }]
            });

            const result = await initializeConsent({
                resumeId: 'r1',
                profileType: 'employee',
                candidateName: 'John'
            });

            expect(result.consent_status).toBe('not_required');
            expect(query.mock.calls[0][1][3]).toBe('not_required');
        });

        it('should initialize external consent as pending with token', async () => {
            query.mockResolvedValueOnce({
                rows: [{ id: 'r1', profile_type: 'external', consent_status: 'pending_consent' }]
            });

            const result = await initializeConsent({
                resumeId: 'r1',
                profileType: 'external',
                candidateName: 'Jane',
                candidateEmail: 'jane@test.com'
            });

            expect(result.consent_status).toBe('pending_consent');
            // Token param should be a 64-char hex string
            const tokenParam = query.mock.calls[0][1][4];
            expect(tokenParam).toHaveLength(64);
        });

        it('should throw if resumeId missing', async () => {
            await expect(initializeConsent({ profileType: 'employee', candidateName: 'X' }))
                .rejects.toThrow('Resume ID is required');
        });

        it('should throw for invalid profileType', async () => {
            await expect(initializeConsent({ resumeId: 'r1', profileType: 'invalid', candidateName: 'X' }))
                .rejects.toThrow('Profile type');
        });

        it('should throw if candidateName missing', async () => {
            await expect(initializeConsent({ resumeId: 'r1', profileType: 'employee' }))
                .rejects.toThrow('Candidate name');
        });

        it('should throw if external profile without email', async () => {
            await expect(initializeConsent({ resumeId: 'r1', profileType: 'external', candidateName: 'X' }))
                .rejects.toThrow('email is required');
        });

        it('should throw if resume not found', async () => {
            query.mockResolvedValueOnce({ rows: [] });

            await expect(initializeConsent({
                resumeId: 'r1', profileType: 'employee', candidateName: 'X'
            })).rejects.toThrow('Resume not found');
        });
    });

    describe('validateConsentToken', () => {
        const validToken = 'a'.repeat(64);

        it('should return null for invalid token format', async () => {
            expect(await validateConsentToken(null)).toBeNull();
            expect(await validateConsentToken('short')).toBeNull();
            expect(await validateConsentToken('')).toBeNull();
        });

        it('should return null if token not found in DB', async () => {
            query.mockResolvedValueOnce({ rows: [] }); // main lookup
            query.mockResolvedValueOnce({ rows: [] }); // diagnostic

            expect(await validateConsentToken(validToken)).toBeNull();
        });

        it('should return resume with expired flag if token expired', async () => {
            query.mockResolvedValueOnce({
                rows: [{
                    id: 'r1',
                    consent_token_expires_at: new Date(Date.now() - 86400000).toISOString(),
                    consent_status: 'pending_consent'
                }]
            });

            const result = await validateConsentToken(validToken);
            expect(result.expired).toBe(true);
        });

        it('should return resume with alreadyProcessed if not pending', async () => {
            query.mockResolvedValueOnce({
                rows: [{
                    id: 'r1',
                    consent_token_expires_at: new Date(Date.now() + 86400000).toISOString(),
                    consent_status: 'active'
                }]
            });

            const result = await validateConsentToken(validToken);
            expect(result.alreadyProcessed).toBe(true);
        });

        it('should return valid resume', async () => {
            query.mockResolvedValueOnce({
                rows: [{
                    id: 'r1',
                    consent_token_expires_at: new Date(Date.now() + 86400000).toISOString(),
                    consent_status: 'pending_consent'
                }]
            });

            const result = await validateConsentToken(validToken);
            expect(result.id).toBe('r1');
            expect(result.expired).toBeUndefined();
            expect(result.alreadyProcessed).toBeUndefined();
        });
    });

    describe('recordConsentResponse', () => {
        const validToken = 'b'.repeat(64);

        it('should accept consent and set retention', async () => {
            // validateConsentToken queries
            query.mockResolvedValueOnce({
                rows: [{
                    id: 'r1', firm_id: 'f1', firm_name: 'Acme',
                    candidate_name: 'John', candidate_email: 'j@t.com',
                    consent_token_expires_at: new Date(Date.now() + 86400000).toISOString(),
                    consent_status: 'pending_consent'
                }]
            });
            // UPDATE consent
            query.mockResolvedValueOnce({
                rows: [{ id: 'r1', consent_status: 'active', retention_until: '2028-01-01' }]
            });

            const result = await recordConsentResponse(validToken, true);

            expect(result.consent_status).toBe('active');
            expect(query.mock.calls[1][1][0]).toBe('active');
        });

        it('should refuse consent and clear retention', async () => {
            query.mockResolvedValueOnce({
                rows: [{
                    id: 'r1', firm_id: 'f1', firm_name: 'Acme',
                    candidate_name: 'John', candidate_email: 'j@t.com',
                    consent_token_expires_at: new Date(Date.now() + 86400000).toISOString(),
                    consent_status: 'pending_consent'
                }]
            });
            query.mockResolvedValueOnce({
                rows: [{ id: 'r1', consent_status: 'refused' }]
            });

            const result = await recordConsentResponse(validToken, false);

            expect(result.consent_status).toBe('refused');
            expect(query.mock.calls[1][1][1]).toBeNull(); // retention_until null
        });

        it('should throw for invalid token', async () => {
            query.mockResolvedValueOnce({ rows: [] });
            query.mockResolvedValueOnce({ rows: [] }); // diagnostic

            await expect(recordConsentResponse(validToken, true))
                .rejects.toThrow('Invalid or expired');
        });

        it('should throw for expired token', async () => {
            query.mockResolvedValueOnce({
                rows: [{
                    id: 'r1',
                    consent_token_expires_at: new Date(Date.now() - 86400000).toISOString(),
                    consent_status: 'pending_consent'
                }]
            });

            await expect(recordConsentResponse(validToken, true))
                .rejects.toThrow('expired');
        });
    });

    describe('getConsentStatus', () => {
        it('should return consent info for a resume', async () => {
            query.mockResolvedValueOnce({
                rows: [{ id: 'r1', consent_status: 'active', profile_type: 'external' }]
            });

            const result = await getConsentStatus('r1');

            expect(result.consent_status).toBe('active');
            expect(query.mock.calls[0][1]).toEqual(['r1']);
        });

        it('should throw if resume not found', async () => {
            query.mockResolvedValueOnce({ rows: [] });
            await expect(getConsentStatus('missing')).rejects.toThrow('Resume not found');
        });
    });
});
