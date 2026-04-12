/**
 * Market Radar - Facts Data Routes
 * Endpoints for retrieving market facts, trends by keyword, regional data
 */

import express from 'express';
import { authenticateToken, requireAdmin } from '../../middleware/auth.middleware.js';
import { safeLog } from '../../utils/logger.backend.js';
import {
    getFactsByDateRange,
    getLatestFacts,
    getKeywordTrend,
    getRegionalComparison,
    invalidateFactsCache,
    loadFactsCache,
    getFactsFilterOptions,
    getFactsSummary
} from '../../services/marketFacts.service.js';

const router = express.Router();
const MAX_ALL_FACTS_RESPONSE = 2000;

function parsePositiveInteger(value, { field, maxValue = null } = {}) {
    if (value === undefined) {
        return undefined;
    }

    const parsedValue = Number.parseInt(value, 10);
    if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
        throw new Error(`${field} must be a positive integer`);
    }

    return maxValue ? Math.min(parsedValue, maxValue) : parsedValue;
}

/**
 * GET /api/market-radar/facts/all
 * Get ALL facts data (no pagination, uses cache)
 * Returns all facts for efficient frontend processing
 */
router.get('/facts/all', authenticateToken, async (req, res) => {
    try {
        const startTime = Date.now();
        if (req.query.refresh === '1' || req.query.refresh === 'true') {
            invalidateFactsCache();
        }
        
        // Keep the "all facts" endpoint bounded to protect server and client memory.
        const result = await getFactsByDateRange(null, null, {
            page: 1,
            pageSize: MAX_ALL_FACTS_RESPONSE
        });
        
        const duration = Date.now() - startTime;
        const totalCount = result.pagination?.totalCount ?? result.facts.length;
        const returnedCount = result.facts.length;
        const truncated = totalCount > returnedCount;
        safeLog('info', `Market Radar: All facts loaded in ${duration}ms`, { 
            totalCount,
            returnedCount,
            truncated
        });

        // Set cache headers for client-side caching (5 minutes)
        res.set('Cache-Control', 'private, max-age=300');
        
        res.json({
            success: true,
            facts: result.facts,
            totalCount,
            returnedCount,
            truncated,
            duration
        });
    } catch {
        safeLog('error', 'Market Radar: Failed to get all facts');
        res.status(500).json({ 
            error: 'Failed to get all facts' 
        });
    }
});

/**
 * GET /api/market-radar/facts/filters
 * Get available filter options for facts
 */
router.get('/facts/filters', authenticateToken, async (req, res) => {
    try {
        if (req.query.refresh === '1' || req.query.refresh === 'true') {
            invalidateFactsCache();
        }
        const filters = await getFactsFilterOptions();
        safeLog('info', 'Market Radar: Facts filters loaded', { 
            sourcesCount: filters?.sources?.length || 0,
            typesCount: filters?.types?.length || 0,
            regionsCount: filters?.regions?.length || 0
        });
        res.json({
            success: true,
            filters
        });
    } catch {
        safeLog('error', 'Market Radar: Failed to get facts filters');
        res.status(500).json({ 
            error: 'Failed to get facts filters' 
        });
    }
});

/**
 * GET /api/market-radar/facts/summary
 * Get aggregated summary of facts
 */
router.get('/facts/summary', authenticateToken, async (req, res) => {
    try {
        if (req.query.refresh === '1' || req.query.refresh === 'true') {
            invalidateFactsCache();
        }
        const summary = await getFactsSummary();
        res.json({
            success: true,
            summary
        });
    } catch {
        safeLog('error', 'Market Radar: Failed to get facts summary');
        res.status(500).json({ 
            error: 'Failed to get facts summary' 
        });
    }
});

/**
 * POST /api/market-radar/facts/cache/refresh
 * Force refresh the facts cache (admin only)
 */
