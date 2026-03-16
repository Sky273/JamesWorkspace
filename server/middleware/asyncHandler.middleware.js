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
 * Wrap an async route handler with a custom error message
 * @param {Function} fn - Async route handler function
 * @param {string} errorMessage - Custom error message to return on failure
 * @returns {Function} Express middleware function
 */
export function asyncHandlerWithMessage(fn, errorMessage = 'An error occurred') {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch((error) => {
            const statusCode = error.statusCode || error.status || 500;
            safeLog('error', 'Route error with custom message', {
                path: req.path,
                method: req.method,
                error: error.message,
                customMessage: errorMessage
            });
            res.status(statusCode).json({
                error: errorMessage,
                statusCode
            });
        });
    };
}

/**
 * Global error handler middleware for Express
 * @param {Error} err - Error object
 * @param {Request} req - Express request
 * @param {Response} res - Express response
 * @param {Function} _next - Express next function (unused but required for Express error handler signature)
 */
export function globalErrorHandler(err, req, res, _next) {
    const statusCode = err.statusCode || err.status || 500;
    const isProduction = process.env.NODE_ENV === 'production';
    
    safeLog('error', 'Global error handler', {
        path: req.path,
        method: req.method,
        error: err.message,
        statusCode
    });
    
    res.status(statusCode).json({
        error: isProduction ? 'Internal server error' : err.message,
        statusCode,
        ...(isProduction ? {} : { stack: err.stack })
    });
}

export default asyncHandler;
