/**
 * Tests for Database Service
 * Tests initializeDatabase, getDatabaseStats, healthCheck
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../config/database.js', () => ({
    query: vi.fn(),
    pool: { totalCount: 5, idleCount: 3, waitingCount: 0 },
    testConnection: vi.fn(),
    closePool: vi.fn()
}));

vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn()
}));

vi.mock('../../utils/postgresHelpers.js', () => ({
    selectWithTimeout: vi.fn(),
    findWithTimeout: vi.fn(),
    createWithTimeout: vi.fn(),
    updateWithTimeout: vi.fn(),
    destroyWithTimeout: vi.fn(),
    fetchPaginatedRecords: vi.fn(),
    transaction: vi.fn(),
    buildWhereClause: vi.fn()
}));

import { query, testConnection } from '../../config/database.js';
import { initializeDatabase, getDatabaseStats, healthCheck } from '../../services/database.service.js';

describe('Database Service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('initializeDatabase', () => {
        it('should return true when all checks pass', async () => {
            testConnection.mockResolvedValueOnce(true);
            // tables query
            query.mockResolvedValueOnce({
                rows: [
                    { table_name: 'firms' }, { table_name: 'users' }, { table_name: 'llm_settings' },
                    { table_name: 'templates' }, { table_name: 'resumes' }, { table_name: 'missions' },
                    { table_name: 'resume_adaptations' }, { table_name: 'rome_metiers' },
                    { table_name: 'industry_aliases' }, { table_name: 'market_facts' },
                    { table_name: 'market_trends' }
                ]
            });
            // extensions query
            query.mockResolvedValueOnce({ rows: [{ extname: 'uuid-ossp' }, { extname: 'pg_trgm' }] });
            // migration queries
            query.mockResolvedValueOnce({ rows: [] });
            query.mockResolvedValueOnce({ rows: [] });

            const result = await initializeDatabase();

            expect(result).toBe(true);
            expect(testConnection).toHaveBeenCalled();
        });

        it('should return false when connection fails', async () => {
            testConnection.mockResolvedValueOnce(false);

            const result = await initializeDatabase();

            expect(result).toBe(false);
        });

        it('should warn about missing tables', async () => {
            const { safeLog } = await import('../../utils/logger.backend.js');
            testConnection.mockResolvedValueOnce(true);
            query.mockResolvedValueOnce({ rows: [{ table_name: 'firms' }] }); // only one table
            query.mockResolvedValueOnce({ rows: [] }); // extensions
            query.mockResolvedValueOnce({ rows: [] }); // migration 1
            query.mockResolvedValueOnce({ rows: [] }); // migration 2

            await initializeDatabase();

            expect(safeLog).toHaveBeenCalledWith('warn', 'Some tables are missing from database', expect.any(Object));
        });
    });

    describe('getDatabaseStats', () => {
        it('should return tables, row counts, and connections', async () => {
            query.mockResolvedValueOnce({ rows: [{ tablename: 'resumes', size: '1 MB', size_bytes: 1048576 }] });
            query.mockResolvedValueOnce({ rows: [{ tablename: 'resumes', row_count: 100 }] });
            query.mockResolvedValueOnce({ rows: [{ total_connections: 5, active_connections: 2, idle_connections: 3 }] });

            const stats = await getDatabaseStats();

            expect(stats.tables).toHaveLength(1);
            expect(stats.rowCounts).toHaveLength(1);
            expect(stats.connections.total_connections).toBe(5);
        });

        it('should throw on DB error', async () => {
            query.mockRejectedValueOnce(new Error('DB error'));
            await expect(getDatabaseStats()).rejects.toThrow('DB error');
        });
    });

    describe('healthCheck', () => {
        it('should return healthy status', async () => {
            query.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });

            const result = await healthCheck();

            expect(result.status).toBe('healthy');
            expect(result.pool.total).toBe(5);
            expect(result.pool.idle).toBe(3);
        });

        it('should return unhealthy status on error', async () => {
            query.mockRejectedValueOnce(new Error('Connection refused'));

            const result = await healthCheck();

            expect(result.status).toBe('unhealthy');
            expect(result.error).toBe('Connection refused');
        });
    });
});
