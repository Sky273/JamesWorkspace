import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../services/missions.service.js', () => ({
    findMission: vi.fn()
}));

vi.mock('../../services/resumes.service.js', () => ({
    getResumeForAccessCheck: vi.fn()
}));

const {
    normalizeBatchJobPayload,
    resolveFirmId
} = await import('../../routes/batchJobs/helpers.payloadAccess.js');

describe('batch jobs payload access helpers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('normalizes admin firm selection to canonical firmId', () => {
        const normalized = normalizeBatchJobPayload({ firm_id: 'firm-123', mission_id: 'mission-456' });

        expect(normalized.firmId).toBe('firm-123');
        expect(normalized.firm_id).toBeUndefined();
        expect(normalized.missionId).toBe('mission-456');
    });

    it('resolves admin firm access from canonical firmId only', () => {
        expect(resolveFirmId(
            { isAdmin: true, userFirmId: 'user-firm' },
            { firmId: 'target-firm' }
        )).toBe('target-firm');

        expect(resolveFirmId(
            { isAdmin: true, userFirmId: 'user-firm' },
            {}
        )).toBe('user-firm');
    });
});
