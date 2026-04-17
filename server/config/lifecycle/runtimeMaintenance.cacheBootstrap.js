import { safeLog } from '../../utils/logger.backend.js';
import { cleanupAllCaches } from '../../services/cache.service.js';
import { cleanupFactsCache, startFactsCacheCleanup } from '../../services/marketFacts.service.js';
import { cleanupTrendsCache, startTrendsCacheCleanup } from '../../services/marketTrends.service.js';
import { cleanupMetiersCache } from '../../services/rome.service.js';
import { invalidateTagsCache, startTagsCacheCleanup } from '../../services/tagsCache.service.js';
import { startEscoCacheCleanup } from '../../services/escoService.js';
import { registerCacheCleanupFunctions } from '../../services/memoryMonitor.service.js';

const STARTUP_CACHE_CLEANUPS = [
    cleanupFactsCache,
    cleanupTrendsCache,
    cleanupMetiersCache
];

export async function cleanupCachesOnStartup() {
    safeLog('info', 'Cleaning all caches on startup');
    try {
        await cleanupAllCaches();
        cleanupFactsCache();
        cleanupTrendsCache();
        cleanupMetiersCache();
        await invalidateTagsCache();
        safeLog('info', 'All caches cleaned successfully');
    } catch (error) {
        safeLog('error', 'Error cleaning caches on startup', { error: error.message });
    }
}

export function registerStartupCacheCleanups() {
    registerCacheCleanupFunctions(STARTUP_CACHE_CLEANUPS);
}

export function startBackgroundCacheCleanups() {
    startFactsCacheCleanup();
    startTrendsCacheCleanup();
    startTagsCacheCleanup();
    startEscoCacheCleanup();
}
