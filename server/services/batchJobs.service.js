/**
 * Batch Jobs Service
 * Re-exports all batch job functionality from modular sub-modules.
 * 
 * Structure:
 * - ./batchJobs/constants.js     : Status constants and configuration
 * - ./batchJobs/schema.js        : Database table initialization
 * - ./batchJobs/jobCrud.js       : Job CRUD operations
 * - ./batchJobs/itemCrud.js      : Item CRUD operations
 * - ./batchJobs/worker.js        : Background worker logic
 * - ./batchJobs/maintenance.js   : Cleanup and statistics
 */

// Constants
export { JOB_STATUS, ITEM_STATUS } from './batchJobs/constants.js';

// Schema
export { initializeBatchJobsTable } from './batchJobs/schema.js';

// Job CRUD
export {
    createJob,
    getJob,
    getJobsByFirm,
    getAllJobs,
    updateJobStatus,
    cancelJob,
    deleteJob,
    getPendingJobs,
    updateJobCounters,
    updateJobExportFile,
    isJobComplete
} from './batchJobs/jobCrud.js';

// Item CRUD
export {
    addJobItems,
    addJobResumeIds,
    addJobExportItems,
    getJobItems,
    updateJobItemStatus,
    getJobItem,
    resumeItemWithName,
    getItemsPendingName,
    getPendingItems
} from './batchJobs/itemCrud.js';

// Worker
export { startWorker, stopWorker } from './batchJobs/worker.js';

// Maintenance
export { cleanupOldJobs, getBatchJobsStats } from './batchJobs/maintenance.js';

// Default export for backward compatibility
import { JOB_STATUS, ITEM_STATUS } from './batchJobs/constants.js';
import { initializeBatchJobsTable } from './batchJobs/schema.js';
import { createJob, getJob, getJobsByFirm, getAllJobs, updateJobStatus, cancelJob, deleteJob } from './batchJobs/jobCrud.js';
import { addJobItems, addJobResumeIds, addJobExportItems, getJobItems, updateJobItemStatus } from './batchJobs/itemCrud.js';
import { startWorker, stopWorker } from './batchJobs/worker.js';
import { cleanupOldJobs, getBatchJobsStats } from './batchJobs/maintenance.js';

export default {
    JOB_STATUS,
    ITEM_STATUS,
    initializeBatchJobsTable,
    createJob,
    addJobItems,
    addJobResumeIds,
    addJobExportItems,
    getJob,
    getJobItems,
    getJobsByFirm,
    getAllJobs,
    updateJobStatus,
    updateJobItemStatus,
    cancelJob,
    deleteJob,
    startWorker,
    stopWorker,
    cleanupOldJobs,
    getBatchJobsStats
};
