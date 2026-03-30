/**
 * Tests for Batch Jobs Service (local functions)
 * Tests getDealForExport, getResumesForDeal, getAdaptationsForDeal
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../config/database.js', () => ({
    query: vi.fn()
}));

vi.mock('../../services/batchJobs/constants.js', () => ({
    JOB_STATUS: { PENDING: 'pending', PROCESSING: 'processing', COMPLETED: 'completed', FAILED: 'failed', CANCELLED: 'cancelled' },
    ITEM_STATUS: { PENDING: 'pending', PROCESSING: 'processing', COMPLETED: 'completed', FAILED: 'failed', SKIPPED: 'skipped' }
}));

vi.mock('../../services/batchJobs/schema.js', () => ({
    initializeBatchJobsTable: vi.fn()
}));

vi.mock('../../services/batchJobs/jobCrud.js', () => ({
    createJob: vi.fn(), getJob: vi.fn(), getJobsByFirm: vi.fn(), getAllJobs: vi.fn(),
    updateJobStatus: vi.fn(), cancelJob: vi.fn(), deleteJob: vi.fn(), getPendingJobs: vi.fn(),
    updateJobCounters: vi.fn(), updateCollectionJobProgress: vi.fn(),
    updateJobExportFile: vi.fn(), clearJobExportFile: vi.fn(),
    isJobComplete: vi.fn(), getFinalJobOutcome: vi.fn()
}));

vi.mock('../../services/batchJobs/itemCrud.js', () => ({
    addJobItems: vi.fn(), addJobResumeIds: vi.fn(), addJobTaskItems: vi.fn(), addJobExportItems: vi.fn(),
    getJobItems: vi.fn(), updateJobItemStatus: vi.fn(), getJobItem: vi.fn(),
    resumeItemWithName: vi.fn(), getItemsPendingName: vi.fn(), getPendingItems: vi.fn()
}));

vi.mock('../../services/batchJobs/worker.js', () => ({
    startWorker: vi.fn(), stopWorker: vi.fn()
}));

vi.mock('../../services/batchJobs/maintenance.js', () => ({
    cleanupOldJobs: vi.fn(), cleanupJobExportArtifacts: vi.fn(), getBatchJobsStats: vi.fn()
}));

import { query } from '../../config/database.js';
import {
    getDealForExport,
    getResumesForDeal,
    getAdaptationsForDeal,
    JOB_STATUS,
    ITEM_STATUS
} from '../../services/batchJobs.service.js';

describe('Batch Jobs Service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('constants', () => {
        it('should export JOB_STATUS', () => {
            expect(JOB_STATUS.PENDING).toBe('pending');
            expect(JOB_STATUS.COMPLETED).toBe('completed');
        });

        it('should export ITEM_STATUS', () => {
            expect(ITEM_STATUS.PENDING).toBe('pending');
            expect(ITEM_STATUS.FAILED).toBe('failed');
        });
    });

    describe('getDealForExport', () => {
        it('should return deal info', async () => {
            query.mockResolvedValueOnce({ rows: [{ id: 'd1', title: 'Deal', firm_id: 'f1' }] });

            const result = await getDealForExport('d1');

            expect(result.title).toBe('Deal');
            expect(query.mock.calls[0][1]).toEqual(['d1']);
        });

        it('should return null if not found', async () => {
            query.mockResolvedValueOnce({ rows: [] });
            expect(await getDealForExport('missing')).toBeNull();
        });
    });

    describe('getResumesForDeal', () => {
        it('should return resumes linked to deal', async () => {
            query.mockResolvedValueOnce({ rows: [
                { id: 'r1', name: 'CV1', relative_path: '/files/cv1.pdf' },
                { id: 'r2', name: 'CV2', relative_path: null }
            ] });

            const result = await getResumesForDeal('d1');

            expect(result).toHaveLength(2);
            expect(query.mock.calls[0][0]).toContain('deal_resumes');
        });

        it('should return empty array for deal with no resumes', async () => {
            query.mockResolvedValueOnce({ rows: [] });
            expect(await getResumesForDeal('d1')).toEqual([]);
        });
    });

    describe('getAdaptationsForDeal', () => {
        it('should return adaptations linked to deal missions', async () => {
            query.mockResolvedValueOnce({ rows: [
                { id: 'a1', candidate_name: 'John', mission_name: 'Dev' }
            ] });

            const result = await getAdaptationsForDeal('d1');

            expect(result).toHaveLength(1);
            expect(query.mock.calls[0][0]).toContain('resume_adaptations');
            expect(query.mock.calls[0][0]).toContain('m.deal_id = $1');
        });
    });
});
