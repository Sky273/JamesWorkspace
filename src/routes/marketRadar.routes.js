/**
 * Market Radar Routes
 * API endpoints for IT market data collection and retrieval
 */

import express from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.middleware.js';
import { safeLog } from '../utils/logger.backend.js';
import {
    runFullCollection,
    runSourceCollection,
    getFactsByDateRange,
    getLatestFacts,
    getKeywordTrend,
    getRegionalComparison,
    invalidateFactsCache,
    loadFactsCache,
    getFactsFilterOptions,
    getFactsSummary
} from '../services/marketFacts.service.js';
import {
    searchOffers as searchFranceTravail,
    getReferentiel,
    IT_ROME_CODES,
    FRENCH_REGIONS,
    IT_KEYWORDS as FT_KEYWORDS
} from '../services/franceTravail.service.js';
import { getStatDynamiqueEmploi } from '../services/marketTrends.service.js';
import {
    searchJobs as searchAdzuna,
    getCategories as getAdzunaCategories,
    getSalaryHistogram,
    getTopCompanies,
    IT_KEYWORDS as ADZUNA_KEYWORDS
} from '../services/adzuna.service.js';
import {
    collectMarketTrends,
    getStoredTrends,
    getStoredTrendsLight,
    getStoredTrendsWithMetadata,
    getStoredTrendsGroupedByType,
    getTrendMetadata,
    storeTrend,
    getTrendFilterOptions,
    getTrendsSummary,
    invalidateTrendsCache,
    loadTrendsCache
} from '../services/marketTrends.service.js';

const router = express.Router();

// ============================================
// DATA COLLECTION ENDPOINTS (Admin only)
// ============================================

/**
 * POST /api/market-radar/collect
 * Run full data collection from all sources
 * Admin only - this is a heavy operation
 */
router.post('/collect', authenticateToken, requireAdmin, async (req, res) => {
    try {
        safeLog('info', 'Market Radar: Full collection triggered', { 
            userId: req.user.id 
        });

        const options = req.body.options || {};
        const summary = await runFullCollection(options);

        // Invalidate facts cache after collection
        invalidateFactsCache();
        safeLog('info', 'Market Radar: Facts cache invalidated after collection');

        res.json({
            success: true,
            message: 'Data collection completed',
            summary
        });
    } catch (error) {
        safeLog('error', 'Market Radar: Collection failed', { error: error.message });
        res.status(500).json({ 
            error: 'Collection failed', 
            message: error.message 
        });
    }
});

/**
 * POST /api/market-radar/collect/:source
 * Run data collection for a specific source
 * @param source - 'france_travail' or 'adzuna'
 */
router.post('/collect/:source', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { source } = req.params;
        
        if (!['france_travail', 'adzuna'].includes(source)) {
            return res.status(400).json({ 
                error: 'Invalid source',
                message: 'Source must be "france_travail" or "adzuna"'
            });
        }

        safeLog('info', `Market Radar: ${source} collection triggered`, { 
            userId: req.user.id 
        });

        const options = req.body.options || {};
        const summary = await runSourceCollection(source, options);

        // Invalidate facts cache after collection
        invalidateFactsCache();
        safeLog('info', 'Market Radar: Facts cache invalidated after source collection');

        res.json({
            success: true,
            message: `${source} collection completed`,
            summary
        });
    } catch (error) {
        safeLog('error', 'Market Radar: Source collection failed', { 
            source: req.params.source,
            error: error.message 
        });
        res.status(500).json({ 
            error: 'Collection failed', 
            message: error.message 
        });
    }
});

// ============================================
// DATA RETRIEVAL ENDPOINTS
// ============================================

/**
 * GET /api/market-radar/facts/all
 * Get ALL facts data (no pagination, uses cache)
 * Returns all facts for efficient frontend processing
 */
router.get('/facts/all', authenticateToken, async (req, res) => {
    try {
        const startTime = Date.now();
        
        // Get all facts from cache (no pagination)
        const result = await getFactsByDateRange(null, null, {
            page: 1,
            pageSize: 10000 // Large enough to get all records
        });
        
        const duration = Date.now() - startTime;
        safeLog('info', `Market Radar: All facts loaded in ${duration}ms`, { 
            totalCount: result.facts.length 
        });

        res.json({
            success: true,
            facts: result.facts,
            totalCount: result.facts.length,
            duration
        });
    } catch (error) {
        safeLog('error', 'Market Radar: Failed to get all facts', { error: error.message });
        res.status(500).json({ 
            error: 'Failed to get all facts', 
            message: error.message 
        });
    }
});

