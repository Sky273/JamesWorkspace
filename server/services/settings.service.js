/**
 * Centralized Settings Service (PostgreSQL)
 * Provides a single source of truth for LLM settings
 */

import { selectWithTimeout, updateWithTimeout, createWithTimeout } from '../utils/postgresHelpers.js';
import { safeLog } from '../utils/logger.backend.js';
import { syncPersistedAvailabilityState } from './llmAvailability.service.js';
import { getProviderDefaultModel } from './llmConfiguration.service.js';
import {
    settingsCache as sharedSettingsCache,
    CACHE_KEYS,
    invalidateSettingsCaches as invalidateSharedSettingsCaches,
    getNamedCacheStats
} from './cache.service.js';
import {
    CANONICAL_LLM_SETTINGS_KEY,
    buildCanonicalSettingsDefaults,
    buildMappedLlmSettings,
    applyResolvedLlmAvailability,
    buildWeightedGlobalRatingDetails
} from './settings.helpers.js';

const LLM_SETTINGS_CACHE_KEY = CACHE_KEYS.settings.LLM_SETTINGS;
const DEFAULT_LLM_PROVIDER = 'openai';
let cacheTimestamp = null;

async function findCanonicalSettingsRecord() {
    const records = await selectWithTimeout('llm_settings', {
        where: 'settings_key = $1',
        params: [CANONICAL_LLM_SETTINGS_KEY],
        limit: 1
    });

    return records[0] || null;
}

async function findLatestLegacySettingsRecord() {
    const records = await selectWithTimeout('llm_settings', {
        limit: 1,
        orderBy: "CASE WHEN status = 'active' THEN 0 ELSE 1 END, updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC"
    });

    return records[0] || null;
}

export async function getCanonicalSettingsRecord({ createIfMissing = false, initialFields = {} } = {}) {
    const canonical = await findCanonicalSettingsRecord();
    if (canonical) {
        return canonical;
    }

    const legacyRecord = await findLatestLegacySettingsRecord();
    if (legacyRecord) {
        return updateWithTimeout('llm_settings', legacyRecord.id, buildCanonicalSettingsDefaults({
            settings_key: CANONICAL_LLM_SETTINGS_KEY,
            name: legacyRecord.name || 'Default Settings',
            status: legacyRecord.status || 'active'
        }));
    }

    if (!createIfMissing) {
        return null;
    }

    return createWithTimeout('llm_settings', {
        fields: buildCanonicalSettingsDefaults(initialFields)
    });
}

/**
 * Get LLM settings from PostgreSQL with caching
 * @returns {Promise<Object>} Settings object
 */
export async function getLLMSettings() {
    try {
        const now = Date.now();
        const cachedSettings = await sharedSettingsCache.get(LLM_SETTINGS_CACHE_KEY);
        if (cachedSettings) {
            safeLog('debug', 'Using cached LLM settings', {
                age: Math.round((now - cacheTimestamp) / 1000) + 's'
            });
            return cachedSettings;
        }

        // Fetch fresh settings
        safeLog('debug', 'Fetching fresh LLM settings from PostgreSQL');
        const dbSettings = await getCanonicalSettingsRecord();

        if (!dbSettings) {
            safeLog('warn', 'No LLM settings found in database');
            return {};
        }
        syncPersistedAvailabilityState(dbSettings.llm_availability_state || {});

        const settings = applyResolvedLlmAvailability(buildMappedLlmSettings(dbSettings));

        // Update cache
        await sharedSettingsCache.set(LLM_SETTINGS_CACHE_KEY, settings);
        cacheTimestamp = now;

        safeLog('debug', 'LLM settings loaded from PostgreSQL', {
            model: settings.llmModel || 'NOT SET',
            provider: settings.llmProvider || 'NOT SET'
        });

        return settings;
    } catch (error) {
        safeLog('error', 'Failed to fetch LLM settings', {
            error: error.message
        });

        // Return cached settings if available, even if expired
        const cachedSettings = await sharedSettingsCache.get(LLM_SETTINGS_CACHE_KEY);
        if (cachedSettings) {
            safeLog('warn', 'Using stale cached settings due to error');
            return cachedSettings;
        }

        // Return empty object as fallback
        return {};
    }
}

/**
 * Get the configured LLM model
 * @returns {Promise<string>} Model name
 */
export async function getLLMModel() {
    const settings = await getLLMSettings();
    return settings.llmModel || getProviderDefaultModel(settings.llmProvider || DEFAULT_LLM_PROVIDER);
}

/**
 * Get the configured LLM provider
 * @returns {Promise<string>} Provider name (openai or anthropic)
 */
