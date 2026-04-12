import express from 'express';
import { CACHE_BACKEND } from '../config/constants.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.middleware.js';
import { validateQuery, validators } from '../utils/validation.js';
import { getSecurityLogs, getSecurityLogsCount } from '../services/security.service.js';
import { getProxyLogs, getProxyLogsCount, getProxyLogsStats, safeLog } from '../utils/logger.backend.js';
import { listUsers } from '../services/users.service.js';
import { getApplicationCacheDiagnosticSummary, getApplicationCacheUsageSummary } from './healthRouteHelpers.js';

// Import cache stats functions
import { getBlacklistStats } from '../services/tokenBlacklist.service.js';
import { getSettingsCacheStats } from '../services/settings.service.js';
import { getFactsCacheStats } from '../services/marketFacts.service.js';
import { getTrendsCacheStats } from '../services/marketTrends.service.js';
import { getMetiersCacheStats } from '../services/rome.service.js';
import { getTagsCacheStats } from '../services/tagsCache.service.js';
import { getEscoCacheStats } from '../services/escoService.js';
import { getStatsCacheStats } from './resumes/stats.routes.js';
import { getCacheRegistryStats } from '../services/cache.service.js';

const router = express.Router();
const MAX_SECURITY_LOGS_LIMIT = 1000;

// ============================================
// ADMIN ROUTES
// ============================================