/**
 * GET /api/market-radar/facts/filters
 * Get available filter options for facts
 */
router.get('/facts/filters', authenticateToken, async (req, res) => {
    try {
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
    } catch (error) {
        safeLog('error', 'Market Radar: Failed to get facts filters', { error: error.message });
        res.status(500).json({ 
            error: 'Failed to get facts filters', 
            message: error.message 
        });
    }
});

/**
 * GET /api/market-radar/facts/summary
 * Get aggregated summary of facts
 */
router.get('/facts/summary', authenticateToken, async (req, res) => {
    try {
        const summary = await getFactsSummary();
        res.json({
            success: true,
            summary
        });
    } catch (error) {
        safeLog('error', 'Market Radar: Failed to get facts summary', { error: error.message });
        res.status(500).json({ 
            error: 'Failed to get facts summary', 
            message: error.message 
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
    } catch (error) {
        safeLog('error', 'Market Radar: Facts cache refresh failed', { error: error.message });
        res.status(500).json({ 
            error: 'Facts cache refresh failed', 
            message: error.message 
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
        const { startDate, endDate, source, type, region, keyword, romeCode, page, pageSize } = req.query;

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
            page,
            pageSize
        });

        res.json({
            success: true,
            count: result.facts.length,
            dateRange: { start, end },
            facts: result.facts,
            pagination: result.pagination
        });
    } catch (error) {
        safeLog('error', 'Market Radar: Failed to get facts', { error: error.message });
        res.status(500).json({ 
            error: 'Failed to retrieve facts', 
            message: error.message 
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
    } catch (error) {
        safeLog('error', 'Market Radar: Failed to get latest facts', { error: error.message });
        res.status(500).json({ 
            error: 'Failed to retrieve facts', 
            message: error.message 
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
        const days = parseInt(req.query.days) || 30;

        const trend = await getKeywordTrend(keyword, days);

        res.json({
            success: true,
            ...trend
        });
    } catch (error) {
        safeLog('error', 'Market Radar: Failed to get trend', { error: error.message });
        res.status(500).json({ 
            error: 'Failed to retrieve trend', 
            message: error.message 
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
    } catch (error) {
        safeLog('error', 'Market Radar: Failed to get regional data', { error: error.message });
        res.status(500).json({ 
            error: 'Failed to retrieve regional data', 
            message: error.message 
        });
    }
});

// ============================================
// LIVE SEARCH ENDPOINTS (Direct API calls)
// ============================================

/**
 * GET /api/market-radar/search/france-travail
 * Live search on France Travail API
 */
router.get('/search/france-travail', authenticateToken, async (req, res) => {
    try {
        const { motsCles, codeROME, departement, region, typeContrat, range } = req.query;

        const results = await searchFranceTravail({
            motsCles,
            codeROME,
            departement,
            region,
            typeContrat,
            range: range || '0-49'
        });

        res.json({
            success: true,
            source: 'france_travail',
            ...results
        });
    } catch (error) {
        safeLog('error', 'Market Radar: France Travail search failed', { error: error.message });
        res.status(500).json({ 
            error: 'Search failed', 
            message: error.message 
        });
    }
});

/**
 * GET /api/market-radar/search/adzuna
 * Live search on Adzuna API
 */
router.get('/search/adzuna', authenticateToken, async (req, res) => {
    try {
        const { what, where, category, salary_min, salary_max, page } = req.query;

        const results = await searchAdzuna({
            what,
            where,
            category,
            salary_min: salary_min ? parseInt(salary_min) : undefined,
            salary_max: salary_max ? parseInt(salary_max) : undefined,
            page: page ? parseInt(page) : 1,
            results_per_page: 20
        });

        res.json({
            success: true,
            source: 'adzuna',
            ...results
        });
    } catch (error) {
        safeLog('error', 'Market Radar: Adzuna search failed', { error: error.message });
        res.status(500).json({ 
            error: 'Search failed', 
            message: error.message 
        });
    }
});

/**
 * GET /api/market-radar/salary-histogram
 * Get salary histogram from Adzuna
 */
router.get('/salary-histogram', authenticateToken, async (req, res) => {
    try {
        const { what, where, category } = req.query;

        const data = await getSalaryHistogram({ what, where, category });

        res.json({
            success: true,
            source: 'adzuna',
            ...data
        });
    } catch (error) {
        safeLog('error', 'Market Radar: Salary histogram failed', { error: error.message });
        res.status(500).json({ 
            error: 'Failed to get salary data', 
            message: error.message 
        });
    }
});

/**
 * GET /api/market-radar/top-companies
 * Get top hiring companies from Adzuna
 */
router.get('/top-companies', authenticateToken, async (req, res) => {
    try {
        const { what, where } = req.query;

        const data = await getTopCompanies({ what, where });

        res.json({
            success: true,
            source: 'adzuna',
            ...data
        });
    } catch (error) {
        safeLog('error', 'Market Radar: Top companies failed', { error: error.message });
        res.status(500).json({ 
            error: 'Failed to get company data', 
            message: error.message 
        });
    }
});

// ============================================
// REFERENCE DATA ENDPOINTS
// ============================================

/**
 * GET /api/market-radar/referentiel/:type
 * Get reference data from France Travail
 * Types: metiers, appellations, domaines, etc.
 */
router.get('/referentiel/:type', authenticateToken, async (req, res) => {
    try {
        const { type } = req.params;
        const data = await getReferentiel(type);

        res.json({
            success: true,
            type,
            count: data.length,
            data
        });
    } catch (error) {
        safeLog('error', 'Market Radar: Referentiel failed', { error: error.message });
        res.status(500).json({ 
            error: 'Failed to get reference data', 
            message: error.message 
        });
    }
});

/**
 * GET /api/market-radar/categories
 * Get job categories from Adzuna
 */
router.get('/categories', authenticateToken, async (req, res) => {
    try {
        const categories = await getAdzunaCategories();

        res.json({
            success: true,
            source: 'adzuna',
            count: categories.length,
            categories
        });
    } catch (error) {
        safeLog('error', 'Market Radar: Categories failed', { error: error.message });
        res.status(500).json({ 
            error: 'Failed to get categories', 
            message: error.message 
        });
    }
});

/**
 * GET /api/market-radar/config
 * Get radar configuration (ROME codes, regions, keywords)
 */
router.get('/config', authenticateToken, async (req, res) => {
    res.json({
        success: true,
        config: {
            romeCodes: IT_ROME_CODES,
            regions: FRENCH_REGIONS,
            keywords: {
                franceTravail: FT_KEYWORDS,
                adzuna: ADZUNA_KEYWORDS
            }
        }
    });
});

// ============================================
// MARKET TRENDS ENDPOINTS
// ============================================

/**
 * POST /api/market-radar/trends/collect
 * Trigger market trends collection (fire-and-forget, runs in background)
 */
router.post('/trends/collect', authenticateToken, requireAdmin, async (req, res) => {
    try {
        safeLog('info', 'Market Radar: Trends collection triggered (background)', { 
            userId: req.user.id 
        });

        // Respond immediately - collection will run in background
        res.json({
            success: true,
            message: 'Collection started in background',
            estimatedDuration: '30-60 minutes'
        });

        // Run collection in background (non-blocking)
        setImmediate(async () => {
            const startTime = Date.now();
            let createdCount = 0;
            let updatedCount = 0;
            let failedCount = 0;
            let processedCount = 0;
            let lastProgressLog = Date.now();
            const PROGRESS_INTERVAL_MS = 30000;

            try {
                safeLog('info', 'Market Radar: Background collection starting...');
                
                const trends = await collectMarketTrends({
                    onTrendCollected: async (trend) => {
                        processedCount++;
                        
                        try {
                            const result = await storeTrend(trend);
                            
                            if (result.action === 'created') {
                                createdCount++;
                            } else if (result.action === 'updated') {
                                updatedCount++;
                            } else if (result.action === 'failed') {
                                failedCount++;
                                safeLog('warn', 'Market Radar: Failed to store trend', { 
                                    error: result.error,
                                    trendType: result.trend?.type,
                                    regionCode: result.trend?.regionCode,
                                    codeRome: result.trend?.codeRome
                                });
                            }
                        } catch (storeError) {
                            failedCount++;
                            safeLog('error', 'Market Radar: Exception storing trend', {
                                error: storeError.message,
                                trendType: trend?.type
                            });
                        }
                        
                        // Log progress periodically
                        const now = Date.now();
                        if (now - lastProgressLog > PROGRESS_INTERVAL_MS) {
                            const memUsage = process.memoryUsage();
                            safeLog('info', 'Market Radar: Trends collection progress', {
                                processed: processedCount,
                                created: createdCount,
                                updated: updatedCount,
                                failed: failedCount,
                                elapsed: Math.round((now - startTime) / 1000) + 's',
                                heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024)
                            });
                            lastProgressLog = now;
                        }
                        
                        // Explicit cleanup of trend object to help GC
                        trend = null;
                    }
                });

                const duration = Date.now() - startTime;
                const finalMemUsage = process.memoryUsage();

                // Invalidate cache after collection to force reload
                invalidateTrendsCache();
                
                safeLog('info', 'Market Radar: Background collection completed', {
                    totalProcessed: processedCount,
                    created: createdCount,
                    updated: updatedCount,
                    failed: failedCount,
                    successRate: processedCount > 0 ? Math.round(((createdCount + updatedCount) / processedCount) * 100) + '%' : 'N/A',
                    duration: Math.round(duration / 1000) + 's',
                    finalHeapMB: Math.round(finalMemUsage.heapUsed / 1024 / 1024)
                });
            } catch (error) {
                const errorMemUsage = process.memoryUsage();
                safeLog('error', 'Market Radar: Background collection failed', { 
                    error: error.message,
                    stack: error.stack,
                    processed: processedCount,
                    created: createdCount,
                    updated: updatedCount,
                    failed: failedCount,
                    heapUsedMB: Math.round(errorMemUsage.heapUsed / 1024 / 1024)
                });
            } finally {
                // Force garbage collection if available
                if (global.gc) {
                    global.gc();
                    safeLog('debug', 'Market Radar: Forced garbage collection after main collection');
                }
            }
        });
    } catch (error) {
        safeLog('error', 'Market Radar: Failed to start collection', { error: error.message });
        res.status(500).json({ 
            error: 'Failed to start collection', 
            message: error.message 
        });
    }
});

/**
 * POST /api/market-radar/trends/collect-dynamics
 * TEMPORARY: Trigger DYN_1 (employment dynamics) collection only
 * Fire-and-forget endpoint - responds immediately, collection runs in background
 */
router.post('/trends/collect-dynamics', authenticateToken, requireAdmin, async (req, res) => {
    try {
        safeLog('info', 'Market Radar: DYN_1 dynamics collection triggered (background)', { 
            userId: req.user.id 
        });

        // Respond immediately
        res.json({
            success: true,
            message: 'DYN_1 dynamics collection started in background',
            estimatedDuration: '1-2 minutes'
        });

        // Run collection in background (non-blocking)
        setImmediate(async () => {
            const startTime = Date.now();
            let createdCount = 0;
            let updatedCount = 0;
            let failedCount = 0;
            let skippedCount = 0;
            let processedCount = 0;

            try {
                const collectionDate = new Date().toISOString().split('T')[0];
                const totalRegions = FRENCH_REGIONS.length;
                
                safeLog('info', 'MarketTrends: Starting DYN_1 collection', {
                    totalRegions,
                    collectionDate
                });
                
                // Extract value helper (defined once, not per iteration)
                const extractValue = (apiData) => {
                    if (!apiData?.listeValeursParPeriode?.length) return null;
                    const periode = apiData.listeValeursParPeriode[0];
                    return periode.valeurPrincipaleNombre ?? periode.valeurPrincipaleMontant ?? periode.valeurPrincipaleTaux ?? null;
                };
                
                // Extract label helper
                const extractLabel = (apiData) => {
                    if (apiData?.libIndicateur) return apiData.libIndicateur;
                    if (apiData?.listeValeursParPeriode?.[0]?.libPeriode) {
                        return `Dynamique emploi - ${apiData.listeValeursParPeriode[0].libPeriode}`;
                    }
                    return 'Dynamique de l\'emploi';
                };
                
                for (let i = 0; i < FRENCH_REGIONS.length; i++) {
                    const region = FRENCH_REGIONS[i];
                    processedCount++;
                    
                    try {
                        // Rate limiting
                        await new Promise(resolve => setTimeout(resolve, 500));
                        
                        let data = await getStatDynamiqueEmploi({ 
                            codeTerritoire: region.code,
                            codeTypeTerritoire: 'REG',
                            codeTypeActivite: 'MOYENNE',
                            codeActivite: 'MOYENNE',
                            codeTypePeriode: 'TRIMESTRE',
                            dernierePeriode: true,
                            sansCaracteristiques: true
                        });
                        
                        // Handle null response (API unavailable for this region)
                        if (!data) {
                            skippedCount++;
                            safeLog('debug', 'MarketTrends: DYN_1 no data for region', {
                                region: region.name,
                                regionCode: region.code,
                                progress: `${processedCount}/${totalRegions}`
                            });
                            continue;
                        }
                        
                        const trend = {
                            date: collectionDate,
                            type: 'dynamique_emploi',
                            region: region.name,
                            regionCode: region.code,
                            value: extractValue(data),
                            valueLabel: extractLabel(data),
                            metadata: data
                        };
                        
                        // Explicit cleanup of API response
                        data = null;
                        
                        try {
                            const result = await storeTrend(trend);
                            
                            if (result.action === 'created') {
                                createdCount++;
                            } else if (result.action === 'updated') {
                                updatedCount++;
                            } else if (result.action === 'failed') {
                                failedCount++;
                                safeLog('warn', 'Market Radar: Failed to store DYN_1 trend', { 
                                    error: result.error,
                                    regionCode: region.code
                                });
                            }
                        } catch (storeError) {
                            failedCount++;
                            safeLog('error', 'Market Radar: Exception storing DYN_1 trend', {
                                error: storeError.message,
                                regionCode: region.code
                            });
                        }
                    } catch (error) {
                        failedCount++;
                        safeLog('warn', 'MarketTrends: Failed to collect DYN_1 for region', {
                            region: region.name,
                            regionCode: region.code,
                            error: error.message,
                            progress: `${processedCount}/${totalRegions}`
                        });
                    }
                }

                const duration = Date.now() - startTime;
                const memUsage = process.memoryUsage();

                // Invalidate cache after collection
                invalidateTrendsCache();
                
                // Verify totals add up
                const totalAccounted = createdCount + updatedCount + failedCount + skippedCount;
                
                safeLog('info', 'Market Radar: DYN_1 collection completed', {
                    totalRegions,
                    processed: processedCount,
                    created: createdCount,
                    updated: updatedCount,
                    failed: failedCount,
                    skipped: skippedCount,
                    totalAccounted,
                    accountingMatch: totalAccounted === totalRegions ? 'OK' : 'MISMATCH',
                    successRate: processedCount > 0 ? Math.round(((createdCount + updatedCount) / processedCount) * 100) + '%' : 'N/A',
                    duration: Math.round(duration / 1000) + 's',
                    heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024)
                });
            } catch (error) {
                const errorMemUsage = process.memoryUsage();
                safeLog('error', 'Market Radar: DYN_1 collection failed', { 
                    error: error.message,
                    stack: error.stack,
                    processed: processedCount,
                    created: createdCount,
                    updated: updatedCount,
                    failed: failedCount,
                    skipped: skippedCount,
                    heapUsedMB: Math.round(errorMemUsage.heapUsed / 1024 / 1024)
                });
            } finally {
                // Force garbage collection if available
                if (global.gc) {
                    global.gc();
                    safeLog('debug', 'Market Radar: Forced garbage collection after DYN_1 collection');
                }
            }
        });
    } catch (error) {
        safeLog('error', 'Market Radar: Failed to start DYN_1 collection', { error: error.message });
        res.status(500).json({ 
            error: 'Failed to start DYN_1 collection', 
            message: error.message 
        });
    }
});

/**
 * GET /api/market-radar/trends/all
 * Get ALL trends data for map view (no pagination, NO metadata)
 * Optimized for PostgreSQL - direct query without loading metadata
 * Returns all trends grouped by type for efficient map rendering
 */
router.get('/trends/all', authenticateToken, async (req, res) => {
    try {
        const startTime = Date.now();
        const { type } = req.query;
        
        // Get trends from PostgreSQL - NO metadata (optimized for map)
        const result = await getStoredTrendsLight({ type: type || undefined });
        
        // Group by type for efficient frontend processing
        const byType = {};
        result.trends.forEach(t => {
            if (!byType[t.Type]) byType[t.Type] = [];
            byType[t.Type].push(t);
        });
        
        const duration = Date.now() - startTime;
        const memUsage = process.memoryUsage();
        safeLog('info', `Market Radar: Map trends loaded in ${duration}ms`, { 
            totalCount: result.totalCount,
            heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024)
        });

        res.json({
            success: true,
            trends: result.trends,
            byType,
            totalCount: result.totalCount,
            duration
        });
    } catch (error) {
        safeLog('error', 'Market Radar: Failed to get map trends', { error: error.message });
        res.status(500).json({ 
            error: 'Failed to get map trends', 
            message: error.message 
        });
    }
});

/**
 * GET /api/market-radar/trends
 * Get stored market trends with server-side filters and pagination
 * If no type filter, returns grouped by type with limited items per type
 */
router.get('/trends', authenticateToken, async (req, res) => {
    try {
        const { type, codeRome, regionCode, sortField, sortDirection, page, pageSize, itemsPerType } = req.query;
        
        // If no type filter, return grouped by type
        if (!type) {
            const result = await getStoredTrendsGroupedByType({
                codeRome,
                regionCode,
                itemsPerType: itemsPerType ? parseInt(itemsPerType) : 5
            });

            res.json({
                success: true,
                grouped: true,
                groupedTrends: result.groupedTrends,
                countsByType: result.countsByType,
                totalCount: result.totalCount
            });
            return;
        }
        
        // With type filter, return paginated list
        const result = await getStoredTrends({
            type,
            codeRome,
            regionCode,
            sortField: sortField || 'Date',
            sortDirection: sortDirection || 'desc',
            page: page ? parseInt(page) : 1,
            pageSize: pageSize ? parseInt(pageSize) : 20
        });

        res.json({
            success: true,
            grouped: false,
            trends: result.trends,
            totalCount: result.totalCount,
            pagination: result.pagination
        });
    } catch (error) {
        safeLog('error', 'Market Radar: Failed to get trends', { error: error.message });
        res.status(500).json({ 
            error: 'Failed to get trends', 
            message: error.message 
        });
    }
});

/**
 * GET /api/market-radar/trends/summary
 * Get aggregated summary of market trends (uses streaming to avoid memory issues)
 */
router.get('/trends/summary', authenticateToken, async (req, res) => {
    try {
        const summary = await getTrendsSummary();

        res.json({
            success: true,
            summary
        });
    } catch (error) {
        safeLog('error', 'Market Radar: Failed to get trends summary', { error: error.message });
        res.status(500).json({ 
            error: 'Failed to get trends summary', 
            message: error.message 
        });
    }
});

/**
 * GET /api/market-radar/trends/:id/metadata
 * Get metadata for a specific trend (on-demand loading for hover)
 */
router.get('/trends/:id/metadata', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        
        if (!id) {
            return res.status(400).json({ 
                error: 'Missing trend ID',
                message: 'Trend ID is required'
            });
        }
        
        const trend = await getTrendMetadata(id);
        
        if (!trend) {
            return res.status(404).json({ 
                error: 'Trend not found',
                message: `No trend found with ID: ${id}`
            });
        }
        
        res.json({
            success: true,
            trend
        });
    } catch (error) {
        safeLog('error', 'Market Radar: Failed to get trend metadata', { error: error.message, id: req.params.id });
        res.status(500).json({ 
            error: 'Failed to get trend metadata', 
            message: error.message 
        });
    }
});

/**
 * GET /api/market-radar/trends/filters
 * Get available filter options (types, regions, rome codes)
 */
router.get('/trends/filters', authenticateToken, async (req, res) => {
    try {
        const filters = await getTrendFilterOptions();
        safeLog('info', 'Market Radar: Filters loaded', { 
            typesCount: filters.types?.length || 0,
            regionsCount: filters.regions?.length || 0,
            romeCodesCount: filters.romeCodes?.length || 0
        });
        res.json({
            success: true,
            filters
        });
    } catch (error) {
        safeLog('error', 'Market Radar: Failed to get trend filters', { error: error.message });
        res.status(500).json({ 
            error: 'Failed to get trend filters', 
            message: error.message 
        });
    }
});

/**
 * POST /api/market-radar/trends/cache/refresh
 * Force refresh the trends cache (admin only)
 */
router.post('/trends/cache/refresh', authenticateToken, requireAdmin, async (req, res) => {
    try {
        safeLog('info', 'Market Radar: Manual cache refresh triggered', { userId: req.user.id });
        const startTime = Date.now();
        
        invalidateTrendsCache();
        await loadTrendsCache();
        
        const duration = Date.now() - startTime;
        
        res.json({
            success: true,
            message: 'Cache refreshed successfully',
            duration
        });
    } catch (error) {
        safeLog('error', 'Market Radar: Cache refresh failed', { error: error.message });
        res.status(500).json({ 
            error: 'Cache refresh failed', 
            message: error.message 
        });
    }
});

export default router;
