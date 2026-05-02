/**
 * Market Trends Cache System
 * In-memory cache for filtering, pagination, summary, and grouped views
 */

import { safeLog } from '../../utils/logger.backend.js';
import { query as dbQuery } from '../../config/database.js';
import { fetchMetadataForIds } from './queries.js';
import { clearTokenCache } from './apiClient.js';
import { buildApplicationCacheMetrics } from '../cacheMetrics.service.js';
import { toNumber } from './extractors.js';

// PostgreSQL table name
const MARKET_TRENDS_TABLE = 'market_trends';

// Lightweight cache for filtering/pagination (NO metadata - too heavy)
let trendsLightCache = null;
let trendsCacheTime = 0;
const TRENDS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes (reduced for memory)
const TRENDS_CACHE_MAX_SIZE = 20000; // Max records (reduced from 100K to save ~40MB)

// Derived caches (computed from light cache)
let filterOptionsCache = null;
let _filterOptionsCacheTime = 0;
let summaryCache = null;
let trendsCacheCleanupInterval = null;

/**
 * Helper to parse PostgreSQL DECIMAL values to numbers
 */
function parseValue(value) {
    return toNumber(value) ?? 0;
}

// ============================================
// CACHE LOADING
// ============================================

/**
 * Load lightweight trends cache (NO metadata for memory efficiency)
 * Metadata is fetched on-demand for displayed records only
 */
export async function loadTrendsCache() {
    const startTime = Date.now();
    safeLog('info', 'MarketTrends: Loading lightweight trends cache (no metadata)...');
    
    // Only load essential fields - NO metadata (saves ~90% memory)
    const result = await dbQuery(
        `SELECT id, type, code_rome, rome_label, region, region_code, date, value, value_label
         FROM ${MARKET_TRENDS_TABLE} ORDER BY date DESC`
    );
    
    const allTrends = result.rows.map(record => ({
        id: record.id,
        Type: record.type,
        CodeRome: record.code_rome,
        RomeLabel: record.rome_label,
        Region: record.region,
        RegionCode: record.region_code,
        Date: record.date,
        Value: parseValue(record.value),
        ValueLabel: record.value_label
        // NO Metadata here - fetched on demand
    }));
    
    // Update cache
    if (allTrends.length <= TRENDS_CACHE_MAX_SIZE) {
        trendsLightCache = allTrends;
        trendsCacheTime = Date.now();
        
        // Compute derived caches
        computeFilterOptions();
        await computeSummary();
        
        const duration = Date.now() - startTime;
        const memUsage = process.memoryUsage();
        safeLog('info', `MarketTrends: Light cache loaded - ${allTrends.length} records in ${duration}ms`, {
            heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024)
        });
    } else {
        safeLog('warn', `MarketTrends: Limiting cache - ${allTrends.length} records exceeds limit`);
        trendsLightCache = allTrends.slice(0, TRENDS_CACHE_MAX_SIZE);
        trendsCacheTime = Date.now();
        computeFilterOptions();
        await computeSummary();
    }
    
    return allTrends;
}

/**
 * Get trends cache (load if needed)
 */
export async function getTrendsCache() {
    if (!trendsLightCache || (Date.now() - trendsCacheTime) > TRENDS_CACHE_TTL) {
        await loadTrendsCache();
    }
    return trendsLightCache;
}

/**
 * Invalidate cache (call after collection)
 */
export function invalidateTrendsCache() {
    trendsLightCache = null;
    trendsCacheTime = 0;
    filterOptionsCache = null;
    summaryCache = null;
    safeLog('info', 'MarketTrends: Cache invalidated');
}

// Periodic cache cleanup - auto-expire if not accessed for 2x TTL
export function startTrendsCacheCleanup() {
    if (trendsCacheCleanupInterval) {
        return;
    }

    trendsCacheCleanupInterval = setInterval(() => {
        if (trendsCacheTime && Date.now() - trendsCacheTime > TRENDS_CACHE_TTL * 2) {
            trendsLightCache = null;
            filterOptionsCache = null;
            summaryCache = null;
            trendsCacheTime = 0;
            safeLog('debug', 'MarketTrends: Cache auto-expired (inactive)');
        }
    }, TRENDS_CACHE_TTL);

    if (trendsCacheCleanupInterval.unref) {
        trendsCacheCleanupInterval.unref();
    }
}

