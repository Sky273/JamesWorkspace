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
import { getProviderAvailabilityFlags, resolveAvailableModel } from '../services/llmAvailability.service.js';
import { getProviderDefaultModel } from '../services/llmConfiguration.service.js';
import { buildLlmAdminMetadataWithOptions, sanitizeLlmModelParameters } from '../services/llmAdminParameters.service.js';
import { getPromptContract, getPromptDefinition } from '../config/llmGovernance.js';
import { discoverOllamaModels, validateOllamaModelExists } from '../services/ollamaAdmin.service.js';
import { validatePersistedLlmSettings } from '../services/llmSettingsValidation.service.js';
import {
    computeUpdatedPromptVersionState,
    extractPromptTextsFromFrontendSettings,
    extractPromptTextsFromSettingsRecord,
    resolvePromptVersionState
} from '../services/promptVersioning.service.js';
import {
    PROFILE_MATCHING_LOCAL_SKILL_WEIGHT,
    PROFILE_MATCHING_LOCAL_TOOL_WEIGHT,
    PROFILE_MATCHING_LOCAL_INDUSTRY_WEIGHT,
    PROFILE_MATCHING_LOCAL_SOFTSKILL_WEIGHT,
    PROFILE_MATCHING_LOCAL_TITLE_EXACT_WEIGHT,
    PROFILE_MATCHING_LOCAL_TITLE_TOKEN_WEIGHT,
    PROFILE_MATCHING_LOCAL_COVERAGE_MULTIPLIER
} from '../config/constants.js';

const router = express.Router();
const GOVERNED_PROMPT_KEYS = Object.freeze({
    'Analysis Prompt': 'DEFAULT_ANALYSIS_PROMPT',
    'Improvement Prompt': 'DEFAULT_IMPROVEMENT_PROMPT',
    'Match Analysis Prompt': 'DEFAULT_MATCH_ANALYSIS_PROMPT',
    'Adaptation Prompt': 'DEFAULT_ADAPTATION_PROMPT'
});

function normalizeRequestedSettingsModel(settingsData = {}) {
    if (!settingsData.llmProvider || !settingsData.llmModel) {
        return settingsData;
    }

    const normalizedModel = resolveAvailableModel(
        settingsData.llmProvider,
        settingsData.llmModel,
        getProviderDefaultModel(settingsData.llmProvider)
    );

    if (normalizedModel.adjusted) {
        safeLog('warn', 'Normalized unavailable LLM model in settings payload', {
            provider: settingsData.llmProvider,
            originalModel: normalizedModel.originalModel,
            effectiveModel: normalizedModel.model,
            reason: normalizedModel.reason
        });

        return {
            ...settingsData,
            llmModel: normalizedModel.model
        };
    }

    return settingsData;
}

async function decorateSettingsResponse(settings) {
    const ollamaDiscovery = { modelCatalog: [], capabilitiesByModel: {} };
    const promptGovernance = Object.fromEntries(
        Object.entries(GOVERNED_PROMPT_KEYS).map(([settingKey, promptKey]) => {
            const prompt = getPromptDefinition(promptKey);
            const contract = getPromptContract(promptKey);

            return [settingKey, {
                settingKey,
                promptKey,
                promptId: prompt?.id || null,
                promptVersion: prompt?.version || null,
                promptDomain: prompt?.domain || null,
                promptOperation: prompt?.operation || null,
                contractId: contract?.id || null,
                contractVersion: contract?.version || null,
                sourceModule: prompt?.sourceModule || null,
                defaultText: prompt?.text || ''
            }];
        })
    );

    return {
        ...settings,
        llmAvailability: getProviderAvailabilityFlags(),
        ...buildLlmAdminMetadataWithOptions(getProviderAvailabilityFlags(), {
            ollamaModels: ollamaDiscovery.modelCatalog
        }),
        ollamaDiscoveredModels: ollamaDiscovery.modelCatalog,
        ollamaModelCapabilities: ollamaDiscovery.capabilitiesByModel,
        promptVersionState: resolvePromptVersionState({
            storedState: settings?.promptVersionState || {},
            promptTexts: extractPromptTextsFromFrontendSettings(settings)
        }),
        promptGovernance
    };
}

