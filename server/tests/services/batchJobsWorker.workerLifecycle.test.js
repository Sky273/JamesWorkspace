/**
 * Tests for Batch Jobs Worker - Worker Lifecycle
 * initializeWorker, startWorker, stopWorker, processNextBatch, processItem
 */

import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn()
}));
vi.mock('../../config/database.js', () => ({
    query: vi.fn(() => ({ rows: [
        { table_name: 'batch_jobs' },
        { table_name: 'batch_job_items' }
    ] }))
}));
vi.mock('../../services/batchJobs/constants.js', () => ({
    JOB_STATUS: { PENDING: 'pending', PROCESSING: 'processing', COMPLETED: 'completed', FAILED: 'failed', CANCELLED: 'cancelled' },
    ITEM_STATUS: { PENDING: 'pending', PROCESSING: 'processing', SUCCESS: 'success', ERROR: 'error' },
    BATCH_SIZE: 100,
    WORKER_EXECUTION_CONCURRENCY: 2,
    WORKER_INTERVAL: 10
}));
vi.mock('../../services/batchJobs/jobCrud.js', () => ({
    getPendingJobs: vi.fn(() => []),
    getJobStatus: vi.fn(() => 'processing'),
    updateJobStatus: vi.fn(),
    updateJobCounters: vi.fn(),
    isJobComplete: vi.fn(() => false),
    getFinalJobOutcome: vi.fn(() => ({
        status: 'completed',
        counters: { processed_items: 0, success_count: 0, error_count: 0 }
    }))
}));
vi.mock('../../services/batchJobs/itemCrud.js', () => ({
    claimPendingItems: vi.fn(() => []),
    updateJobItemStatus: vi.fn()
}));
vi.mock('../../services/batchJobsWorker/llmIntegration.js', () => ({
    resetLLMQueue: vi.fn()
}));
vi.mock('../../services/batchJobsWorker/itemProcessors.js', () => ({
    processImportItem: vi.fn(),
    processImproveItem: vi.fn(),
    processAdaptItem: vi.fn(),
    processMatchItem: vi.fn(),
    processProfileSearchItem: vi.fn(),
    processProfileAnalysisItem: vi.fn()
}));
vi.mock('../../services/batchJobsWorker/exportGenerator.js', () => ({
    generateJobExport: vi.fn()
}));

import {
    initializeWorker,
    startWorker,
    stopWorker,
    _internal
} from '../../services/batchJobsWorker/workerLifecycle.js';

