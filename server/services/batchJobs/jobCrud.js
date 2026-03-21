/**
 * Batch Jobs - Job CRUD Operations
 * Create, read, update, delete operations for batch jobs
 */

import { query } from '../../config/database.js';
import { safeLog } from '../../utils/logger.backend.js';
import { JOB_STATUS, COLLECTION_JOB_TYPES } from './constants.js';

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
        `, ['skipped', jobId, 'pending']);

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
            SELECT bj.*,
                   u.name as user_name,
                   f.name as firm_name
            FROM batch_jobs bj
            LEFT JOIN users u ON bj.user_id = u.id
            LEFT JOIN firms f ON bj.firm_id = f.id
            WHERE bj.status IN ($1, $2)
            AND bj.job_type NOT IN (${COLLECTION_JOB_TYPES.map((_, i) => `$${i + 3}`).join(', ')})
            ORDER BY bj.created_at ASC
            LIMIT 5
        `, [JOB_STATUS.PENDING, JOB_STATUS.PROCESSING, ...COLLECTION_JOB_TYPES]);

        return result.rows;
    } catch (error) {
        safeLog('error', 'Failed to get pending batch jobs', { error: error.message });
        return [];
    }
}

/**
 * Update collection job progress directly (no batch_job_items)
 * @param {string} jobId - Job ID
 * @param {Object} counters - { total_items, processed_items, success_count, error_count }
 */
export async function updateCollectionJobProgress(jobId, counters) {
    try {
        const setClauses = [];
        const params = [jobId];
        let idx = 2;

        for (const [key, value] of Object.entries(counters)) {
            if (value !== undefined) {
                setClauses.push(`${key} = $${idx}`);
                params.push(value);
                idx++;
            }
        }

        if (setClauses.length === 0) return;

        await query(`UPDATE batch_jobs SET ${setClauses.join(', ')} WHERE id = $1`, params);
    } catch (error) {
        safeLog('error', 'Failed to update collection job progress', { error: error.message, jobId });
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
