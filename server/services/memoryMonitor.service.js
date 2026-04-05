/**
 * Memory Monitor Service
 * Monitors memory usage and triggers cleanup when thresholds are exceeded
 */

import { safeLog } from '../utils/logger.backend.js';

// Memory thresholds (in MB)
const MEMORY_WARNING_THRESHOLD = 300;
const MEMORY_CRITICAL_THRESHOLD = 500;

// Monitoring interval (5 minutes)
const MONITOR_INTERVAL_MS = 5 * 60 * 1000;

// Cache cleanup interval (15 minutes)
const CACHE_CLEANUP_INTERVAL_MS = 15 * 60 * 1000;

// Store interval references for cleanup
let memoryMonitorInterval = null;
let cacheCleanupInterval = null;

// Cache cleanup functions (injected at startup)
let cacheCleanupFunctions = [];

/**
 * Register cache cleanup functions
 * @param {Function[]} cleanupFns - Array of cleanup functions
 */
export function registerCacheCleanupFunctions(cleanupFns) {
    cacheCleanupFunctions = cleanupFns;
    safeLog('info', 'Memory monitor: registered cache cleanup functions', { 
        count: cleanupFns.length 
    });
}

/**
 * Get current memory usage in MB
 * @returns {Object} Memory usage stats
 */
export function getMemoryUsage() {
    const memUsage = process.memoryUsage();
    return {
        rss: Math.round(memUsage.rss / 1024 / 1024),
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
        external: Math.round(memUsage.external / 1024 / 1024)
    };
}

/**
 * Trigger garbage collection if available
 */
function triggerGC() {
    if (global.gc) {
        safeLog('info', 'Triggering garbage collection');
        global.gc();
    }
}

/**
 * Execute all registered cache cleanup functions
 */
function cleanupCaches() {
    for (const cleanupFn of cacheCleanupFunctions) {
        try {
            cleanupFn();
        } catch (err) {
            safeLog('error', 'Memory monitor: cache cleanup error', { error: err.message });
        }
    }
}

/**
 * Check memory and take action if needed
 */
function checkMemory() {
    const memMB = getMemoryUsage();
    
    // Log memory at info level for monitoring
    safeLog('info', 'Memory usage', memMB);
    
    if (memMB.heapUsed > MEMORY_CRITICAL_THRESHOLD) {
        safeLog('warn', 'Critical memory usage detected', { heapUsedMB: memMB.heapUsed });
        triggerGC();
        cleanupCaches();
        safeLog('info', 'Market Radar caches cleared due to high memory');
    } else if (memMB.heapUsed > MEMORY_WARNING_THRESHOLD) {
        safeLog('warn', 'High memory usage detected', { heapUsedMB: memMB.heapUsed });
    }
}

/**
 * Periodic cache cleanup based on memory threshold
 */
function periodicCacheCleanup() {
    const memMB = getMemoryUsage();
    
    // Only clear if memory usage is above warning threshold
    if (memMB.heapUsed > MEMORY_WARNING_THRESHOLD) {
        safeLog('info', 'Periodic Market Radar cache cleanup', { heapUsedMB: memMB.heapUsed });
        cleanupCaches();
    }
}

/**
 * Start memory monitoring
 */
export function startMemoryMonitor() {
    if (memoryMonitorInterval || cacheCleanupInterval) {
        stopMemoryMonitor();
    }

    // Memory check every 5 minutes
    memoryMonitorInterval = setInterval(checkMemory, MONITOR_INTERVAL_MS);
    
    // Cache cleanup every 15 minutes (if memory is high)
    cacheCleanupInterval = setInterval(periodicCacheCleanup, CACHE_CLEANUP_INTERVAL_MS);

    safeLog('info', 'Market Radar cache cleanup scheduled (every 15 min if memory > 300MB)');
    safeLog('info', 'Memory monitor started', {
        monitorIntervalMs: MONITOR_INTERVAL_MS,
        cacheCleanupIntervalMs: CACHE_CLEANUP_INTERVAL_MS,
        warningThresholdMB: MEMORY_WARNING_THRESHOLD,
        criticalThresholdMB: MEMORY_CRITICAL_THRESHOLD
    });
}

/**
 * Stop memory monitoring
 */
export function stopMemoryMonitor() {
    if (memoryMonitorInterval) {
        clearInterval(memoryMonitorInterval);
        memoryMonitorInterval = null;
    }
    
    if (cacheCleanupInterval) {
        clearInterval(cacheCleanupInterval);
        cacheCleanupInterval = null;
    }
    
    safeLog('info', 'Memory monitor stopped');
}
