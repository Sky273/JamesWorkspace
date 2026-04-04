/**
 * Batch Jobs Constants
 * Status constants and configuration for batch job processing
 */

// Job status constants
export const JOB_STATUS = {
    PENDING: 'pending',
    PROCESSING: 'processing',
    COMPLETED: 'completed',
    FAILED: 'failed',
    CANCELLED: 'cancelled'
};

// Job item status constants
export const ITEM_STATUS = {
    PENDING: 'pending',
    PROCESSING: 'processing',
    PENDING_NAME: 'pending_name',  // Waiting for manual name input (XXX detected)
    SUCCESS: 'success',
    ERROR: 'error',
    SKIPPED: 'skipped'
};

// Collection job types (self-managed, not processed by the batch worker)
export const COLLECTION_JOB_TYPES = [
    'collect-trends',
    'collect-facts',
    'collect-metiers'
];

// Processing configuration
export const BATCH_SIZE = 100; // Fetch up to 100 CVs per worker pass
const parsedWorkerConcurrency = Number.parseInt(process.env.BATCH_WORKER_CONCURRENCY || '', 10);
export const WORKER_EXECUTION_CONCURRENCY = Number.isInteger(parsedWorkerConcurrency) && parsedWorkerConcurrency > 0
    ? Math.min(parsedWorkerConcurrency, BATCH_SIZE)
    : BATCH_SIZE; // Process up to 100 CVs in parallel by default
export const WORKER_INTERVAL = 5000; // Check for pending jobs every 5 seconds
