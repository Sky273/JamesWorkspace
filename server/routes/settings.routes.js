import express from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.middleware.js';
import { validateParams, validateBody, updateSettingsSchema } from '../utils/validation.js';
import { securityLog, getRequestMetadata, LOG_LEVELS, SECURITY_EVENTS } from '../services/security.service.js';
import { settingsCache, CACHE_KEYS } from '../services/cache.service.js';
import { metrics } from '../services/metrics.service.js';
import { invalidateSettingsCache, getSettings, getLLMSettings, upsertSettings, createSettings } from '../services/settings.service.js';
import { normalizeWeights, DEFAULT_ANALYSIS_PROMPT, DEFAULT_IMPROVEMENT_PROMPT, DEFAULT_MATCH_ANALYSIS_PROMPT, DEFAULT_ADAPTATION_PROMPT } from '../config/prompts.backend.js';
import { safeLog } from '../utils/logger.backend.js';
import { mapSettingsToFrontend, mapSettingsFromFrontend } from '../utils/mappers.js';
import { getProviderAvailabilityFlags } from '../services/llmAvailability.service.js';
import { discoverOllamaModels } from '../services/ollamaAdmin.service.js';
import { validatePersistedLlmSettings } from '../services/llmSettingsValidation.service.js';
import {
    PROFILE_MATCHING_LOCAL_SKILL_WEIGHT,
    PROFILE_MATCHING_LOCAL_TOOL_WEIGHT,
    PROFILE_MATCHING_LOCAL_INDUSTRY_WEIGHT,
    PROFILE_MATCHING_LOCAL_SOFTSKILL_WEIGHT,
    PROFILE_MATCHING_LOCAL_TITLE_EXACT_WEIGHT,
    PROFILE_MATCHING_LOCAL_TITLE_TOKEN_WEIGHT,
    PROFILE_MATCHING_LOCAL_COVERAGE_MULTIPLIER
} from '../config/constants.js';
import {
    decorateSettingsResponse,
    mergeCanonicalLlmSettings,
    normalizeRequestedSettingsModel,
    prepareSettingsMutationPayload
} from './settings.routes.helpers.js';

const router = express.Router();

// GET /api/settings - Get settings
router.get('/', authenticateToken, async (req, res) => {
    try {
        const cachedSettings = await settingsCache.get(CACHE_KEYS.settings.UI_SETTINGS);
        if (cachedSettings) {
            metrics.trackCacheHit();
            safeLog('debug', 'Returning cached settings');
            return res.json(cachedSettings);
        }

        metrics.trackCacheMiss();
        safeLog('debug', 'Cache miss - fetching settings from PostgreSQL');

        const [settings, canonicalLlmSettings] = await Promise.all([
            getSettings(),
            getLLMSettings()
        ]);

        if (!settings) {
            safeLog('info', 'No settings found, returning defaults');

            const defaultSettings = mergeCanonicalLlmSettings(await decorateSettingsResponse({
                id: null,
                llmModel: null,
                cvMode: 'nominative',
                chatbotEnabled: 'on',
                webglEnabled: 'on',
                'Analysis Prompt': DEFAULT_ANALYSIS_PROMPT,
                'Improvement Prompt': DEFAULT_IMPROVEMENT_PROMPT,
                'Match Analysis Prompt': DEFAULT_MATCH_ANALYSIS_PROMPT,
                'Adaptation Prompt': DEFAULT_ADAPTATION_PROMPT,
                'Executive Summary Weight': 20,
                'Skills Weight': 20,
                'Experience Weight': 20,
                'Education Weight': 15,
                'ATS Weight': 15,
                'Hobbies Languages Weight': 10,
                'Profile Matching Local Skill Weight': PROFILE_MATCHING_LOCAL_SKILL_WEIGHT,
                'Profile Matching Local Tool Weight': PROFILE_MATCHING_LOCAL_TOOL_WEIGHT,
                'Profile Matching Local Industry Weight': PROFILE_MATCHING_LOCAL_INDUSTRY_WEIGHT,
                'Profile Matching Local Soft Skill Weight': PROFILE_MATCHING_LOCAL_SOFTSKILL_WEIGHT,
                'Profile Matching Local Title Exact Weight': PROFILE_MATCHING_LOCAL_TITLE_EXACT_WEIGHT,
                'Profile Matching Local Title Token Weight': PROFILE_MATCHING_LOCAL_TITLE_TOKEN_WEIGHT,
                'Profile Matching Local Coverage Multiplier': PROFILE_MATCHING_LOCAL_COVERAGE_MULTIPLIER
            }, getProviderAvailabilityFlags), canonicalLlmSettings);

            return res.json(defaultSettings);
        }

        const responseData = mergeCanonicalLlmSettings(
            await decorateSettingsResponse(normalizeRequestedSettingsModel(mapSettingsToFrontend(settings)), getProviderAvailabilityFlags),
            canonicalLlmSettings
        );

        await settingsCache.set(CACHE_KEYS.settings.UI_SETTINGS, responseData);

        res.json(responseData);
    } catch (error) {
        safeLog('error', 'Error fetching settings', { error: error.message });
        return res.status(500).json({
            error: 'Failed to fetch settings'
        });
    }
});

