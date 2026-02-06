/**
 * Centralized Settings Service (PostgreSQL)
 * Provides a single source of truth for LLM settings
 */

import { selectWithTimeout } from '../utils/postgresHelpers.js';
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
            limit: 1
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

        safeLog('info', 'LLM settings loaded from PostgreSQL', {
            model: settings.llmModel || 'NOT SET',
            provider: settings.llmProvider || 'NOT SET',
            cached: true
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
