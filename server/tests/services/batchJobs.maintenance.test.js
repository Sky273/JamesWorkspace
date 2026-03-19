/**
 * Tests for Batch Jobs - Maintenance Operations
 * Tests cleanupOldJobs and getBatchJobsStats
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../config/database.js', () => ({
    query: vi.fn()
}));

vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn()
}));

import { query } from '../../config/database.js';
import {
    cleanupOldJobs,
    getBatchJobsStats
} from '../../services/batchJobs/maintenance.js';

describe('Batch Jobs - Maintenance', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('cleanupOldJobs', () => {
        it('should clear file_data and delete old jobs', async () => {
            query.mockResolvedValueOnce({ rowCount: 5 }); // clear file_data
            query.mockResolvedValueOnce({ rowCount: 2 }); // delete old jobs

            const result = await cleanupOldJobs(7);

            expect(result).toEqual({ deletedJobs: 2, clearedFileData: 5 });
            expect(query.mock.calls[0][0]).toContain('file_data = NULL');
            expect(query.mock.calls[1][0]).toContain('DELETE FROM batch_jobs');
        });

        it('should use default maxAgeDays of 7', async () => {
            query.mockResolvedValueOnce({ rowCount: 0 });
            query.mockResolvedValueOnce({ rowCount: 0 });

            await cleanupOldJobs();

            expect(query.mock.calls[1][1]).toEqual([7]);
        });

        it('should fallback to 7 days when given 0', async () => {
            query.mockResolvedValueOnce({ rowCount: 0 });
            query.mockResolvedValueOnce({ rowCount: 0 });

            await cleanupOldJobs(0);

            // Number(0) is falsy, so || 7 kicks in → Math.max(1, 7) = 7
            expect(query.mock.calls[1][1]).toEqual([7]);
        });

        it('should return zeros on error', async () => {
            query.mockRejectedValueOnce(new Error('DB error'));

            const result = await cleanupOldJobs();

            expect(result).toEqual({ deletedJobs: 0, clearedFileData: 0 });
        });
    });

    describe('getBatchJobsStats', () => {
        it('should return formatted stats', async () => {
            query.mockResolvedValueOnce({
                rows: [{
                    pending_jobs: '3',
                    processing_jobs: '1',
                    completed_jobs: '10',
                    failed_jobs: '2',
                    cancelled_jobs: '0',
                    pending_items: '15',
                    items_with_file_data: '5',
                    total_file_data_bytes: '10485760' // 10MB
                }]
            });

            const result = await getBatchJobsStats();

            expect(result.jobs.pending).toBe(3);
            expect(result.jobs.processing).toBe(1);
            expect(result.jobs.completed).toBe(10);
            expect(result.jobs.failed).toBe(2);
            expect(result.jobs.cancelled).toBe(0);
            expect(result.items.pending).toBe(15);
            expect(result.items.withFileData).toBe(5);
            expect(result.items.fileDataSizeMB).toBe(10);
        });

        it('should handle null/zero values', async () => {
            query.mockResolvedValueOnce({
                rows: [{
                    pending_jobs: null,
                    processing_jobs: null,
                    completed_jobs: null,
                    failed_jobs: null,
                    cancelled_jobs: null,
                    pending_items: null,
                    items_with_file_data: null,
                    total_file_data_bytes: null
                }]
            });

            const result = await getBatchJobsStats();

            expect(result.jobs.pending).toBe(0);
            expect(result.items.fileDataSizeMB).toBe(0);
        });

        it('should return null on error', async () => {
            query.mockRejectedValueOnce(new Error('DB error'));
            expect(await getBatchJobsStats()).toBeNull();
        });
    });
});
