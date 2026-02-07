/**
 * Route Helpers
 * Reusable utilities for Express route handlers
 */

import { safeLog } from './logger.backend.js';

/**
 * Standard success response
 * @param {Response} res - Express response object
 * @param {*} data - Response data
 * @param {number} statusCode - HTTP status code (default: 200)
 */
export function sendSuccess(res, data, statusCode = 200) {
    return res.status(statusCode).json({
        success: true,
        data
    });
}

/**
 * Standard error response
 * @param {Response} res - Express response object
 * @param {string} message - Error message
 * @param {number} statusCode - HTTP status code (default: 500)
 * @param {*} details - Additional error details (only in dev)
 */
export function sendError(res, message, statusCode = 500, details = null) {
    const response = {
        success: false,
        error: message,
        statusCode
    };
    
    if (details && process.env.NODE_ENV === 'development') {
        response.details = details;
    }
    
    return res.status(statusCode).json(response);
}

/**
 * Standard paginated response
 * @param {Response} res - Express response object
 * @param {Array} data - Array of items
 * @param {Object} pagination - Pagination info
 */
export function sendPaginated(res, data, pagination) {
    return res.status(200).json({
        success: true,
        data,
        pagination: {
            page: pagination.page,
            pageSize: pagination.pageSize,
            total: pagination.total,
            totalPages: Math.ceil(pagination.total / pagination.pageSize),
            hasMore: pagination.page * pagination.pageSize < pagination.total
        }
    });
}

/**
 * Parse pagination parameters from request query
 * @param {Object} query - Request query object
 * @param {Object} defaults - Default values
 * @returns {Object} { page, pageSize, offset }
 */
export function parsePagination(query, defaults = { page: 1, pageSize: 20, maxPageSize: 100 }) {
    let page = parseInt(query.page) || defaults.page;
    let pageSize = parseInt(query.pageSize || query.limit) || defaults.pageSize;
    
    // Enforce limits
    page = Math.max(1, page);
    pageSize = Math.min(Math.max(1, pageSize), defaults.maxPageSize);
    
    const offset = (page - 1) * pageSize;
    
    return { page, pageSize, offset };
}

/**
 * Parse sort parameters from request query
 * @param {Object} query - Request query object
 * @param {Object} options - Sort options
 * @returns {Object} { column, direction, sql }
 */
export function parseSort(query, options = {}) {
    const {
        allowedColumns = ['created_at', 'updated_at', 'name'],
        defaultColumn = 'created_at',
        defaultDirection = 'DESC'
    } = options;
    
    let column = query.sortBy || query.sort || defaultColumn;
    let direction = (query.sortDir || query.order || defaultDirection).toUpperCase();
    
    // Validate column to prevent SQL injection
    if (!allowedColumns.includes(column)) {
        column = defaultColumn;
    }
    
    // Validate direction
    if (!['ASC', 'DESC'].includes(direction)) {
        direction = defaultDirection;
    }
    
    return {
        column,
        direction,
        sql: `${column} ${direction}`
    };
}

/**
 * Parse filter parameters from request query
 * @param {Object} query - Request query object
 * @param {Object} filterConfig - Configuration for allowed filters
 * @returns {Object} { conditions, params }
 */
export function parseFilters(query, filterConfig = {}) {
    const conditions = [];
    const params = [];
    let paramIndex = 1;
    
    for (const [key, config] of Object.entries(filterConfig)) {
        const value = query[key];
        
        if (value === undefined || value === null || value === '') {
            continue;
        }
        
        const column = config.column || key;
        const operator = config.operator || '=';
        
        switch (operator) {
            case 'LIKE':
            case 'ILIKE':
                conditions.push(`${column} ${operator} $${paramIndex}`);
                params.push(`%${value}%`);
                break;
            case 'IN':
                const values = Array.isArray(value) ? value : value.split(',');
                const placeholders = values.map((_, i) => `$${paramIndex + i}`).join(',');
                conditions.push(`${column} IN (${placeholders})`);
                params.push(...values);
                paramIndex += values.length - 1;
                break;
            case '>=':
            case '<=':
            case '>':
            case '<':
            case '=':
            default:
                conditions.push(`${column} ${operator} $${paramIndex}`);
                params.push(value);
                break;
        }
        
        paramIndex++;
    }
    
    return { conditions, params };
}

/**
 * Build WHERE clause from conditions
 * @param {string[]} conditions - Array of SQL conditions
 * @param {string} prefix - Prefix for WHERE (default: 'WHERE')
 * @returns {string} SQL WHERE clause
 */
export function buildWhereClause(conditions, prefix = 'WHERE') {
    if (conditions.length === 0) {
        return '';
    }
    return `${prefix} ${conditions.join(' AND ')}`;
}

/**
 * Log route access for debugging
 * @param {Request} req - Express request object
 * @param {string} routeName - Name of the route
 */
export function logRouteAccess(req, routeName) {
    safeLog('debug', `Route accessed: ${routeName}`, {
        method: req.method,
        path: req.path,
        query: req.query,
        userId: req.user?.id,
        ip: req.ip
    });
}

/**
 * Extract user context from request
 * @param {Request} req - Express request object
 * @returns {Object} User context
 */
export function getUserContext(req) {
    return {
        userId: req.user?.id,
        email: req.user?.email,
        role: req.user?.role,
        customer: req.user?.customer,
        isAdmin: req.user?.role?.toLowerCase() === 'admin'
    };
}

/**
 * Check if user can access resource based on customer
 * @param {Request} req - Express request object
 * @param {string} resourceCustomer - Customer of the resource
 * @returns {boolean}
 */
export function canAccessResource(req, resourceCustomer) {
    const { isAdmin, customer } = getUserContext(req);
    
    if (isAdmin) return true;
    if (!customer) return false;
    
    return customer === resourceCustomer;
}

/**
 * Create a standardized not found response
 * @param {Response} res - Express response object
 * @param {string} resource - Name of the resource
 */
export function sendNotFound(res, resource = 'Resource') {
    return sendError(res, `${resource} not found`, 404);
}

/**
 * Create a standardized forbidden response
 * @param {Response} res - Express response object
 * @param {string} message - Custom message
 */
export function sendForbidden(res, message = 'Access denied') {
    return sendError(res, message, 403);
}

/**
 * Create a standardized unauthorized response
 * @param {Response} res - Express response object
 * @param {string} message - Custom message
 */
export function sendUnauthorized(res, message = 'Authentication required') {
    return sendError(res, message, 401);
}

/**
 * Create a standardized validation error response
 * @param {Response} res - Express response object
 * @param {*} errors - Validation errors
 */
export function sendValidationError(res, errors) {
    return res.status(400).json({
        success: false,
        error: 'Validation failed',
        statusCode: 400,
        details: errors
    });
}

export default {
    sendSuccess,
    sendError,
    sendPaginated,
    parsePagination,
    parseSort,
    parseFilters,
    buildWhereClause,
    logRouteAccess,
    getUserContext,
    canAccessResource,
    sendNotFound,
    sendForbidden,
    sendUnauthorized,
    sendValidationError
};
