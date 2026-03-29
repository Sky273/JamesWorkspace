/**
 * Batch Jobs Worker - Lifecycle Management
 * Worker state, initialization, start/stop, batch processing loop
 */

import { safeLog } from '../../utils/logger.backend.js';
import { query } from '../../config/database.js';
import {
    JOB_STATUS,
    ITEM_STATUS,
    getPendingJobs,
    getPendingItems,
    updateJobStatus,
    updateJobItemStatus,
    updateJobCounters,
    isJobComplete,
    getFinalJobOutcome
} from '../batchJobs.service.js';
import { resetLLMQueue } from './llmIntegration.js';
import { processImportItem, processImproveItem, processAdaptItem, processMatchItem, processProfileSearchItem, processProfileAnalysisItem } from './itemProcessors.js';
import { generateJobExport } from './exportGenerator.js';

// Worker configuration
const WORKER_INTERVAL = 5000; // Check for pending jobs every 5 seconds
const BATCH_SIZE = 100; // Process up to 100 items in parallel
const SHUTDOWN_TIMEOUT = 30000; // Max wait time for graceful shutdown (30s)

// Worker state
let workerInterval = null;
let isWorkerRunning = false;
let isInitialized = false;
let isShuttingDown = false;
let activeProcessingCount = 0;

const REQUIRED_BATCH_TABLES = ['batch_jobs', 'batch_job_items'];

async function ensureBatchJobsSchemaReady() {
    const result = await query(
        `
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_name = ANY($1::text[])
        `,
        [REQUIRED_BATCH_TABLES]
    );

    const existingTables = result.rows.map(row => row.table_name);
    const missingTables = REQUIRED_BATCH_TABLES.filter(tableName => !existingTables.includes(tableName));

    if (missingTables.length > 0) {
        throw new Error(`Batch jobs schema is missing required tables: ${missingTables.join(', ')}. Run npm run docker-migrate before starting the worker.`);
    }
}

/**
 * Initialize the worker
 */
export async function initializeWorker() {
    if (isInitialized) return;

    try {
        await ensureBatchJobsSchemaReady();
        isInitialized = true;
        safeLog('info', 'Batch jobs worker initialized');
    } catch (error) {
        safeLog('error', 'Failed to initialize batch jobs worker', { error: error.message });
        throw error;
    }
}

/**
 * Start the background worker
 */
export async function startWorker() {
    if (workerInterval) {
        safeLog('warn', 'Batch jobs worker already running');
        return;
    }

    isShuttingDown = false;
    safeLog('info', 'Starting batch jobs worker', { interval: WORKER_INTERVAL, batchSize: BATCH_SIZE });
    
    // Log all existing jobs for debugging
    try {
        const allJobsResult = await query(`SELECT id, status, total_items, processed_items, created_at FROM batch_jobs ORDER BY created_at DESC LIMIT 10`);
        if (allJobsResult.rows.length > 0) {
            safeLog('info', 'Existing batch jobs', { jobs: allJobsResult.rows.map(j => ({ id: j.id, status: j.status, total: j.total_items, processed: j.processed_items })) });
        }
    } catch (e) {
        safeLog('debug', 'Could not fetch existing jobs', { error: e.message });
    }

    workerInterval = setInterval(async () => {
        if (isWorkerRunning || isShuttingDown) return;

        try {
            isWorkerRunning = true;
            await processNextBatch();
        } catch (error) {
            safeLog('error', 'Batch jobs worker error', { error: error.message });
        } finally {
            isWorkerRunning = false;
        }
    }, WORKER_INTERVAL);
}

/**
 * Stop the background worker gracefully
 * Waits for active processing to complete before stopping
 * @returns {Promise<void>}
 */
export async function stopWorker() {
    if (!workerInterval && !isWorkerRunning) {
        safeLog('info', 'Batch jobs worker already stopped');
        return;
    }

    safeLog('info', 'Stopping batch jobs worker...', { activeProcessing: activeProcessingCount });
    isShuttingDown = true;

    // Stop the interval immediately to prevent new batches
    if (workerInterval) {
        clearInterval(workerInterval);
        workerInterval = null;
    }

    // Wait for active processing to complete
    if (activeProcessingCount > 0 || isWorkerRunning) {
        safeLog('info', 'Waiting for active batch processing to complete...', { activeProcessingCount });
        
        const startTime = Date.now();
        
        await new Promise((resolve) => {
            const checkInterval = setInterval(() => {
                const elapsed = Date.now() - startTime;
                
                if (activeProcessingCount === 0 && !isWorkerRunning) {
                    clearInterval(checkInterval);
                    safeLog('info', 'All batch processing completed');
                    resolve();
                } else if (elapsed >= SHUTDOWN_TIMEOUT) {
                    clearInterval(checkInterval);
                    safeLog('warn', 'Shutdown timeout reached, forcing stop', { 
                        activeProcessingCount, 
                        isWorkerRunning,
                        elapsed 
                    });
                    resolve();
                } else {
                    safeLog('debug', 'Still waiting for batch processing...', { 
                        activeProcessingCount, 
                        isWorkerRunning,
                        elapsed 
                    });
                }
            }, 500);
        });
    }

    isWorkerRunning = false;
    activeProcessingCount = 0;
    
    // Reset LLM queue to prevent stuck requests
    resetLLMQueue();
    
    safeLog('info', 'Batch jobs worker stopped');
}

