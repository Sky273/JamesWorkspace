/**
 * Industry Service (PostgreSQL)
 * Service for managing industry aliases from PostgreSQL
 */

import { selectWithTimeout } from '../utils/postgresHelpers.js';
import { safeLog } from '../utils/logger.backend.js';

// Cache for industry aliases
let industriesCache = null;
let cacheTimestamp = null;
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

/**
 * Get all accepted industries from the industry_aliases table
 * @returns {Promise<string[]>} - Array of industry names
 */
export async function getAcceptedIndustries() {
    try {
        // Check cache
        const now = Date.now();
        if (industriesCache && cacheTimestamp && (now - cacheTimestamp) < CACHE_TTL) {
            return industriesCache;
        }

        // Fetch from PostgreSQL
        const records = await selectWithTimeout('industry_aliases', {
            orderBy: 'canonical_name ASC'
        });

        // Extract industry names (canonical_name is the main industry name)
        const industries = records
            .map(record => record.canonical_name)
            .filter(industry => industry && typeof industry === 'string' && industry.trim().length > 0)
            .map(industry => industry.trim());

        // Remove duplicates and sort
        const uniqueIndustries = [...new Set(industries)].sort();

        // Update cache
        industriesCache = uniqueIndustries;
        cacheTimestamp = now;

        safeLog('info', 'Industries loaded successfully from PostgreSQL', { count: uniqueIndustries.length });
        return uniqueIndustries;
    } catch (error) {
        safeLog('error', 'Error fetching industries from PostgreSQL', { error: error.message });
        // Return empty array on error to avoid breaking the flow
        return [];
    }
}

/**
 * Get industries as a comma-separated string
 * @returns {Promise<string>} - Comma-separated list of industries
 */
export async function getAcceptedIndustriesString() {
    const industries = await getAcceptedIndustries();
    return industries.join(', ');
}

// Cache for industry mapping lexique
let mappingCache = null;
let mappingCacheTimestamp = null;

/**
 * Get industry mapping lexique from industry_aliases table
 * Groups aliases by canonical_name for prompt injection
 * @returns {Promise<string>} - Formatted mapping lexique
 */
export async function getIndustryMappingString() {
    try {
        const now = Date.now();
        if (mappingCache && mappingCacheTimestamp && (now - mappingCacheTimestamp) < CACHE_TTL) {
            return mappingCache;
        }

        const records = await selectWithTimeout('industry_aliases', {
            orderBy: 'canonical_name ASC, alias ASC'
        });

        // Group aliases by canonical_name
        const grouped = {};
        for (const record of records) {
            const canonical = record.canonical_name?.trim();
            const alias = record.alias?.trim();
            if (!canonical || !alias) continue;
            // Skip self-referencing aliases (canonical_name === alias)
            if (canonical === alias) continue;
            if (!grouped[canonical]) grouped[canonical] = [];
            grouped[canonical].push(alias);
        }

        // Format: "canonical_name : alias1, alias2, alias3"
        const lines = Object.entries(grouped)
            .filter(([, aliases]) => aliases.length > 0)
            .map(([canonical, aliases]) => `- ${aliases.join(', ')} → ${canonical}`)
            .join('\n');

        mappingCache = lines;
        mappingCacheTimestamp = now;

        safeLog('info', 'Industry mapping lexique loaded from PostgreSQL', { 
            canonicalCount: Object.keys(grouped).length 
        });
        return lines;
    } catch (error) {
        safeLog('error', 'Error building industry mapping lexique', { error: error.message });
        return '';
    }
}

/**
 * Clear the industries cache
 */
export function clearIndustriesCache() {
    industriesCache = null;
    cacheTimestamp = null;
    mappingCache = null;
    mappingCacheTimestamp = null;
    safeLog('debug', 'Industries cache cleared');
}