function mergeCanonicalLlmSettings(settingsData, canonicalLlmSettings = {}) {
    if (!canonicalLlmSettings || Object.keys(canonicalLlmSettings).length === 0) {
        return settingsData;
    }

    return {
        ...settingsData,
        llmProvider: canonicalLlmSettings.llmProvider ?? settingsData.llmProvider,
        llmModel: canonicalLlmSettings.llmModel ?? settingsData.llmModel,
        ollamaBaseUrl: canonicalLlmSettings.ollamaBaseUrl ?? settingsData.ollamaBaseUrl,
        ollamaVisionModel: canonicalLlmSettings.ollamaVisionModel ?? settingsData.ollamaVisionModel,
        ollamaKeepAlive: canonicalLlmSettings.ollamaKeepAlive ?? settingsData.ollamaKeepAlive,
        ollamaNumCtx: canonicalLlmSettings.ollamaNumCtx ?? settingsData.ollamaNumCtx,
        llmModelParameters: canonicalLlmSettings.llmModelParameters ?? settingsData.llmModelParameters,
        cvMode: canonicalLlmSettings.cvMode ?? settingsData.cvMode,
        chatbotEnabled: canonicalLlmSettings.chatbotEnabled ?? settingsData.chatbotEnabled,
        webglEnabled: canonicalLlmSettings.webglEnabled ?? settingsData.webglEnabled,
        'Analysis Prompt': canonicalLlmSettings['Analysis Prompt'] ?? settingsData['Analysis Prompt'],
        'Improvement Prompt': canonicalLlmSettings['Improvement Prompt'] ?? settingsData['Improvement Prompt'],
        'Match Analysis Prompt': canonicalLlmSettings['Match Analysis Prompt'] ?? settingsData['Match Analysis Prompt'],
        'Adaptation Prompt': canonicalLlmSettings['Adaptation Prompt'] ?? settingsData['Adaptation Prompt'],
        'Executive Summary Weight': canonicalLlmSettings['Executive Summary Weight'] ?? settingsData['Executive Summary Weight'],
        'Skills Weight': canonicalLlmSettings['Skills Weight'] ?? settingsData['Skills Weight'],
        'Experience Weight': canonicalLlmSettings['Experience Weight'] ?? settingsData['Experience Weight'],
        'Education Weight': canonicalLlmSettings['Education Weight'] ?? settingsData['Education Weight'],
        'ATS Weight': canonicalLlmSettings['ATS Weight'] ?? settingsData['ATS Weight'],
        'Hobbies Languages Weight': canonicalLlmSettings['Hobbies Languages Weight'] ?? settingsData['Hobbies Languages Weight'],
        'Profile Matching Local Skill Weight': canonicalLlmSettings['Profile Matching Local Skill Weight'] ?? settingsData['Profile Matching Local Skill Weight'],
        'Profile Matching Local Tool Weight': canonicalLlmSettings['Profile Matching Local Tool Weight'] ?? settingsData['Profile Matching Local Tool Weight'],
        'Profile Matching Local Industry Weight': canonicalLlmSettings['Profile Matching Local Industry Weight'] ?? settingsData['Profile Matching Local Industry Weight'],
        'Profile Matching Local Soft Skill Weight': canonicalLlmSettings['Profile Matching Local Soft Skill Weight'] ?? settingsData['Profile Matching Local Soft Skill Weight'],
        'Profile Matching Local Title Exact Weight': canonicalLlmSettings['Profile Matching Local Title Exact Weight'] ?? settingsData['Profile Matching Local Title Exact Weight'],
        'Profile Matching Local Title Token Weight': canonicalLlmSettings['Profile Matching Local Title Token Weight'] ?? settingsData['Profile Matching Local Title Token Weight'],
        'Profile Matching Local Coverage Multiplier': canonicalLlmSettings['Profile Matching Local Coverage Multiplier'] ?? settingsData['Profile Matching Local Coverage Multiplier'],
        llmAvailability: canonicalLlmSettings.llmAvailability ?? settingsData.llmAvailability,
        llmModelCatalog: canonicalLlmSettings.llmModelCatalog ?? settingsData.llmModelCatalog,
        llmParameterDefinitions: canonicalLlmSettings.llmParameterDefinitions ?? settingsData.llmParameterDefinitions,
        promptVersionState: canonicalLlmSettings.promptVersionState ?? settingsData.promptVersionState
    };
}

