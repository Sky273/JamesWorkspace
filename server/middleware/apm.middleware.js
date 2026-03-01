/**
 * Application Performance Monitoring (APM) Middleware
 * Tracks slow requests, provides detailed timing breakdowns, and alerts on performance issues
 */

import { safeLog, createModuleLogger } from '../utils/logger.backend.js';

const log = createModuleLogger('apm');

// Configuration
const APM_CONFIG = {
    // Thresholds in milliseconds
    slowRequestThreshold: parseInt(process.env.APM_SLOW_THRESHOLD || '1000', 10),
    verySlowRequestThreshold: parseInt(process.env.APM_VERY_SLOW_THRESHOLD || '5000', 10),
    criticalRequestThreshold: parseInt(process.env.APM_CRITICAL_THRESHOLD || '30000', 10),
    
    // Sampling rate for detailed traces (1 = 100%, 0.1 = 10%)
    traceSamplingRate: parseFloat(process.env.APM_TRACE_SAMPLING || '1.0'),
    
    // Max slow requests to keep in memory
    maxSlowRequests: parseInt(process.env.APM_MAX_SLOW_REQUESTS || '100', 10),
    
    // Endpoints to exclude from APM tracking
    excludedPaths: ['/health', '/health/memory', '/api/metrics', '/favicon.ico']
};

// Circular buffer for slow requests
const slowRequestsBuffer = [];

/**
 * Get slow requests history
 * @param {number} limit - Maximum number of requests to return
 * @returns {Array} Slow requests sorted by duration (slowest first)
 */
export function getSlowRequests(limit = 50) {
    return [...slowRequestsBuffer]
        .sort((a, b) => b.duration - a.duration)
        .slice(0, limit);
}

/**
 * Get APM statistics
 * @returns {Object} APM statistics
 */
export function getAPMStats() {
    const requests = getSlowRequests(APM_CONFIG.maxSlowRequests);
    
    const stats = {
        totalSlowRequests: slowRequestsBuffer.length,
        thresholds: {
            slow: `${APM_CONFIG.slowRequestThreshold}ms`,
            verySlow: `${APM_CONFIG.verySlowRequestThreshold}ms`,
            critical: `${APM_CONFIG.criticalRequestThreshold}ms`
        },
        breakdown: {
            slow: 0,
            verySlow: 0,
            critical: 0
        },
        topSlowEndpoints: {},
        recentSlowRequests: requests.slice(0, 10)
    };
    
    for (const req of requests) {
        if (req.duration >= APM_CONFIG.criticalRequestThreshold) {
            stats.breakdown.critical++;
        } else if (req.duration >= APM_CONFIG.verySlowRequestThreshold) {
            stats.breakdown.verySlow++;
        } else {
            stats.breakdown.slow++;
        }
        
        // Track by endpoint
        const endpoint = req.endpoint;
        if (!stats.topSlowEndpoints[endpoint]) {
            stats.topSlowEndpoints[endpoint] = { count: 0, avgDuration: 0, maxDuration: 0 };
        }
        stats.topSlowEndpoints[endpoint].count++;
        stats.topSlowEndpoints[endpoint].maxDuration = Math.max(
            stats.topSlowEndpoints[endpoint].maxDuration, 
            req.duration
        );
    }
    
    // Calculate averages
    for (const endpoint of Object.keys(stats.topSlowEndpoints)) {
        const endpointRequests = requests.filter(r => r.endpoint === endpoint);
        const totalDuration = endpointRequests.reduce((sum, r) => sum + r.duration, 0);
        stats.topSlowEndpoints[endpoint].avgDuration = Math.round(totalDuration / endpointRequests.length);
    }
    
    // Sort endpoints by count
    stats.topSlowEndpoints = Object.entries(stats.topSlowEndpoints)
        .sort(([, a], [, b]) => b.count - a.count)
        .slice(0, 10)
        .reduce((obj, [key, value]) => ({ ...obj, [key]: value }), {});
    
    return stats;
}

/**
 * Clear slow requests buffer
 */
export function clearSlowRequests() {
    slowRequestsBuffer.length = 0;
    log.info('Slow requests buffer cleared');
}

/**
 * APM Middleware - tracks request performance
 */
export function apmMiddleware(req, res, next) {
    // Skip excluded paths
    if (APM_CONFIG.excludedPaths.some(path => req.path.startsWith(path))) {
        return next();
    }
    
    // Sampling: only trace a percentage of requests for detailed analysis
    const shouldTrace = Math.random() < APM_CONFIG.traceSamplingRate;
    
    const startTime = process.hrtime.bigint();
    const startTimestamp = new Date().toISOString();
    
    // Store timing marks for detailed breakdown
    const timings = {
        start: startTime,
        marks: {}
    };
    
    // Attach timing function to request for use in route handlers
    req.apmMark = (name) => {
        if (shouldTrace) {
            timings.marks[name] = process.hrtime.bigint();
        }
    };
    
    // Track response
    const finishHandler = () => {
        const endTime = process.hrtime.bigint();
        const durationNs = Number(endTime - startTime);
        const durationMs = Math.round(durationNs / 1_000_000);
        
        // Check if request is slow
        if (durationMs >= APM_CONFIG.slowRequestThreshold) {
            const severity = durationMs >= APM_CONFIG.criticalRequestThreshold ? 'critical' :
                           durationMs >= APM_CONFIG.verySlowRequestThreshold ? 'very_slow' : 'slow';
            
            // Normalize endpoint for grouping
            const normalizedEndpoint = normalizeEndpoint(req.path);
            
            // Build timing breakdown
            const breakdown = {};
            if (shouldTrace && Object.keys(timings.marks).length > 0) {
                let prevTime = startTime;
                for (const [name, time] of Object.entries(timings.marks)) {
                    breakdown[name] = Math.round(Number(time - prevTime) / 1_000_000);
                    prevTime = time;
                }
                breakdown['_remaining'] = Math.round(Number(endTime - prevTime) / 1_000_000);
            }
            
            const slowRequest = {
                timestamp: startTimestamp,
                method: req.method,
                path: req.path,
                endpoint: normalizedEndpoint,
                duration: durationMs,
                severity,
                statusCode: res.statusCode,
                userId: req.user?.id || null,
                userAgent: req.headers['user-agent']?.substring(0, 100) || null,
                breakdown: Object.keys(breakdown).length > 0 ? breakdown : undefined
            };
            
            // Add to buffer
            slowRequestsBuffer.push(slowRequest);
            
            // Enforce max size
            while (slowRequestsBuffer.length > APM_CONFIG.maxSlowRequests) {
                slowRequestsBuffer.shift();
            }
            
            // Log slow request
            const logLevel = severity === 'critical' ? 'error' : severity === 'very_slow' ? 'warn' : 'info';
            safeLog(logLevel, `Slow request detected (${severity})`, {
                method: req.method,
                path: req.path,
                duration: `${durationMs}ms`,
                statusCode: res.statusCode,
                userId: req.user?.id
            });
        }
        
        // Remove listener to prevent memory leak
        res.removeListener('finish', finishHandler);
    };
    
    res.on('finish', finishHandler);
    next();
}

/**
 * Normalize endpoint path for grouping
 */
function normalizeEndpoint(path) {
    return path
        // Remove UUIDs
        .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
        // Remove Airtable IDs
        .replace(/\/rec[a-zA-Z0-9]{14}/g, '/:id')
        // Remove numeric IDs
        .replace(/\/\d+/g, '/:id')
        // Remove long alphanumeric strings
        .replace(/\/[a-zA-Z0-9]{20,}/g, '/:id');
}

export default apmMiddleware;
