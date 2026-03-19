/**
 * Market Radar - Market Trends Routes
 * Endpoints for France Travail trends collection, retrieval, cache, audit
 */

import express from 'express';
import { authenticateToken, requireAdmin } from '../../middleware/auth.middleware.js';
import { safeLog } from '../../utils/logger.backend.js';
import { FRENCH_REGIONS } from '../../services/franceTravail.service.js';
import { getStatDynamiqueEmploi } from '../../services/marketTrends.service.js';
import {
    collectMarketTrends,
    getStoredTrends,
    getStoredTrendsLight,
    getStoredTrendsGroupedByType,
    getTrendMetadata,
    storeTrend,
    getTrendFilterOptions,
    getTrendsSummary,
    invalidateTrendsCache,
    loadTrendsCache
} from '../../services/marketTrends.service.js';

const router = express.Router();

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
                
                const _trends = await collectMarketTrends({
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
        safeLog('error', 'Market Radar: Failed to start collection');
        res.status(500).json({ 
            error: 'Failed to start collection' 
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
                                    regionCode: region.code
                                });
                            }
                        } catch (storeError) {
                            failedCount++;
                            safeLog('error', 'Market Radar: Exception storing DYN_1 trend', {
                                regionCode: region.code
                            });
                        }
                    } catch (error) {
                        failedCount++;
                        safeLog('warn', 'MarketTrends: Failed to collect DYN_1 for region', {
                            region: region.name,
                            regionCode: region.code,
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
        safeLog('error', 'Market Radar: Failed to start DYN_1 collection');
        res.status(500).json({ 
            error: 'Failed to start DYN_1 collection' 
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

        // Set cache headers for client-side caching (5 minutes)
        res.set('Cache-Control', 'private, max-age=300');
        
        res.json({
            success: true,
            trends: result.trends,
            byType,
            totalCount: result.totalCount,
            duration
        });
    } catch (error) {
        safeLog('error', 'Market Radar: Failed to get map trends');
        res.status(500).json({ 
            error: 'Failed to get map trends' 
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
        safeLog('error', 'Market Radar: Failed to get trends');
        res.status(500).json({ 
            error: 'Failed to get trends' 
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
        safeLog('error', 'Market Radar: Failed to get trends summary');
        res.status(500).json({ 
            error: 'Failed to get trends summary' 
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
                success: false,
                error: 'No stored trend found for this ID',
                params: { id }
            });
        }
        
        // Note: Live API verification would require calling the appropriate API
        // For now, return stored data with audit info
        res.json({
            success: true,
            trend
        });
    } catch (error) {
        safeLog('error', 'Market Radar: Failed to get trend metadata', { id: req.params.id });
        res.status(500).json({ 
            error: 'Failed to get trend metadata' 
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
        safeLog('error', 'Market Radar: Failed to get trend filters');
        res.status(500).json({ 
            error: 'Failed to get trend filters' 
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
        safeLog('error', 'Market Radar: Cache refresh failed');
        res.status(500).json({ 
            error: 'Cache refresh failed' 
        });
    }
});

/**
 * GET /api/market-radar/trends/verify/:type/:regionCode/:codeRome
 * Verify stored data against live API call (admin only)
 * Compares stored value with fresh API response
 */
router.get('/trends/verify/:type/:regionCode/:codeRome', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { type, regionCode, codeRome } = req.params;
        
        // Get stored trend
        const storedResult = await getStoredTrends({
            type,
            regionCode,
            codeRome,
            page: 1,
            pageSize: 1
        });
        
        const storedTrend = storedResult.trends?.[0] || null;
        
        if (!storedTrend) {
            return res.status(404).json({
                success: false,
                error: 'No stored trend found for this combination',
                params: { type, regionCode, codeRome }
            });
        }
        
        // Note: Live API verification would require calling the appropriate API
        // For now, return stored data with audit info
        res.json({
            success: true,
            verification: {
                type,
                regionCode,
                codeRome,
                storedValue: storedTrend.Value,
                collectedAt: storedTrend.collected_at,
                quarterPeriod: storedTrend.quarter_period,
                apiEndpoint: storedTrend.api_endpoint,
                apiResponseHash: storedTrend.api_response_hash,
                previousValue: storedTrend.previous_value,
                lastUpdated: storedTrend.updated_at
            },
            recommendation: 'To verify against live API, trigger a new collection and compare values'
        });
    } catch (error) {
        safeLog('error', 'Market Radar: Verification failed');
        res.status(500).json({ 
            error: 'Verification failed' 
        });
    }
});

/**
 * GET /api/market-radar/trends/audit
 * Get audit/freshness report for all trends (admin only)
 */
router.get('/trends/audit', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { query } = await import('../../config/database.js');
        
        // Get freshness statistics
        const freshnessQuery = `
            SELECT 
                type,
                COUNT(*) as total_records,
                MIN(collected_at) as oldest_collection,
                MAX(collected_at) as newest_collection,
                COUNT(CASE WHEN collected_at > NOW() - INTERVAL '7 days' THEN 1 END) as fresh_count,
                COUNT(CASE WHEN collected_at > NOW() - INTERVAL '30 days' AND collected_at <= NOW() - INTERVAL '7 days' THEN 1 END) as recent_count,
                COUNT(CASE WHEN collected_at <= NOW() - INTERVAL '30 days' OR collected_at IS NULL THEN 1 END) as stale_count,
                COUNT(CASE WHEN previous_value IS NOT NULL THEN 1 END) as updated_records,
                AVG(CASE WHEN previous_value IS NOT NULL AND previous_value != 0 
                    THEN ABS((value - previous_value) / previous_value) * 100 
                    ELSE NULL END) as avg_change_percent
            FROM market_trends
            GROUP BY type
            ORDER BY type
        `;
        
        const freshnessResult = await query(freshnessQuery);
        
        // Get significant changes (>50%)
        const changesQuery = `
            SELECT type, region_code, code_rome, rome_label, 
                   previous_value, value,
                   ROUND(ABS((value - previous_value) / NULLIF(previous_value, 0)) * 100, 1) as change_percent,
                   collected_at
            FROM market_trends
            WHERE previous_value IS NOT NULL 
              AND previous_value != 0
              AND ABS((value - previous_value) / previous_value) > 0.5
            ORDER BY ABS((value - previous_value) / previous_value) DESC
            LIMIT 20
        `;
        
        const changesResult = await query(changesQuery);
        
        // Get overall stats
        const overallQuery = `
            SELECT 
                COUNT(*) as total_records,
                COUNT(DISTINCT type) as total_types,
                COUNT(DISTINCT region_code) as total_regions,
                COUNT(DISTINCT code_rome) as total_rome_codes,
                MIN(collected_at) as oldest_data,
                MAX(collected_at) as newest_data
            FROM market_trends
        `;
        
        const overallResult = await query(overallQuery);
        
        res.json({
            success: true,
            audit: {
                overall: overallResult.rows[0],
                byType: freshnessResult.rows.map(row => ({
                    type: row.type,
                    totalRecords: parseInt(row.total_records),
                    oldestCollection: row.oldest_collection,
                    newestCollection: row.newest_collection,
                    freshness: {
                        fresh: parseInt(row.fresh_count),
                        recent: parseInt(row.recent_count),
                        stale: parseInt(row.stale_count)
                    },
                    updatedRecords: parseInt(row.updated_records),
                    avgChangePercent: row.avg_change_percent ? parseFloat(row.avg_change_percent).toFixed(1) : null
                })),
                significantChanges: changesResult.rows.map(row => ({
                    type: row.type,
                    regionCode: row.region_code,
                    codeRome: row.code_rome,
                    romeLabel: row.rome_label,
                    previousValue: parseFloat(row.previous_value),
                    currentValue: parseFloat(row.value),
                    changePercent: parseFloat(row.change_percent),
                    collectedAt: row.collected_at
                }))
            },
            generatedAt: new Date().toISOString()
        });
    } catch (error) {
        safeLog('error', 'Market Radar: Audit report failed');
        res.status(500).json({ 
            error: 'Audit report failed' 
        });
    }
});

export default router;
