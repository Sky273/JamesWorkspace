/**
 * Tests for Batch Jobs - Schema initialization
 * Tests initializeBatchJobsTable
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../config/database.js', () => ({
    query: vi.fn()
}));

vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn()
}));

import { query } from '../../config/database.js';
import { initializeBatchJobsTable } from '../../services/batchJobs/schema.js';

describe('Batch Jobs - Schema', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('initializeBatchJobsTable', () => {
        it('should verify tables, columns, and indexes', async () => {
            query.mockImplementation((sql, params) => {
                if (sql.includes('information_schema.tables')) {
                    expect(params).toEqual([['batch_jobs', 'batch_job_items', 'resumes']]);
                    return Promise.resolve({ rows: [
                        { table_name: 'batch_jobs' },
                        { table_name: 'batch_job_items' },
                        { table_name: 'resumes' }
                    ] });
                }
                if (sql.includes('information_schema.columns')) {
                    if (params[0] === 'batch_jobs') {
                        return Promise.resolve({ rows: [
                            { column_name: 'export_file_path' },
                            { column_name: 'export_file_name' }
                        ] });
                    }
                    if (params[0] === 'batch_job_items') {
                        return Promise.resolve({ rows: [
                            { column_name: 'relative_path' },
                            { column_name: 'original_name' },
                            { column_name: 'display_name' },
                            { column_name: 'pending_data' },
                            { column_name: 'source_type' },
                            { column_name: 'adaptation_id' }
                        ] });
                    }
                    return Promise.resolve({ rows: [{ column_name: 'relative_path' }] });
                }
                if (sql.includes('pg_indexes')) {
                    return Promise.resolve({ rows: [
                        { indexname: 'idx_batch_jobs_status' },
                        { indexname: 'idx_batch_jobs_firm_id' },
                        { indexname: 'idx_batch_jobs_user_id' },
                        { indexname: 'idx_batch_job_items_job_id' },
                        { indexname: 'idx_batch_job_items_status' }
                    ] });
                }
                return Promise.resolve({ rows: [] });
            });

            const result = await initializeBatchJobsTable();

            expect(result).toBe(true);
            expect(query).toHaveBeenCalledTimes(5);
        });

        it('should throw on DB error', async () => {
            query.mockRejectedValueOnce(new Error('DB error'));
            await expect(initializeBatchJobsTable()).rejects.toThrow('DB error');
        });
    });
});
