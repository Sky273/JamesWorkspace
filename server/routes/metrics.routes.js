import express from 'express';
import { metrics } from '../services/metrics.service.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.middleware.js';
import { safeLog } from '../utils/logger.backend.js';
import { getDatabaseMetrics } from '../services/health.service.js';
import { getStorageStats, getFileCleanupStats } from '../utils/fileCleanup.js';
import { getAPMStats, getSlowRequests, clearSlowRequests } from '../middleware/apm.middleware.js';

const router = express.Router();

// Cache for database metrics (refreshed every 30 seconds)
let dbMetricsCache = null;
let dbMetricsCacheTime = 0;
const DB_METRICS_CACHE_TTL = 30 * 1000; // 30 seconds

// ============================================
// METRICS ENDPOINTS
// ============================================

/**
 * GET /api/metrics
 * Get comprehensive server metrics (admin only)
 */
router.get('/', authenticateToken, requireAdmin, (req, res) => {
    try {
        const metricsData = metrics.getMetrics();
        res.json(metricsData);
    } catch (error) {
        safeLog('error', 'Error fetching metrics', { error: error.message });
        res.status(500).json({ 
            error: 'Failed to fetch metrics'
        });
    }
});

/**
 * GET /api/metrics/summary
 * Get simplified metrics summary (admin only)
 */
router.get('/summary', authenticateToken, requireAdmin, (req, res) => {
    try {
        const fullMetrics = metrics.getMetrics();
        
        const summary = {
            uptime: fullMetrics.server.uptime,
            requests: {
                total: fullMetrics.requests.total,
                last24h: fullMetrics.requests.last24h,
                avgResponseTime: fullMetrics.performance.avgResponseTime
            },
            cache: {
                hitRate: fullMetrics.cache.hitRate
            },
            errors: {
                total: fullMetrics.errors.total,
                rate: fullMetrics.errors.rate
            },
            memory: fullMetrics.memory
        };
        
        res.json(summary);
    } catch (error) {
        safeLog('error', 'Error fetching metrics summary', { error: error.message });
        res.status(500).json({ 
            error: 'Failed to fetch metrics summary' 
        });
    }
});

/**
 * GET /api/metrics/performance
 * Get performance metrics (admin only)
 */
router.get('/performance', authenticateToken, requireAdmin, (req, res) => {
    try {
        const fullMetrics = metrics.getMetrics();
        
        const performance = {
            responseTime: fullMetrics.performance,
            requests: {
                total: fullMetrics.requests.total,
                byMethod: fullMetrics.requests.byMethod,
                byStatus: fullMetrics.requests.byStatus
            },
            topEndpoints: fullMetrics.requests.topEndpoints
        };
        
        res.json(performance);
    } catch (error) {
        safeLog('error', 'Error fetching performance metrics', { error: error.message });
        res.status(500).json({ 
            error: 'Failed to fetch performance metrics' 
        });
    }
});

/**
 * GET /api/metrics/errors
 * Get error metrics (admin only)
 */
router.get('/errors', authenticateToken, requireAdmin, (req, res) => {
    try {
        const fullMetrics = metrics.getMetrics();
        res.json(fullMetrics.errors);
    } catch (error) {
        safeLog('error', 'Error fetching error metrics', { error: error.message });
        res.status(500).json({ 
            error: 'Failed to fetch error metrics' 
        });
    }
});

/**
 * GET /api/metrics/cache
 * Get cache metrics (admin only)
 */
router.get('/cache', authenticateToken, requireAdmin, (req, res) => {
    try {
        const fullMetrics = metrics.getMetrics();
        res.json(fullMetrics.cache);
    } catch (error) {
        safeLog('error', 'Error fetching cache metrics', { error: error.message });
        res.status(500).json({ 
            error: 'Failed to fetch cache metrics' 
        });
    }
});

/**
 * GET /api/metrics/llm
 * Get LLM usage metrics (admin only)
 */
router.get('/llm', authenticateToken, requireAdmin, (req, res) => {
    try {
        const fullMetrics = metrics.getMetrics();
        res.json(fullMetrics.llm);
    } catch (error) {
        safeLog('error', 'Error fetching LLM metrics', { error: error.message });
        res.status(500).json({ 
            error: 'Failed to fetch LLM metrics' 
        });
    }
});

/**
 * GET /api/metrics/operations
 * Get operational metrics around uploads, OCR, storage, and cleanup (admin only)
 */