// GET /api/settings/defaults - Get default prompts and weights
router.get('/defaults', authenticateToken, requireAdmin, (req, res) => {
    Promise.resolve(decorateSettingsResponse({
        llmModel: 'gpt-5.4',
        cvMode: 'nominative',
        chatbotEnabled: 'on',
        webglEnabled: 'on',
        'Analysis Prompt': DEFAULT_ANALYSIS_PROMPT,
        'Improvement Prompt': DEFAULT_IMPROVEMENT_PROMPT,
        'Match Analysis Prompt': DEFAULT_MATCH_ANALYSIS_PROMPT,
        'Adaptation Prompt': DEFAULT_ADAPTATION_PROMPT,
        'Executive Summary Weight': 20,
        'Skills Weight': 20,
        'Experience Weight': 20,
        'Education Weight': 15,
        'ATS Weight': 15,
        'Hobbies Languages Weight': 10,
        'Profile Matching Local Skill Weight': PROFILE_MATCHING_LOCAL_SKILL_WEIGHT,
        'Profile Matching Local Tool Weight': PROFILE_MATCHING_LOCAL_TOOL_WEIGHT,
        'Profile Matching Local Industry Weight': PROFILE_MATCHING_LOCAL_INDUSTRY_WEIGHT,
        'Profile Matching Local Soft Skill Weight': PROFILE_MATCHING_LOCAL_SOFTSKILL_WEIGHT,
        'Profile Matching Local Title Exact Weight': PROFILE_MATCHING_LOCAL_TITLE_EXACT_WEIGHT,
        'Profile Matching Local Title Token Weight': PROFILE_MATCHING_LOCAL_TITLE_TOKEN_WEIGHT,
        'Profile Matching Local Coverage Multiplier': PROFILE_MATCHING_LOCAL_COVERAGE_MULTIPLIER,
        'DPO Name': '',
        'DPO Email': '',
        'DPO Phone': ''
    }, getProviderAvailabilityFlags)).then(payload => res.json(payload)).catch(() => res.status(500).json({ error: 'Failed to build defaults' }));
});

router.get('/ollama/models', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const baseUrl = String(req.query.baseUrl || '').trim();
        const selectedModel = String(req.query.model || '').trim();
        const discovery = await discoverOllamaModels(baseUrl, { includeCapabilities: true });

        return res.json({
            models: discovery.modelCatalog,
            capabilitiesByModel: discovery.capabilitiesByModel,
            selectedModelExists: selectedModel ? discovery.modelCatalog.some(entry => entry.value === selectedModel) : true
        });
    } catch (error) {
        safeLog('warn', 'Failed to discover Ollama models', { error: error.message });
        return res.status(400).json({ error: 'Failed to discover Ollama models' });
    }
});

// PUT /api/settings/:id - Update settings (or create if not exists)
router.put('/:id', authenticateToken, requireAdmin, validateParams('id'), validateBody(updateSettingsSchema), async (req, res) => {
    try {
        const { id } = req.params;
        let updateData = req.body;

        await invalidateSettingsCache();

        safeLog('info', 'Updating settings', { settingsId: id });

        delete updateData.id;
        updateData = normalizeRequestedSettingsModel(normalizeWeights(updateData));
        const currentSettingsRecord = await getSettings();
        updateData = await prepareSettingsMutationPayload(updateData, {
            getProviderAvailabilityFlags,
            validatePersistedLlmSettings,
            reqUser: req.user,
            currentSettingsRecord
        });

        safeLog('debug', 'Settings normalized', { fields: Object.keys(updateData) });

        const fieldsToUpdate = mapSettingsFromFrontend(updateData);
        const result = await upsertSettings(id, fieldsToUpdate);

        securityLog(LOG_LEVELS.SECURITY, SECURITY_EVENTS.SETTINGS_CHANGED, {
            ...getRequestMetadata(req),
            settingsId: id,
            changedBy: req.user.id,
            action: 'SETTINGS_UPDATED',
            message: 'LLM settings updated by admin',
            metadata: { fields: Object.keys(updateData) }
        });

        res.json(await decorateSettingsResponse(mapSettingsToFrontend(result), getProviderAvailabilityFlags));
    } catch (error) {
        safeLog('error', 'Error updating settings', { error: error.message });
        return res.status(error.statusCode || 500).json({
            error: error.statusCode ? error.message : 'Failed to update settings'
        });
    }
});

// POST /api/settings - Create settings
router.post('/', authenticateToken, requireAdmin, validateBody(updateSettingsSchema), async (req, res) => {
    try {
        let settingsData = req.body;

        await invalidateSettingsCache();

        settingsData = normalizeRequestedSettingsModel(normalizeWeights(settingsData));
        const currentSettingsRecord = await getSettings();
        settingsData = await prepareSettingsMutationPayload(settingsData, {
            getProviderAvailabilityFlags,
            validatePersistedLlmSettings,
            reqUser: req.user,
            currentSettingsRecord
        });

        const fieldsToCreate = {
            name: settingsData.llmModel || 'Default Settings',
            ...mapSettingsFromFrontend(settingsData),
            status: 'active'
        };

        const result = await createSettings(fieldsToCreate);

        securityLog(LOG_LEVELS.SECURITY, SECURITY_EVENTS.SETTINGS_CHANGED, {
            ...getRequestMetadata(req),
            changedBy: req.user.id,
            action: 'SETTINGS_CREATED',
            message: 'LLM settings created by admin'
        });

        res.status(201).json(await decorateSettingsResponse(mapSettingsToFrontend(result), getProviderAvailabilityFlags));
    } catch (error) {
        safeLog('error', 'Error creating settings', { error: error.message });
        return res.status(error.statusCode || 500).json({
            error: error.statusCode ? error.message : 'Failed to create settings'
        });
    }
});

export default router;
