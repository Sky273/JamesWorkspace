/**
 * Batch Jobs Schema
 * Database table initialization and migrations for batch jobs
 */

import { safeLog } from '../../utils/logger.backend.js';
import { assertSchemaRequirements } from '../schemaVerification.service.js';

/**
 * Verify the batch jobs schema is present
 */
export async function initializeBatchJobsTable() {
    try {
        await assertSchemaRequirements({
            context: 'batch jobs',
            tables: ['batch_jobs', 'batch_job_items', 'resumes'],
            columns: {
                batch_jobs: ['export_file_path', 'export_file_name'],
                batch_job_items: ['relative_path', 'original_name', 'display_name', 'pending_data', 'source_type', 'adaptation_id'],
                resumes: ['relative_path']
            },
            indexes: [
                'idx_batch_jobs_status',
                'idx_batch_jobs_firm_id',
                'idx_batch_jobs_user_id',
                'idx_batch_job_items_job_id',
                'idx_batch_job_items_status'
            ]
        });

        safeLog('info', 'Batch jobs schema verified');
        return true;
    } catch (error) {
        safeLog('error', 'Failed to verify batch jobs schema', { error: error.message });
        throw error;
    }
}

