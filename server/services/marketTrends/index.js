/**
 * Market Trends Service - Main Entry Point
 * Re-exports all functions from submodules for backward compatibility
 * 
 * Structure:
 * - apiClient.js  : Token management + 7 France Travail API call functions
 * - collector.js  : collectMarketTrends, storeTrend, generateCollectionReport
 * - queries.js    : getStoredTrendsLight, getStoredTrendsWithMetadata, getTrendMetadata
 * - cache.js      : Cache system, getStoredTrends, grouped views, summary, filter options
 */

// API Client
export {
    getStatEmbauches,
    getStatDynamiqueEmploi,
    getStatTensions,
    getStatSalaires,
    getStatOffres,
    getStatDemandeurs,
    getStatDemandeursEntrants
} from './apiClient.js';

// Collection & Storage
export {
    storeTrend,
    collectMarketTrends
} from './collector.js';

// Direct Queries (no cache)
export {
    getStoredTrendsLight,
    getStoredTrendsWithMetadata,
    getTrendMetadata,
    fetchMetadataForIds,
    getTrendsAuditReport
} from './queries.js';

// Cache-based queries & management
export {
    getStoredTrends,
    getStoredTrendsGroupedByType,
    getTrendsSummary,
    getTrendFilterOptions,
    loadTrendsCache,
    invalidateTrendsCache,
    cleanupTrendsCache,
    destroyTrendsCache,
    getTrendsCacheStats
} from './cache.js';
