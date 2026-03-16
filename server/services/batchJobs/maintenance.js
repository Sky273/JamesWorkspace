/**
 * Batch Jobs - Maintenance Operations
 * Cleanup old jobs and statistics
 */

import { query } from '../../config/database.js';
import { safeLog } from '../../utils/logger.backend.js';

/**
 * Cleanup old completed/failed jobs and their items
 * Removes jobs older than specified days and clears file_data from processed items
 * @param {number} maxAgeDays - Maximum age in days for completed jobs (default: 7)
 * @returns {Promise<{deletedJobs: number, clearedFileData: number}>}
 */
export async function cleanupOldJobs(maxAgeDays = 7) {
    try {
        // First, clear file_data from all processed items (success/error) to free memory
        // Keep file_data only for pending items that haven't been processed yet
        const clearResult = await query(`
            UPDATE batch_job_items 
            SET file_data = NULL 
            WHERE file_data IS NOT NULL 
            AND status IN ('success', 'error', 'skipped')
        `);
        const clearedFileData = clearResult.rowCount || 0;

        // Delete old completed/failed/cancelled jobs
        const deleteResult = await query(`
            DELETE FROM batch_jobs 
            WHERE status IN ('completed', 'failed', 'cancelled')
            AND completed_at < NOW() - INTERVAL '${maxAgeDays} days'
            RETURNING id
        `);
        const deletedJobs = deleteResult.rowCount || 0;

        if (clearedFileData > 0 || deletedJobs > 0) {
            safeLog('info', 'Batch jobs cleanup completed', { 
                clearedFileData, 
                deletedJobs,
                maxAgeDays 
            });
        }

        return { deletedJobs, clearedFileData };
    } catch (error) {
        safeLog('error', 'Failed to cleanup old batch jobs', { error: error.message });
        return { deletedJobs: 0, clearedFileData: 0 };
    }
}

/**
 * Get batch jobs statistics
 * @returns {Promise<Object>} Statistics about batch jobs
 */
export async function getBatchJobsStats() {
    try {
        const result = await query(`
            SELECT 
                COUNT(*) FILTER (WHERE status = 'pending') as pending_jobs,
                COUNT(*) FILTER (WHERE status = 'processing') as processing_jobs,
                COUNT(*) FILTER (WHERE status = 'completed') as completed_jobs,
                COUNT(*) FILTER (WHERE status = 'failed') as failed_jobs,
                COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_jobs,
                (SELECT COUNT(*) FROM batch_job_items WHERE status = 'pending') as pending_items,
                (SELECT COUNT(*) FROM batch_job_items WHERE file_data IS NOT NULL) as items_with_file_data,
                (SELECT COALESCE(SUM(LENGTH(file_data)), 0) FROM batch_job_items WHERE file_data IS NOT NULL) as total_file_data_bytes
            FROM batch_jobs
        `);

        const stats = result.rows[0];
        return {
            jobs: {
                pending: parseInt(stats.pending_jobs) || 0,
                processing: parseInt(stats.processing_jobs) || 0,
                completed: parseInt(stats.completed_jobs) || 0,
                failed: parseInt(stats.failed_jobs) || 0,
                cancelled: parseInt(stats.cancelled_jobs) || 0
            },
            items: {
                pending: parseInt(stats.pending_items) || 0,
                withFileData: parseInt(stats.items_with_file_data) || 0,
                fileDataSizeMB: Math.round((parseInt(stats.total_file_data_bytes) || 0) / (1024 * 1024) * 100) / 100
            }
        };
    } catch (error) {
        safeLog('error', 'Failed to get batch jobs stats', { error: error.message });
        return null;
    }
}
