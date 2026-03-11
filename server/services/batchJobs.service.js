/**
 * Batch Jobs Service
 * Manages background batch processing jobs for CV import/improvement
 * Jobs are persisted in database and processed in parallel batches
 */

import { query } from '../config/database.js';
import { safeLog } from '../utils/logger.backend.js';

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
    SUCCESS: 'success',
    ERROR: 'error',
    SKIPPED: 'skipped'
};

// Processing configuration
const BATCH_SIZE = 100; // Process up to 100 CVs in parallel
const WORKER_INTERVAL = 5000; // Check for pending jobs every 5 seconds

// Worker state
let workerInterval = null;
let isWorkerRunning = false;

/**
 * Initialize the batch_jobs table if it doesn't exist
 */
export async function initializeBatchJobsTable() {
    try {
        await query(`
            CREATE TABLE IF NOT EXISTS batch_jobs (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                firm_id UUID REFERENCES firms(id) ON DELETE CASCADE,
                user_id UUID REFERENCES users(id) ON DELETE SET NULL,
                status VARCHAR(20) NOT NULL DEFAULT 'pending',
                job_type VARCHAR(50) NOT NULL DEFAULT 'import',
                options JSONB DEFAULT '{}',
                total_items INTEGER DEFAULT 0,
                processed_items INTEGER DEFAULT 0,
                success_count INTEGER DEFAULT 0,
                error_count INTEGER DEFAULT 0,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                started_at TIMESTAMP WITH TIME ZONE,
                completed_at TIMESTAMP WITH TIME ZONE,
                error_message TEXT,
                export_file_path TEXT,
                export_file_name TEXT
            )
        `);
        
        // Add columns if they don't exist (for existing tables)
        await query(`
            DO $$ 
            BEGIN 
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'batch_jobs' AND column_name = 'export_file_path') THEN
                    ALTER TABLE batch_jobs ADD COLUMN export_file_path TEXT;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'batch_jobs' AND column_name = 'export_file_name') THEN
                    ALTER TABLE batch_jobs ADD COLUMN export_file_name TEXT;
                END IF;
            END $$;
        `);

        await query(`
            CREATE TABLE IF NOT EXISTS batch_job_items (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                job_id UUID REFERENCES batch_jobs(id) ON DELETE CASCADE,
                resume_id UUID REFERENCES resumes(id) ON DELETE SET NULL,
                file_name VARCHAR(255),
                file_data BYTEA,
                file_mime_type VARCHAR(100),
                status VARCHAR(20) NOT NULL DEFAULT 'pending',
                progress INTEGER DEFAULT 0,
                error_message TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                processed_at TIMESTAMP WITH TIME ZONE
            )
        `);

        // Create indexes for performance
        await query(`
            CREATE INDEX IF NOT EXISTS idx_batch_jobs_status ON batch_jobs(status);
            CREATE INDEX IF NOT EXISTS idx_batch_jobs_firm_id ON batch_jobs(firm_id);
            CREATE INDEX IF NOT EXISTS idx_batch_jobs_user_id ON batch_jobs(user_id);
            CREATE INDEX IF NOT EXISTS idx_batch_job_items_job_id ON batch_job_items(job_id);
            CREATE INDEX IF NOT EXISTS idx_batch_job_items_status ON batch_job_items(status);
        `);

        safeLog('info', 'Batch jobs tables initialized');
        return true;
    } catch (error) {
        safeLog('error', 'Failed to initialize batch jobs tables', { error: error.message });
        throw error;
    }
}

/**
 * Create a new batch job
 * @param {Object} params - Job parameters
 * @returns {Promise<Object>} Created job
 */
export async function createJob({ firmId, userId, jobType = 'import', options = {} }) {
    try {
        const result = await query(`
            INSERT INTO batch_jobs (firm_id, user_id, job_type, options, status)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
        `, [firmId, userId, jobType, JSON.stringify(options), JOB_STATUS.PENDING]);

        const job = result.rows[0];
        safeLog('info', 'Batch job created', { jobId: job.id, jobType, firmId });
        return job;
    } catch (error) {
        safeLog('error', 'Failed to create batch job', { error: error.message });
        throw error;
    }
}

/**
 * Add items to a batch job
 * @param {string} jobId - Job ID
 * @param {Array} items - Array of { fileName, fileData, fileMimeType }
 * @returns {Promise<number>} Number of items added
 */