/**
 * Process the next batch of items
 */
async function processNextBatch() {
    // Get pending jobs
    const pendingJobs = await getPendingJobs();
    
    if (pendingJobs.length > 0) {
        safeLog('debug', 'Found jobs to process', { count: pendingJobs.length, jobIds: pendingJobs.map(j => j.id) });
    }

    for (const job of pendingJobs) {
        try {
            safeLog('debug', 'Processing job', { jobId: job.id, status: job.status, totalItems: job.total_items });
            
            // Mark job as processing if not already
            if (job.status === JOB_STATUS.PENDING) {
                await updateJobStatus(job.id, JOB_STATUS.PROCESSING);
            }

            // Get pending items
            const pendingItems = await getPendingItems(job.id);
            safeLog('debug', 'Got pending items', { jobId: job.id, pendingItemsCount: pendingItems.length });

            if (pendingItems.length === 0) {
                // No more items, check if job is complete
                const isComplete = await isJobComplete(job.id);
                safeLog('debug', 'No pending items, checking completion', { jobId: job.id, isComplete });
                
                if (isComplete) {
                    await updateJobCounters(job.id);
                    
                    // Generate export ZIP if export was requested
                    const options = typeof job.options === 'string' ? JSON.parse(job.options) : (job.options || {});
                    if (options.export && options.templateId) {
                        await generateJobExport(job.id, options);
                        await updateJobCounters(job.id);
                    }
                    
                    const outcome = await getFinalJobOutcome(job.id);
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
            safeLog('info', 'Processing batch', { 
                jobId: job.id, 
                jobType: job.job_type,
                itemCount: pendingItems.length 
            });

            const promises = pendingItems.map(item => processItem(item, job));
            await Promise.all(promises);

            // Update counters after batch
            await updateJobCounters(job.id);

            // Check if job is complete
            if (await isJobComplete(job.id)) {
                // Generate export ZIP if export was requested
                const options = typeof job.options === 'string' ? JSON.parse(job.options) : (job.options || {});
                if (options.export && options.templateId) {
                    await generateJobExport(job.id, options);
                    await updateJobCounters(job.id);
                }
                
                const outcome = await getFinalJobOutcome(job.id);
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
        } catch (error) {
            safeLog('error', 'Error processing job', { jobId: job.id, error: error.message });
            await updateJobStatus(job.id, JOB_STATUS.FAILED, { error_message: error.message });
        }
    }
}

/**
 * Process a single item
 * @param {Object} item - The job item to process
 * @param {Object} job - The parent job
 */
async function processItem(item, job) {
    // Check if shutdown is in progress
    if (isShuttingDown) {
        safeLog('debug', 'Skipping item processing due to shutdown', { itemId: item.id });
        return;
    }

    activeProcessingCount++;
    
    try {
        await updateJobItemStatus(item.id, ITEM_STATUS.PROCESSING, { progress: 10 });

        const options = typeof job.options === 'string' ? JSON.parse(job.options) : (job.options || {});

        if (job.job_type === 'import') {
            await processImportItem(item, job, options);
        } else if (job.job_type === 'improve') {
            await processImproveItem(item, job, options);
        } else if (job.job_type === 'match') {
            await processMatchItem(item, job, options);
        } else if (job.job_type === 'adapt') {
            await processAdaptItem(item, job, options);
        } else if (job.job_type === 'profile-search') {
            await processProfileSearchItem(item, job, options);
        } else if (job.job_type === 'profile-analysis') {
            await processProfileAnalysisItem(item, job, options);
        } else if (job.job_type === 'deal-export') {
            // Deal-export items don't need individual processing - 
            // the actual export happens in generateJobExport when the job completes
            await updateJobItemStatus(item.id, ITEM_STATUS.PROCESSING, { progress: 50 });
        } else {
            throw new Error(`Unknown job type: ${job.job_type}`);
        }

        await updateJobItemStatus(item.id, ITEM_STATUS.SUCCESS, { progress: 100 });
        safeLog('debug', 'Item processed successfully', { itemId: item.id, fileName: item.file_name });

    } catch (error) {
        safeLog('error', 'Failed to process item', { 
            itemId: item.id, 
            fileName: item.file_name,
            error: error.message 
        });
        await updateJobItemStatus(item.id, ITEM_STATUS.ERROR, { 
            error_message: error.message 
        });
    } finally {
        activeProcessingCount--;
    }
}
