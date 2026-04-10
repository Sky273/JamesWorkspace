/**
 * PostgreSQL Helper Functions
 * Utility functions for common database operations
 */

import { pool, getClientWithRetry } from '../config/database.js';
import { safeLog } from './logger.backend.js';

// ============================================
// SECURITY: Whitelist of allowed table names
// Prevents SQL injection via table name manipulation
// ============================================
const ALLOWED_TABLES = new Set([
    'firms',
    'users',
    'llm_settings',
    'templates',
    'resumes',
    'resume_versions',
    'resume_comments',
    'missions',
    'resume_adaptations',
    'clients',
    'client_contacts',
    'resume_submissions',
    'candidate_pipeline',
    'pipeline_history',
    'pipeline_interviews',
    'deals',
    'deal_resumes',
    'batch_jobs',
    'batch_job_items',
    'user_mail_tokens',
    'user_calendar_tokens',
    'firm_gdpr_mail_tokens',
    'global_gdpr_mail_token',
    'gdpr_audit_log',
    'email_templates',
    'rome_metiers',
    'industry_aliases',
    'market_facts',
    'market_trends',
    'skills',
    'skill_evidence',
    'skill_occurrences',
    'token_blacklist',
    'user_blacklist',
    'backup_settings',
    'backup_history',
    'tags',
    'security_logs'
]);

/**
 * Validate table name against whitelist
 * @param {string} table - Table name to validate
 * @throws {Error} If table name is not in whitelist
 */
function validateTableName(table) {
    if (!table || typeof table !== 'string') {
        throw new Error('Table name must be a non-empty string');
    }
    
    const normalizedTable = table.toLowerCase().trim();
    
    if (!ALLOWED_TABLES.has(normalizedTable)) {
        safeLog('error', 'SQL Injection attempt blocked: invalid table name', {
            attemptedTable: table.substring(0, 50)
        });
        throw new Error(`Invalid table name: ${normalizedTable}`);
    }
    
    return normalizedTable;
}

/**
 * Execute a query with statement timeout and connection retry
 * @param {string} sql - SQL query
 * @param {Array} params - Query parameters
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<Object>} Query result
 */
async function queryWithTimeout(sql, params, timeout = 30000) {
    // Use getClientWithRetry for automatic connection retry on failure
    const client = await getClientWithRetry();
    
    try {
        // Set statement timeout for this session (explicit numeric coercion to prevent injection)
        const safeTimeout = Math.max(0, Math.floor(Number(timeout)));
        if (!Number.isFinite(safeTimeout)) throw new Error('Invalid timeout value');
        await client.query(`SET statement_timeout = ${safeTimeout}`);
        
        // Execute the actual query
        const result = await client.query(sql, params);
        
        return result;
    } finally {
        // Always release the client back to the pool
        client.release();
    }
}

/**
 * Execute an explicitly reviewed raw SELECT query.
 * This helper exists for complex joins/aggregations that cannot be expressed
 * with the generic select helper. Callers must provide a short context label.
 * @param {string} sql
 * @param {Array} params
 * @param {Object} options
 * @param {string} options.context
 * @param {number} timeout
 * @returns {Promise<Array>}
 */
export async function selectRawWithTimeout(sql, params = [], { context } = {}, timeout = 30000) {
    if (!sql || typeof sql !== 'string') {
        throw new Error('Raw SQL query must be a non-empty string');
    }

    if (!context || typeof context !== 'string') {
        throw new Error('Raw SQL context is required');
    }

    try {
        const result = await queryWithTimeout(sql, params, timeout);
        return result.rows;
    } catch (error) {
        safeLog('error', 'selectRawWithTimeout failed', {
            context,
            error: error.message,
            timeout
        });
        throw error;
    }
}

/**
 * Validate column names (basic validation - alphanumeric and underscore only)
 * @param {Array<string>} columns - Column names to validate
 * @throws {Error} If any column name is invalid
 */
function validateColumnNames(columns) {
    if (!Array.isArray(columns)) {
        throw new Error('Columns must be an array');
    }
    
    const validColumnPattern = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
    
    for (const col of columns) {
        if (col === '*') continue; // Allow wildcard
        
        if (!col || typeof col !== 'string') {
            throw new Error('Column name must be a non-empty string');
        }
        
        if (!validColumnPattern.test(col)) {
            safeLog('error', 'SQL Injection attempt blocked: invalid column name', {
                attemptedColumn: col.substring(0, 50)
            });
            throw new Error(`Invalid column name: ${col}`);
        }
    }
    
    return columns;
}