router.get('/operations', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const fullMetrics = metrics.getMetrics();
        const { binaryStorageResult, batchStorageResult } = await getDatabaseMetrics();
        const storageStats = await getStorageStats();
        const cleanupStats = getFileCleanupStats();

        res.json({
            operations: fullMetrics.operations || {
                uploads: metrics.operations?.uploads || {},
                ocr: metrics.operations?.ocr || {},
                cleanup: metrics.operations?.cleanup || {}
            },
            binaryStorage: {
                resumesWithBinary: parseInt(binaryStorageResult.rows[0]?.resumes_with_binary || 0),
                resumeBinaryBytes: parseInt(binaryStorageResult.rows[0]?.resume_binary_bytes || 0),
                avgResumeBinaryBytes: Math.round(parseFloat(binaryStorageResult.rows[0]?.avg_resume_binary_bytes || 0)),
                maxResumeBinaryBytes: parseInt(binaryStorageResult.rows[0]?.max_resume_binary_bytes || 0),
                batchItemsWithFileData: parseInt(batchStorageResult.rows[0]?.items_with_file_data || 0),
                batchFileDataBytes: parseInt(batchStorageResult.rows[0]?.total_file_data_bytes || 0)
            },
            storage: storageStats,
            cleanup: cleanupStats,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        safeLog('error', 'Error fetching operational metrics', { error: error.message });
        res.status(500).json({
            error: 'Failed to fetch operational metrics'
        });
    }
});
/**
 * POST /api/metrics/reset
 * Reset all metrics (admin only, use with caution)
 */
router.post('/reset', authenticateToken, requireAdmin, (req, res) => {
    try {
        metrics.reset();
        res.json({ 
            message: 'Metrics reset successfully',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        safeLog('error', 'Error resetting metrics', { error: error.message });
        res.status(500).json({ 
            error: 'Failed to reset metrics' 
        });
    }
});

/**
 * GET /api/metrics/database
 * Get database performance metrics (admin only)
 * Cached for 30 seconds to reduce database load
 */
router.get('/database', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const now = Date.now();
        
        // Return cached data if still valid
        if (dbMetricsCache && (now - dbMetricsCacheTime) < DB_METRICS_CACHE_TTL) {
            return res.json({
                ...dbMetricsCache,
                cached: true,
                cacheAge: `${Math.round((now - dbMetricsCacheTime) / 1000)}s`
            });
        }
        
        const { sizeResult, tableStatsResult, connectionStatsResult, binaryStorageResult, batchStorageResult, queryTime } = await getDatabaseMetrics();
        
        const result = {
            database: {
                size: parseInt(sizeResult.rows[0]?.db_size || 0),
                sizePretty: sizeResult.rows[0]?.db_size_pretty || 'Unknown'
            },
            tables: tableStatsResult.rows.map(row => ({
                name: row.table_name,
                rowCount: parseInt(row.row_count || 0),
                deadRows: parseInt(row.dead_rows || 0),
                lastVacuum: row.last_vacuum,
                lastAutovacuum: row.last_autovacuum,
                lastAnalyze: row.last_analyze
            })),
            connections: {
                total: parseInt(connectionStatsResult.rows[0]?.total_connections || 0),
                active: parseInt(connectionStatsResult.rows[0]?.active_connections || 0),
                idle: parseInt(connectionStatsResult.rows[0]?.idle_connections || 0)
            },
            queryTime: `${queryTime}ms`,
            timestamp: new Date().toISOString()
        };
        
        // Update cache
        dbMetricsCache = result;
        dbMetricsCacheTime = now;
        
        res.json(result);
    } catch (error) {
        safeLog('error', 'Error fetching database metrics', { error: error.message });
        res.status(500).json({ 
            error: 'Failed to fetch database metrics' 
        });
    }
});

/**
 * GET /api/metrics/apm
 * Get APM (Application Performance Monitoring) statistics (admin only)
 */
router.get('/apm', authenticateToken, requireAdmin, (req, res) => {
    try {
        const apmStats = getAPMStats();
        res.json(apmStats);
    } catch (error) {
        safeLog('error', 'Error fetching APM stats', { error: error.message });
        res.status(500).json({ 
            error: 'Failed to fetch APM stats' 
        });
    }
});

/**
 * GET /api/metrics/apm/slow-requests
 * Get detailed slow requests list (admin only)
 */
router.get('/apm/slow-requests', authenticateToken, requireAdmin, (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const slowRequests = getSlowRequests(limit);
        res.json({
            count: slowRequests.length,
            requests: slowRequests
        });
    } catch (error) {
        safeLog('error', 'Error fetching slow requests', { error: error.message });
        res.status(500).json({ 
            error: 'Failed to fetch slow requests' 
        });
    }
});

/**
 * DELETE /api/metrics/apm/slow-requests
 * Clear slow requests buffer (admin only)
 */
router.delete('/apm/slow-requests', authenticateToken, requireAdmin, (req, res) => {
    try {
        clearSlowRequests();
        res.json({ 
            message: 'Slow requests buffer cleared',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        safeLog('error', 'Error clearing slow requests', { error: error.message });
        res.status(500).json({ 
            error: 'Failed to clear slow requests' 
        });
    }
});

export default router;



