/**
 * Tags Cache Service
 * Thin wrapper around the shared versioned cache namespace for tags aggregations.
 */

import { CACHE_KEYS, getNamedCacheStats, invalidateTagsCaches, tagsCache as sharedTagsCache } from './cache.service.js';

const CLEANED_TAG_KEYS = new Set();
let hasEscoCache = false;
let hasRawCache = false;

export async function getCachedRawTags(cacheKey) {
    return sharedTagsCache.get(cacheKey, { scope: CACHE_KEYS.tags.RAW });
}

export async function setCachedRawTags(cacheKey, result) {
    hasRawCache = true;
    return sharedTagsCache.set(cacheKey, result, { scope: CACHE_KEYS.tags.RAW });
}

export async function getCachedCleanedTags(cacheKey) {
    return sharedTagsCache.get(cacheKey, { scope: CACHE_KEYS.tags.CLEANED });
}

export async function setCachedCleanedTags(cacheKey, result) {
    CLEANED_TAG_KEYS.add(cacheKey);
    return sharedTagsCache.set(cacheKey, result, { scope: CACHE_KEYS.tags.CLEANED });
}

export async function getCachedEscoTags(cacheKey = 'admin') {
    return sharedTagsCache.get(cacheKey, { scope: CACHE_KEYS.tags.ESCO });
}

export async function setCachedEscoTags(result, cacheKey = 'admin') {
    hasEscoCache = true;
    return sharedTagsCache.set(cacheKey, result, { scope: CACHE_KEYS.tags.ESCO });
}

export async function invalidateTagsCache() {
    CLEANED_TAG_KEYS.clear();
    hasEscoCache = false;
    hasRawCache = false;
    await invalidateTagsCaches();
}

export async function destroyTagsCache() {
    CLEANED_TAG_KEYS.clear();
    hasEscoCache = false;
    hasRawCache = false;
}

export async function getTagsCacheStats() {
    const cache = await getNamedCacheStats('tags');
    return {
        cleanedTags: {
            size: CLEANED_TAG_KEYS.size,
            keys: [...CLEANED_TAG_KEYS]
        },
        escoTags: {
            hasData: hasEscoCache
        },
        rawTags: {
            hasData: hasRawCache
        },
        cache
    };
}

export function startTagsCacheCleanup() {
    return null;
}
