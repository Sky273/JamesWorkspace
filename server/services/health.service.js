/**
 * Health Service
 * Data access layer for health check operations
 * Extracted from routes/health.routes.js
 */

import { query as dbQuery } from '../config/database.js';

async function getBinaryStorageMetricsSafe() {
    try {
        return await dbQuery(`
            SELECT
                COUNT(*) FILTER (WHERE resume_file_data IS NOT NULL) AS resumes_with_binary,
                COALESCE(SUM(octet_length(resume_file_data)), 0) AS resume_binary_bytes,
                COALESCE(AVG(octet_length(resume_file_data)), 0) AS avg_resume_binary_bytes,
                COALESCE(MAX(octet_length(resume_file_data)), 0) AS max_resume_binary_bytes
            FROM resumes
        `);
    } catch (_error) {
        return {
            rows: [{
                resumes_with_binary: 0,
                resume_binary_bytes: 0,
                avg_resume_binary_bytes: 0,
                max_resume_binary_bytes: 0
            }]
        };
    }
}

async function getBatchStorageMetricsSafe() {
    try {
        return await dbQuery(`
            SELECT
                COUNT(*) FILTER (WHERE file_data IS NOT NULL) AS items_with_file_data,
                COALESCE(SUM(octet_length(file_data)), 0) AS total_file_data_bytes
            FROM batch_job_items
        `);
    } catch (_error) {
        return {
            rows: [{
                items_with_file_data: 0,
                total_file_data_bytes: 0
            }]
        };
    }
}

/**
 * Check DB connectivity and get basic stats (resumes, users, missions counts + db size)
 * @returns {Promise<{latency: number, stats: Object}>}
 */
export async function checkDatabaseHealth() {
    const dbStart = Date.now();
    const [_connResult, statsResult] = await Promise.race([
        Promise.all([
            dbQuery('SELECT 1 as connected'),
            dbQuery(`
                SELECT 
                    (SELECT count(*) FROM resumes) as resumes_count,
                    (SELECT count(*) FROM users) as users_count,
                    (SELECT count(*) FROM missions) as missions_count,
                    pg_database_size(current_database()) as db_size
            `)
        ]),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
    ]);
    const latency = Date.now() - dbStart;
    return { latency, stats: statsResult.rows[0] };
}

/**
 * Get database size, table stats, connection stats, and binary storage stats for metrics
 * @returns {Promise<{sizeResult: Object, tableStatsResult: Object, connectionStatsResult: Object, binaryStorageResult: Object, batchStorageResult: Object, queryTime: number}>}
 */
export async function getDatabaseMetrics() {
    const startTime = Date.now();

    const [sizeResult, tableStatsResult, connectionStatsResult, binaryStorageResult, batchStorageResult] = await Promise.all([
        dbQuery(`
            SELECT 
                pg_database_size(current_database()) as db_size,
                pg_size_pretty(pg_database_size(current_database())) as db_size_pretty
        `),
        dbQuery(`
            SELECT 
                relname as table_name,
                n_live_tup as row_count,
                n_dead_tup as dead_rows,
                last_vacuum,
                last_autovacuum,
                last_analyze
            FROM pg_stat_user_tables
            ORDER BY n_live_tup DESC
            LIMIT 10
        `),
        dbQuery(`
            SELECT 
                count(*) as total_connections,
                count(*) FILTER (WHERE state = 'active') as active_connections,
                count(*) FILTER (WHERE state = 'idle') as idle_connections
            FROM pg_stat_activity
            WHERE datname = current_database()
        `),
        getBinaryStorageMetricsSafe(),
        getBatchStorageMetricsSafe()
    ]);

    const queryTime = Date.now() - startTime;

    return { sizeResult, tableStatsResult, connectionStatsResult, binaryStorageResult, batchStorageResult, queryTime };
}