function buildNextPromptTexts(currentSettingsRecord = {}, incomingSettings = {}) {
    return {
        ...extractPromptTextsFromSettingsRecord(currentSettingsRecord),
        ...Object.fromEntries(
            Object.entries(extractPromptTextsFromFrontendSettings(incomingSettings))
                .filter(([settingKey]) => Object.prototype.hasOwnProperty.call(incomingSettings, settingKey))
        )
    };
}

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
            }), canonicalLlmSettings);

            return res.json(defaultSettings);
        }

        const responseData = mergeCanonicalLlmSettings(
            await decorateSettingsResponse(normalizeRequestedSettingsModel(mapSettingsToFrontend(settings))),
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
    })).then(payload => res.json(payload)).catch(() => res.status(500).json({ error: 'Failed to build defaults' }));
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
        let ollamaDiscovery = null;
        if (updateData.llmProvider === 'ollama') {
            if (!String(updateData.llmModel || '').trim()) {
                return res.status(400).json({ error: 'An Ollama default model must be selected.' });
            }
            const validation = await validateOllamaModelExists(updateData.ollamaBaseUrl, updateData.llmModel);
            ollamaDiscovery = validation.discovery;
            if (!validation.exists) {
                return res.status(400).json({ error: 'Selected Ollama model is not available on the configured instance.' });
            }
        }
        if (updateData.llmModelParameters) {
            updateData.llmModelParameters = sanitizeLlmModelParameters(updateData.llmModelParameters, getProviderAvailabilityFlags(), {
                ollamaModels: ollamaDiscovery?.modelCatalog || []
            });
        }
        await validatePersistedLlmSettings(updateData, req.user);
        const currentSettingsRecord = await getSettings();
        const previousPromptTexts = extractPromptTextsFromSettingsRecord(currentSettingsRecord || {});
        updateData.promptVersionState = computeUpdatedPromptVersionState({
            storedState: currentSettingsRecord?.prompt_versions || {},
            previousPromptTexts,
            nextPromptTexts: buildNextPromptTexts(currentSettingsRecord || {}, updateData),
            changedAt: new Date().toISOString(),
            changedBy: req.user
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

        res.json(await decorateSettingsResponse(mapSettingsToFrontend(result)));
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
        let ollamaDiscovery = null;
        if (settingsData.llmProvider === 'ollama') {
            if (!String(settingsData.llmModel || '').trim()) {
                return res.status(400).json({ error: 'An Ollama default model must be selected.' });
            }
            const validation = await validateOllamaModelExists(settingsData.ollamaBaseUrl, settingsData.llmModel);
            ollamaDiscovery = validation.discovery;
            if (!validation.exists) {
                return res.status(400).json({ error: 'Selected Ollama model is not available on the configured instance.' });
            }
        }
        if (settingsData.llmModelParameters) {
            settingsData.llmModelParameters = sanitizeLlmModelParameters(settingsData.llmModelParameters, getProviderAvailabilityFlags(), {
                ollamaModels: ollamaDiscovery?.modelCatalog || []
            });
        }
        await validatePersistedLlmSettings(settingsData, req.user);
        const currentSettingsRecord = await getSettings();
        const previousPromptTexts = extractPromptTextsFromSettingsRecord(currentSettingsRecord || {});
        settingsData.promptVersionState = computeUpdatedPromptVersionState({
            storedState: currentSettingsRecord?.prompt_versions || {},
            previousPromptTexts,
            nextPromptTexts: buildNextPromptTexts(currentSettingsRecord || {}, settingsData),
            changedAt: new Date().toISOString(),
            changedBy: req.user
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

        res.status(201).json(await decorateSettingsResponse(mapSettingsToFrontend(result)));
    } catch (error) {
        safeLog('error', 'Error creating settings', { error: error.message });
        return res.status(error.statusCode || 500).json({
            error: error.statusCode ? error.message : 'Failed to create settings'
        });
    }
});

export default router;
