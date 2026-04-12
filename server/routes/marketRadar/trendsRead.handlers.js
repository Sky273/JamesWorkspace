import {
    getStoredTrends,
    getStoredTrendsLight,
    getStoredTrendsGroupedByType,
    getTrendMetadata,
    getTrendFilterOptions,
    getTrendsSummary,
    invalidateTrendsCache,
    loadTrendsCache,
    getTrendsAuditReport
} from '../../services/marketTrends.service.js';
import { safeLog } from '../../utils/logger.backend.js';

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

export async function getAllTrendsForMap(_req, res) {
    try {
        const startTime = Date.now();
        const { type } = _req.query;
        if (_req.query.refresh === '1' || _req.query.refresh === 'true') {
            invalidateTrendsCache();
        }
        const result = await getStoredTrendsLight({ type: type || undefined });

        const byType = {};
        result.trends.forEach((trend) => {
            if (!byType[trend.Type]) byType[trend.Type] = [];
            byType[trend.Type].push(trend);
        });

        const duration = Date.now() - startTime;
        const memUsage = process.memoryUsage();
        safeLog('info', `Market Radar: Map trends loaded in ${duration}ms`, {
            totalCount: result.totalCount,
            heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024)
        });

        res.set('Cache-Control', 'private, max-age=300');
        res.json({ success: true, trends: result.trends, byType, totalCount: result.totalCount, duration });
    } catch {
        safeLog('error', 'Market Radar: Failed to get map trends');
        res.status(500).json({ error: 'Failed to get map trends' });
    }
}

export async function getTrends(req, res) {
    try {
        const { type, codeRome, regionCode, sortField, sortDirection, page, pageSize, itemsPerType } = req.query;
        if (req.query.refresh === '1' || req.query.refresh === 'true') {
            invalidateTrendsCache();
        }
        const parsedItemsPerType = parsePositiveInteger(itemsPerType, { field: 'itemsPerType', maxValue: 50 });
        const parsedPage = parsePositiveInteger(page, { field: 'page', maxValue: 1000 });
        const parsedPageSize = parsePositiveInteger(pageSize, { field: 'pageSize', maxValue: 100 });

        if (!type) {
            const result = await getStoredTrendsGroupedByType({
                codeRome,
                regionCode,
                itemsPerType: parsedItemsPerType || 5
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

        const result = await getStoredTrends({
            type,
            codeRome,
            regionCode,
            sortField: sortField || 'Date',
            sortDirection: sortDirection || 'desc',
            page: parsedPage || 1,
            pageSize: parsedPageSize || 20
        });

        res.json({
            success: true,
            grouped: false,
            trends: result.trends,
            totalCount: result.totalCount,
            pagination: result.pagination
        });
    } catch (error) {
        if (error.message?.includes('must be a positive integer')) {
            return res.status(400).json({ error: error.message });
        }
        safeLog('error', 'Market Radar: Failed to get trends');
        res.status(500).json({ error: 'Failed to get trends' });
    }
}

export async function getTrendsSummaryHandler(_req, res) {
    try {
        if (_req.query.refresh === '1' || _req.query.refresh === 'true') {
            invalidateTrendsCache();
        }
        const summary = await getTrendsSummary();
        res.json({ success: true, summary });
    } catch {
        safeLog('error', 'Market Radar: Failed to get trends summary');
        res.status(500).json({ error: 'Failed to get trends summary' });
    }
}

export async function getTrendMetadataHandler(req, res) {
    try {
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({ error: 'Missing trend ID', message: 'Trend ID is required' });
        }

        const trend = await getTrendMetadata(id);
        if (!trend) {
            return res.status(404).json({ success: false, error: 'No stored trend found for this ID', params: { id } });
        }

        res.json({ success: true, trend });
    } catch {
        safeLog('error', 'Market Radar: Failed to get trend metadata', { id: req.params.id });
        res.status(500).json({ error: 'Failed to get trend metadata' });
    }
}

export async function getTrendFilters(_req, res) {
    try {
        if (_req.query.refresh === '1' || _req.query.refresh === 'true') {
            invalidateTrendsCache();
        }
        const filters = await getTrendFilterOptions();
        safeLog('info', 'Market Radar: Filters loaded', {
            typesCount: filters.types?.length || 0,
            regionsCount: filters.regions?.length || 0,
            romeCodesCount: filters.romeCodes?.length || 0
        });
        res.json({ success: true, filters });
    } catch {
        safeLog('error', 'Market Radar: Failed to get trend filters');
        res.status(500).json({ error: 'Failed to get trend filters' });
    }
}

export async function refreshTrendsCache(req, res) {
    try {
        safeLog('info', 'Market Radar: Manual cache refresh triggered', { userId: req.user.id });
        const startTime = Date.now();
        invalidateTrendsCache();
        await loadTrendsCache();
        const duration = Date.now() - startTime;
        res.json({ success: true, message: 'Cache refreshed successfully', duration });
    } catch {
        safeLog('error', 'Market Radar: Cache refresh failed');
        res.status(500).json({ error: 'Cache refresh failed' });
    }
}

export async function verifyTrend(req, res) {
    try {
        const { type, regionCode, codeRome } = req.params;
        const storedResult = await getStoredTrends({ type, regionCode, codeRome, page: 1, pageSize: 1 });
        const storedTrend = storedResult.trends?.[0] || null;

        if (!storedTrend) {
            return res.status(404).json({ success: false, error: 'No stored trend found for this combination', params: { type, regionCode, codeRome } });
        }

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
    } catch {
        safeLog('error', 'Market Radar: Verification failed');
        res.status(500).json({ error: 'Verification failed' });
    }
}

export async function getTrendsAudit(req, res) {
    try {
        const { freshness, significantChanges, overall } = await getTrendsAuditReport();
        res.json({
            success: true,
            audit: {
                overall,
                byType: freshness.map(row => ({
                    type: row.type,
                    totalRecords: parseInt(row.total_records, 10),
                    oldestCollection: row.oldest_collection,
                    newestCollection: row.newest_collection,
                    freshness: {
                        fresh: parseInt(row.fresh_count, 10),
                        recent: parseInt(row.recent_count, 10),
                        stale: parseInt(row.stale_count, 10)
                    },
                    updatedRecords: parseInt(row.updated_records, 10),
                    avgChangePercent: row.avg_change_percent ? parseFloat(row.avg_change_percent).toFixed(1) : null
                })),
                significantChanges: significantChanges.map(row => ({
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
    } catch {
        safeLog('error', 'Market Radar: Audit report failed');
        res.status(500).json({ error: 'Audit report failed' });
    }
}
