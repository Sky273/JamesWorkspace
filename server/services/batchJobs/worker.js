/**
 * Batch Jobs - Worker Logic
 * Background worker that processes batch jobs in parallel
 */

import { safeLog } from '../../utils/logger.backend.js';
import { JOB_STATUS, ITEM_STATUS, WORKER_EXECUTION_CONCURRENCY, WORKER_INTERVAL } from './constants.js';
import { getPendingJobs, updateJobStatus, updateJobCounters, isJobComplete, getFinalJobOutcome, getJobStatus } from './jobCrud.js';
import { claimPendingItems, updateJobItemStatus } from './itemCrud.js';

// Worker state
let workerInterval = null;
let isWorkerRunning = false;

async function processPendingItemsWithLimit(items, job, processItemFn, concurrency) {
    const effectiveConcurrency = Math.max(1, Math.min(concurrency, items.length || 1));
    let nextIndex = 0;

    const workers = Array.from({ length: effectiveConcurrency }, async () => {
        while (nextIndex < items.length) {
            const currentIndex = nextIndex++;
            const item = items[currentIndex];

            try {
                await updateJobItemStatus(item.id, ITEM_STATUS.PROCESSING);
                await processItemFn(item, job);
                await updateJobItemStatus(item.id, ITEM_STATUS.SUCCESS, { progress: 100 });
            } catch (error) {
                safeLog('error', 'Failed to process batch item', {
                    itemId: item.id,
                    error: error.message
                });
                await updateJobItemStatus(item.id, ITEM_STATUS.ERROR, {
                    error_message: error.message
                });
            }
        }
    });

    await Promise.all(workers);
}

/**
 * Start the background worker
 * @param {Function} processItemFn - Function to process a single item
 */
export function startWorker(processItemFn) {
    if (workerInterval) {
        safeLog('warn', 'Batch jobs worker already running');
        return;
    }

    safeLog('info', 'Starting batch jobs worker');

    workerInterval = setInterval(async () => {
        if (isWorkerRunning) return;

        try {
            isWorkerRunning = true;
            await processNextBatch(processItemFn);
        } catch (error) {
            safeLog('error', 'Batch jobs worker error', { error: error.message });
        } finally {
            isWorkerRunning = false;
        }
    }, WORKER_INTERVAL);
}

/**
 * Stop the background worker
 */
export function stopWorker() {
    if (workerInterval) {
        clearInterval(workerInterval);
        workerInterval = null;
        safeLog('info', 'Batch jobs worker stopped');
    }
}

/**
 * Process the next batch of items
 * @param {Function} processItemFn - Function to process a single item
 */
async function processNextBatch(processItemFn) {
    // Get pending jobs
    const pendingJobs = await getPendingJobs();

    for (const job of pendingJobs) {
        const currentStatus = await getJobStatus(job.id);
        if (currentStatus !== JOB_STATUS.PROCESSING) {
            continue;
        }

        // Get pending items
        const pendingItems = await claimPendingItems(job.id);

        if (pendingItems.length === 0) {
            // No more items, check if job is complete
            if (await isJobComplete(job.id)) {
                await updateJobCounters(job.id);
                const outcome = await getFinalJobOutcome(job.id);
                const latestStatus = await getJobStatus(job.id);
                if (latestStatus === JOB_STATUS.CANCELLED) {
                    safeLog('info', 'Batch job remained cancelled after processing cycle', { jobId: job.id });
                    continue;
                }
                await updateJobStatus(job.id, outcome.status, {
                    processed_items: outcome.counters.processed_items,
                    success_count: outcome.counters.success_count,
                    error_count: outcome.counters.error_count,
                    ...(outcome.status === JOB_STATUS.FAILED ? { error_message: 'One or more batch items failed' } : {})
                });
                safeLog('info', outcome.status === JOB_STATUS.FAILED ? 'Batch job failed with item errors' : 'Batch job completed', {
                    jobId: job.id,
                    ...outcome.counters
                });
            }
            continue;
        }

        // Process items in parallel
        safeLog('info', 'Processing batch', { jobId: job.id, itemCount: pendingItems.length });

        await processPendingItemsWithLimit(pendingItems, job, processItemFn, WORKER_EXECUTION_CONCURRENCY);

        // Update counters
        await updateJobCounters(job.id);

        // Check if job is complete
        if (await isJobComplete(job.id)) {
            const outcome = await getFinalJobOutcome(job.id);
            const latestStatus = await getJobStatus(job.id);
            if (latestStatus === JOB_STATUS.CANCELLED) {
                safeLog('info', 'Batch job remained cancelled after processing cycle', { jobId: job.id });
                continue;
            }
            await updateJobStatus(job.id, outcome.status, {
                processed_items: outcome.counters.processed_items,
                success_count: outcome.counters.success_count,
                error_count: outcome.counters.error_count,
                ...(outcome.status === JOB_STATUS.FAILED ? { error_message: 'One or more batch items failed' } : {})
            });
            safeLog('info', outcome.status === JOB_STATUS.FAILED ? 'Batch job failed with item errors' : 'Batch job completed', {
                jobId: job.id,
                ...outcome.counters
            });
        }
    }
}
