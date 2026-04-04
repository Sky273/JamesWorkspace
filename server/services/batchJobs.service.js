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

import { query } from '../config/database.js';

// Constants
export { JOB_STATUS, ITEM_STATUS, COLLECTION_JOB_TYPES } from './batchJobs/constants.js';

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
    updateCollectionJobProgress,
    updateJobExportFile,
    clearJobExportFile,
    isJobComplete,
    getFinalJobOutcome
} from './batchJobs/jobCrud.js';

// Item CRUD
export {
    addJobItems,
    addJobItemsFromUploadedFiles,
    addJobResumeIds,
    addJobTaskItems,
    addJobExportItems,
    getJobItems,
    updateJobItemStatus,
    getJobItem,
    resumeItemWithName,
    getItemsPendingName,
    getPendingItems,
    getJobItemFilePayload,
    clearJobItemFileData
} from './batchJobs/itemCrud.js';

// Worker
export { startWorker, stopWorker } from './batchJobs/worker.js';

// Maintenance
export { cleanupOldJobs, cleanupJobExportArtifacts, getBatchJobsStats } from './batchJobs/maintenance.js';

/**
 * Get deal info for export validation
 * @param {string} dealId
 * @returns {Promise<Object|null>}
 */
export async function getDealForExport(dealId) {
    const result = await query(
        'SELECT id, title, firm_id FROM deals WHERE id = $1',
        [dealId]
    );
    return result.rows.length > 0 ? result.rows[0] : null;
}

/**
 * Get resumes linked to a deal (with relative path fallback)
 * @param {string} dealId
 * @returns {Promise<Array>}
 */
export async function getResumesForDeal(dealId) {
    const result = await query(`
        SELECT r.id, r.name, r.title, r.file_name as source_file_name,
               COALESCE(r.relative_path, latest_item.relative_path) as relative_path
        FROM resumes r
        INNER JOIN deal_resumes dr ON r.id = dr.resume_id
        LEFT JOIN LATERAL (
            SELECT bji.relative_path
            FROM batch_job_items bji
            INNER JOIN batch_jobs bj ON bj.id = bji.job_id
            WHERE bji.relative_path IS NOT NULL
              AND bj.job_type = 'import'
              AND (
                  bji.resume_id = r.id
                  OR (
                      bji.resume_id IS NULL
                      AND r.file_name IS NOT NULL
                      AND bji.file_name = r.file_name
                      AND bj.firm_id = r.firm_id
                  )
              )
            ORDER BY
                CASE WHEN bji.resume_id = r.id THEN 0 ELSE 1 END,
                bji.created_at DESC
            LIMIT 1
        ) latest_item ON TRUE
        WHERE dr.deal_id = $1
        ORDER BY LOWER(r.name) ASC
    `, [dealId]);
    return result.rows;
}

/**
 * Get adaptations linked to missions of a deal (with relative path fallback)
 * @param {string} dealId
 * @returns {Promise<Array>}
 */
export async function getAdaptationsForDeal(dealId) {
    const result = await query(`
        SELECT ra.id, ra.resume_id, ra.candidate_name, ra.adapted_title, ra.mission_title,
               COALESCE(r.relative_path, latest_item.relative_path) as relative_path,
               m.title as mission_name,
               r.file_name as source_file_name
        FROM resume_adaptations ra
        INNER JOIN missions m ON ra.mission_id = m.id
        INNER JOIN resumes r ON r.id = ra.resume_id
        LEFT JOIN LATERAL (
            SELECT bji.relative_path
            FROM batch_job_items bji
            INNER JOIN batch_jobs bj ON bj.id = bji.job_id
            WHERE bji.relative_path IS NOT NULL
              AND bj.job_type = 'import'
              AND (
                  bji.resume_id = ra.resume_id
                  OR (
                      bji.resume_id IS NULL
                      AND r.file_name IS NOT NULL
                      AND bji.file_name = r.file_name
                      AND bj.firm_id = r.firm_id
                  )
              )
            ORDER BY
                CASE WHEN bji.resume_id = ra.resume_id THEN 0 ELSE 1 END,
                bji.created_at DESC
            LIMIT 1
        ) latest_item ON TRUE
        WHERE m.deal_id = $1
        ORDER BY m.title ASC, ra.candidate_name ASC
    `, [dealId]);
    return result.rows;
}
