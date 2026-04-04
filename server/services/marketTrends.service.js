/**
 * Market Trends Service
 *
 * Runtime-facing re-export surface for market trends modules.
 */

export { getStatDynamiqueEmploi } from './marketTrends/apiClient.js';

export { storeTrend, collectMarketTrends } from './marketTrends/collector.js';

export {
    getStoredTrendsLight,
    getTrendMetadata,
    getTrendsAuditReport
} from './marketTrends/queries.js';

export {
    getStoredTrends,
    getStoredTrendsGroupedByType,
    getTrendsSummary,
    getTrendFilterOptions,
    loadTrendsCache,
    startTrendsCacheCleanup,
    invalidateTrendsCache,
    cleanupTrendsCache,
    destroyTrendsCache,
    getTrendsCacheStats
} from './marketTrends/cache.js';
