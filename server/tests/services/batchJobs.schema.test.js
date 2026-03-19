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
        it('should create tables, add columns, and create indexes', async () => {
            query.mockResolvedValue({ rows: [] });

            const result = await initializeBatchJobsTable();

            expect(result).toBe(true);
            // Should have multiple query calls for table creation, column migration, indexes
            expect(query).toHaveBeenCalled();
            const allSql = query.mock.calls.map(c => c[0]).join(' ');
            expect(allSql).toContain('CREATE TABLE IF NOT EXISTS batch_jobs');
            expect(allSql).toContain('CREATE TABLE IF NOT EXISTS batch_job_items');
            expect(allSql).toContain('CREATE INDEX');
        });

        it('should throw on DB error', async () => {
            query.mockRejectedValueOnce(new Error('DB error'));
            await expect(initializeBatchJobsTable()).rejects.toThrow('DB error');
        });
    });
});
