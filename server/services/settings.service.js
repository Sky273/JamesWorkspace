/**
 * Centralized Settings Service (PostgreSQL)
 * Provides a single source of truth for LLM settings
 */

import { selectWithTimeout, updateWithTimeout, createWithTimeout } from '../utils/postgresHelpers.js';
import {
    OLLAMA_BASE_URL,
    PROFILE_MATCHING_LOCAL_SKILL_WEIGHT,
    PROFILE_MATCHING_LOCAL_TOOL_WEIGHT,
    PROFILE_MATCHING_LOCAL_INDUSTRY_WEIGHT,
    PROFILE_MATCHING_LOCAL_SOFTSKILL_WEIGHT,
    PROFILE_MATCHING_LOCAL_TITLE_EXACT_WEIGHT,
    PROFILE_MATCHING_LOCAL_TITLE_TOKEN_WEIGHT,
    PROFILE_MATCHING_LOCAL_COVERAGE_MULTIPLIER
} from '../config/constants.js';
import { safeLog } from '../utils/logger.backend.js';
import { resolveAvailableModel, getProviderAvailabilityFlags, syncPersistedAvailabilityState } from './llmAvailability.service.js';
import { getProviderDefaultModel } from './llmConfiguration.service.js';
import { settingsCache as sharedSettingsCache, CACHE_KEYS, invalidateSettingsCaches as invalidateSharedSettingsCaches } from './cache.service.js';

const LLM_SETTINGS_CACHE_KEY = CACHE_KEYS.settings.LLM_SETTINGS;
const CANONICAL_LLM_SETTINGS_KEY = 'default';
let cacheTimestamp = null;

function buildCanonicalSettingsDefaults(fields = {}) {
    return {
        settings_key: CANONICAL_LLM_SETTINGS_KEY,
        name: 'Default Settings',
        status: 'active',
        ...fields
    };
}

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
        const cachedSettings = sharedSettingsCache.get(LLM_SETTINGS_CACHE_KEY);
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

        
        // Map PostgreSQL columns to frontend format
        const settings = {
            llmModel: dbSettings.llm_model,
            llmProvider: dbSettings.llm_provider || 'openai',
            ollamaBaseUrl: dbSettings.ollama_base_url || OLLAMA_BASE_URL || '',
            ollamaVisionModel: dbSettings.ollama_vision_model || '',
            ollamaKeepAlive: dbSettings.ollama_keep_alive || '5m',
            ollamaNumCtx: dbSettings.ollama_num_ctx || 8192,
            cvMode: dbSettings.cv_mode,
            chatbotEnabled: dbSettings.chatbot_enabled,
            webglEnabled: dbSettings.webgl_enabled,
            'Analysis Prompt': dbSettings.analysis_prompt,
            'Improvement Prompt': dbSettings.improvement_prompt,
            'Match Analysis Prompt': dbSettings.match_analysis_prompt,
            'Adaptation Prompt': dbSettings.adaptation_prompt,
            'Executive Summary Weight': dbSettings.executive_summary_weight,
            'Skills Weight': dbSettings.skills_weight,
            'Experience Weight': dbSettings.experience_weight,
            'Education Weight': dbSettings.education_weight,
            'ATS Weight': dbSettings.ats_weight,
            'Hobbies Languages Weight': dbSettings.hobbies_languages_weight,
            'Profile Matching Local Skill Weight': dbSettings.profile_matching_local_skill_weight ?? PROFILE_MATCHING_LOCAL_SKILL_WEIGHT,
            'Profile Matching Local Tool Weight': dbSettings.profile_matching_local_tool_weight ?? PROFILE_MATCHING_LOCAL_TOOL_WEIGHT,
            'Profile Matching Local Industry Weight': dbSettings.profile_matching_local_industry_weight ?? PROFILE_MATCHING_LOCAL_INDUSTRY_WEIGHT,
            'Profile Matching Local Soft Skill Weight': dbSettings.profile_matching_local_softskill_weight ?? PROFILE_MATCHING_LOCAL_SOFTSKILL_WEIGHT,
            'Profile Matching Local Title Exact Weight': dbSettings.profile_matching_local_title_exact_weight ?? PROFILE_MATCHING_LOCAL_TITLE_EXACT_WEIGHT,
            'Profile Matching Local Title Token Weight': dbSettings.profile_matching_local_title_token_weight ?? PROFILE_MATCHING_LOCAL_TITLE_TOKEN_WEIGHT,
            'Profile Matching Local Coverage Multiplier': dbSettings.profile_matching_local_coverage_multiplier ?? PROFILE_MATCHING_LOCAL_COVERAGE_MULTIPLIER,
            llmAvailabilityState: dbSettings.llm_availability_state || {}
        };

        const normalizedModel = resolveAvailableModel(
            settings.llmProvider,
            settings.llmModel,
            getProviderDefaultModel(settings.llmProvider)
        );

        if (normalizedModel.adjusted) {
            safeLog('warn', 'Normalized unavailable configured LLM model', {
                provider: settings.llmProvider,
                originalModel: normalizedModel.originalModel,
                effectiveModel: normalizedModel.model,
                reason: normalizedModel.reason
            });
            settings.llmModel = normalizedModel.model;
        }

        settings.llmAvailability = getProviderAvailabilityFlags();

        // Update cache
        sharedSettingsCache.set(LLM_SETTINGS_CACHE_KEY, settings);
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
        const cachedSettings = sharedSettingsCache.get(LLM_SETTINGS_CACHE_KEY);
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
    return settings.llmModel || 'gpt-4o'; // Default fallback
}

