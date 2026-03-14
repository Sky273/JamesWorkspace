/**
 * Database Service
 * High-level database operations and utilities
 */

import { pool, query, testConnection, closePool } from '../config/database.js';
import { safeLog } from '../utils/logger.backend.js';
import {
    selectWithTimeout,
    findWithTimeout,
    createWithTimeout,
    updateWithTimeout,
    destroyWithTimeout,
    fetchPaginatedRecords,
    transaction,
    buildWhereClause
} from '../utils/postgresHelpers.js';

/**
 * Initialize database connection and verify schema
 * @returns {Promise<boolean>} True if initialization successful
 */
export async function initializeDatabase() {
    try {
        safeLog('info', 'Initializing PostgreSQL database connection...');
        
        // Test connection
        const connected = await testConnection();
        if (!connected) {
            throw new Error('Failed to connect to PostgreSQL database');
        }
        
        // Verify tables exist
        const tablesResult = await query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            ORDER BY table_name
        `);
        
        const tables = tablesResult.rows.map(row => row.table_name);
        const expectedTables = [
            'firms',
            'users',
            'llm_settings',
            'templates',
            'resumes',
            'missions',
            'resume_adaptations',
            'rome_metiers',
            'industry_aliases',
            'market_facts',
            'market_trends'
        ];
        
        const missingTables = expectedTables.filter(t => !tables.includes(t));
        
        if (missingTables.length > 0) {
            safeLog('warn', 'Some tables are missing from database', {
                missingTables,
                existingTables: tables
            });
        } else {
            safeLog('info', 'All expected tables found in database', {
                tableCount: tables.length
            });
        }
        
        // Verify extensions
        const extensionsResult = await query(`
            SELECT extname 
            FROM pg_extension 
            WHERE extname IN ('uuid-ossp', 'pg_trgm')
        `);
        
        const extensions = extensionsResult.rows.map(row => row.extname);
        safeLog('info', 'PostgreSQL extensions loaded', { extensions });
        
        // Migration: Add candidate_name and adapted_title columns to resume_adaptations
        try {
            await query(`ALTER TABLE resume_adaptations ADD COLUMN IF NOT EXISTS candidate_name VARCHAR(255)`);
            await query(`ALTER TABLE resume_adaptations ADD COLUMN IF NOT EXISTS adapted_title VARCHAR(500)`);
            safeLog('info', 'Migration: resume_adaptations.candidate_name and adapted_title columns ensured');
        } catch (migrationError) {
            safeLog('debug', 'Migration note: candidate_name/adapted_title columns', { note: migrationError.message });
        }

        return true;
    } catch (error) {
        safeLog('error', 'Database initialization failed', {
            error: error.message,
            stack: error.stack
        });
        return false;
    }
}

/**
 * Get database statistics
 * @returns {Promise<Object>} Database statistics
 */
export async function getDatabaseStats() {
    try {
        // Get table sizes
        const sizeResult = await query(`
            SELECT 
                schemaname,
                tablename,
                pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
                pg_total_relation_size(schemaname||'.'||tablename) AS size_bytes
            FROM pg_tables
            WHERE schemaname = 'public'
            ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
        `);
        
        // Get row counts
        const countResult = await query(`
            SELECT 
                schemaname,
                tablename,
                n_live_tup AS row_count
            FROM pg_stat_user_tables
            WHERE schemaname = 'public'
            ORDER BY n_live_tup DESC
        `);
        
        // Get connection stats
        const connectionResult = await query(`
            SELECT 
                count(*) as total_connections,
                count(*) FILTER (WHERE state = 'active') as active_connections,
                count(*) FILTER (WHERE state = 'idle') as idle_connections
            FROM pg_stat_activity
            WHERE datname = current_database()
        `);
        
        return {
            tables: sizeResult.rows,
            rowCounts: countResult.rows,
            connections: connectionResult.rows[0]
        };
    } catch (error) {
        safeLog('error', 'Failed to get database stats', {
            error: error.message
        });
        throw error;
    }
}

/**
 * Health check for database
 * @returns {Promise<Object>} Health status
 */
export async function healthCheck() {
    try {
        const start = Date.now();
        await query('SELECT 1');
        const responseTime = Date.now() - start;
        
        const poolStats = {
            total: pool.totalCount,
            idle: pool.idleCount,
            waiting: pool.waitingCount
        };
        
        return {
            status: 'healthy',
            responseTime: `${responseTime}ms`,
            pool: poolStats
        };
    } catch (error) {
        return {
            status: 'unhealthy',
            error: error.message
        };
    }
}

// Export all helpers for convenience
export {
    pool,
    query,
    testConnection,
    closePool,
    selectWithTimeout,
    findWithTimeout,
    createWithTimeout,
    updateWithTimeout,
    destroyWithTimeout,
    fetchPaginatedRecords,
    transaction,
    buildWhereClause
};