/**
 * Execute a SELECT query with timeout
 * @param {string} table - Table name
 * @param {Object} options - Query options
 * @param {string} options.where - WHERE clause (without WHERE keyword)
 * @param {Array} options.params - Query parameters
 * @param {Array<string>} options.columns - Columns to select (default: *)
 * @param {string} options.orderBy - ORDER BY clause
 * @param {number} options.limit - LIMIT value
 * @param {number} options.offset - OFFSET value
 * @param {number} timeout - Query timeout in ms
 * @returns {Promise<Array>} Array of rows
 */
export async function selectWithTimeout(table, options = {}, timeout = 30000) {
    if (options.rawQuery) {
        throw new Error('Raw SQL is not allowed via selectWithTimeout; use selectRawWithTimeout');
    }

    // Validate table and column names to prevent SQL injection
    const validatedTable = validateTableName(table);
    
    const {
        where = '',
        params = [],
        columns = ['*'],
        orderBy = '',
        limit = null,
        offset = null
    } = options;

    // Validate column names
    validateColumnNames(columns);

    let sql = `SELECT ${columns.join(', ')} FROM ${validatedTable}`;
    
    if (where) {
        sql += ` WHERE ${where}`;
    }
    
    if (orderBy) {
        sql += ` ORDER BY ${orderBy}`;
    }
    
    if (limit !== null) {
        const safeLimit = Math.max(0, Math.floor(Number(limit)));
        if (!Number.isFinite(safeLimit)) throw new Error('Invalid limit value');
        sql += ` LIMIT ${safeLimit}`;
    }
    
    if (offset !== null) {
        const safeOffset = Math.max(0, Math.floor(Number(offset)));
        if (!Number.isFinite(safeOffset)) throw new Error('Invalid offset value');
        sql += ` OFFSET ${safeOffset}`;
    }

    try {
        const result = await queryWithTimeout(sql, params, timeout);
        return result.rows;
    } catch (error) {
        safeLog('error', 'selectWithTimeout failed', {
            table: validatedTable,
            error: error.message,
            timeout
        });
        throw error;
    }
}

/**
 * Find a single record by ID
 * @param {string} table - Table name
 * @param {string} id - Record ID (UUID)
 * @param {Object} options - Query options
 * @param {Array<string>} options.columns - Columns to select (default: *)
 * @param {number} timeout - Query timeout in ms
 * @returns {Promise<Object>} Single row object
 */
export async function findWithTimeout(table, id, options = {}, timeout = 30000) {
    // Handle legacy signature: findWithTimeout(table, id, timeout)
    if (typeof options === 'number') {
        timeout = options;
        options = {};
    }
    
    // Validate table name to prevent SQL injection
    const validatedTable = validateTableName(table);
    
    const { columns = ['*'] } = options;
    
    // Validate column names if specified
    if (columns[0] !== '*') {
        validateColumnNames(columns);
    }
    
    const columnList = columns.join(', ');
    const sql = `SELECT ${columnList} FROM ${validatedTable} WHERE id = $1`;
    
    try {
        const result = await queryWithTimeout(sql, [id], timeout);
        
        if (result.rows.length === 0) {
            const error = new Error('Record not found');
            error.statusCode = 404;
            throw error;
        }
        
        return result.rows[0];
    } catch (error) {
        if (error.statusCode === 404) {
            throw error;
        }
        safeLog('error', 'findWithTimeout failed', {
            table: validatedTable,
            error: error.message,
            timeout
        });
        throw error;
    }
}

/**
 * Create one or more records
 * @param {string} table - Table name
 * @param {Array<Object>} records - Array of record objects
 * @param {Object} options - Options (ignored for PostgreSQL compatibility)
 * @param {number} timeout - Query timeout in ms
 * @returns {Promise<Array>} Array of created rows
 */
export async function createWithTimeout(table, recordOrRecords, _options = {}, timeout = 30000) {
    // Validate table name to prevent SQL injection
    const validatedTable = validateTableName(table);
    
    // Accept both single object and array of records
    const records = Array.isArray(recordOrRecords) ? recordOrRecords : [recordOrRecords];
    
    if (records.length === 0) {
        throw new Error('Records must be a non-empty array');
    }

    const results = [];
    
    for (const record of records) {
        const fields = record.fields || record;
        const columns = Object.keys(fields);
        
        // Validate column names to prevent SQL injection
        validateColumnNames(columns);
        
        // Process values - arrays are passed directly (pg driver handles TEXT[] conversion)
        // Objects are serialized to JSON for JSONB columns
        const values = Object.values(fields).map(val => {
            if (val === null || val === undefined) return null;
            // Arrays are passed directly - pg driver converts them to PostgreSQL array format
            if (Array.isArray(val)) return val;
            // Objects (non-array) are serialized to JSON for JSONB columns
            if (typeof val === 'object' && val !== null) {
                return JSON.stringify(val);
            }
            return val;
        });
        const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
        
        const sql = `
            INSERT INTO ${validatedTable} (${columns.join(', ')})
            VALUES (${placeholders})
            RETURNING *
        `;
        
        try {
            const result = await queryWithTimeout(sql, values, timeout);
            results.push(result.rows[0]);
        } catch (error) {
            safeLog('error', 'createWithTimeout failed', {
                table: validatedTable,
                error: error.message,
                timeout
            });
            throw error;
        }
    }
    
    // Return single object if single record was passed, array otherwise
    return Array.isArray(recordOrRecords) ? results : results[0];
}

