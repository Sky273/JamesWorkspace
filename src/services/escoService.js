/**
 * ESCO Service
 * Service for converting tags to ESCO (European Skills, Competences, Qualifications and Occupations) normalized tags
 * API Documentation: https://ec.europa.eu/esco/api/doc/esco_api_doc.html
 */

import axios from 'axios';
import { safeLog } from '../utils/logger.backend.js';

const ESCO_API_BASE = 'https://ec.europa.eu/esco/api';
const ESCO_LANGUAGE = 'fr'; // Default language for searches
const ESCO_LIMIT = 1; // Get only the best match

// Cache configuration
const ESCO_CACHE_MAX_SIZE = 10000; // Max entries to prevent memory leak
const ESCO_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

// Cache for ESCO lookups to avoid repeated API calls
const escoCache = new Map();
const escoCacheTimestamps = new Map();

/**
 * Cleanup expired entries and enforce max size
 */
function cleanupEscoCache() {
    const now = Date.now();
    let expiredCount = 0;
    
    // Remove expired entries
    for (const [key, timestamp] of escoCacheTimestamps.entries()) {
        if (now - timestamp > ESCO_CACHE_TTL) {
            escoCache.delete(key);
            escoCacheTimestamps.delete(key);
            expiredCount++;
        }
    }
    
    // Enforce max size (remove oldest entries if over limit)
    if (escoCache.size > ESCO_CACHE_MAX_SIZE) {
        const entries = [...escoCacheTimestamps.entries()]
            .sort((a, b) => a[1] - b[1]);
        const toRemove = entries.slice(0, escoCache.size - ESCO_CACHE_MAX_SIZE);
        toRemove.forEach(([key]) => {
            escoCache.delete(key);
            escoCacheTimestamps.delete(key);
        });
        
        safeLog('debug', 'ESCO cache size limit enforced', { 
            removed: toRemove.length, 
            currentSize: escoCache.size 
        });
    }
    
    if (expiredCount > 0) {
        safeLog('debug', 'ESCO cache cleanup completed', { 
            expiredRemoved: expiredCount, 
            currentSize: escoCache.size 
        });
    }
}

// Periodic cleanup every hour
const escoCacheCleanupInterval = setInterval(cleanupEscoCache, 60 * 60 * 1000);

/**
 * Set a value in the ESCO cache with timestamp
 */
function setCacheEntry(key, value) {
    escoCache.set(key, value);
    escoCacheTimestamps.set(key, Date.now());
    
    // Quick check: if way over limit, trigger cleanup
    if (escoCache.size > ESCO_CACHE_MAX_SIZE * 1.2) {
        cleanupEscoCache();
    }
}

/**
 * Get a value from the ESCO cache (returns undefined if expired)
 */
function getCacheEntry(key) {
    if (!escoCache.has(key)) return undefined;
    
    const timestamp = escoCacheTimestamps.get(key);
    if (timestamp && Date.now() - timestamp > ESCO_CACHE_TTL) {
        // Entry expired, remove it
        escoCache.delete(key);
        escoCacheTimestamps.delete(key);
        return undefined;
    }
    
    return escoCache.get(key);
}

/**
 * Search for a skill/competence in ESCO
 * @param {string} tag - The tag to search for
 * @param {string} language - Language code (default: 'fr')
 * @returns {Promise<Object|null>} - ESCO skill object or null if not found
 */
async function searchEscoSkill(tag, language = ESCO_LANGUAGE) {
    if (!tag || typeof tag !== 'string') return null;
    
    const cacheKey = `skill:${language}:${tag.toLowerCase()}`;
    const cached = getCacheEntry(cacheKey);
    if (cached !== undefined) {
        return cached;
    }
    
    try {
        const response = await axios.get(`${ESCO_API_BASE}/search`, {
            params: {
                text: tag,
                language: language,
                type: 'skill',
                limit: ESCO_LIMIT,
                full: false
            },
            timeout: 10000
        });
        
        const results = response.data?._embedded?.results || [];
        if (results.length > 0) {
            const match = {
                uri: results[0].uri,
                title: results[0].title,
                preferredLabel: results[0].preferredLabel?.[language] || results[0].title,
                className: results[0].className
            };
            setCacheEntry(cacheKey, match);
            return match;
        }
        
        setCacheEntry(cacheKey, null);
        return null;
    } catch (error) {
        safeLog('warn', 'ESCO API search failed', { tag, error: error.message });
        return null;
    }
}

/**
 * Search for an occupation in ESCO
 * @param {string} tag - The tag to search for
 * @param {string} language - Language code (default: 'fr')
 * @returns {Promise<Object|null>} - ESCO occupation object or null if not found
 */
async function searchEscoOccupation(tag, language = ESCO_LANGUAGE) {
    if (!tag || typeof tag !== 'string') return null;
    
    const cacheKey = `occupation:${language}:${tag.toLowerCase()}`;
    const cached = getCacheEntry(cacheKey);
    if (cached !== undefined) {
        return cached;
    }
    
    try {
        const response = await axios.get(`${ESCO_API_BASE}/search`, {
            params: {
                text: tag,
                language: language,
                type: 'occupation',
                limit: ESCO_LIMIT,
                full: false
            },
            timeout: 10000
        });
        
        const results = response.data?._embedded?.results || [];
        if (results.length > 0) {
            const match = {
                uri: results[0].uri,
                title: results[0].title,
                preferredLabel: results[0].preferredLabel?.[language] || results[0].title,
                className: results[0].className
            };
            setCacheEntry(cacheKey, match);
            return match;
        }
        
        setCacheEntry(cacheKey, null);
        return null;
    } catch (error) {
        safeLog('warn', 'ESCO API occupation search failed', { tag, error: error.message });
        return null;
    }
}

