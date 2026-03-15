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

export default asyncHandler;
