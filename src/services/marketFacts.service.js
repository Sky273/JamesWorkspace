/**
 * Market Facts Service
 * Handles storage and retrieval of market radar data in PostgreSQL
 * Table: market_facts
 */

import { safeLog } from '../utils/logger.backend.js';
import { query as dbQuery } from '../config/database.js';
import { collectMarketFacts as collectFranceTravailFacts } from './franceTravail.service.js';
import { collectMarketFacts as collectAdzunaFacts } from './adzuna.service.js';

// ============================================
// ROME CODES FROM STORED METIERS
// ============================================

/**
 * Get ROME codes from stored métiers in PostgreSQL
 * @returns {Array<string>} - Array of ROME codes
 */
async function getStoredRomeCodes() {
    try {
        const result = await dbQuery(
            'SELECT code_rome FROM rome_metiers ORDER BY code_rome ASC'
        );

        const codes = result.rows
            .map(r => r.code_rome)
            .filter(code => code);

        safeLog('info', 'MarketFacts: Retrieved ROME codes from stored métiers', { count: codes.length });
        return codes;
    } catch (error) {
        safeLog('error', 'MarketFacts: Failed to get stored ROME codes', { error: error.message });
        return [];
    }
}

// ============================================
// FACT STORAGE
// ============================================

/**
 * Store a single market fact in PostgreSQL
 * @param {Object} fact - The fact to store
 * @returns {Object} - Created record
 */
