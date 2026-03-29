/**
 * Tests for Batch Jobs Worker - Worker Lifecycle
 * initializeWorker, startWorker, stopWorker, processNextBatch, processItem
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn()
}));
vi.mock('../../config/database.js', () => ({
    query: vi.fn(() => ({ rows: [
        { table_name: 'batch_jobs' },
        { table_name: 'batch_job_items' }
    ] }))
}));
vi.mock('../../services/batchJobs.service.js', () => ({
    JOB_STATUS: { PENDING: 'pending', PROCESSING: 'processing', COMPLETED: 'completed', FAILED: 'failed' },
    ITEM_STATUS: { PENDING: 'pending', PROCESSING: 'processing', SUCCESS: 'success', ERROR: 'error' },
    getPendingJobs: vi.fn(() => []),
    getPendingItems: vi.fn(() => []),
    updateJobStatus: vi.fn(),
    updateJobItemStatus: vi.fn(),
    updateJobCounters: vi.fn(),
    isJobComplete: vi.fn(() => false),
    getFinalJobOutcome: vi.fn(() => ({
        status: 'completed',
        counters: { processed_items: 0, success_count: 0, error_count: 0 }
    }))
}));
vi.mock('../../services/batchJobsWorker/llmIntegration.js', () => ({
    resetLLMQueue: vi.fn()
}));
vi.mock('../../services/batchJobsWorker/itemProcessors.js', () => ({
    processImportItem: vi.fn(),
    processImproveItem: vi.fn(),
    processAdaptItem: vi.fn()
}));
vi.mock('../../services/batchJobsWorker/exportGenerator.js', () => ({
    generateJobExport: vi.fn()
}));

import {
    initializeWorker,
    startWorker,
    stopWorker
} from '../../services/batchJobsWorker/workerLifecycle.js';

import { query } from '../../config/database.js';
import { getPendingJobs, getPendingItems, updateJobStatus, updateJobItemStatus, updateJobCounters, isJobComplete } from '../../services/batchJobs.service.js';
import { processImportItem, processImproveItem, processAdaptItem } from '../../services/batchJobsWorker/itemProcessors.js';
import { resetLLMQueue } from '../../services/batchJobsWorker/llmIntegration.js';

describe('Batch Jobs Worker - Worker Lifecycle', () => {
    afterEach(async () => {
        await stopWorker();
        vi.clearAllMocks();
    });

    describe('initializeWorker', () => {
        it('should validate batch job tables once and skip if already initialized', async () => {
            await initializeWorker();
            expect(query).toHaveBeenCalled();

            // Second call should be a no-op (isInitialized is persistent module state)
            query.mockClear();
            await initializeWorker();
            expect(query).not.toHaveBeenCalled();
        });
    });

    describe('startWorker / stopWorker', () => {
        it('should start and stop without error', async () => {
            await startWorker();
            await stopWorker();
        });

        it('should not start twice', async () => {
            const { safeLog } = await import('../../utils/logger.backend.js');
            await startWorker();
            await startWorker();
            expect(safeLog).toHaveBeenCalledWith('warn', expect.stringContaining('already running'));
        });

        it('should reset LLM queue on stop', async () => {
            await startWorker();
            await stopWorker();
            expect(resetLLMQueue).toHaveBeenCalled();
        });
    });

    describe('processNextBatch (via worker interval)', () => {
        it('should process import items', async () => {
            const job = { id: 'j1', status: 'pending', job_type: 'import', options: '{}', total_items: 1 };
            const item = { id: 'i1', file_name: 'cv.pdf' };

            getPendingJobs.mockResolvedValueOnce([job]).mockResolvedValue([]);
            getPendingItems.mockResolvedValueOnce([item]);
            isJobComplete.mockResolvedValueOnce(true);

            await startWorker();
            await new Promise(r => setTimeout(r, 6000));
            await stopWorker();

            expect(updateJobStatus).toHaveBeenCalledWith('j1', 'processing');
            expect(processImportItem).toHaveBeenCalledWith(item, job, {});
            expect(updateJobItemStatus).toHaveBeenCalledWith('i1', 'success', { progress: 100 });
        }, 10000);

        it('should process adapt items', async () => {
            const job = { id: 'j-adapt', status: 'pending', job_type: 'adapt', options: '{"missionId":"m1"}', total_items: 1 };
            const item = { id: 'i-adapt', file_name: 'cv.pdf', resume_id: 'r1' };

            getPendingJobs.mockResolvedValueOnce([job]).mockResolvedValue([]);
            getPendingItems.mockResolvedValueOnce([item]);
            isJobComplete.mockResolvedValueOnce(true);

            await startWorker();
            await new Promise(r => setTimeout(r, 6000));
            await stopWorker();

            expect(processAdaptItem).toHaveBeenCalledWith(item, job, { missionId: 'm1' });
        }, 10000);

        it('should process improve items', async () => {
            const job = { id: 'j2', status: 'pending', job_type: 'improve', options: '{}', total_items: 1 };
            const item = { id: 'i2', file_name: 'cv.pdf' };

            getPendingJobs.mockResolvedValueOnce([job]).mockResolvedValue([]);
            getPendingItems.mockResolvedValueOnce([item]);
            isJobComplete.mockResolvedValueOnce(true);

            await startWorker();
            await new Promise(r => setTimeout(r, 6000));
            await stopWorker();

            expect(processImproveItem).toHaveBeenCalledWith(item, job, {});
        }, 10000);

        it('should mark item as error on processing failure', async () => {
            const job = { id: 'j3', status: 'pending', job_type: 'import', options: '{}', total_items: 1 };
            const item = { id: 'i3', file_name: 'cv.pdf' };

            getPendingJobs.mockResolvedValueOnce([job]).mockResolvedValue([]);
            getPendingItems.mockResolvedValueOnce([item]);
            processImportItem.mockRejectedValueOnce(new Error('LLM error'));
            isJobComplete.mockResolvedValueOnce(true);

            await startWorker();
            await new Promise(r => setTimeout(r, 6000));
            await stopWorker();

            expect(updateJobItemStatus).toHaveBeenCalledWith('i3', 'error', expect.objectContaining({ error_message: 'LLM error' }));
        }, 10000);

        it('should complete job when no pending items remain', async () => {
            const job = { id: 'j4', status: 'processing', job_type: 'import', options: '{}', total_items: 0 };

            getPendingJobs.mockResolvedValueOnce([job]).mockResolvedValue([]);
            getPendingItems.mockResolvedValueOnce([]);
            isJobComplete.mockResolvedValueOnce(true);

            await startWorker();
            await new Promise(r => setTimeout(r, 6000));
            await stopWorker();

            expect(updateJobCounters).toHaveBeenCalledWith('j4');
            expect(updateJobStatus).toHaveBeenLastCalledWith('j4', 'completed', expect.objectContaining({ processed_items: 0, success_count: 0, error_count: 0 }));
        }, 10000);

        it('should handle unknown job type with error', async () => {
            const job = { id: 'j5', status: 'pending', job_type: 'unknown', options: '{}', total_items: 1 };
            const item = { id: 'i5', file_name: 'cv.pdf' };

            getPendingJobs.mockResolvedValueOnce([job]).mockResolvedValue([]);
            getPendingItems.mockResolvedValueOnce([item]);
            isJobComplete.mockResolvedValueOnce(true);

            await startWorker();
            await new Promise(r => setTimeout(r, 6000));
            await stopWorker();

            expect(updateJobItemStatus).toHaveBeenCalledWith('i5', 'error', expect.objectContaining({ error_message: expect.stringContaining('Unknown job type') }));
        }, 10000);
    });
});
