/**
 * Async Handler Middleware
 * Wraps async route handlers to catch errors and pass them to Express error handler
 * 
 * Usage:
 *   import { asyncHandler } from '../middleware/asyncHandler.middleware.js';
 *   router.get('/example', asyncHandler(async (req, res) => { ... }));
 */

import { safeLog } from '../utils/logger.backend.js';

/**
 * Wrap an async route handler to automatically catch errors
 * @param {Function} fn - Async route handler function
 * @returns {Function} Express middleware function
 */
export function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch((error) => {
            safeLog('error', 'Unhandled route error', {
                path: req.path,
                method: req.method,
                error: error.message,
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
            });
            next(error);
        });
    };
}

/**
 * Wrap an async route handler with custom error response
 * @param {Function} fn - Async route handler function
 * @param {string} errorMessage - Custom error message for client
 * @returns {Function} Express middleware function
 */
export function asyncHandlerWithMessage(fn, errorMessage = 'An error occurred') {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch((error) => {
            safeLog('error', 'Route error', {
                path: req.path,
                method: req.method,
                error: error.message,
                customMessage: errorMessage
            });
            
            // Determine status code
            const statusCode = error.statusCode || error.status || 500;
            
            res.status(statusCode).json({
                error: errorMessage,
                message: process.env.NODE_ENV === 'development' ? error.message : undefined,
                statusCode
            });
        });
    };
}

/**
 * Global error handler middleware
 * Should be registered last in the middleware chain
 */
export function globalErrorHandler(err, req, res, next) {
    safeLog('error', 'Global error handler caught error', {
        path: req.path,
        method: req.method,
        error: err.message,
        statusCode: err.statusCode || 500
    });
    
    const statusCode = err.statusCode || err.status || 500;
    const isProduction = process.env.NODE_ENV === 'production';
    
    res.status(statusCode).json({
        error: isProduction ? 'Internal server error' : err.message,
        statusCode,
        ...(isProduction ? {} : { stack: err.stack })
    });
}

export default asyncHandler;