/**
 * Destroy trends cache and cleanup interval (for graceful shutdown)
 */
export function destroyTrendsCache() {
    if (trendsCacheCleanupInterval) {
        clearInterval(trendsCacheCleanupInterval);
        trendsCacheCleanupInterval = null;
    }
    trendsLightCache = null;
    filterOptionsCache = null;
    summaryCache = null;
    trendsCacheTime = 0;
    safeLog('info', 'MarketTrends: Cache destroyed');
}

/**
 * Get trends cache statistics
 */
export function getTrendsCacheStats() {
    return buildApplicationCacheMetrics({
        size: trendsLightCache?.length || 0,
        maxSize: TRENDS_CACHE_MAX_SIZE,
        ageMs: trendsCacheTime ? Date.now() - trendsCacheTime : null,
        ttlMs: TRENDS_CACHE_TTL,
        extra: {
            hasFilterOptions: !!filterOptionsCache,
            hasSummary: !!summaryCache
        }
    });
}

/**
 * Cleanup function for graceful shutdown
 * Clears all caches and releases memory
 */
export function cleanupTrendsCache() {
    trendsLightCache = null;
    trendsCacheTime = 0;
    filterOptionsCache = null;
    summaryCache = null;
    // Clear token cache
    clearTokenCache();
    safeLog('info', 'MarketTrends: Cache cleaned up for shutdown');
}

// ============================================
// FILTER OPTIONS
// ============================================

/**
 * Compute filter options from cache
 */
function computeFilterOptions() {
    if (!trendsLightCache) return;
    
    const types = new Set();
    const regions = new Map();
    const romeCodes = new Set();
    
    trendsLightCache.forEach(t => {
        if (t.Type) types.add(t.Type);
        if (t.RegionCode && t.Region) regions.set(t.RegionCode, t.Region);
        if (t.CodeRome) romeCodes.add(t.CodeRome);
    });
    
    filterOptionsCache = {
        types: Array.from(types).sort(),
        regions: Array.from(regions.entries())
            .map(([code, name]) => ({ code, name }))
            .sort((a, b) => a.name.localeCompare(b.name)),
        romeCodes: Array.from(romeCodes).sort()
    };
}

/**
 * Get unique values for filters (types, regions, rome codes)
 * Uses cache for instant response
 */
export async function getTrendFilterOptions() {
    try {
        // Ensure cache is loaded
        await getTrendsCache();
        
        if (filterOptionsCache) {
            safeLog('debug', 'MarketTrends: Returning cached filter options');
            return filterOptionsCache;
        }
        
        // Fallback: compute from scratch if cache failed
        const types = new Set();
        const regions = new Map();
        const romeCodes = new Set();
        
        // Query PostgreSQL for unique values
        const dbResult = await dbQuery(
            `SELECT DISTINCT type, region, region_code, code_rome FROM ${MARKET_TRENDS_TABLE}`
        );
        
        dbResult.rows.forEach(r => {
            if (r.type) types.add(r.type);
            if (r.region_code && r.region) {
                regions.set(r.region_code, r.region);
            }
            if (r.code_rome) romeCodes.add(r.code_rome);
        });
        
        const result = {
            types: Array.from(types).sort(),
            regions: Array.from(regions.entries()).map(([code, name]) => ({ code, name })).sort((a, b) => a.name.localeCompare(b.name)),
            romeCodes: Array.from(romeCodes).sort()
        };
        
        // Update cache
        filterOptionsCache = result;
        _filterOptionsCacheTime = Date.now();
        safeLog('info', 'MarketTrends: Cached filter options');
        
        return result;
    } catch (error) {
        safeLog('error', 'MarketTrends: Failed to get filter options', { error: error.message });
        throw error;
    }
}

// ============================================
// SUMMARY
// ============================================

/**
 * Compute summary from cache
 * Calculates aggregated statistics (sums and averages) by type
 * For salaries, fetches metadata to calculate average SAL3 (all experience levels)
 */