/**
 * Get the configured LLM provider
 * @returns {Promise<string>} Provider name (openai or anthropic)
 */
export async function getLLMProvider() {
    const settings = await getLLMSettings();
    return settings.llmProvider || 'openai'; // Default fallback
}

/**
 * Invalidate the settings cache (call after settings update)
 */
export function invalidateSettingsCache() {
    safeLog('info', 'Settings cache invalidated');
    invalidateSharedSettingsCaches();
    cacheTimestamp = null;
}

/**
 * Destroy settings cache (for graceful shutdown)
 * Alias for invalidateSettingsCache for consistency with other cache services
 */
export function destroySettingsCache() {
    invalidateSharedSettingsCaches();
    cacheTimestamp = null;
    safeLog('info', 'Settings cache destroyed');
}

/**
 * Get settings cache statistics
 */
export function getSettingsCacheStats() {
    return {
        hasCache: !!sharedSettingsCache.get(LLM_SETTINGS_CACHE_KEY),
        entries: sharedSettingsCache.size(),
        ageMs: cacheTimestamp ? Date.now() - cacheTimestamp : null,
        ttlMs: sharedSettingsCache.ttl,
        key: LLM_SETTINGS_CACHE_KEY,
        cache: sharedSettingsCache.getStats()
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
        improvement: settings['Improvement Prompt'] || null,
        matchAnalysis: settings['Match Analysis Prompt'] || null,
        adaptation: settings['Adaptation Prompt'] || null
    };
}

/**
 * Parse a rating string (e.g., "85%") to a number (e.g., 85)
 * @param {string|number} rating - Rating as string or number
 * @returns {number} - Rating as number (0-100)
 */
function parseRating(rating) {
    if (typeof rating === 'number') return rating;
    if (typeof rating === 'string') {
        const parsed = parseFloat(rating.replace('%', ''));
        return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
}

/**
 * Calculate globalRating based on section scores and admin-defined weights
 * This ensures the global rating is always consistent with the weighted average of section scores
 * @param {Object} analysis - Analysis object with section ratings
 * @param {Object} settings - Optional settings object (will be fetched if not provided)
 * @returns {Promise<Object>} - Analysis object with recalculated globalRating
 */
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
        // Get settings if not provided
        const llmSettings = settings || await getLLMSettings();
        
        // Get weights with defaults
        const weights = {
            executiveSummary: llmSettings['Executive Summary Weight'] || 20,
            skills: llmSettings['Skills Weight'] || 20,
            experience: llmSettings['Experience Weight'] || 20,
            education: llmSettings['Education Weight'] || 15,
            ats: llmSettings['ATS Weight'] || 15,
            hobbiesLanguages: llmSettings['Hobbies Languages Weight'] || 10
        };
        
        // Normalize weights to ensure they sum to 100
        const totalWeight = Object.values(weights).reduce((sum, w) => sum + w, 0);
        const normalizedWeights = {};
        for (const [key, value] of Object.entries(weights)) {
            normalizedWeights[key] = totalWeight > 0 ? (value / totalWeight) * 100 : 100 / 6;
        }
        
        // Parse section ratings
        const scores = {
            executiveSummary: parseRating(analysis.executiveSummaryRating || analysis['Executive Summary'] || 0),
            skills: parseRating(analysis.skillsRating || analysis['Skills'] || 0),
            experience: parseRating(analysis.experiencesRating || analysis['Experience'] || 0),
            education: parseRating(analysis.educationRating || analysis['Education'] || 0),
            ats: parseRating(analysis.atsOptimizationRating || analysis['ATS Compatibility'] || analysis['ATS'] || 0),
            hobbiesLanguages: parseRating(analysis.hobbiesLanguagesRating || analysis['Hobbies Languages'] || 0)
        };
        
        // Calculate weighted average
        let weightedSum = 0;
        let appliedWeight = 0;
        
        for (const [key, score] of Object.entries(scores)) {
            const weight = normalizedWeights[key];
            weightedSum += score * weight;
            appliedWeight += weight;
        }
        
        const calculatedGlobalRating = appliedWeight > 0 ? Math.round(weightedSum / appliedWeight) : 0;
        
        // Format as percentage string
        const globalRatingStr = `${calculatedGlobalRating}%`;
        
        safeLog('debug', 'Calculated weighted global rating', {
            scores,
            weights: normalizedWeights,
            originalGlobalRating: analysis.globalRating || analysis['Global Rating'],
            calculatedGlobalRating: globalRatingStr
        });
        
        // Update analysis with calculated global rating
        const updatedAnalysis = { ...analysis };
        updatedAnalysis.globalRating = globalRatingStr;
        updatedAnalysis['Global Rating'] = globalRatingStr;
        
        // Also store the weights used for transparency
        updatedAnalysis._weightsUsed = normalizedWeights;
        updatedAnalysis._originalLLMGlobalRating = analysis.globalRating || analysis['Global Rating'];
        
        return updatedAnalysis;
    } catch (error) {
        safeLog('error', 'Failed to calculate weighted global rating', { error: error.message });
        // Return original analysis if calculation fails
        return analysis;
    }
}

