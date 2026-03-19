/**
 * Market Trends Service
 * 
 * This file re-exports the modular market trends service from ./marketTrends/
 * 
 * Structure:
 * - ./marketTrends/index.js     : Main entry point
 * - ./marketTrends/apiClient.js : Token management + France Travail API calls
 * - ./marketTrends/collector.js : Data collection & storage
 * - ./marketTrends/queries.js   : PostgreSQL queries for stored trends
 * - ./marketTrends/cache.js     : In-memory cache, filtering, summary
 */

export {
    getStatEmbauches,
    getStatDynamiqueEmploi,
    getStatTensions,
    getStatSalaires,
    getStatOffres,
    getStatDemandeurs,
    getStatDemandeursEntrants,
    storeTrend,
    collectMarketTrends,
    getStoredTrends,
    getStoredTrendsLight,
    getStoredTrendsWithMetadata,
    getStoredTrendsGroupedByType,
    getTrendMetadata,
    getTrendFilterOptions,
    getTrendsSummary,
    invalidateTrendsCache,
    loadTrendsCache,
    cleanupTrendsCache,
    destroyTrendsCache,
    getTrendsCacheStats,
    getTrendsAuditReport
} from './marketTrends/index.js';
