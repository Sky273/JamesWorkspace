import express from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.middleware.js';
import { validateParams, validateBody, updateSettingsSchema } from '../utils/validation.js';
import { securityLog, getRequestMetadata, LOG_LEVELS, SECURITY_EVENTS } from '../services/security.service.js';
import { settingsCache, CACHE_KEYS } from '../services/cache.service.js';
import { metrics } from '../services/metrics.service.js';
import { invalidateSettingsCache, getSettings, getLLMSettings, upsertSettings, createSettings } from '../services/settings.service.js';
import {
    normalizeWeights,
    DEFAULT_ANALYSIS_PROMPT,
    DEFAULT_IMPROVEMENT_PROMPT,
    DEFAULT_MATCH_ANALYSIS_PROMPT,
    DEFAULT_ADAPTATION_PROMPT,
    DEFAULT_PRE_ANALYSIS_PROMPT
} from '../config/prompts.backend.js';
import { safeLog } from '../utils/logger.backend.js';
import { mapSettingsToFrontend, mapSettingsFromFrontend } from '../utils/mappers.js';
import { getProviderAvailabilityFlags } from '../services/llmAvailability.service.js';
import { discoverOllamaModels, validateOllamaModelExists } from '../services/ollamaAdmin.service.js';
import { sanitizeLlmModelParameters } from '../services/llmAdminParameters.service.js';
import { testLlmSettingsConnection } from '../services/llmSettingsValidation.service.js';
import { normalizeBaseUrl } from '../services/ollama.request.js';
import { getProviderDefaultModel } from '../services/llmConfiguration.service.js';
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
const DEFAULT_OPENAI_MODEL = getProviderDefaultModel('openai');

function createSettingsRouteHandler(logMessage, errorMessage, handler) {
    return async (req, res) => {
        try {
            await handler(req, res);
        } catch (error) {
            safeLog('error', logMessage, { error: error.message });
            return res.status(error.statusCode || 500).json({
                error: error.statusCode ? error.message : errorMessage
            });
        }
    };
}

function buildDefaultSettingsPayload() {
    return {
        llmProvider: 'openai',
        llmModel: DEFAULT_OPENAI_MODEL,
        cvMode: 'nominative',
        chatbotEnabled: 'on',
        webglEnabled: 'on',
        preAnalysisEnabled: false,
        'Pre Analysis Prompt': DEFAULT_PRE_ANALYSIS_PROMPT,
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
    };
}

function resolveConfiguredOllamaBaseUrl(settings = {}) {
    const candidate = settings?.ollamaBaseUrl;
    if (!candidate || !String(candidate).trim()) {
        throw Object.assign(new Error('Ollama base URL is not configured.'), { statusCode: 400 });
    }

    return normalizeBaseUrl(candidate);
}

// GET /api/settings - Get settings
router.get('/', authenticateToken, createSettingsRouteHandler('Error fetching settings', 'Failed to fetch settings', async (req, res) => {
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

            const defaultSettings = mergeCanonicalLlmSettings(
                await decorateSettingsResponse({
                    id: null,
                    ...buildDefaultSettingsPayload()
                }, getProviderAvailabilityFlags),
                canonicalLlmSettings
            );

            return res.json(defaultSettings);
        }

        const responseData = mergeCanonicalLlmSettings(
            await decorateSettingsResponse(normalizeRequestedSettingsModel(mapSettingsToFrontend(settings)), getProviderAvailabilityFlags),
            canonicalLlmSettings
        );

        await settingsCache.set(CACHE_KEYS.settings.UI_SETTINGS, responseData);

        return res.json(responseData);
    }));

router.get('/presentation', authenticateToken, createSettingsRouteHandler('Error fetching presentation settings', 'Failed to fetch presentation settings', async (req, res) => {
        const settings = await getSettings();

        if (!settings) {
            return res.json({
                chatbotEnabled: 'on',
                webglEnabled: 'on'
            });
        }

        const mapped = mapSettingsToFrontend(settings);
        return res.json({
            chatbotEnabled: mapped.chatbotEnabled || 'on',
            webglEnabled: mapped.webglEnabled || 'on'
        });
    }));

// GET /api/settings/defaults - Get default prompts and weights
router.get('/defaults', authenticateToken, requireAdmin, createSettingsRouteHandler('Error building defaults', 'Failed to build defaults', async (req, res) => {
    const payload = await decorateSettingsResponse({
        ...buildDefaultSettingsPayload(),
        'DPO Name': '',
        'DPO Email': '',
        'DPO Phone': ''
    }, getProviderAvailabilityFlags);
    return res.json(payload);
}));

