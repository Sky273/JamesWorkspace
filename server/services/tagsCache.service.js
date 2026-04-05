/**
 * Tags Cache Service
 * Owns in-memory cache state for tags aggregation
 */

import { safeLog } from '../utils/logger.backend.js';

const TAGS_CACHE_TTL = 10 * 60 * 1000; // 10 minutes
const MAX_TAGS_CACHE_ENTRIES = 100;

const cleanedTagsCache = new Map();
const cleanedTagsCacheTime = new Map();
let escoTagsCache = null;
let escoTagsCacheTime = 0;
let tagsCacheCleanupInterval = null;

function isEntryFresh(timestamp, ttlMs = TAGS_CACHE_TTL) {
    return typeof timestamp === 'number' && (Date.now() - timestamp) < ttlMs;
}

function evictOldestCleanedTagsEntry() {
    const oldestKey = cleanedTagsCache.keys().next().value;
    if (oldestKey !== undefined) {
        cleanedTagsCache.delete(oldestKey);
        cleanedTagsCacheTime.delete(oldestKey);
    }
}

function runTagsCacheCleanup() {
    const now = Date.now();
    let expiredCount = 0;

    for (const [key, timestamp] of cleanedTagsCacheTime.entries()) {
        if (now - timestamp > TAGS_CACHE_TTL * 2) {
            cleanedTagsCache.delete(key);
            cleanedTagsCacheTime.delete(key);
            expiredCount++;
        }
    }

    if (expiredCount > 0) {
        safeLog('debug', 'Tags: cleaned tags cache auto-expired', { expiredCount });
    }

    if (escoTagsCacheTime && now - escoTagsCacheTime > TAGS_CACHE_TTL * 2) {
        escoTagsCache = null;
        escoTagsCacheTime = 0;
        safeLog('debug', 'Tags: ESCO tags cache auto-expired');
    }
}

function clearCleanedTagsCache() {
    cleanedTagsCache.clear();
    cleanedTagsCacheTime.clear();
}

function clearEscoTagsCache() {
    escoTagsCache = null;
    escoTagsCacheTime = 0;
}

export function getCachedCleanedTags(cacheKey) {
    const cachedResult = cleanedTagsCache.get(cacheKey);
    const cachedTime = cleanedTagsCacheTime.get(cacheKey);

    if (!cachedResult || !cachedTime) {
        return null;
    }

    if (!isEntryFresh(cachedTime)) {
        cleanedTagsCache.delete(cacheKey);
        cleanedTagsCacheTime.delete(cacheKey);
        return null;
    }

    return cachedResult;
}

export function setCachedCleanedTags(cacheKey, result) {
    if (cleanedTagsCache.size >= MAX_TAGS_CACHE_ENTRIES) {
        evictOldestCleanedTagsEntry();
    }

    cleanedTagsCache.set(cacheKey, result);
    cleanedTagsCacheTime.set(cacheKey, Date.now());
}

export function getCachedEscoTags() {
    if (!escoTagsCache || !escoTagsCacheTime) {
        return null;
    }

    if (!isEntryFresh(escoTagsCacheTime)) {
        clearEscoTagsCache();
        return null;
    }

    return escoTagsCache;
}

export function setCachedEscoTags(result) {
    escoTagsCache = result;
    escoTagsCacheTime = Date.now();
}

export function invalidateTagsCache() {
    clearCleanedTagsCache();
    clearEscoTagsCache();
    safeLog('debug', 'Tags: cache invalidated');
}

export function destroyTagsCache() {
    if (tagsCacheCleanupInterval) {
        clearInterval(tagsCacheCleanupInterval);
        tagsCacheCleanupInterval = null;
    }

    clearCleanedTagsCache();
    clearEscoTagsCache();
    safeLog('info', 'Tags: cache destroyed');
}

export function getTagsCacheStats() {
    return {
        cleanedTags: {
            size: cleanedTagsCache.size,
            maxSize: MAX_TAGS_CACHE_ENTRIES,
            keys: [...cleanedTagsCache.keys()]
        },
        escoTags: {
            hasData: !!escoTagsCache,
            ageMs: escoTagsCacheTime ? Date.now() - escoTagsCacheTime : null
        },
        ttlMinutes: TAGS_CACHE_TTL / (60 * 1000)
    };
}

export function startTagsCacheCleanup(intervalMs = TAGS_CACHE_TTL) {
    if (tagsCacheCleanupInterval) {
        return tagsCacheCleanupInterval;
    }

    tagsCacheCleanupInterval = setInterval(runTagsCacheCleanup, intervalMs);
    return tagsCacheCleanupInterval;
}

