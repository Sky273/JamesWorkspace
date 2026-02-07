/**
 * PostgreSQL Database Configuration
 * Manages connection pool and database client with retry logic
 */

import pg from 'pg';
import { safeLog } from '../utils/logger.backend.js';

const { Pool } = pg;

// Retry configuration
const RETRY_CONFIG = {
    maxRetries: parseInt(process.env.POSTGRES_MAX_RETRIES || '5', 10),
    initialDelayMs: parseInt(process.env.POSTGRES_RETRY_DELAY || '1000', 10),
    maxDelayMs: 30000,
    backoffMultiplier: 2
};

// Database configuration from environment variables
const dbConfig = {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
    database: process.env.POSTGRES_DB || 'resumeconverter',
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD,
    
    // Connection pool settings
    max: parseInt(process.env.POSTGRES_MAX_CONNECTIONS || '20', 10),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    
    // SSL configuration (for production)
    ssl: process.env.POSTGRES_SSL === 'true' ? {
        rejectUnauthorized: false
    } : false
};

// Validate required configuration
if (!dbConfig.password) {
    throw new Error('POSTGRES_PASSWORD environment variable is required');
}

// Create connection pool
export const pool = new Pool(dbConfig);

/**
 * Sleep for a specified duration
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculate delay with exponential backoff
 * @param {number} attempt - Current attempt number (0-indexed)
 * @returns {number} Delay in milliseconds
 */
function calculateBackoffDelay(attempt) {
    const delay = RETRY_CONFIG.initialDelayMs * Math.pow(RETRY_CONFIG.backoffMultiplier, attempt);
    // Add jitter (±10%) to prevent thundering herd
    const jitter = delay * 0.1 * (Math.random() * 2 - 1);
    return Math.min(delay + jitter, RETRY_CONFIG.maxDelayMs);
}

/**
 * Check if an error is retryable
 * @param {Error} error - The error to check
 * @returns {boolean} True if the error is retryable
 */
function isRetryableError(error) {
    const retryableCodes = [
        'ECONNREFUSED',     // Connection refused
        'ECONNRESET',       // Connection reset
        'ETIMEDOUT',        // Connection timed out
        'ENOTFOUND',        // DNS lookup failed
        'EAI_AGAIN',        // DNS temporary failure
        'EHOSTUNREACH',     // Host unreachable
        'ENETUNREACH',      // Network unreachable
        '57P01',            // PostgreSQL: admin_shutdown
        '57P02',            // PostgreSQL: crash_shutdown
        '57P03',            // PostgreSQL: cannot_connect_now
        '08000',            // PostgreSQL: connection_exception
        '08003',            // PostgreSQL: connection_does_not_exist
        '08006',            // PostgreSQL: connection_failure
    ];
    
    return retryableCodes.includes(error.code) || 
           error.message?.includes('Connection terminated') ||
           error.message?.includes('timeout');
}

// Handle pool errors
pool.on('error', (err) => {
    safeLog('error', 'Unexpected error on idle PostgreSQL client', {
        error: err.message,
        stack: err.stack
    });
});

// Handle pool connection
pool.on('connect', () => {
    safeLog('debug', 'New PostgreSQL client connected to pool');
});

// Handle pool removal
pool.on('remove', () => {
    safeLog('debug', 'PostgreSQL client removed from pool');
});

/**
 * Test database connection with retry logic
 * @returns {Promise<boolean>} True if connection successful
 */
export async function testConnection() {
    for (let attempt = 0; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
        try {
            const client = await pool.connect();
            const result = await client.query('SELECT NOW() as now, version() as version');
            client.release();
            
            safeLog('info', 'PostgreSQL connection successful', {
                timestamp: result.rows[0].now,
                version: result.rows[0].version,
                attempt: attempt + 1
            });
            
            return true;
        } catch (error) {
            const isLastAttempt = attempt === RETRY_CONFIG.maxRetries;
            
            if (isRetryableError(error) && !isLastAttempt) {
                const delay = calculateBackoffDelay(attempt);
                safeLog('warn', `PostgreSQL connection failed, retrying in ${Math.round(delay)}ms...`, {
                    error: error.message,
                    attempt: attempt + 1,
                    maxRetries: RETRY_CONFIG.maxRetries,
                    nextDelayMs: Math.round(delay)
                });
                await sleep(delay);
            } else {
                safeLog('error', 'PostgreSQL connection failed permanently', {
                    error: error.message,
                    host: dbConfig.host,
                    port: dbConfig.port,
                    database: dbConfig.database,
                    attempts: attempt + 1
                });
                return false;
            }
        }
    }
    return false;
}

/**
 * Get a client from the pool with retry logic
 * @param {number} maxRetries - Maximum number of retries (default: from config)
 * @returns {Promise<PoolClient>} Database client
 */
export async function getClientWithRetry(maxRetries = RETRY_CONFIG.maxRetries) {
    let lastError;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const client = await pool.connect();
            return client;
        } catch (error) {
            lastError = error;
            const isLastAttempt = attempt === maxRetries;
            
            if (isRetryableError(error) && !isLastAttempt) {
                const delay = calculateBackoffDelay(attempt);
                safeLog('warn', `Failed to get PostgreSQL client, retrying...`, {
                    error: error.message,
                    attempt: attempt + 1,
                    nextDelayMs: Math.round(delay)
                });
                await sleep(delay);
            }
        }
    }
    
    safeLog('error', 'Failed to get PostgreSQL client after all retries', {
        error: lastError?.message,
        attempts: maxRetries + 1
    });
    throw lastError;
}

/**
 * Execute a query with automatic client management
 * @param {string} text - SQL query text
 * @param {Array} params - Query parameters
 * @returns {Promise<Object>} Query result
 */
export async function query(text, params) {
    const start = Date.now();
    try {
        const result = await pool.query(text, params);
        const duration = Date.now() - start;
        
        safeLog('debug', 'Executed query', {
            query: text.substring(0, 100),
            duration: `${duration}ms`,
            rows: result.rowCount
        });
        
        return result;
    } catch (error) {
        // Don't log params - they may contain sensitive data (passwords, tokens, etc.)
        safeLog('error', 'Query execution failed', {
            error: error.message,
            query: text.substring(0, 100),
            paramsCount: params?.length || 0
        });
        throw error;
    }
}

/**
 * Get a client from the pool for transactions
 * Remember to call client.release() when done!
 * @returns {Promise<PoolClient>} Database client
 */
export async function getClient() {
    return await pool.connect();
}

/**
 * Gracefully close all connections in the pool
 * @returns {Promise<void>}
 */
export async function closePool() {
    try {
        await pool.end();
        safeLog('info', 'PostgreSQL connection pool closed');
    } catch (error) {
        safeLog('error', 'Error closing PostgreSQL pool', {
            error: error.message
        });
        throw error;
    }
}

// Note: Graceful shutdown is handled by proxy-server.js
// Do not add SIGINT/SIGTERM handlers here to avoid calling closePool() twice

export default pool;
