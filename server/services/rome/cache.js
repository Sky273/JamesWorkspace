const METIERS_CACHE_TTL = 10 * 60 * 1000;
const METIERS_CACHE_MAX_SIZE = 5000;

let metiersCache = null;
let metiersCacheTime = 0;

function canUseCache(filters = {}) {
    const includeDetails = filters.includeDetails === true || filters.includeDetails === 'true';
    return !filters.codeRome && !filters.grandDomaine && !filters.search && !includeDetails;
}

function isCacheFresh() {
    return metiersCache && Date.now() - metiersCacheTime < METIERS_CACHE_TTL;
}

function getCachedMetiers(filters = {}, log) {
    if (!canUseCache(filters) || !isCacheFresh()) {
        return null;
    }

    log.debug('Returning cached métiers list');

    const page = filters.page ? parseInt(filters.page, 10) : null;
    const pageSize = filters.pageSize ? parseInt(filters.pageSize, 10) : 20;

    if (page) {
        const startIndex = (page - 1) * pageSize;
        return {
            metiers: metiersCache.slice(startIndex, startIndex + pageSize),
            totalCount: metiersCache.length,
            pagination: {
                page,
                pageSize,
                totalCount: metiersCache.length,
                totalPages: Math.ceil(metiersCache.length / pageSize)
            }
        };
    }

    return metiersCache;
}

function updateMetiersCache(filters = {}, metiers = [], log) {
    if (canUseCache(filters) && metiers.length <= METIERS_CACHE_MAX_SIZE) {
        metiersCache = metiers;
        metiersCacheTime = Date.now();
        log.info(`Cached ${metiers.length} métiers`);
    }
}

function withPagination(items, filters = {}) {
    const page = filters.page ? parseInt(filters.page, 10) : null;
    const pageSize = filters.pageSize ? parseInt(filters.pageSize, 10) : 20;

    if (!page) {
        return items;
    }

    const startIndex = (page - 1) * pageSize;
    return {
        metiers: items.slice(startIndex, startIndex + pageSize),
        totalCount: items.length,
        pagination: {
            page,
            pageSize,
            totalCount: items.length,
            totalPages: Math.ceil(items.length / pageSize)
        }
    };
}

const metiersCacheCleanupInterval = setInterval(() => {
    if (metiersCacheTime && Date.now() - metiersCacheTime > METIERS_CACHE_TTL * 2) {
        metiersCache = null;
        metiersCacheTime = 0;
    }
}, METIERS_CACHE_TTL);

function cleanupMetiersCache(log) {
    metiersCache = null;
    metiersCacheTime = 0;
    log.info('Métiers cache cleaned up for shutdown');
}

function destroyMetiersCache(log) {
    if (metiersCacheCleanupInterval) {
        clearInterval(metiersCacheCleanupInterval);
    }
    metiersCache = null;
    metiersCacheTime = 0;
    log.info('Métiers cache destroyed');
}

function getMetiersCacheStats() {
    return {
        size: metiersCache?.length || 0,
        maxSize: METIERS_CACHE_MAX_SIZE,
        ttlMinutes: METIERS_CACHE_TTL / (60 * 1000),
        ageMs: metiersCacheTime ? Date.now() - metiersCacheTime : null
    };
}

export {
    cleanupMetiersCache,
    destroyMetiersCache,
    getCachedMetiers,
    getMetiersCacheStats,
    updateMetiersCache,
    withPagination
};