export async function getLLMProvider() {
    const settings = await getLLMSettings();
    return settings.llmProvider || DEFAULT_LLM_PROVIDER;
}

/**
 * Invalidate the settings cache (call after settings update)
 */
export async function invalidateSettingsCache() {
    safeLog('info', 'Settings cache invalidated');
    await invalidateSharedSettingsCaches();
    cacheTimestamp = null;
}

/**
 * Destroy settings cache (for graceful shutdown)
 * Alias for invalidateSettingsCache for consistency with other cache services
 */
export async function destroySettingsCache() {
    await invalidateSharedSettingsCaches();
    cacheTimestamp = null;
    safeLog('info', 'Settings cache destroyed');
}

/**
 * Get settings cache statistics
 */
export async function getSettingsCacheStats() {
    const [hasCache, entries, cache] = await Promise.all([
        sharedSettingsCache.get(LLM_SETTINGS_CACHE_KEY),
        sharedSettingsCache.size(),
        getNamedCacheStats('settings')
    ]);

    return {
        hasCache: !!hasCache,
        entries,
        ageMs: cacheTimestamp ? Date.now() - cacheTimestamp : null,
        ttlMs: sharedSettingsCache.ttl,
        key: LLM_SETTINGS_CACHE_KEY,
        cache
    };
}

/**
 * Get all prompts from settings
 * @returns {Promise<Object>} Object containing all prompts
 */
export async function getPrompts() {
    const settings = await getLLMSettings();
    return {
        analysis: settings['Analysis Prompt'] || null,
        preAnalysis: settings['Pre Analysis Prompt'] || null,
        preAnalysisEnabled: settings.preAnalysisEnabled ?? false,
        improvement: settings['Improvement Prompt'] || null,
        matchAnalysis: settings['Match Analysis Prompt'] || null,
        adaptation: settings['Adaptation Prompt'] || null
    };
}

/**
 * Get the latest settings record from database
 * @returns {Promise<Object|null>} Raw settings record or null
 */
export async function getSettings() {
    return getCanonicalSettingsRecord();
}

/**
 * Update settings by ID
 * @param {string} id - Settings record ID
 * @param {Object} fields - Fields to update (already mapped to DB columns)
 * @returns {Promise<Object>} Updated record
 */
export async function updateSettings(id, fields) {
    const records = await updateWithTimeout('llm_settings', [{
        id,
        fields: buildCanonicalSettingsDefaults(fields)
    }]);
    return records[0];
}

/**
 * Update settings by ID, with fallback to existing record or create new
 * @param {string} id - Settings record ID to try first
 * @param {Object} fields - Fields to update (already mapped to DB columns)
 * @returns {Promise<Object>} Updated or created record
 */
export async function upsertSettings(id, fields) {
    const canonical = await getCanonicalSettingsRecord();
    if (canonical) {
        return updateSettings(canonical.id, fields);
    }

    return createWithTimeout('llm_settings', {
        fields: buildCanonicalSettingsDefaults(fields)
    });
}

/**
 * Create a new settings record
 * @param {Object} fields - Fields for the new record (already mapped to DB columns)
 * @returns {Promise<Object>} Created record
 */
export async function createSettings(fields) {
    const canonical = await getCanonicalSettingsRecord();
    if (canonical) {
        return updateSettings(canonical.id, fields);
    }

    return createWithTimeout('llm_settings', {
        fields: buildCanonicalSettingsDefaults(fields)
    });
}

export async function calculateWeightedGlobalRating(analysis, settings = null) {
    try {
        const llmSettings = settings || await getLLMSettings();
        const ratingDetails = buildWeightedGlobalRatingDetails(analysis, llmSettings);
        safeLog('debug', 'Calculated weighted global rating', {
            scores: ratingDetails.scores,
            weights: ratingDetails.normalizedWeights,
            originalGlobalRating: ratingDetails.originalGlobalRating,
            calculatedGlobalRating: ratingDetails.globalRatingStr
        });

        const updatedAnalysis = { ...analysis };
        updatedAnalysis.globalRating = ratingDetails.globalRatingStr;
        updatedAnalysis['Global Rating'] = ratingDetails.globalRatingStr;
        updatedAnalysis._weightsUsed = ratingDetails.normalizedWeights;
        updatedAnalysis._originalLLMGlobalRating = ratingDetails.originalGlobalRating;

        return updatedAnalysis;
    } catch (error) {
        safeLog('error', 'Failed to calculate weighted global rating', { error: error.message });
        return analysis;
    }
}