/**
 * Update one or more records
 * @param {string} table - Table name
 * @param {Array<Object>|string} recordsOrId - Array of {id, fields} objects OR single record ID
 * @param {Object} optionsOrFields - Options (if records array) OR fields to update (if ID)
 * @param {number} timeout - Query timeout in ms
 * @returns {Promise<Array|Object>} Array of updated rows or single updated row
 */
export async function updateWithTimeout(table, recordsOrId, optionsOrFields = {}, timeout = 30000) {
    // Validate table name to prevent SQL injection
    const validatedTable = validateTableName(table);
    
    // Support two calling conventions:
    // 1. updateWithTimeout(table, [{id, fields}], options, timeout) - array format
    // 2. updateWithTimeout(table, id, fields) - simple format
    
    let records;
    let returnSingle = false;
    
    if (typeof recordsOrId === 'string') {
        // Simple format: (table, id, fields)
        records = [{ id: recordsOrId, fields: optionsOrFields }];
        returnSingle = true;
    } else if (Array.isArray(recordsOrId)) {
        // Array format: (table, [{id, fields}], options)
        records = recordsOrId;
    } else {
        throw new Error('Second argument must be an array of records or a record ID string');
    }
    
    if (records.length === 0) {
        throw new Error('Records must be a non-empty array');
    }

    const results = [];
    
    for (const record of records) {
        const { id, fields } = record;
        
        if (!id) {
            throw new Error('Record ID is required for update');
        }
        
        const columns = Object.keys(fields);
        
        // Validate column names to prevent SQL injection
        validateColumnNames(columns);
        
        // Process values - arrays are passed directly (pg driver handles TEXT[] conversion)
        // Objects are serialized to JSON for JSONB columns
        const values = Object.values(fields).map(val => {
            if (val === null || val === undefined) return null;
            // Arrays are passed directly - pg driver converts them to PostgreSQL array format
            if (Array.isArray(val)) return val;
            // Objects (non-array) are serialized to JSON for JSONB columns
            if (typeof val === 'object' && val !== null) {
                return JSON.stringify(val);
            }
            return val;
        });
        const setClause = columns.map((col, i) => `${col} = $${i + 1}`).join(', ');
        
        const sql = `
            UPDATE ${validatedTable}
            SET ${setClause}
            WHERE id = $${values.length + 1}
            RETURNING *
        `;
        
        safeLog('debug', 'updateWithTimeout SQL', {
            table: validatedTable,
            columnsCount: columns.length
        });
        
        try {
            const result = await queryWithTimeout(sql, [...values, id], timeout);
            
            if (result.rows.length === 0) {
                const error = new Error('Record not found');
                error.statusCode = 404;
                throw error;
            }
            
            results.push(result.rows[0]);
        } catch (error) {
            safeLog('error', 'updateWithTimeout failed', {
                table: validatedTable,
                error: error.message,
                timeout
            });
            throw error;
        }
    }
    
    // Return single object if simple format was used, array otherwise
    return returnSingle ? results[0] : results;
}

/**
 * Delete one or more records
 * @param {string} table - Table name
 * @param {Array<string>} ids - Array of record IDs
 * @param {number} timeout - Query timeout in ms
 * @returns {Promise<Array>} Array of deleted row IDs
 */
export async function destroyWithTimeout(table, ids, timeout = 30000) {
    // Validate table name to prevent SQL injection
    const validatedTable = validateTableName(table);
    
    if (!Array.isArray(ids)) {
        ids = [ids];
    }
    
    if (ids.length === 0) {
        throw new Error('IDs must be a non-empty array');
    }

    const results = [];
    
    for (const id of ids) {
        const sql = `DELETE FROM ${validatedTable} WHERE id = $1 RETURNING id`;
        
        try {
            const result = await queryWithTimeout(sql, [id], timeout);
            
            if (result.rows.length === 0) {
                const error = new Error('Record not found');
                error.statusCode = 404;
                throw error;
            }
            
            results.push(result.rows[0].id);
        } catch (error) {
            safeLog('error', 'destroyWithTimeout failed', {
                table: validatedTable,
                error: error.message,
                timeout
            });
            throw error;
        }
    }
    
    return results;
}