import { query } from '../../config/database.js';
import { getPendingJobs, getJobStatus, updateJobStatus, updateJobCounters, isJobComplete } from '../../services/batchJobs/jobCrud.js';
import { claimPendingItems, updateJobItemStatus } from '../../services/batchJobs/itemCrud.js';
import { processImportItem, processImproveItem, processAdaptItem, processMatchItem } from '../../services/batchJobsWorker/itemProcessors.js';
import { resetLLMQueue } from '../../services/batchJobsWorker/llmIntegration.js';
import { safeLog } from '../../utils/logger.backend.js';

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

        it('should refuse restart while timed-out shutdown is still draining active items', async () => {
            vi.useFakeTimers();
            try {
                const { safeLog } = await import('../../utils/logger.backend.js');
                const job = { id: 'j-drain', status: 'pending', job_type: 'import', options: '{}', total_items: 1 };
                const item = { id: 'i-drain', file_name: 'cv.pdf' };
                let resolveProcessing;

                getPendingJobs.mockResolvedValueOnce([job]).mockResolvedValue([]);
                claimPendingItems.mockResolvedValueOnce([item]);
                isJobComplete.mockResolvedValue(false);
                processImportItem.mockImplementationOnce(() => new Promise((resolve) => {
                    resolveProcessing = resolve;
                }));

                await startWorker();
                await vi.advanceTimersByTimeAsync(5000);

                const stopPromise = stopWorker();
                await vi.advanceTimersByTimeAsync(30000);
                await stopPromise;

                await startWorker();

                expect(safeLog).toHaveBeenCalledWith('warn', expect.stringContaining('cannot restart while previous processing is still draining'), expect.objectContaining({
                    activeProcessingCount: 1
                }));

                resolveProcessing();
                await vi.runAllTimersAsync();
            } finally {
                vi.useRealTimers();
            }
        }, 20000);
    });

    describe('processNextBatch (via worker interval)', () => {
        it('should process import items', async () => {
            const job = { id: 'j1', status: 'pending', job_type: 'import', options: '{}', total_items: 1 };
            const item = { id: 'i1', file_name: 'cv.pdf' };

            getPendingJobs.mockResolvedValueOnce([job]).mockResolvedValue([]);
            claimPendingItems.mockResolvedValueOnce([item]);
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
            claimPendingItems.mockResolvedValueOnce([item]);
            isJobComplete.mockResolvedValueOnce(true);

            await startWorker();
            await new Promise(r => setTimeout(r, 6000));
            await stopWorker();

            expect(processAdaptItem).toHaveBeenCalledWith(item, job, { missionId: 'm1' });
        }, 10000);

        it('should process match items', async () => {
            const job = { id: 'j-match', status: 'pending', job_type: 'match', options: '{"missionId":"m1"}', total_items: 1 };
            const item = { id: 'i-match', file_name: 'cv.pdf', resume_id: 'r1' };

            getPendingJobs.mockResolvedValueOnce([job]).mockResolvedValue([]);
            claimPendingItems.mockResolvedValueOnce([item]);
            isJobComplete.mockResolvedValueOnce(true);

            await startWorker();
            await new Promise(r => setTimeout(r, 6000));
            await stopWorker();

            expect(processMatchItem).toHaveBeenCalledWith(item, job, { missionId: 'm1' });
        }, 10000);

        it('should process improve items', async () => {
            const job = { id: 'j2', status: 'pending', job_type: 'improve', options: '{}', total_items: 1 };
            const item = { id: 'i2', file_name: 'cv.pdf' };

            getPendingJobs.mockResolvedValueOnce([job]).mockResolvedValue([]);
            claimPendingItems.mockResolvedValueOnce([item]);
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
            claimPendingItems.mockResolvedValueOnce([item]);
            processImportItem.mockRejectedValueOnce(new Error('LLM error'));
            isJobComplete.mockResolvedValueOnce(true);

            await startWorker();
            await new Promise(r => setTimeout(r, 6000));
            await stopWorker();

            expect(updateJobItemStatus).toHaveBeenCalledWith('i3', 'error', expect.objectContaining({ error_message: 'LLM error' }));
        }, 10000);

        it('should fail the job cleanly when job options JSON is invalid', async () => {
            const job = { id: 'j-invalid-options', status: 'pending', job_type: 'import', options: '{invalid-json', total_items: 1 };
            const item = { id: 'i-invalid-options', file_name: 'cv.pdf' };

            getPendingJobs.mockResolvedValueOnce([job]).mockResolvedValue([]);
            claimPendingItems.mockResolvedValueOnce([item]);

            await startWorker();
            await new Promise(r => setTimeout(r, 6000));
            await stopWorker();

            expect(processImportItem).not.toHaveBeenCalled();
            expect(updateJobStatus).toHaveBeenCalledWith('j-invalid-options', 'failed', expect.objectContaining({
                error_message: expect.stringContaining('Invalid job options JSON')
            }));
        }, 10000);

        it('should complete job when no pending items remain', async () => {
            const job = { id: 'j4', status: 'processing', job_type: 'import', options: '{}', total_items: 0 };

            getPendingJobs.mockResolvedValueOnce([job]).mockResolvedValue([]);
            claimPendingItems.mockResolvedValueOnce([]);
            isJobComplete.mockResolvedValueOnce(true);
            getJobStatus.mockResolvedValueOnce('processing');

            await startWorker();
            await new Promise(r => setTimeout(r, 6000));
            await stopWorker();

            expect(updateJobCounters).toHaveBeenCalledWith('j4');
            expect(updateJobStatus).toHaveBeenLastCalledWith('j4', 'completed', expect.objectContaining({ processed_items: 0, success_count: 0, error_count: 0 }));
            expect(safeLog).toHaveBeenCalledWith('info', 'Batch job completed', expect.objectContaining({
                jobId: 'j4',
                jobType: 'import',
                totalItems: 0,
                exportRequested: false
            }));
        }, 10000);

        it('should preserve cancelled status when a job completes after cancellation', async () => {
            const job = { id: 'j-cancelled', status: 'processing', job_type: 'import', options: '{}', total_items: 0 };

            getPendingJobs.mockResolvedValueOnce([job]).mockResolvedValue([]);
            claimPendingItems.mockResolvedValueOnce([]);
            isJobComplete.mockResolvedValueOnce(true);
            getJobStatus.mockResolvedValueOnce('cancelled');

            await startWorker();
            await new Promise(r => setTimeout(r, 6000));
            await stopWorker();

            expect(updateJobCounters).toHaveBeenCalledWith('j-cancelled');
            expect(updateJobStatus).not.toHaveBeenCalledWith('j-cancelled', 'completed', expect.anything());
            expect(updateJobStatus).not.toHaveBeenCalledWith('j-cancelled', 'failed', expect.anything());
        }, 10000);

        it('should mark an item as error for an unknown job type', async () => {
            const job = { id: 'j5', status: 'pending', job_type: 'unknown', options: '{}', total_items: 1 };
            const item = { id: 'i5', file_name: 'cv.pdf' };

            _internal.resetState();
            updateJobItemStatus.mockClear();

            await _internal.processItem(item, job, {});

            expect(updateJobItemStatus).toHaveBeenCalledWith('i5', 'processing', { progress: 10 });
            expect(updateJobItemStatus).toHaveBeenCalledWith(
                'i5',
                'error',
                expect.objectContaining({ error_message: expect.stringContaining('Unknown job type') })
            );
        }, 10000);

        it('should mark an import item as error when processing fails without failing the job directly', async () => {
            const job = { id: 'j-error-cancelled', status: 'processing', job_type: 'import', options: '{}', total_items: 1 };
            const item = { id: 'i-error-cancelled', file_name: 'cv.pdf' };

            _internal.resetState();
            processImportItem.mockRejectedValueOnce(new Error('late failure'));
            updateJobItemStatus.mockClear();
            updateJobStatus.mockClear();

            await _internal.processItem(item, job, {});

            expect(updateJobItemStatus).toHaveBeenCalledWith('i-error-cancelled', 'processing', { progress: 10 });
            expect(updateJobItemStatus).toHaveBeenCalledWith(
                'i-error-cancelled',
                'error',
                expect.objectContaining({ error_message: 'late failure' })
            );
            expect(updateJobStatus).not.toHaveBeenCalled();
        }, 10000);

    });
});