router.post('/facts/cache/refresh', authenticateToken, requireAdmin, async (req, res) => {
    try {
        safeLog('info', 'Market Radar: Manual facts cache refresh triggered', { userId: req.user.id });
        const startTime = Date.now();
        
        invalidateFactsCache();
        await loadFactsCache();
        
        const duration = Date.now() - startTime;
        
        res.json({
            success: true,
            message: 'Facts cache refreshed successfully',
            duration
        });
    } catch {
        safeLog('error', 'Market Radar: Facts cache refresh failed');
        res.status(500).json({ 
            error: 'Facts cache refresh failed' 
        });
    }
});

/**
 * GET /api/market-radar/facts
 * Get facts with optional filters and pagination
 * Query params: startDate, endDate, source, type, region, keyword, romeCode, page, pageSize
 */
router.get('/facts', authenticateToken, async (req, res) => {
    try {
        if (req.query.refresh === '1' || req.query.refresh === 'true') {
            invalidateFactsCache();
        }
        const { startDate, endDate, source, type, region, keyword, romeCode, page, pageSize } = req.query;
        const parsedPage = parsePositiveInteger(page, { field: 'page' });
        const parsedPageSize = parsePositiveInteger(pageSize, { field: 'pageSize', maxValue: 1000 });

        // Default to last 30 days if no dates provided
        const end = endDate || new Date().toISOString().split('T')[0];
        const start = startDate || (() => {
            const d = new Date();
            d.setDate(d.getDate() - 30);
            return d.toISOString().split('T')[0];
        })();

        const result = await getFactsByDateRange(start, end, {
            source,
            type,
            region,
            keyword,
            romeCode,
            page: parsedPage,
            pageSize: parsedPageSize
        });

        res.json({
            success: true,
            count: result.facts.length,
            dateRange: { start, end },
            facts: result.facts,
            pagination: result.pagination
        });
    } catch (error) {
        if (error.message?.includes('must be a positive integer')) {
            return res.status(400).json({
                error: error.message
            });
        }
        safeLog('error', 'Market Radar: Failed to get facts');
        res.status(500).json({ 
            error: 'Failed to retrieve facts' 
        });
    }
});

/**
 * GET /api/market-radar/latest/:type
 * Get latest facts for a specific type
 */
router.get('/latest/:type', authenticateToken, async (req, res) => {
    try {
        const { type } = req.params;
        const { source } = req.query;

        const facts = await getLatestFacts(type, source);

        res.json({
            success: true,
            type,
            source: source || 'all',
            count: facts.length,
            facts
        });
    } catch {
        safeLog('error', 'Market Radar: Failed to get latest facts');
        res.status(500).json({ 
            error: 'Failed to retrieve facts' 
        });
    }
});

/**
 * GET /api/market-radar/trend/:keyword
 * Get trend data for a specific keyword
 */
router.get('/trend/:keyword', authenticateToken, async (req, res) => {
    try {
        const { keyword } = req.params;
        const days = parsePositiveInteger(req.query.days, { field: 'days', maxValue: 365 }) || 30;

        const trend = await getKeywordTrend(keyword, days);

        res.json({
            success: true,
            ...trend
        });
    } catch (error) {
        if (error.message?.includes('must be a positive integer')) {
            return res.status(400).json({
                error: error.message
            });
        }
        safeLog('error', 'Market Radar: Failed to get trend');
        res.status(500).json({ 
            error: 'Failed to retrieve trend' 
        });
    }
});

/**
 * GET /api/market-radar/regional
 * Get regional comparison data
 */
router.get('/regional', authenticateToken, async (req, res) => {
    try {
        const date = req.query.date || new Date().toISOString().split('T')[0];
        const { source } = req.query;

        const data = await getRegionalComparison(date, source);

        res.json({
            success: true,
            date,
            source: source || 'all',
            count: data.length,
            regions: data
        });
    } catch {
        safeLog('error', 'Market Radar: Failed to get regional data');
        res.status(500).json({ 
            error: 'Failed to retrieve regional data' 
        });
    }
});

export default router;