async function storeFact(fact) {
    try {
        // Include type and regionCode in metadata for map display
        const enrichedMetadata = {
            ...fact.metadata,
            type: fact.type || null,
            regionCode: fact.regionCode || null,
            romeCode: fact.romeCode || null
        };
        
        const result = await dbQuery(
            `INSERT INTO market_facts (date, source, keyword, location, job_count, mean_salary, metadata)
            VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [
                fact.date,
                fact.source,
                fact.keyword || fact.romeCode || null,
                fact.region || fact.location || null,
                fact.jobCount || 0,
                fact.meanSalary || null,
                JSON.stringify(enrichedMetadata)
            ]
        );
        
        return result.rows[0];
    } catch (error) {
        safeLog('error', 'MarketFacts: Failed to store fact', { 
            error: error.message,
            fact: { type: fact.type, source: fact.source }
        });
        throw error;
    }
}

/**
 * Store multiple facts in batch
 * @param {Array} facts - Array of facts to store
 * @returns {Object} - Summary of stored facts
 */
async function storeFacts(facts) {
    const results = {
        success: 0,
        failed: 0,
        errors: []
    };

    for (const fact of facts) {
        try {
            await storeFact(fact);
            results.success++;
        } catch (error) {
            results.failed++;
            results.errors.push({
                fact: { keyword: fact.keyword, source: fact.source },
                error: error.message
            });
        }
    }

    safeLog('info', 'MarketFacts: Storage completed', results);
    return results;
}

// ============================================
// OPTIMIZED DATA CACHE SYSTEM
// ============================================

// Main cache for all facts data (loaded once, filtered in memory)
let factsCache = null;
let factsCacheTime = 0;
const FACTS_CACHE_TTL = 10 * 60 * 1000; // 10 minutes
const FACTS_CACHE_MAX_SIZE = 50000; // Max records to cache (safety limit ~25MB)

// Region name to code mapping for backward compatibility
const REGION_NAME_TO_CODE = {
    'Auvergne-Rhône-Alpes': '84',
    'Bourgogne-Franche-Comté': '27',
    'Bretagne': '53',
    'Centre-Val de Loire': '24',
    'Corse': '94',
    'Grand Est': '44',
    'Hauts-de-France': '32',
    'Île-de-France': '11',
    'Normandie': '28',
    'Nouvelle-Aquitaine': '75',
    'Occitanie': '76',
    'Pays de la Loire': '52',
    "Provence-Alpes-Côte d'Azur": '93'
};

// Derived caches
let factsFilterOptionsCache = null;
let factsSummaryCache = null;

/**
 * Load all facts into cache from PostgreSQL
 */
async function loadFactsCache() {
    const startTime = Date.now();
    safeLog('info', 'MarketFacts: Loading facts cache...');
    
    const result = await dbQuery(
        'SELECT * FROM market_facts ORDER BY date DESC'
    );
    
    const allFacts = result.rows.map(record => {
        const metadata = record.metadata || {};
        const regionName = record.location;
        // Get regionCode from metadata or derive from region name
        const regionCode = metadata.regionCode || REGION_NAME_TO_CODE[regionName] || null;
        return {
            id: record.id,
            Source: record.source,
            Date: record.date,
            Keyword: record.keyword,
            Location: record.location,
            Region: regionName,
            RegionCode: regionCode,
            RomeCode: metadata.romeCode || record.keyword, // keyword stores rome code
            Type: metadata.type || (record.source === 'france_travail' && regionCode ? 'rome_region' : null),
            JobCount: record.job_count,
            MeanSalary: record.mean_salary,
            Metadata: metadata
        };
    });
    
    // Update cache with size limit check
    if (allFacts.length <= FACTS_CACHE_MAX_SIZE) {
        factsCache = allFacts;
        factsCacheTime = Date.now();
        
        computeFactsFilterOptions();
        computeFactsSummary();
        
        const duration = Date.now() - startTime;
        safeLog('info', `MarketFacts: Cache loaded - ${allFacts.length} records in ${duration}ms`);
    } else {
        safeLog('warn', `MarketFacts: Skipping cache - ${allFacts.length} records exceeds limit`);
        factsCache = allFacts.slice(0, FACTS_CACHE_MAX_SIZE);
        factsCacheTime = Date.now();
        computeFactsFilterOptions();
        computeFactsSummary();
    }
    
    return allFacts;
}

/**
 * Get facts cache (load if needed)
 */
async function getFactsCache() {
    if (!factsCache || (Date.now() - factsCacheTime) > FACTS_CACHE_TTL) {
        await loadFactsCache();
    }
    return factsCache;
}

/**
 * Invalidate cache (call after collection)
 */
function invalidateFactsCache() {
    factsCache = null;
    factsCacheTime = 0;
    factsFilterOptionsCache = null;
    factsSummaryCache = null;
    safeLog('info', 'MarketFacts: Cache invalidated');
}

// Periodic cache cleanup - auto-expire if not accessed for 2x TTL
const factsCacheCleanupInterval = setInterval(() => {
    if (factsCacheTime && Date.now() - factsCacheTime > FACTS_CACHE_TTL * 2) {
        factsCache = null;
        factsFilterOptionsCache = null;
        factsSummaryCache = null;
        factsCacheTime = 0;
        safeLog('debug', 'MarketFacts: Cache auto-expired (inactive)');
    }
}, FACTS_CACHE_TTL);

/**
 * Destroy facts cache and cleanup interval (for graceful shutdown)
 */
function destroyFactsCache() {
    if (factsCacheCleanupInterval) {
        clearInterval(factsCacheCleanupInterval);
    }
    factsCache = null;
    factsFilterOptionsCache = null;
    factsSummaryCache = null;
    factsCacheTime = 0;
    safeLog('info', 'MarketFacts: Cache destroyed');
}

/**
 * Get facts cache statistics
 */
function getFactsCacheStats() {
    return {
        size: factsCache?.length || 0,
        maxSize: FACTS_CACHE_MAX_SIZE,
        ttlMinutes: FACTS_CACHE_TTL / (60 * 1000),
        ageMs: factsCacheTime ? Date.now() - factsCacheTime : null,
        hasFilterOptions: !!factsFilterOptionsCache,
        hasSummary: !!factsSummaryCache
    };
}

/**
 * Compute filter options from cache
 */
function computeFactsFilterOptions() {
    if (!factsCache) return;
    
    const sources = new Set();
    const regions = new Set();
    const keywords = new Set();
    const locations = new Set();
    
    factsCache.forEach(f => {
        if (f.Source) sources.add(f.Source);
        if (f.Region) regions.add(f.Region);
        if (f.Keyword) keywords.add(f.Keyword);
        if (f.Location) locations.add(f.Location);
    });
    
    factsFilterOptionsCache = {
        sources: Array.from(sources).sort(),
        regions: Array.from(regions).filter(r => r).sort(),
        keywords: Array.from(keywords).filter(k => k).sort(),
        locations: Array.from(locations).filter(l => l).sort()
    };
}

/**
 * Compute summary from cache
 */
function computeFactsSummary() {
    if (!factsCache) return;
    
    const bySource = {};
    const regions = new Set();
    const keywords = new Set();
    let totalJobs = 0;
    
    factsCache.forEach(f => {
        if (f.Source) {
            if (!bySource[f.Source]) bySource[f.Source] = { count: 0, latestDate: null, totalJobs: 0 };
            bySource[f.Source].count++;
            bySource[f.Source].totalJobs += f.JobCount || 0;
            if (!bySource[f.Source].latestDate || f.Date > bySource[f.Source].latestDate) {
                bySource[f.Source].latestDate = f.Date;
            }
        }
        if (f.Region) regions.add(f.Region);
        if (f.Keyword) keywords.add(f.Keyword);
        totalJobs += f.JobCount || 0;
    });
    
    factsSummaryCache = {
        totalRecords: factsCache.length,
        totalJobs,
        totalRegions: regions.size,
        totalKeywords: keywords.size,
        sources: Object.entries(bySource).map(([source, data]) => ({
            source,
            count: data.count,
            totalJobs: data.totalJobs,
            latestDate: data.latestDate
        })),
        regions: Array.from(regions).filter(r => r),
        keywords: Array.from(keywords).filter(k => k)
    };
}

/**
 * Get facts filter options using cache
 */
async function getFactsFilterOptions() {
    await getFactsCache();
    return factsFilterOptionsCache;
}

/**
 * Get facts summary using cache
 */
async function getFactsSummary() {
    await getFactsCache();
    return factsSummaryCache;
}

// ============================================
// RETRIEVAL FUNCTIONS
// ============================================

/**
 * Get facts with server-side filtering and pagination
 * Uses in-memory cache for instant response
 * @param {string} startDate - Start date (YYYY-MM-DD) - ignored, kept for API compatibility
 * @param {string} endDate - End date (YYYY-MM-DD) - ignored, kept for API compatibility
 * @param {Object} filters - Additional filters
 * @returns {Object} - Facts with pagination info
 */
async function getFactsByDateRange(startDate, endDate, filters = {}) {
    try {
        // Ensure cache is loaded
        const allFacts = await getFactsCache();
        
        // Apply filters in memory (very fast)
        let filtered = allFacts;
        
        if (filters.source) {
            filtered = filtered.filter(f => f.Source === filters.source);
        }
        if (filters.region) {
            filtered = filtered.filter(f => f.Region === filters.region);
        }
        if (filters.keyword) {
            filtered = filtered.filter(f => f.Keyword === filters.keyword);
        }
        if (filters.location) {
            filtered = filtered.filter(f => f.Location === filters.location);
        }
        
        // Sort by date descending (already sorted in cache, but re-sort if needed)
        filtered.sort((a, b) => {
            const aDate = a.Date ? String(a.Date) : '';
            const bDate = b.Date ? String(b.Date) : '';
            return bDate.localeCompare(aDate);
        });

        // Handle pagination
        const page = filters.page ? parseInt(filters.page) : null;
        const pageSize = filters.pageSize ? parseInt(filters.pageSize) : 20;
        
        if (page) {
            const startIndex = (page - 1) * pageSize;
            const paginatedFacts = filtered.slice(startIndex, startIndex + pageSize);
            return {
                facts: paginatedFacts,
                pagination: {
                    page,
                    pageSize,
                    totalCount: filtered.length,
                    totalPages: Math.ceil(filtered.length / pageSize)
                }
            };
        }

        // Return all facts if no pagination
        return { facts: filtered, pagination: null };
    } catch (error) {
        safeLog('error', 'MarketFacts: Failed to get facts', { error: error.message });
        throw error;
    }
}

/**
 * Get latest facts by source
 * @param {string} type - Fact type (unused in PostgreSQL, kept for compatibility)
 * @param {string} source - Optional source filter
 * @returns {Array} - Latest facts
 */
async function getLatestFacts(type, source = null) {
    try {
        let query = 'SELECT * FROM market_facts';
        const params = [];
        
        if (source) {
            query += ' WHERE source = $1';
            params.push(source);
        }
        
        query += ' ORDER BY date DESC LIMIT 100';
        
        const result = await dbQuery(query, params);

        return result.rows.map(r => ({
            id: r.id,
            Source: r.source,
            Date: r.date,
            Keyword: r.keyword,
            Location: r.location,
            Region: r.region,
            JobCount: r.job_count,
            MeanSalary: r.mean_salary,
            Metadata: r.metadata
        }));
    } catch (error) {
        safeLog('error', 'MarketFacts: Failed to get latest facts', { error: error.message });
        throw error;
    }
}

/**
 * Get aggregated stats for a keyword over time
 * @param {string} keyword - Keyword to track
 * @param {number} days - Number of days to look back
 * @returns {Object} - Aggregated stats
 */
async function getKeywordTrend(keyword, days = 30) {
    try {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const result = await dbQuery(
            `SELECT date, source, job_count, mean_salary 
             FROM market_facts 
             WHERE keyword = $1 AND date >= $2 
             ORDER BY date ASC`,
            [keyword, startDate]
        );

        const trend = result.rows.map(r => ({
            date: r.date,
            source: r.source,
            jobCount: r.job_count,
            meanSalary: r.mean_salary
        }));

        return {
            keyword,
            days,
            dataPoints: trend.length,
            trend
        };
    } catch (error) {
        safeLog('error', 'MarketFacts: Failed to get keyword trend', { error: error.message });
        throw error;
    }
}

/**
 * Get regional comparison for a specific date
 * @param {string} date - Date (YYYY-MM-DD)
 * @param {string} source - Data source
 * @returns {Array} - Regional data
 */
async function getRegionalComparison(date, source = null) {
    try {
        let query = `SELECT * FROM market_facts WHERE date = $1`;
        const params = [date];
        
        if (source) {
            query += ` AND source = $2`;
            params.push(source);
        }
        
        query += ` ORDER BY job_count DESC`;

        const result = await dbQuery(query, params);

        return result.rows.map(r => ({
            id: r.id,
            location: r.location,
            keyword: r.keyword,
            jobCount: r.job_count,
            meanSalary: r.mean_salary,
            source: r.source
        }));
    } catch (error) {
        safeLog('error', 'MarketFacts: Failed to get regional comparison', { error: error.message });
        throw error;
    }
}

// ============================================
// DATA COLLECTION ORCHESTRATION
// ============================================

/**
 * Run full market data collection from all sources
 * Uses ROME codes from stored métiers to filter API calls
 * @param {Object} options - Collection options
 * @param {boolean} options.useStoredRomeCodes - Use ROME codes from stored métiers (default: true)
 * @returns {Object} - Collection summary
 */
async function runFullCollection(options = {}) {
    const summary = {
        startTime: new Date().toISOString(),
        sources: {},
        totalFacts: 0,
        stored: 0,
        failed: 0
    };

    safeLog('info', 'MarketFacts: Starting full collection');

    // Get ROME codes from stored métiers if enabled (default: true)
    let romeCodes = null;
    if (options.useStoredRomeCodes !== false) {
        romeCodes = await getStoredRomeCodes();
        if (romeCodes.length > 0) {
            safeLog('info', 'MarketFacts: Using ROME codes from stored métiers', { count: romeCodes.length });
            summary.romeCodesUsed = romeCodes.length;
        } else {
            safeLog('warn', 'MarketFacts: No stored ROME codes found, using default IT codes');
        }
    }

    // Collect from France Travail with immediate storage
    let ftStoredCount = 0;
    let ftFailedCount = 0;
    
    try {
        safeLog('info', 'MarketFacts: Collecting from France Travail (with immediate storage)');
        const ftOptions = options.franceTravail || {};
        // Pass ROME codes if we have them
        if (romeCodes && romeCodes.length > 0) {
            ftOptions.romeCodes = romeCodes;
        }
        // Pass callback to save each fact immediately
        ftOptions.onFactCollected = async (fact) => {
            try {
                await storeFact(fact);
                ftStoredCount++;
            } catch (err) {
                ftFailedCount++;
                safeLog('error', 'MarketFacts: Failed to store fact', { error: err.message });
            }
        };
        
        const ftFacts = await collectFranceTravailFacts(ftOptions);
        summary.sources.franceTravail = {
            collected: ftFacts.length,
            stored: ftStoredCount,
            failed: ftFailedCount,
            status: 'success'
        };
        summary.stored += ftStoredCount;
        summary.failed += ftFailedCount;
        summary.totalFacts += ftFacts.length;
    } catch (error) {
        safeLog('error', 'MarketFacts: France Travail collection failed', { error: error.message });
        summary.sources.franceTravail = {
            collected: 0,
            stored: ftStoredCount,
            failed: ftFailedCount,
            status: 'error',
            error: error.message
        };
    }

    // Collect from Adzuna
    try {
        safeLog('info', 'MarketFacts: Collecting from Adzuna');
        const adzunaFacts = await collectAdzunaFacts(options.adzuna || {});
        summary.sources.adzuna = {
            collected: adzunaFacts.length,
            status: 'success'
        };
        
        if (adzunaFacts.length > 0) {
            const adzunaStored = await storeFacts(adzunaFacts);
            summary.sources.adzuna.stored = adzunaStored.success;
            summary.sources.adzuna.failed = adzunaStored.failed;
            summary.stored += adzunaStored.success;
            summary.failed += adzunaStored.failed;
        }
        
        summary.totalFacts += adzunaFacts.length;
    } catch (error) {
        safeLog('error', 'MarketFacts: Adzuna collection failed', { error: error.message });
        summary.sources.adzuna = {
            status: 'error',
            error: error.message
        };
    }

    summary.endTime = new Date().toISOString();
    summary.duration = new Date(summary.endTime) - new Date(summary.startTime);

    safeLog('info', 'MarketFacts: Full collection completed', summary);

    return summary;
}

/**
 * Run collection for a specific source only
 * Uses ROME codes from stored métiers to filter API calls
 * @param {string} source - 'france_travail' or 'adzuna'
 * @param {Object} options - Collection options
 * @param {boolean} options.useStoredRomeCodes - Use ROME codes from stored métiers (default: true)
 * @returns {Object} - Collection summary
 */
async function runSourceCollection(source, options = {}) {
    const summary = {
        source,
        startTime: new Date().toISOString(),
        collected: 0,
        stored: 0,
        failed: 0
    };

    let storedCount = 0;
    let failedCount = 0;

    try {
        // Get ROME codes from stored métiers if enabled (default: true)
        if (options.useStoredRomeCodes !== false && !options.romeCodes) {
            const storedCodes = await getStoredRomeCodes();
            if (storedCodes.length > 0) {
                options.romeCodes = storedCodes;
                summary.romeCodesUsed = storedCodes.length;
                safeLog('info', `MarketFacts: Using ${storedCodes.length} ROME codes from stored métiers for ${source}`);
            }
        }

        // Add callback for immediate storage
        options.onFactCollected = async (fact) => {
            try {
                await storeFact(fact);
                storedCount++;
            } catch (err) {
                failedCount++;
                safeLog('error', 'MarketFacts: Failed to store fact', { error: err.message });
            }
        };

        let facts = [];
        
        if (source === 'france_travail') {
            facts = await collectFranceTravailFacts(options);
        } else if (source === 'adzuna') {
            facts = await collectAdzunaFacts(options);
        } else {
            throw new Error(`Unknown source: ${source}`);
        }

        summary.collected = facts.length;
        summary.stored = storedCount;
        summary.failed = failedCount;
        summary.status = 'success';
    } catch (error) {
        summary.status = 'error';
        summary.error = error.message;
        summary.stored = storedCount;
        summary.failed = failedCount;
        safeLog('error', `MarketFacts: ${source} collection failed`, { error: error.message });
    }

    summary.endTime = new Date().toISOString();
    summary.duration = new Date(summary.endTime) - new Date(summary.startTime);

    return summary;
}

/**
 * Cleanup function for graceful shutdown
 * Clears all caches and releases memory
 */
function cleanupFactsCache() {
    factsCache = null;
    factsCacheTime = 0;
    factsFilterOptionsCache = null;
    factsSummaryCache = null;
    safeLog('info', 'MarketFacts: Cache cleaned up for shutdown');
}

export {
    storeFact,
    storeFacts,
    getFactsByDateRange,
    getLatestFacts,
    getKeywordTrend,
    getRegionalComparison,
    runFullCollection,
    runSourceCollection,
    getStoredRomeCodes,
    invalidateFactsCache,
    loadFactsCache,
    getFactsFilterOptions,
    getFactsSummary,
    cleanupFactsCache,
    destroyFactsCache,
    getFactsCacheStats
};