// GET /api/admin/security-logs - Get security and proxy logs combined
router.get('/security-logs', authenticateToken, requireAdmin, validateQuery({
    limit: (val) => {
        if (val === 'all') {
            return { valid: true, value: 'all' };
        }
        return validators.positiveInteger(val);
    },
    offset: validators.positiveInteger,
    level: validators.maxLength(50),
    event: validators.maxLength(100),
    source: validators.maxLength(50)
}), (req, res) => {
    try {
        const { level, event, source, limit = 100, offset = 0 } = req.query;
        const parsedLimit = limit === 'all'
            ? MAX_SECURITY_LOGS_LIMIT
            : Math.min(parseInt(limit, 10), MAX_SECURITY_LOGS_LIMIT);
        const parsedOffset = parseInt(offset) || 0;
        
        // Get logs from appropriate source(s) - already sorted newest first
        let logs;
        if (source) {
            if (source === 'security') {
                logs = getSecurityLogs().map(log => ({ ...log, source: 'security' }));
            } else if (source === 'proxy') {
                logs = getProxyLogs();
            } else {
                // Unknown source, return empty
                logs = [];
            }
        } else {
            // Merge both sources - they're already sorted, use merge sort approach
            const secLogs = getSecurityLogs().map(log => ({ ...log, source: 'security' }));
            const proxyLogsArr = getProxyLogs();
            logs = mergeSortedArrays(secLogs, proxyLogsArr);
        }
        
        // Apply filters in single pass and collect results up to limit+offset
        const filteredLogs = [];
        let totalMatching = 0;
        
        for (const log of logs) {
            // Apply level filter (case-insensitive)
            if (level && log.level?.toUpperCase() !== level.toUpperCase()) continue;
            // Apply event filter
            if (event && log.event !== event) continue;
            
            totalMatching++;
            
            // Only collect logs within the requested window
            if (totalMatching > parsedOffset && filteredLogs.length < parsedLimit) {
                filteredLogs.push(log);
            }
        }
        
        res.json({
            logs: filteredLogs,
            total: totalMatching,
            offset: parsedOffset,
            limit: parsedLimit
        });
    } catch (error) {
        safeLog('error', 'Error fetching security logs', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch security logs' });
    }
});

/**
 * Merge two sorted arrays (newest first) into one sorted array
 * O(n+m) instead of O((n+m) * log(n+m)) for concat+sort
 */
function mergeSortedArrays(arr1, arr2) {
    const result = [];
    let i = 0, j = 0;
    
    while (i < arr1.length && j < arr2.length) {
        const time1 = new Date(arr1[i].timestamp).getTime();
        const time2 = new Date(arr2[j].timestamp).getTime();
        
        if (time1 >= time2) {
            result.push(arr1[i++]);
        } else {
            result.push(arr2[j++]);
        }
    }
    
    // Add remaining elements
    while (i < arr1.length) result.push(arr1[i++]);
    while (j < arr2.length) result.push(arr2[j++]);
    
    return result;
}

// GET /api/admin/security-filters - Get available filter options dynamically
router.get('/security-filters', authenticateToken, requireAdmin, (req, res) => {
    try {
        const secLogs = getSecurityLogs().map(log => ({ ...log, source: 'security' }));
        const proxyLogsArr = getProxyLogs();
        const allLogs = [...secLogs, ...proxyLogsArr];
        
        // Extract unique values for each filter
        const levels = new Set();
        const events = new Set();
        const sources = new Set();
        
        for (const log of allLogs) {
            if (log.level) levels.add(log.level);
            if (log.event) events.add(log.event);
            if (log.source) sources.add(log.source);
        }
        
        res.json({
            levels: Array.from(levels).sort(),
            events: Array.from(events).sort(),
            sources: Array.from(sources).sort()
        });
    } catch (error) {
        safeLog('error', 'Error fetching security filters', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch security filters' });
    }
});

// GET /api/admin/security-stats - Get combined security and proxy statistics
router.get('/security-stats', authenticateToken, requireAdmin, (req, res) => {
    try {
        // Get counts from optimized functions
        const securityCount = getSecurityLogsCount();
        const proxyCount = getProxyLogsCount();
        
        // Get proxy logs stats (already optimized)
        const proxyStats = getProxyLogsStats();
        
        // Initialize stats
        const stats = {
            total: securityCount + proxyCount,
            byLevel: { ...proxyStats.byLevel },
            byEvent: {},
            bySource: {
                security: securityCount,
                proxy: proxyCount
            },
            recent: {
                last24h: proxyStats.recent.last24h,
                lastHour: proxyStats.recent.lastHour
            }
        };
        
        // Process security logs for additional stats
        const now = Date.now();
        const oneDayAgo = now - 24 * 60 * 60 * 1000;
        const oneHourAgo = now - 60 * 60 * 1000;
        
        for (const log of getSecurityLogs()) {
            // Normalize level to uppercase for consistent counting
            const normalizedLevel = log.level?.toUpperCase() || 'UNKNOWN';
            stats.byLevel[normalizedLevel] = (stats.byLevel[normalizedLevel] || 0) + 1;
            if (log.event) {
                stats.byEvent[log.event] = (stats.byEvent[log.event] || 0) + 1;
            }
            
            const logTime = new Date(log.timestamp).getTime();
            if (logTime > oneDayAgo) stats.recent.last24h++;
            if (logTime > oneHourAgo) stats.recent.lastHour++;
        }
        
        // Normalize byLevel keys from proxy stats (may have lowercase)
        const normalizedByLevel = {};
        for (const [level, count] of Object.entries(stats.byLevel)) {
            const upperLevel = level?.toUpperCase() || 'UNKNOWN';
            normalizedByLevel[upperLevel] = (normalizedByLevel[upperLevel] || 0) + count;
        }
        stats.byLevel = normalizedByLevel;
        
        res.json(stats);
    } catch (error) {
        safeLog('error', 'Error fetching security stats', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch security stats' });
    }
});

// GET /api/admin/cache-stats - Get unified cache statistics (admin only)
router.get('/cache-stats', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const memUsage = process.memoryUsage();
        const [settingsCacheStats, cacheRegistryStats, tokenBlacklistStats, resumeStatsCache, marketFactsCache, marketTrendsCache, metiersCache, tagsCacheStats, escoCacheStats] = await Promise.all([
            getSettingsCacheStats(),
            getCacheRegistryStats(),
            Promise.resolve(getBlacklistStats()),
            Promise.resolve(getStatsCacheStats()),
            Promise.resolve(getFactsCacheStats()),
            Promise.resolve(getTrendsCacheStats()),
            Promise.resolve(getMetiersCacheStats()),
            Promise.resolve(getTagsCacheStats()),
            Promise.resolve(getEscoCacheStats())
        ]);
        const detailedCaches = {
            settings: settingsCacheStats,
            tokenBlacklist: tokenBlacklistStats,
            resumeStats: resumeStatsCache,
            marketFacts: marketFactsCache,
            marketTrends: marketTrendsCache,
            metiers: metiersCache,
            tags: tagsCacheStats,
            esco: escoCacheStats
        };
        const effectiveCacheDiagnostics = getApplicationCacheDiagnosticSummary({
            cacheRegistry: cacheRegistryStats,
            caches: detailedCaches
        });
        const cacheUsageSummary = getApplicationCacheUsageSummary({
            cacheRegistry: cacheRegistryStats,
            caches: detailedCaches
        });
        const stats = {
            timestamp: new Date().toISOString(),
            memory: {
                rss: Math.round(memUsage.rss / 1024 / 1024),
                heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
                heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
                external: Math.round(memUsage.external / 1024 / 1024)
            },
            cacheBackend: {
                configuredBackend: CACHE_BACKEND,
                backend: effectiveCacheDiagnostics.backend,
                effectiveBackend: effectiveCacheDiagnostics.effectiveBackend,
                cacheLayer: effectiveCacheDiagnostics.cacheLayer,
                applicationCacheActive: effectiveCacheDiagnostics.applicationCacheActive,
                connected: effectiveCacheDiagnostics.connected,
                fallbackReason: effectiveCacheDiagnostics.fallbackReason,
                message: effectiveCacheDiagnostics.message,
                backendBreakdown: effectiveCacheDiagnostics.backendBreakdown
            },
            cacheSummary: cacheUsageSummary,
            caches: {
                tokenBlacklist: tokenBlacklistStats,
                settings: settingsCacheStats,
                resumeStats: resumeStatsCache,
                marketFacts: marketFactsCache,
                marketTrends: marketTrendsCache,
                metiers: metiersCache,
                tags: tagsCacheStats,
                esco: escoCacheStats
            }
        };
        
        res.json(stats);
    } catch (error) {
        safeLog('error', 'Error fetching cache stats', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch cache stats' });
    }
});

// GET /api/admin/users - Get all users (admin only) - alias for /api/auth/users
router.get('/users', authenticateToken, requireAdmin, validateQuery({
    page: validators.positiveInteger,
    limit: validators.positiveInteger,
    search: validators.maxLength(200),
    role: validators.maxLength(50),
    status: validators.maxLength(50)
}), async (req, res) => {
    try {
        const {
            page,
            limit = 100,
            search,
            role,
            status
        } = req.query;
        const bypassCache = req.query.refresh === '1' || req.query.refresh === 'true';
        const parsedPage = Number.isInteger(Number.parseInt(page, 10)) ? Number.parseInt(page, 10) : 1;
        const parsedLimitRaw = Number.parseInt(limit, 10);
        const parsedLimit = Number.isInteger(parsedLimitRaw) ? Math.min(parsedLimitRaw, 100) : 100;

        const { users: records, hasMore } = await listUsers({
            search: search || undefined,
            role: role || undefined,
            status: status || undefined,
            page: parsedPage,
            limit: parsedLimit,
            ...(bypassCache ? { bypassCache: true } : {})
        });
        const users = records.map(record => ({
            id: record.id,
            name: record.name,
            email: record.email,
            firmId: record.firm_id || null,
            firmName: record.firm_name || null,
            customerName: record.firm_name || null,
            // Legacy aliases kept for compatibility with older admin payload consumers.
            firm: record.firm_name || null,
            customer: record.firm_name || null,
            role: record.role || 'user',
            status: record.status || 'active'
        }));
        res.json({
            users,
            pagination: {
                page: parsedPage,
                limit: parsedLimit,
                hasMore
            }
        });
    } catch (error) {
        safeLog('error', 'Error fetching users', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

export default router;
