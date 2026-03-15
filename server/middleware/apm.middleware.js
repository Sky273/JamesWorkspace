/**
 * Application Performance Monitoring (APM) Middleware
 * Tracks slow requests, provides detailed timing breakdowns, and alerts on performance issues
 */

import { safeLog } from '../utils/logger.backend.js';

// Configuration
const APM_CONFIG = {
    slowRequestThreshold: parseInt(process.env.APM_SLOW_THRESHOLD || '1000', 10),
    verySlowRequestThreshold: parseInt(process.env.APM_VERY_SLOW_THRESHOLD || '5000', 10),
    criticalRequestThreshold: parseInt(process.env.APM_CRITICAL_THRESHOLD || '30000', 10),
    traceSamplingRate: parseFloat(process.env.APM_TRACE_SAMPLING || '1.0'),
    maxSlowRequests: parseInt(process.env.APM_MAX_SLOW_REQUESTS || '100', 10),
    excludedPaths: ['/health', '/health/memory', '/api/metrics', '/favicon.ico']
};

// Circular buffer for slow requests
const slowRequestsBuffer = [];

/**
 * Normalize endpoint path (replace UUIDs and IDs with :id)
 */
function normalizeEndpoint(path) {
    return path
        .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id')
        .replace(/\/\d+/g, '/:id');
}

/**
 * Get severity level based on duration
 */
function getSeverity(duration) {
    if (duration >= APM_CONFIG.criticalRequestThreshold) return 'critical';
    if (duration >= APM_CONFIG.verySlowRequestThreshold) return 'very_slow';
    if (duration >= APM_CONFIG.slowRequestThreshold) return 'slow';
    return 'normal';
}

/**
 * Add slow request to buffer
 */
function addSlowRequest(requestData) {
    slowRequestsBuffer.push(requestData);
    if (slowRequestsBuffer.length > APM_CONFIG.maxSlowRequests) {
        slowRequestsBuffer.shift();
    }
}

/**
 * APM Middleware - tracks request performance
 */
export function apmMiddleware(req, res, next) {
    // Skip excluded paths
    if (APM_CONFIG.excludedPaths.some(p => req.path.startsWith(p))) {
        return next();
    }

    const startTime = Date.now();
    const startHrTime = process.hrtime();

    // Track when response finishes
    res.on('finish', () => {
        const duration = Date.now() - startTime;
        const severity = getSeverity(duration);

        if (severity !== 'normal') {
            const [seconds, nanoseconds] = process.hrtime(startHrTime);
            const preciseMs = (seconds * 1000 + nanoseconds / 1e6).toFixed(2);

            const requestData = {
                timestamp: new Date().toISOString(),
                method: req.method,
                path: req.originalUrl || req.path,
                endpoint: normalizeEndpoint(req.path),
                duration: parseInt(preciseMs),
                severity,
                statusCode: res.statusCode,
                userId: req.user?.id || null,
                userAgent: req.get('user-agent')?.substring(0, 100) || null
            };

            addSlowRequest(requestData);

            if (severity === 'critical') {
                safeLog('warn', 'Critical slow request detected', requestData);
            }
        }
    });

    next();
}

/**
 * Get APM statistics
 */
export function getAPMStats() {
    const now = Date.now();
    const last5min = slowRequestsBuffer.filter(r => 
        new Date(r.timestamp).getTime() > now - 5 * 60 * 1000
    );
    const last1h = slowRequestsBuffer.filter(r => 
        new Date(r.timestamp).getTime() > now - 60 * 60 * 1000
    );

    const severityCounts = {
        slow: 0,
        very_slow: 0,
        critical: 0
    };

    slowRequestsBuffer.forEach(r => {
        if (severityCounts[r.severity] !== undefined) {
            severityCounts[r.severity]++;
        }
    });

    const avgDuration = slowRequestsBuffer.length > 0
        ? Math.round(slowRequestsBuffer.reduce((sum, r) => sum + r.duration, 0) / slowRequestsBuffer.length)
        : 0;

    // Top slow endpoints
    const endpointStats = {};
    slowRequestsBuffer.forEach(r => {
        const key = `${r.method} ${r.endpoint}`;
        if (!endpointStats[key]) {
            endpointStats[key] = { count: 0, totalDuration: 0, maxDuration: 0 };
        }
        endpointStats[key].count++;
        endpointStats[key].totalDuration += r.duration;
        endpointStats[key].maxDuration = Math.max(endpointStats[key].maxDuration, r.duration);
    });

    const topSlowEndpoints = Object.entries(endpointStats)
        .map(([endpoint, stats]) => ({
            endpoint,
            count: stats.count,
            avgDuration: Math.round(stats.totalDuration / stats.count),
            maxDuration: stats.maxDuration
        }))
        .sort((a, b) => b.avgDuration - a.avgDuration)
        .slice(0, 10);

    return {
        config: {
            slowThreshold: APM_CONFIG.slowRequestThreshold,
            verySlowThreshold: APM_CONFIG.verySlowRequestThreshold,
            criticalThreshold: APM_CONFIG.criticalRequestThreshold
        },
        summary: {
            totalTracked: slowRequestsBuffer.length,
            last5min: last5min.length,
            last1h: last1h.length,
            avgDuration,
            severityCounts
        },
        topSlowEndpoints,
        timestamp: new Date().toISOString()
    };
}

/**
 * Get slow requests list
 */
export function getSlowRequests(limit = 50) {
    return slowRequestsBuffer
        .slice(-limit)
        .reverse();
}

/**
 * Clear slow requests buffer
 */
export function clearSlowRequests() {
    slowRequestsBuffer.length = 0;
    safeLog('info', 'APM slow requests buffer cleared');
}

export default {
    apmMiddleware,
    getAPMStats,
    getSlowRequests,
    clearSlowRequests
};