/**
 * Fetch paginated records with cursor-based pagination
 * @param {string} table - Table name
 * @param {Object} options - Pagination options
 * @param {number} options.pageSize - Number of records per page
 * @param {string} options.offset - Cursor offset (record ID)
 * @param {string} options.where - WHERE clause
 * @param {Array} options.params - Query parameters
 * @param {Array<Object>} options.sort - Sort configuration [{field, direction}]
 * @param {number} timeout - Query timeout in ms
 * @returns {Promise<Object>} {records, hasMore, totalCount}
 */
export async function fetchPaginatedRecords(table, options = {}, timeout = 30000) {
    // Validate table name to prevent SQL injection
    const validatedTable = validateTableName(table);
    
    const {
        pageSize = 100,
        offset = null,
        where = '',
        params = [],
        sort = []
    } = options;

    // Build ORDER BY clause (validate sort field names)
    let orderBy = '';
    if (sort.length > 0) {
        const sortFields = sort.map(s => s.field);
        validateColumnNames(sortFields);
        orderBy = 'ORDER BY ' + sort.map(s => `${s.field} ${s.direction === 'DESC' ? 'DESC' : 'ASC'}`).join(', ');
    }

    // Build WHERE clause with cursor
    let whereClause = where;
    let queryParams = [...params];
    
    if (offset && sort.length > 0) {
        const cursorCondition = `id > $${queryParams.length + 1}`;
        whereClause = where ? `(${where}) AND ${cursorCondition}` : cursorCondition;
        queryParams.push(offset);
    }

    // Fetch records with LIMIT + 1 to check if there are more
    const sql = `
        SELECT * FROM ${validatedTable}
        ${whereClause ? `WHERE ${whereClause}` : ''}
        ${orderBy}
        LIMIT ${Math.max(0, Math.floor(Number(pageSize))) + 1}
    `;

    try {
        const result = await queryWithTimeout(sql, queryParams, timeout);
        const records = result.rows;
        const hasMore = records.length > pageSize;
        
        if (hasMore) {
            records.pop(); // Remove the extra record
        }

        // Get total count (expensive, only if needed)
        let totalCount = null;
        if (!offset) {
            const countSql = `SELECT COUNT(*) as count FROM ${validatedTable} ${where ? `WHERE ${where}` : ''}`;
            const countResult = await queryWithTimeout(countSql, params, timeout);
            totalCount = parseInt(countResult.rows[0].count, 10);
        }

        return {
            records,
            hasMore,
            totalCount
        };
    } catch (error) {
        safeLog('error', 'fetchPaginatedRecords failed', {
            table: validatedTable,
            error: error.message,
            timeout
        });
        throw error;
    }
}

/**
 * Execute a transaction with automatic rollback on error
 * @param {Function} callback - Async function that receives a client
 * @returns {Promise<any>} Result of the callback
 */
export async function transaction(callback) {
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
    } catch (error) {
        await client.query('ROLLBACK');
        safeLog('error', 'Transaction rolled back', {
            error: error.message
        });
        throw error;
    } finally {
        client.release();
    }
}

/**
 * Build a parameterized WHERE clause from a filter object
 * @param {Object} filters - Filter object {column: value}
 * @param {number} startIndex - Starting parameter index (default: 1)
 * @returns {Object} {where, params}
 */
export function buildWhereClause(filters, startIndex = 1) {
    const conditions = [];
    const params = [];
    let paramIndex = startIndex;

    // SECURITY: Validate column names to prevent SQL injection
    const columns = Object.keys(filters);
    if (columns.length > 0) {
        validateColumnNames(columns);
    }

    for (const [column, value] of Object.entries(filters)) {
        if (value !== undefined && value !== null) {
            conditions.push(`${column} = $${paramIndex}`);
            params.push(value);
            paramIndex++;
        }
    }

    return {
        where: conditions.length > 0 ? conditions.join(' AND ') : '',
        params
    };
}

/**
 * Escape a string for use in LIKE queries
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
export function escapeLike(str) {
    return str.replace(/[%_\\]/g, '\\$&');
}


/**
 * Validate prompt size for LLM calls
 * @param {string} prompt - The prompt text
 * @param {number} maxTokens - Maximum allowed tokens (approximate)
 * @returns {Object} { valid: boolean, estimatedTokens: number, message?: string }
 */
export function validatePromptSize(prompt, maxTokens = 128000) {
    if (!prompt) {
        return { valid: true, estimatedTokens: 0 };
    }
    
    // Rough estimate: 1 token ≈ 4 characters
    const estimatedTokens = Math.ceil(prompt.length / 4);
    
    if (estimatedTokens > maxTokens) {
        return {
            valid: false,
            estimatedTokens,
            message: `Prompt too large: ~${estimatedTokens} tokens (max: ${maxTokens})`
        };
    }
    
    return { valid: true, estimatedTokens };
}
