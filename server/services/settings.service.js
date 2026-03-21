/**
 * Centralized Settings Service (PostgreSQL)
 * Provides a single source of truth for LLM settings
 */

import { selectWithTimeout, updateWithTimeout, createWithTimeout } from '../utils/postgresHelpers.js';
import { safeLog } from '../utils/logger.backend.js';

// Cache settings for 5 minutes to reduce database calls
let settingsCache = null;
let cacheTimestamp = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get LLM settings from PostgreSQL with caching
 * @returns {Promise<Object>} Settings object
 */
export async function getLLMSettings() {
    try {
        // Check cache validity
        const now = Date.now();
        if (settingsCache && cacheTimestamp && (now - cacheTimestamp) < CACHE_TTL) {
            safeLog('debug', 'Using cached LLM settings', {
                age: Math.round((now - cacheTimestamp) / 1000) + 's'
            });
            return settingsCache;
        }

        // Fetch fresh settings
        safeLog('debug', 'Fetching fresh LLM settings from PostgreSQL');
        const settingsRecords = await selectWithTimeout('llm_settings', {
            limit: 1,
            orderBy: 'created_at DESC'
        });

        if (settingsRecords.length === 0) {
            safeLog('warn', 'No LLM settings found in database');
            return {};
        }

        const dbSettings = settingsRecords[0];

        
        // Map PostgreSQL columns to frontend format
        const settings = {
            llmModel: dbSettings.llm_model,
            llmProvider: dbSettings.llm_provider,
            cvMode: dbSettings.cv_mode,
            chatbotEnabled: dbSettings.chatbot_enabled,
            'Analysis Prompt': dbSettings.analysis_prompt,
            'Improvement Prompt': dbSettings.improvement_prompt,
            'Match Analysis Prompt': dbSettings.match_analysis_prompt,
            'Adaptation Prompt': dbSettings.adaptation_prompt,
            'Executive Summary Weight': dbSettings.executive_summary_weight,
            'Skills Weight': dbSettings.skills_weight,
            'Experience Weight': dbSettings.experience_weight,
            'Education Weight': dbSettings.education_weight,
            'ATS Weight': dbSettings.ats_weight,
            'Hobbies Languages Weight': dbSettings.hobbies_languages_weight
        };

        // Update cache
        settingsCache = settings;
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
        if (settingsCache) {
            safeLog('warn', 'Using stale cached settings due to error');
            return settingsCache;
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
    settingsCache = null;
    cacheTimestamp = null;
}

/**
 * Destroy settings cache (for graceful shutdown)
 * Alias for invalidateSettingsCache for consistency with other cache services
 */
export function destroySettingsCache() {
    settingsCache = null;
    cacheTimestamp = null;
    safeLog('info', 'Settings cache destroyed');
}

/**
 * Get settings cache statistics
 */
export function getSettingsCacheStats() {
    return {
        hasCache: !!settingsCache,
        ageMs: cacheTimestamp ? Date.now() - cacheTimestamp : null,
        ttlMs: CACHE_TTL
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
    const records = await selectWithTimeout('llm_settings', {
        limit: 1,
        orderBy: 'created_at DESC'
    });
    return records.length > 0 ? records[0] : null;
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
        fields
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
    try {
        return await updateSettings(id, fields);
    } catch (error) {
        if (error.statusCode === 404 || error.message.includes('not found')) {
            const existing = await selectWithTimeout('llm_settings', {
                limit: 1,
                orderBy: 'created_at DESC'
            });

            if (existing.length > 0) {
                const records = await updateWithTimeout('llm_settings', [{
                    id: existing[0].id,
                    fields
                }]);
                return records[0];
            } else {
                const fieldsToCreate = {
                    name: 'Default Settings',
                    ...fields,
                    status: 'active'
                };
                const records = await createWithTimeout('llm_settings', [{
                    fields: fieldsToCreate
                }]);
                return records[0];
            }
        }
        throw error;
    }
}

/**
 * Create a new settings record
 * @param {Object} fields - Fields for the new record (already mapped to DB columns)
 * @returns {Promise<Object>} Created record
 */
export async function createSettings(fields) {
    const records = await createWithTimeout('llm_settings', [{
        fields
    }]);
    return records[0];
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