/**
 * Convert an array of cleaned tags to ESCO normalized tags
 * @param {string[]} tags - Array of cleaned tags
 * @param {string} type - Type of search: 'skill' or 'occupation'
 * @param {string} language - Language code
 * @returns {Promise<Object[]>} - Array of ESCO tag objects with original and normalized info
 */
async function convertTagsToEsco(tags, type = 'skill', language = ESCO_LANGUAGE) {
    if (!Array.isArray(tags) || tags.length === 0) return [];
    
    const searchFn = type === 'occupation' ? searchEscoOccupation : searchEscoSkill;
    const results = [];
    
    // Process tags in batches to avoid overwhelming the API
    const batchSize = 5;
    for (let i = 0; i < tags.length; i += batchSize) {
        const batch = tags.slice(i, i + batchSize);
        const batchResults = await Promise.all(
            batch.map(async (tag) => {
                const escoMatch = await searchFn(tag, language);
                return {
                    original: tag,
                    esco: escoMatch ? {
                        uri: escoMatch.uri,
                        preferredLabel: escoMatch.preferredLabel,
                        className: escoMatch.className
                    } : null
                };
            })
        );
        results.push(...batchResults);
    }
    
    return results;
}

/**
 * Process cleaned tags and convert ONLY tools to ESCO
 * Other categories (skills, industries, softSkills) are not processed via ESCO API
 * @param {Object} cleanedTags - Object with skills, industries, tools, softSkills arrays
 * @param {string} language - Language code
 * @returns {Promise<Object>} - Object with ESCO tags (only tools are converted)
 */
async function processCleanedTagsToEsco(cleanedTags, language = ESCO_LANGUAGE) {
    if (!cleanedTags) {
        return {
            skills: [],
            industries: [],
            tools: [],
            softSkills: []
        };
    }
    
    safeLog('debug', 'Converting cleaned tools to ESCO (tools only)', {
        toolsCount: cleanedTags.tools?.length || 0
    });
    
    // Only process tools via ESCO API with type=skill filter
    const tools = await convertTagsToEsco(cleanedTags.tools || [], 'skill', language);
    
    // Extract ESCO labels with URI for deduplication
    const extractEscoLabelsWithUri = (results) => {
        return results
            .filter(r => r.esco && r.esco.preferredLabel && r.esco.uri)
            .map(r => ({
                label: r.esco.preferredLabel,
                uri: r.esco.uri
            }));
    };
    
    const toolsLabels = extractEscoLabelsWithUri(tools);
    
    safeLog('debug', 'ESCO tools conversion results', {
        toolsFound: toolsLabels.length,
        toolsNotFound: tools.filter(t => !t.esco).map(t => t.original)
    });
    
    // Deduplicate tools by URI and label
    const deduplicateWithinCategory = (labels) => {
        const uniqueItems = [];
        const seenUris = new Set();
        const seenLabels = new Set();
        
        for (const item of labels) {
            if (seenUris.has(item.uri)) continue;
            if (seenLabels.has(item.label)) continue;
            
            seenUris.add(item.uri);
            seenLabels.add(item.label);
            uniqueItems.push({
                label: item.label,
                uri: item.uri
            });
        }
        
        return uniqueItems.sort((a, b) => a.label.localeCompare(b.label));
    };
    
    const escoTags = {
        // Only tools are processed via ESCO
        tools: deduplicateWithinCategory(toolsLabels),
        // Other categories are not processed via ESCO - return empty arrays
        skills: [],
        softSkills: [],
        industries: []
    };
    
    safeLog('debug', 'ESCO conversion complete (tools only)', {
        escoToolsCount: escoTags.tools.length
    });
    
    return escoTags;
}

/**
 * Clear the ESCO cache
 */
function clearEscoCache() {
    escoCache.clear();
    escoCacheTimestamps.clear();
    safeLog('debug', 'ESCO cache cleared');
}

/**
 * Destroy ESCO cache and cleanup interval (for graceful shutdown)
 */
function destroyEscoCache() {
    if (escoCacheCleanupInterval) {
        clearInterval(escoCacheCleanupInterval);
    }
    escoCache.clear();
    escoCacheTimestamps.clear();
    safeLog('info', 'ESCO cache destroyed');
}

/**
 * Get ESCO cache statistics
 */
function getEscoCacheStats() {
    return {
        size: escoCache.size,
        maxSize: ESCO_CACHE_MAX_SIZE,
        ttlHours: ESCO_CACHE_TTL / (60 * 60 * 1000)
    };
}

export {
    searchEscoSkill,
    searchEscoOccupation,
    convertTagsToEsco,
    processCleanedTagsToEsco,
    clearEscoCache,
    destroyEscoCache,
    getEscoCacheStats,
    ESCO_API_BASE,
    ESCO_LANGUAGE
};