router.get('/ollama/models', authenticateToken, requireAdmin, createSettingsRouteHandler('Failed to discover Ollama models', 'Failed to discover Ollama models', async (req, res) => {
        const requestedBaseUrl = String(req.query.baseUrl || '').trim();
        const selectedModel = String(req.query.model || '').trim();
        const canonicalLlmSettings = await getLLMSettings();
        const configuredBaseUrl = resolveConfiguredOllamaBaseUrl(canonicalLlmSettings);
        const baseUrl = normalizeBaseUrl(requestedBaseUrl);

        if (baseUrl !== configuredBaseUrl) {
            return res.status(400).json({ error: 'Ollama model discovery is limited to the configured Ollama URL.' });
        }

        const discovery = await discoverOllamaModels(baseUrl, { includeCapabilities: true });

        return res.json({
            models: discovery.modelCatalog,
            capabilitiesByModel: discovery.capabilitiesByModel,
            selectedModelExists: selectedModel ? discovery.modelCatalog.some(entry => entry.value === selectedModel) : true
        });
    }));

router.post('/test-llm', authenticateToken, requireAdmin, validateBody(updateSettingsSchema), createSettingsRouteHandler('Error testing LLM settings', 'Failed to test LLM settings', async (req, res) => {
        let settingsData = normalizeRequestedSettingsModel(normalizeWeights(req.body));
        let ollamaDiscovery = null;

        if (settingsData.llmProvider === 'ollama') {
            const selectedOllamaModel = String(settingsData.llmModel || '').trim();
            if (selectedOllamaModel) {
                try {
                    const validation = await validateOllamaModelExists(settingsData.ollamaBaseUrl, selectedOllamaModel);
                    ollamaDiscovery = validation.discovery;
                } catch (error) {
                    safeLog('warn', 'Failed to refresh Ollama catalog before testing LLM settings', {
                        baseUrl: settingsData.ollamaBaseUrl,
                        model: settingsData.llmModel,
                        error: error.message
                    });
                }
            }
        }

        if (settingsData.llmModelParameters) {
            settingsData = {
                ...settingsData,
                llmModelParameters: sanitizeLlmModelParameters(settingsData.llmModelParameters, getProviderAvailabilityFlags(), {
                    ollamaModels: ollamaDiscovery?.modelCatalog || []
                })
            };
        }

        const result = await testLlmSettingsConnection(settingsData, req.user);
        return res.json({
            success: true,
            ...result
        });
    }));

// PUT /api/settings/:id - Update settings (or create if not exists)
router.put('/:id', authenticateToken, requireAdmin, validateParams('id'), validateBody(updateSettingsSchema), createSettingsRouteHandler('Error updating settings', 'Failed to update settings', async (req, res) => {
        const { id } = req.params;
        let updateData = req.body;

        safeLog('info', 'Updating settings', { settingsId: id });

        delete updateData.id;
        updateData = normalizeRequestedSettingsModel(normalizeWeights(updateData));
        const currentSettingsRecord = await getSettings();
        updateData = await prepareSettingsMutationPayload(updateData, {
            getProviderAvailabilityFlags,
            reqUser: req.user,
            currentSettingsRecord
        });

        safeLog('debug', 'Settings normalized', { fields: Object.keys(updateData) });

        const fieldsToUpdate = mapSettingsFromFrontend(updateData);
        const result = await upsertSettings(id, fieldsToUpdate);
        await invalidateSettingsCache();

        securityLog(LOG_LEVELS.SECURITY, SECURITY_EVENTS.SETTINGS_CHANGED, {
            ...getRequestMetadata(req),
            settingsId: id,
            changedBy: req.user.id,
            action: 'SETTINGS_UPDATED',
            message: 'LLM settings updated by admin',
            metadata: { fields: Object.keys(updateData) }
        });

        return res.json(await decorateSettingsResponse(mapSettingsToFrontend(result), getProviderAvailabilityFlags));
    }));

// POST /api/settings - Create settings
router.post('/', authenticateToken, requireAdmin, validateBody(updateSettingsSchema), createSettingsRouteHandler('Error creating settings', 'Failed to create settings', async (req, res) => {
        let settingsData = req.body;

        settingsData = normalizeRequestedSettingsModel(normalizeWeights(settingsData));
        const currentSettingsRecord = await getSettings();
        settingsData = await prepareSettingsMutationPayload(settingsData, {
            getProviderAvailabilityFlags,
            reqUser: req.user,
            currentSettingsRecord
        });

        const fieldsToCreate = {
            name: settingsData.llmModel || 'Default Settings',
            ...mapSettingsFromFrontend(settingsData),
            status: 'active'
        };

        const result = await createSettings(fieldsToCreate);
        await invalidateSettingsCache();

        securityLog(LOG_LEVELS.SECURITY, SECURITY_EVENTS.SETTINGS_CHANGED, {
            ...getRequestMetadata(req),
            changedBy: req.user.id,
            action: 'SETTINGS_CREATED',
            message: 'LLM settings created by admin'
        });

        return res.status(201).json(await decorateSettingsResponse(mapSettingsToFrontend(result), getProviderAvailabilityFlags));
    }));

export default router;