async function computeSummary() {
    if (!trendsLightCache) return;
    
    const byType = {};
    const regions = new Set();
    const romeCodes = new Set();
    const salaireIds = [];  // Collect salary record IDs for metadata fetch
    
    // Types that should be summed (counts)
    const sumTypes = ['embauche', 'demandeur', 'demandeur_entrant', 'offre'];
    
    trendsLightCache.forEach(t => {
        if (t.Type) {
            if (!byType[t.Type]) {
                byType[t.Type] = { 
                    count: 0, 
                    latestDate: null,
                    totalValue: 0,
                    valueCount: 0
                };
            }
            byType[t.Type].count++;
            if (!byType[t.Type].latestDate || t.Date > byType[t.Type].latestDate) {
                byType[t.Type].latestDate = t.Date;
            }
            
            // Collect salary IDs for metadata-based calculation
            if (t.Type === 'salaire') {
                salaireIds.push(t.id);
            } else {
                // Accumulate values for statistics (non-salary types)
                // Convert to number explicitly (value may be string from database)
                const numValue = toNumber(t.Value);
                if (numValue !== null && !isNaN(numValue)) {
                    byType[t.Type].totalValue += numValue;
                    byType[t.Type].valueCount++;
                }
            }
        }
        if (t.Region) regions.add(t.Region);
        if (t.CodeRome) romeCodes.add(t.CodeRome);
    });
    
    // For salaries: fetch metadata and calculate average SAL3 (all experience levels)
    // Each salary record = 1 ROME code, we take only ONE SAL3 per record (first found)
    if (salaireIds.length > 0 && byType['salaire']) {
        try {
            const metadataMap = await fetchMetadataForIds(salaireIds);
            let totalSal3 = 0;
            let sal3Count = 0;
            
            for (const id of salaireIds) {
                const metadata = metadataMap[id];
                let sal3Found = null;
                
                // Find first SAL3 value in this record's metadata
                // API may use either listeValeursParPeriode or valeursParPeriode
                const periodes = metadata?.listeValeursParPeriode || metadata?.valeursParPeriode;
                if (periodes?.length) {
                    outerLoop:
                    for (const periode of periodes) {
                        if (periode.salaireValeurMontant?.length) {
                            for (const sv of periode.salaireValeurMontant) {
                                // SAL3 = salaire moyen tous niveaux d'expérience
                                if (sv.codeNomenclature === 'SAL3' && sv.valeurPrincipaleMontant !== undefined) {
                                    const montant = toNumber(sv.valeurPrincipaleMontant);
                                    if (montant !== null) {
                                        sal3Found = montant;
                                        break outerLoop;  // Take only first SAL3 per record
                                    }
                                }
                            }
                        }
                    }
                }
                
                // Add this record's SAL3 to total (one per record)
                if (sal3Found !== null) {
                    totalSal3 += sal3Found;
                    sal3Count++;
                }
            }
            
            if (sal3Count > 0) {
                byType['salaire'].totalValue = totalSal3;
                byType['salaire'].valueCount = sal3Count;
            }
            
            safeLog('debug', `MarketTrends: Salary SAL3 calculation - found ${sal3Count} SAL3 values from ${salaireIds.length} records`);
        } catch (error) {
            safeLog('warn', 'MarketTrends: Failed to fetch salary metadata for summary', { error: error.message });
        }
    }
    
    summaryCache = {
        totalRecords: trendsLightCache.length,
        types: Object.entries(byType).map(([type, data]) => {
            // For sum types: return total sum
            // For average types (indices/rates/salaries): return average
            const isSumType = sumTypes.includes(type);
            let aggregatedValue = 0;
            if (data.valueCount > 0 && data.totalValue !== null && !isNaN(data.totalValue)) {
                aggregatedValue = isSumType ? data.totalValue : data.totalValue / data.valueCount;
            }
            // Ensure we never return NaN or null
            const roundedValue = Math.round(aggregatedValue * 100) / 100;
            const finalValue = isNaN(roundedValue) ? 0 : roundedValue;
            
            return {
                type,
                count: data.count,
                latestDate: data.latestDate,
                aggregatedValue: finalValue,
                isSumType,
                valueCount: data.valueCount  // Number of records with valid (non-null) values
            };
        }),
        regions: Array.from(regions),
        romeCodes: Array.from(romeCodes)
    };
    
    safeLog('debug', 'MarketTrends: Summary computed', {
        totalRecords: summaryCache.totalRecords,
        typesCount: summaryCache.types.length
    });
}

// ============================================
// CACHED QUERIES (use in-memory cache)
// ============================================

/**
 * Get stored market trends with server-side filtering and pagination
 * Uses in-memory cache for instant response
 * @param {Object} options - Query options
 */
