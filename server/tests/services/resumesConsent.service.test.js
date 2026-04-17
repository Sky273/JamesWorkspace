import { beforeEach, describe, expect, it, vi } from 'vitest';

const queryMock = vi.fn();
const invalidateResumeMutationViewsMock = vi.fn();
const invalidateResumeMutationViewsForRowsMock = vi.fn();

vi.mock('../../config/database.js', () => ({
    query: (...args) => queryMock(...args)
}));

vi.mock('../../services/resumesPersistence.service.js', () => ({
    resolveResumeExecutor: vi.fn(() => null)
}));

vi.mock('../../services/resumesInvalidation.service.js', () => ({
    invalidateResumeMutationViews: (...args) => invalidateResumeMutationViewsMock(...args),
    invalidateResumeMutationViewsForRows: (...args) => invalidateResumeMutationViewsForRowsMock(...args)
}));

import {
    expirePendingConsents,
    initializeResumeConsent,
    markResumeConsentError,
    recordConsentReminderSent
} from '../../services/resumesConsent.service.js';

describe('resumesConsent.service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        invalidateResumeMutationViewsMock.mockResolvedValue(undefined);
        invalidateResumeMutationViewsForRowsMock.mockResolvedValue(undefined);
    });

    it('initializes consent metadata and invalidates the resume detail views', async () => {
        queryMock.mockResolvedValueOnce({
            rows: [{ id: 'r1', firm_id: 'f1', consent_status: 'pending_consent' }]
        });

        const result = await initializeResumeConsent({
            resumeId: 'r1',
            profileType: 'external',
            candidateName: 'Jane',
            candidateEmail: 'jane@example.com',
            consentStatus: 'pending_consent',
            consentToken: 'token-1',
            tokenExpiresAt: new Date('2026-05-01T00:00:00.000Z')
        });

        expect(result).toEqual(expect.objectContaining({
            id: 'r1',
            firm_id: 'f1',
            consent_status: 'pending_consent'
        }));
        expect(queryMock.mock.calls[0][0]).toContain('consent_token = $5');
        expect(invalidateResumeMutationViewsMock).toHaveBeenCalledWith('r1', 'f1');
    });

    it('marks consent errors with the pending-only guard and invalidates detail views', async () => {
        queryMock.mockResolvedValueOnce({
            rows: [{ id: 'r1', firm_id: 'f1' }]
        });

        const result = await markResumeConsentError('r1', { pendingOnly: true });

        expect(result).toEqual({ id: 'r1', firm_id: 'f1' });
        expect(queryMock.mock.calls[0][0]).toContain("consent_status = 'error'");
        expect(queryMock.mock.calls[0][0]).toContain('AND consent_status = $2');
        expect(queryMock.mock.calls[0][1]).toEqual(['r1', 'pending_consent']);
        expect(invalidateResumeMutationViewsMock).toHaveBeenCalledWith('r1', 'f1');
    });

    it('expires pending consents and invalidates affected firm views as a batch', async () => {
        queryMock.mockResolvedValueOnce({
            rows: [{ id: 'r1', firm_id: 'f1' }, { id: 'r2', firm_id: 'f2' }]
        });

        const result = await expirePendingConsents();

        expect(result.rows).toHaveLength(2);
        expect(queryMock.mock.calls[0][0]).toContain("consent_status = 'expired'");
        expect(invalidateResumeMutationViewsForRowsMock).toHaveBeenCalledWith([
            { id: 'r1', firm_id: 'f1' },
            { id: 'r2', firm_id: 'f2' }
        ]);
    });

    it('records reminder sends and invalidates the targeted resume detail views', async () => {
        queryMock.mockResolvedValueOnce({
            rows: [{ id: 'r1', firm_id: 'f1' }]
        });

        const result = await recordConsentReminderSent('r1');

        expect(result.rows).toEqual([{ id: 'r1', firm_id: 'f1' }]);
        expect(queryMock.mock.calls[0][0]).toContain('consent_reminder_sent_at = CURRENT_TIMESTAMP');
        expect(invalidateResumeMutationViewsMock).toHaveBeenCalledWith('r1', 'f1');
    });
});