export async function addJobItems(jobId, items) {
    try {
        let addedCount = 0;

        for (const item of items) {
            await query(`
                INSERT INTO batch_job_items (job_id, file_name, file_data, file_mime_type, status)
                VALUES ($1, $2, $3, $4, $5)
            `, [jobId, item.fileName, item.fileData, item.fileMimeType, ITEM_STATUS.PENDING]);
            addedCount++;
        }

        // Update total_items count
        await query(`
            UPDATE batch_jobs 
            SET total_items = (SELECT COUNT(*) FROM batch_job_items WHERE job_id = $1)
            WHERE id = $1
        `, [jobId]);

        safeLog('info', 'Added items to batch job', { jobId, count: addedCount });
        return addedCount;
    } catch (error) {
        safeLog('error', 'Failed to add items to batch job', { error: error.message, jobId });
        throw error;
    }
}

/**
 * Add resume IDs to a batch job (for improvement jobs)
 * @param {string} jobId - Job ID
 * @param {Array<number>} resumeIds - Array of resume IDs
 * @returns {Promise<number>} Number of items added
 */
export async function addJobResumeIds(jobId, resumeIds) {
    try {
        let addedCount = 0;

        for (const resumeId of resumeIds) {
            // Get resume name for display
            const resumeResult = await query(`
                SELECT "Name" FROM resumes WHERE id = $1
            `, [resumeId]);
            
            const fileName = resumeResult.rows[0]?.Name || `Resume ${resumeId}`;

            await query(`
                INSERT INTO batch_job_items (job_id, resume_id, file_name, status)
                VALUES ($1, $2, $3, $4)
            `, [jobId, resumeId, fileName, ITEM_STATUS.PENDING]);
            addedCount++;
        }

        // Update total_items count
        await query(`
            UPDATE batch_jobs 
            SET total_items = (SELECT COUNT(*) FROM batch_job_items WHERE job_id = $1)
            WHERE id = $1
        `, [jobId]);

        safeLog('info', 'Added resume IDs to batch job', { jobId, count: addedCount });
        return addedCount;
    } catch (error) {
        safeLog('error', 'Failed to add resume IDs to batch job', { error: error.message, jobId });
        throw error;
    }
}

/**
 * Get a job by ID
 * @param {string} jobId - Job ID
 * @returns {Promise<Object|null>} Job or null
 */
export async function getJob(jobId) {
    try {
        const result = await query(`
            SELECT bj.*, 
                   u.name as user_name,
                   f.name as firm_name
            FROM batch_jobs bj
            LEFT JOIN users u ON bj.user_id = u.id
            LEFT JOIN firms f ON bj.firm_id = f.id
            WHERE bj.id = $1
        `, [jobId]);

        return result.rows[0] || null;
    } catch (error) {
        safeLog('error', 'Failed to get batch job', { error: error.message, jobId });
        throw error;
    }
}

/**
 * Get job items
 * @param {string} jobId - Job ID
 * @returns {Promise<Array>} Job items
 */
export async function getJobItems(jobId) {
    try {
        const result = await query(`
            SELECT id, job_id, resume_id, file_name, status, progress, error_message, 
                   created_at, processed_at
            FROM batch_job_items
            WHERE job_id = $1
            ORDER BY created_at ASC
        `, [jobId]);

        return result.rows;
    } catch (error) {
        safeLog('error', 'Failed to get batch job items', { error: error.message, jobId });
        throw error;
    }
}

/**
 * Get jobs for a firm
 * @param {number} firmId - Firm ID
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Jobs
 */
export async function getJobsByFirm(firmId, { limit = 50, offset = 0, status = null } = {}) {
    try {
        let queryText = `
            SELECT bj.*, 
                   u.name as user_name
            FROM batch_jobs bj
            LEFT JOIN users u ON bj.user_id = u.id
            WHERE bj.firm_id = $1
        `;
        const params = [firmId];

        if (status) {
            queryText += ` AND bj.status = $${params.length + 1}`;
            params.push(status);
        }

        queryText += ` ORDER BY bj.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);

        const result = await query(queryText, params);
        return result.rows;
    } catch (error) {
        safeLog('error', 'Failed to get batch jobs by firm', { error: error.message, firmId });
        throw error;
    }
}

/**
 * Get all jobs for admin
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Jobs
 */
export async function getAllJobs({ limit = 50, offset = 0, status = null } = {}) {
    try {
        let queryText = `
            SELECT bj.*, 
                   u.name as user_name,
                   f.name as firm_name
            FROM batch_jobs bj
            LEFT JOIN users u ON bj.user_id = u.id
            LEFT JOIN firms f ON bj.firm_id = f.id
            WHERE 1=1
        `;
        const params = [];

        if (status) {
            queryText += ` AND bj.status = $${params.length + 1}`;
            params.push(status);
        }

        queryText += ` ORDER BY bj.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);

        const result = await query(queryText, params);
        return result.rows;
    } catch (error) {
        safeLog('error', 'Failed to get all batch jobs', { error: error.message });
        throw error;
    }
}