export async function getStoredTrends(options = {}) {
    try {
        const {
            type,
            codeRome,
            regionCode,
            sortField = 'Date',
            sortDirection = 'desc',
            page = 1,
            pageSize = 20
        } = options;

        // Ensure cache is loaded
        const allTrends = await getTrendsCache();
        
        // Apply filters in memory (very fast)
        let filtered = allTrends;
        
        if (type) {
            filtered = filtered.filter(t => t.Type === type);
        }
        if (codeRome) {
            filtered = filtered.filter(t => t.CodeRome === codeRome);
        }
        if (regionCode) {
            filtered = filtered.filter(t => t.RegionCode === regionCode);
        }
        
        // Sort in memory
        const sortDir = sortDirection === 'asc' ? 1 : -1;
        filtered.sort((a, b) => {
            const aVal = a[sortField] || '';
            const bVal = b[sortField] || '';
            if (aVal < bVal) return -sortDir;
            if (aVal > bVal) return sortDir;
            return 0;
        });
        
        // Paginate
        const parsedPage = parseInt(page) || 1;
        const parsedPageSize = parseInt(pageSize) || 20;
        const totalCount = filtered.length;
        const totalPages = Math.ceil(totalCount / parsedPageSize);
        const startIndex = (parsedPage - 1) * parsedPageSize;
        const paginatedTrends = filtered.slice(startIndex, startIndex + parsedPageSize);
        
        // Fetch metadata only for the paginated records (on-demand)
        const trendIds = paginatedTrends.map(t => t.id);
        const metadataMap = await fetchMetadataForIds(trendIds);
        
        // Merge metadata into trends
        const trendsWithMetadata = paginatedTrends.map(t => ({
            ...t,
            Metadata: metadataMap[t.id] || null
        }));

        return {
            trends: trendsWithMetadata,
            totalCount,
            pagination: {
                page: parsedPage,
                pageSize: parsedPageSize,
                totalCount,
                totalPages
            }
        };
    } catch (error) {
        safeLog('error', 'MarketTrends: Failed to get stored trends', { error: error.message });
        throw error;
    }
}

/**
 * Get trends grouped by type with limited items per type
 * Used when no type filter is selected to show all types with their own sections
 * @param {Object} options - Filter options
 */
export async function getStoredTrendsGroupedByType(options = {}) {
    try {
        const {
            codeRome,
            regionCode,
            itemsPerType = 5
        } = options;

        // Ensure cache is loaded
        const allTrends = await getTrendsCache();
        
        // Apply non-type filters
        let filtered = allTrends;
        
        if (codeRome) {
            filtered = filtered.filter(t => t.CodeRome === codeRome);
        }
        if (regionCode) {
            filtered = filtered.filter(t => t.RegionCode === regionCode);
        }
        
        // Group by type
        const byType = {};
        const countsByType = {};
        
        filtered.forEach(t => {
            if (!byType[t.Type]) {
                byType[t.Type] = [];
                countsByType[t.Type] = 0;
            }
            countsByType[t.Type]++;
            // Only keep first N items per type (already sorted by date desc from cache)
            if (byType[t.Type].length < itemsPerType) {
                byType[t.Type].push(t);
            }
        });
        
        // Fetch metadata for all displayed trends
        const allDisplayedIds = Object.values(byType).flat().map(t => t.id);
        const metadataMap = await fetchMetadataForIds(allDisplayedIds);
        
        // Merge metadata into trends
        const groupedWithMetadata = {};
        for (const [type, trends] of Object.entries(byType)) {
            groupedWithMetadata[type] = trends.map(t => ({
                ...t,
                Metadata: metadataMap[t.id] || null
            }));
        }

        return {
            groupedTrends: groupedWithMetadata,
            countsByType,
            totalCount: filtered.length
        };
    } catch (error) {
        safeLog('error', 'MarketTrends: Failed to get grouped trends', { error: error.message });
        throw error;
    }
}

/**
 * Get trends summary using cache for instant response
 */
export async function getTrendsSummary() {
    try {
        // Ensure cache is loaded
        await getTrendsCache();
        
        if (summaryCache) {
            safeLog('debug', 'MarketTrends: Returning cached summary');
            return summaryCache;
        }
        
        // Fallback: compute from cache
        await computeSummary();
        return summaryCache;
    } catch (error) {
        safeLog('error', 'MarketTrends: Failed to get summary', { error: error.message });
        throw error;
    }
}
