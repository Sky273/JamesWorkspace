/**
 * Tests for Batch Jobs Worker
 * startWorker, stopWorker, processNextBatch logic
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn()
}));
vi.mock('../../services/batchJobs/constants.js', () => ({
    JOB_STATUS: { PENDING: 'pending', PROCESSING: 'processing', COMPLETED: 'completed', FAILED: 'failed', CANCELLED: 'cancelled' },
    ITEM_STATUS: { PENDING: 'pending', PROCESSING: 'processing', SUCCESS: 'success', ERROR: 'error', SKIPPED: 'skipped', PENDING_NAME: 'pending_name' },
    WORKER_INTERVAL: 100 // Short for tests
}));
vi.mock('../../services/batchJobs/jobCrud.js', () => ({
    getPendingJobs: vi.fn(() => []),
    updateJobStatus: vi.fn(),
    updateJobCounters: vi.fn(),
    isJobComplete: vi.fn(() => false),
    getFinalJobOutcome: vi.fn(() => ({
        status: 'completed',
        counters: { processed_items: 0, success_count: 0, error_count: 0 }
    }))
}));
vi.mock('../../services/batchJobs/itemCrud.js', () => ({
    getPendingItems: vi.fn(() => []),
    updateJobItemStatus: vi.fn()
}));

import { startWorker, stopWorker } from '../../services/batchJobs/worker.js';
import { getPendingJobs, updateJobStatus, updateJobCounters, isJobComplete } from '../../services/batchJobs/jobCrud.js';
import { getPendingItems, updateJobItemStatus } from '../../services/batchJobs/itemCrud.js';

describe('Batch Jobs Worker', () => {
    afterEach(() => {
        stopWorker();
        vi.clearAllMocks();
    });

    describe('startWorker / stopWorker', () => {
        it('should start and stop without error', () => {
            const processItem = vi.fn();
            startWorker(processItem);
            stopWorker();
        });

        it('should not start twice', async () => {
            const { safeLog } = await import('../../utils/logger.backend.js');
            const processItem = vi.fn();
            startWorker(processItem);
            startWorker(processItem);
            expect(safeLog).toHaveBeenCalledWith('warn', expect.stringContaining('already running'));
            stopWorker();
        });
    });

    describe('processNextBatch', () => {
        it('should process pending items and mark job completed', async () => {
            const processItem = vi.fn();
            const job = { id: 'job-1', status: 'pending', total_items: 1 };
            const item = { id: 'item-1', file_name: 'cv.pdf' };

            getPendingJobs.mockResolvedValueOnce([job]).mockResolvedValue([]);
            getPendingItems.mockResolvedValueOnce([item]);
            isJobComplete.mockResolvedValueOnce(true);

            startWorker(processItem);
            await new Promise(r => setTimeout(r, 250));
            stopWorker();

            expect(updateJobStatus).toHaveBeenCalledWith('job-1', 'processing');
            expect(processItem).toHaveBeenCalledWith(item, job);
        });

        it('should handle item processing errors', async () => {
            const processItem = vi.fn().mockRejectedValueOnce(new Error('LLM fail'));
            const job = { id: 'job-1', status: 'pending', total_items: 1 };
            const item = { id: 'item-1', file_name: 'cv.pdf' };

            getPendingJobs.mockResolvedValueOnce([job]).mockResolvedValue([]);
            getPendingItems.mockResolvedValueOnce([item]);
            isJobComplete.mockResolvedValueOnce(true);

            startWorker(processItem);
            await new Promise(r => setTimeout(r, 250));
            stopWorker();

            expect(updateJobItemStatus).toHaveBeenCalledWith('item-1', 'error', expect.objectContaining({ error_message: 'LLM fail' }));
        });

        it('should complete job with no pending items', async () => {
            const processItem = vi.fn();
            const job = { id: 'job-1', status: 'pending', total_items: 0 };

            getPendingJobs.mockResolvedValueOnce([job]).mockResolvedValue([]);
            getPendingItems.mockResolvedValueOnce([]);
            isJobComplete.mockResolvedValueOnce(true);

            startWorker(processItem);
            await new Promise(r => setTimeout(r, 250));
            stopWorker();

            expect(updateJobCounters).toHaveBeenCalledWith('job-1');
            expect(updateJobStatus).toHaveBeenLastCalledWith('job-1', 'completed', expect.objectContaining({ processed_items: 0, success_count: 0, error_count: 0 }));
        });
    });
});