/**
 * Update job status
 * @param {string} jobId - Job ID
 * @param {string} status - New status
 * @param {Object} updates - Additional updates
 */
export async function updateJobStatus(jobId, status, updates = {}) {
    try {
        const setClauses = ['status = $2'];
        const params = [jobId, status];
        let paramIndex = 3;

        if (status === JOB_STATUS.PROCESSING && !updates.started_at) {
            setClauses.push(`started_at = NOW()`);
        }

        if (status === JOB_STATUS.COMPLETED || status === JOB_STATUS.FAILED || status === JOB_STATUS.CANCELLED) {
            setClauses.push(`completed_at = NOW()`);
        }

        if (updates.error_message) {
            setClauses.push(`error_message = $${paramIndex}`);
            params.push(updates.error_message);
            paramIndex++;
        }

        if (updates.processed_items !== undefined) {
            setClauses.push(`processed_items = $${paramIndex}`);
            params.push(updates.processed_items);
            paramIndex++;
        }

        if (updates.success_count !== undefined) {
            setClauses.push(`success_count = $${paramIndex}`);
            params.push(updates.success_count);
            paramIndex++;
        }

        if (updates.error_count !== undefined) {
            setClauses.push(`error_count = $${paramIndex}`);
            params.push(updates.error_count);
            paramIndex++;
        }

        await query(`
            UPDATE batch_jobs 
            SET ${setClauses.join(', ')}
            WHERE id = $1
        `, params);

        safeLog('debug', 'Updated batch job status', { jobId, status });
    } catch (error) {
        safeLog('error', 'Failed to update batch job status', { error: error.message, jobId });
        throw error;
    }
}

/**
 * Update job item status
 * @param {string} itemId - Item ID
 * @param {string} status - New status
 * @param {Object} updates - Additional updates
 */
export async function updateJobItemStatus(itemId, status, updates = {}) {
    try {
        const setClauses = ['status = $2'];
        const params = [itemId, status];
        let paramIndex = 3;

        if (status === ITEM_STATUS.SUCCESS || status === ITEM_STATUS.ERROR) {
            setClauses.push(`processed_at = NOW()`);
        }

        if (updates.progress !== undefined) {
            setClauses.push(`progress = $${paramIndex}`);
            params.push(updates.progress);
            paramIndex++;
        }

        if (updates.error_message) {
            setClauses.push(`error_message = $${paramIndex}`);
            params.push(updates.error_message);
            paramIndex++;
        }

        if (updates.resume_id) {
            setClauses.push(`resume_id = $${paramIndex}`);
            params.push(updates.resume_id);
            paramIndex++;
        }

        await query(`
            UPDATE batch_job_items 
            SET ${setClauses.join(', ')}
            WHERE id = $1
        `, params);
    } catch (error) {
        safeLog('error', 'Failed to update batch job item status', { error: error.message, itemId });
        throw error;
    }
}

/**
 * Cancel a job
 * @param {string} jobId - Job ID
 */
export async function cancelJob(jobId) {
    try {
        // Update job status
        await updateJobStatus(jobId, JOB_STATUS.CANCELLED);

        // Mark pending items as skipped
        await query(`
            UPDATE batch_job_items 
            SET status = $1, processed_at = NOW()
            WHERE job_id = $2 AND status = $3
        `, [ITEM_STATUS.SKIPPED, jobId, ITEM_STATUS.PENDING]);

        safeLog('info', 'Batch job cancelled', { jobId });
    } catch (error) {
        safeLog('error', 'Failed to cancel batch job', { error: error.message, jobId });
        throw error;
    }
}

/**
 * Delete a job and its items
 * @param {string} jobId - Job ID
 */
export async function deleteJob(jobId) {
    try {
        // Items are deleted via CASCADE
        await query(`DELETE FROM batch_jobs WHERE id = $1`, [jobId]);
        safeLog('info', 'Batch job deleted', { jobId });
    } catch (error) {
        safeLog('error', 'Failed to delete batch job', { error: error.message, jobId });
        throw error;
    }
}

/**
 * Get pending jobs to process (includes both pending and processing jobs)
 * @returns {Promise<Array>} Pending jobs
 */
