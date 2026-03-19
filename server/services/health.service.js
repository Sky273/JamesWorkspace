/**
 * Health Service
 * Data access layer for health check operations
 * Extracted from routes/health.routes.js
 */

import { query as dbQuery } from '../config/database.js';

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
 * Get database size, table stats, and connection stats for metrics
 * @returns {Promise<{sizeResult: Object, tableStatsResult: Object, connectionStatsResult: Object, queryTime: number}>}
 */
export async function getDatabaseMetrics() {
    const startTime = Date.now();

    const [sizeResult, tableStatsResult, connectionStatsResult] = await Promise.all([
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
        `)
    ]);

    const queryTime = Date.now() - startTime;

    return { sizeResult, tableStatsResult, connectionStatsResult, queryTime };
}
