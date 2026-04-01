import { safeLog } from '../utils/logger.backend.js';
import { query as dbQuery } from '../config/database.js';

const FACTS_CACHE_TTL = 5 * 60 * 1000;
const FACTS_CACHE_MAX_SIZE = 10000;

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

let factsCache = null;
let factsCacheTime = 0;
let factsFilterOptionsCache = null;
let factsSummaryCache = null;
let factsCacheCleanupInterval = null;

function mapRecord(record) {
    const metadata = record.metadata || {};
    const regionName = record.location;
    const regionCode = metadata.regionCode || REGION_NAME_TO_CODE[regionName] || null;

    return {
        id: record.id,
        Source: record.source,
        Date: record.date,
        Keyword: record.keyword,
        Location: record.location,
        Region: regionName,
        RegionCode: regionCode,
        RomeCode: metadata.romeCode || record.keyword,
        Type: metadata.type || (record.source === 'france_travail' && regionCode ? 'rome_region' : null),
        JobCount: record.job_count,
        MeanSalary: record.mean_salary,
        Metadata: metadata
    };
}

function computeFactsFilterOptions() {
    if (!factsCache) return;

    const sources = new Set();
    const regions = new Set();
    const keywords = new Set();
    const locations = new Set();

    factsCache.forEach((fact) => {
        if (fact.Source) sources.add(fact.Source);
        if (fact.Region) regions.add(fact.Region);
        if (fact.Keyword) keywords.add(fact.Keyword);
        if (fact.Location) locations.add(fact.Location);
    });

    factsFilterOptionsCache = {
        sources: Array.from(sources).sort(),
        regions: Array.from(regions).filter(Boolean).sort(),
        keywords: Array.from(keywords).filter(Boolean).sort(),
        locations: Array.from(locations).filter(Boolean).sort()
    };
}

function computeFactsSummary() {
    if (!factsCache) return;

    const bySource = {};
    const regions = new Set();
    const keywords = new Set();
    let totalJobs = 0;

    factsCache.forEach((fact) => {
        if (fact.Source) {
            if (!bySource[fact.Source]) bySource[fact.Source] = { count: 0, latestDate: null, totalJobs: 0 };
            bySource[fact.Source].count++;
            bySource[fact.Source].totalJobs += fact.JobCount || 0;
            if (!bySource[fact.Source].latestDate || fact.Date > bySource[fact.Source].latestDate) {
                bySource[fact.Source].latestDate = fact.Date;
            }
        }
        if (fact.Region) regions.add(fact.Region);
        if (fact.Keyword) keywords.add(fact.Keyword);
        totalJobs += fact.JobCount || 0;
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
        regions: Array.from(regions).filter(Boolean),
        keywords: Array.from(keywords).filter(Boolean)
    };
}

export async function loadFactsCache() {
    const startTime = Date.now();
    safeLog('info', 'MarketFacts: Loading facts cache...');

    const result = await dbQuery('SELECT * FROM market_facts ORDER BY date DESC');
    const allFacts = result.rows.map(mapRecord);

    factsCache = allFacts.length <= FACTS_CACHE_MAX_SIZE
        ? allFacts
        : allFacts.slice(0, FACTS_CACHE_MAX_SIZE);
    factsCacheTime = Date.now();

    computeFactsFilterOptions();
    computeFactsSummary();

    const duration = Date.now() - startTime;
    if (allFacts.length <= FACTS_CACHE_MAX_SIZE) {
        safeLog('info', `MarketFacts: Cache loaded - ${allFacts.length} records in ${duration}ms`);
    } else {
        safeLog('warn', `MarketFacts: Skipping full cache - ${allFacts.length} records exceeds limit`);
    }

    return allFacts;
}

export async function getFactsCache() {
    if (!factsCache || (Date.now() - factsCacheTime) > FACTS_CACHE_TTL) {
        await loadFactsCache();
    }
    return factsCache;
}

export function invalidateFactsCache() {
    factsCache = null;
    factsCacheTime = 0;
    factsFilterOptionsCache = null;
    factsSummaryCache = null;
    safeLog('info', 'MarketFacts: Cache invalidated');
}

export function startFactsCacheCleanup() {
    if (factsCacheCleanupInterval) {
        return;
    }

    factsCacheCleanupInterval = setInterval(() => {
        if (factsCacheTime && Date.now() - factsCacheTime > FACTS_CACHE_TTL * 2) {
            factsCache = null;
            factsFilterOptionsCache = null;
            factsSummaryCache = null;
            factsCacheTime = 0;
            safeLog('debug', 'MarketFacts: Cache auto-expired (inactive)');
        }
    }, FACTS_CACHE_TTL);

    if (factsCacheCleanupInterval.unref) {
        factsCacheCleanupInterval.unref();
    }
}

export function cleanupFactsCache() {
    factsCache = null;
    factsCacheTime = 0;
    factsFilterOptionsCache = null;
    factsSummaryCache = null;
    safeLog('info', 'MarketFacts: Cache cleaned up for shutdown');
}

export function destroyFactsCache() {
    if (factsCacheCleanupInterval) {
        clearInterval(factsCacheCleanupInterval);
        factsCacheCleanupInterval = null;
    }
    cleanupFactsCache();
    safeLog('info', 'MarketFacts: Cache destroyed');
}

export function getFactsCacheStats() {
    return {
        size: factsCache?.length || 0,
        maxSize: FACTS_CACHE_MAX_SIZE,
        ttlMinutes: FACTS_CACHE_TTL / (60 * 1000),
        ageMs: factsCacheTime ? Date.now() - factsCacheTime : null,
        hasFilterOptions: !!factsFilterOptionsCache,
        hasSummary: !!factsSummaryCache
    };
}

export async function getFactsFilterOptions() {
    await getFactsCache();
    return factsFilterOptionsCache;
}

export async function getFactsSummary() {
    await getFactsCache();
    return factsSummaryCache;
}

export async function getFactsByDateRange(startDate, endDate, filters = {}) {
    try {
        const allFacts = await getFactsCache();
        let filtered = allFacts;

        if (filters.source) filtered = filtered.filter((fact) => fact.Source === filters.source);
        if (filters.region) filtered = filtered.filter((fact) => fact.Region === filters.region);
        if (filters.keyword) filtered = filtered.filter((fact) => fact.Keyword === filters.keyword);
        if (filters.location) filtered = filtered.filter((fact) => fact.Location === filters.location);

        filtered.sort((a, b) => {
            const aDate = a.Date ? String(a.Date) : '';
            const bDate = b.Date ? String(b.Date) : '';
            return bDate.localeCompare(aDate);
        });

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

        return { facts: filtered, pagination: null };
    } catch (error) {
        safeLog('error', 'MarketFacts: Failed to get facts', { error: error.message });
        throw error;
    }
}