export async function getPendingJobs() {
    try {
        const result = await query(`
            SELECT * FROM batch_jobs 
            WHERE status IN ($1, $2)
            ORDER BY created_at ASC
            LIMIT 5
        `, [JOB_STATUS.PENDING, JOB_STATUS.PROCESSING]);

        return result.rows;
    } catch (error) {
        safeLog('error', 'Failed to get pending batch jobs', { error: error.message });
        return [];
    }
}

/**
 * Get pending items for a job (limited to batch size)
 * @param {string} jobId - Job ID
 * @returns {Promise<Array>} Pending items
 */
export async function getPendingItems(jobId) {
    try {
        const result = await query(`
            SELECT * FROM batch_job_items 
            WHERE job_id = $1 AND status = $2
            ORDER BY created_at ASC
            LIMIT $3
        `, [jobId, ITEM_STATUS.PENDING, BATCH_SIZE]);

        return result.rows;
    } catch (error) {
        safeLog('error', 'Failed to get pending batch job items', { error: error.message, jobId });
        return [];
    }
}

/**
 * Update job counters from items
 * @param {string} jobId - Job ID
 */
export async function updateJobCounters(jobId) {
    try {
        await query(`
            UPDATE batch_jobs 
            SET 
                processed_items = (SELECT COUNT(*) FROM batch_job_items WHERE job_id = $1 AND status IN ('success', 'error', 'skipped')),
                success_count = (SELECT COUNT(*) FROM batch_job_items WHERE job_id = $1 AND status = 'success'),
                error_count = (SELECT COUNT(*) FROM batch_job_items WHERE job_id = $1 AND status = 'error')
            WHERE id = $1
        `, [jobId]);
    } catch (error) {
        safeLog('error', 'Failed to update batch job counters', { error: error.message, jobId });
    }
}

/**
 * Update job export file info
 * @param {string} jobId - Job ID
 * @param {string} filePath - Path to the export file
 * @param {string} fileName - Name of the export file
 */
export async function updateJobExportFile(jobId, filePath, fileName) {
    try {
        await query(`
            UPDATE batch_jobs 
            SET export_file_path = $1, export_file_name = $2
            WHERE id = $3
        `, [filePath, fileName, jobId]);
        safeLog('debug', 'Updated batch job export file', { jobId, fileName });
    } catch (error) {
        safeLog('error', 'Failed to update batch job export file', { error: error.message, jobId });
        throw error;
    }
}

/**
 * Check if job is complete
 * @param {string} jobId - Job ID
 * @returns {Promise<boolean>}
 */
export async function isJobComplete(jobId) {
    try {
        const result = await query(`
            SELECT 
                (SELECT COUNT(*) FROM batch_job_items WHERE job_id = $1) as total,
                (SELECT COUNT(*) FROM batch_job_items WHERE job_id = $1 AND status IN ('success', 'error', 'skipped')) as processed
        `, [jobId]);

        const { total, processed } = result.rows[0];
        const totalCount = parseInt(total);
        const processedCount = parseInt(processed);
        
        // Job is not complete if there are no items yet
        if (totalCount === 0) {
            return false;
        }
        
        return totalCount === processedCount;
    } catch (error) {
        safeLog('error', 'Failed to check job completion', { error: error.message, jobId });
        return false;
    }
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
        // Mark job as processing
        await updateJobStatus(job.id, JOB_STATUS.PROCESSING);

        // Get pending items
        const pendingItems = await getPendingItems(job.id);

        if (pendingItems.length === 0) {
            // No more items, check if job is complete
            if (await isJobComplete(job.id)) {
                await updateJobCounters(job.id);
                await updateJobStatus(job.id, JOB_STATUS.COMPLETED);
                safeLog('info', 'Batch job completed', { jobId: job.id });
            }
            continue;
        }

        // Process items in parallel
        safeLog('info', 'Processing batch', { jobId: job.id, itemCount: pendingItems.length });

        const promises = pendingItems.map(async (item) => {
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
        });

        await Promise.all(promises);

        // Update counters
        await updateJobCounters(job.id);

        // Check if job is complete
        if (await isJobComplete(job.id)) {
            await updateJobStatus(job.id, JOB_STATUS.COMPLETED);
            safeLog('info', 'Batch job completed', { jobId: job.id });
        }
    }
}

export default {
    JOB_STATUS,
    ITEM_STATUS,
    initializeBatchJobsTable,
    createJob,
    addJobItems,
    addJobResumeIds,
    getJob,
    getJobItems,
    getJobsByFirm,
    getAllJobs,
    updateJobStatus,
    updateJobItemStatus,
    cancelJob,
    deleteJob,
    startWorker,
    stopWorker
};
