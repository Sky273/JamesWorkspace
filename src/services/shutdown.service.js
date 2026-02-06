/**
 * Graceful Shutdown Service
 * Centralized cleanup for all caches and intervals on application shutdown
 */

import { safeLog } from '../utils/logger.backend.js';

// Registry of cleanup functions
const cleanupHandlers = [];

/**
 * Register a cleanup handler
 * @param {string} name - Name of the service/cache
 * @param {Function} handler - Cleanup function to call
 */
export function registerCleanupHandler(name, handler) {
    if (typeof handler !== 'function') {
        safeLog('warn', 'Shutdown: Invalid cleanup handler', { name });
        return;
    }
    cleanupHandlers.push({ name, handler });
    safeLog('debug', 'Shutdown: Registered cleanup handler', { name });
}

/**
 * Execute all cleanup handlers
 * Called on graceful shutdown
 */
export async function executeCleanup() {
    safeLog('info', 'Shutdown: Starting graceful cleanup...', { 
        handlersCount: cleanupHandlers.length 
    });
    
    const startTime = Date.now();
    const results = [];
    
    for (const { name, handler } of cleanupHandlers) {
        try {
            await Promise.resolve(handler());
            results.push({ name, status: 'success' });
        } catch (error) {
            results.push({ name, status: 'error', error: error.message });
            safeLog('error', `Shutdown: Cleanup failed for ${name}`, { error: error.message });
        }
    }
    
    const duration = Date.now() - startTime;
    const successCount = results.filter(r => r.status === 'success').length;
    const errorCount = results.filter(r => r.status === 'error').length;
    
    safeLog('info', 'Shutdown: Graceful cleanup completed', {
        duration: `${duration}ms`,
        total: cleanupHandlers.length,
        success: successCount,
        errors: errorCount
    });
    
    return results;
}

/**
 * Get all cache statistics
 * Useful for monitoring memory usage
 */
export function getAllCacheStats() {
    const stats = {};
    
    // Import stats functions dynamically to avoid circular dependencies
    // These will be populated by the services that register themselves
    return stats;
}

/**
 * Setup process signal handlers for graceful shutdown
 */
export function setupShutdownHandlers() {
    const shutdown = async (signal) => {
        safeLog('info', `Shutdown: Received ${signal}, initiating graceful shutdown...`);
        
        try {
            await executeCleanup();
            safeLog('info', 'Shutdown: All cleanup completed, exiting...');
            process.exit(0);
        } catch (error) {
            safeLog('error', 'Shutdown: Error during cleanup', { error: error.message });
            process.exit(1);
        }
    };
    
    // Handle various shutdown signals
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    
    // Handle uncaught exceptions gracefully
    process.on('uncaughtException', async (error) => {
        safeLog('error', 'Shutdown: Uncaught exception', { 
            error: error.message, 
            stack: error.stack 
        });
        await executeCleanup();
        process.exit(1);
    });
    
    // Handle unhandled promise rejections
    process.on('unhandledRejection', async (reason, promise) => {
        safeLog('error', 'Shutdown: Unhandled promise rejection', { 
            reason: reason?.message || String(reason)
        });
        // Don't exit on unhandled rejections, just log
    });
    
    safeLog('info', 'Shutdown: Signal handlers registered');
}

export default {
    registerCleanupHandler,
    executeCleanup,
    getAllCacheStats,
    setupShutdownHandlers
};
