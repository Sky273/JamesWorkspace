import { resolveAvailableModel } from '../services/llmAvailability.service.js';
import { getProviderDefaultModel, normalizeModelForProvider } from '../services/llmConfiguration.service.js';
import { buildLlmAdminMetadataWithOptions, sanitizeLlmModelParameters } from '../services/llmAdminParameters.service.js';
import { getPromptContract, getPromptDefinition } from '../config/llmGovernance.js';
import { validateOllamaModelExists } from '../services/ollamaAdmin.service.js';
import {
    computeUpdatedPromptVersionState,
    extractPromptTextsFromFrontendSettings,
    extractPromptTextsFromSettingsRecord,
    resolvePromptVersionState
} from '../services/promptVersioning.service.js';
import { safeLog } from '../utils/logger.backend.js';

export const GOVERNED_PROMPT_KEYS = Object.freeze({
    'Pre Analysis Prompt': 'DEFAULT_PRE_ANALYSIS_PROMPT',
    'Analysis Prompt': 'DEFAULT_ANALYSIS_PROMPT',
    'Improvement Prompt': 'DEFAULT_IMPROVEMENT_PROMPT',
    'Match Analysis Prompt': 'DEFAULT_MATCH_ANALYSIS_PROMPT',
    'Adaptation Prompt': 'DEFAULT_ADAPTATION_PROMPT'
});

export function normalizeRequestedSettingsModel(settingsData = {}) {
    if (!settingsData.llmProvider || !settingsData.llmModel) {
        return settingsData;
    }

    const requestedModel = normalizeModelForProvider(settingsData.llmProvider, settingsData.llmModel);
    const normalizedModel = resolveAvailableModel(
        settingsData.llmProvider,
        requestedModel,
        getProviderDefaultModel(settingsData.llmProvider)
    );

    if (!normalizedModel.adjusted && normalizedModel.model === settingsData.llmModel) {
        return settingsData;
    }

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

function buildPromptGovernance() {
    return Object.fromEntries(
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
}

export async function decorateSettingsResponse(settings, getProviderAvailabilityFlags) {
    const ollamaDiscovery = { modelCatalog: [], capabilitiesByModel: {} };

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
        promptGovernance: buildPromptGovernance()
    };
}

export function mergeCanonicalLlmSettings(settingsData, canonicalLlmSettings = {}) {
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
        preAnalysisEnabled: canonicalLlmSettings.preAnalysisEnabled ?? settingsData.preAnalysisEnabled,
        'Pre Analysis Prompt': canonicalLlmSettings['Pre Analysis Prompt'] ?? settingsData['Pre Analysis Prompt'],
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

export async function prepareSettingsMutationPayload(settingsData, { getProviderAvailabilityFlags, reqUser, currentSettingsRecord }) {
    let preparedSettings = settingsData;
    let ollamaDiscovery = null;

    if (preparedSettings.llmProvider === 'ollama') {
        const selectedOllamaModel = String(preparedSettings.llmModel || '').trim();
        if (selectedOllamaModel) {
            try {
                const validation = await validateOllamaModelExists(preparedSettings.ollamaBaseUrl, selectedOllamaModel);
                ollamaDiscovery = validation.discovery;
                if (!validation.exists) {
                    safeLog('warn', 'Selected Ollama model is not currently available on the configured instance; persisting settings anyway', {
                        baseUrl: preparedSettings.ollamaBaseUrl,
                        model: selectedOllamaModel
                    });
                }
            } catch (error) {
                safeLog('warn', 'Failed to validate Ollama model during settings save; persisting settings anyway', {
                    baseUrl: preparedSettings.ollamaBaseUrl,
                    model: selectedOllamaModel,
                    error: error.message
                });
            }
        }
    }

    if (preparedSettings.llmModelParameters) {
        preparedSettings = {
            ...preparedSettings,
            llmModelParameters: sanitizeLlmModelParameters(preparedSettings.llmModelParameters, getProviderAvailabilityFlags(), {
                ollamaModels: ollamaDiscovery?.modelCatalog || []
            })
        };
    }

    return {
        ...preparedSettings,
        promptVersionState: computeUpdatedPromptVersionState({
            storedState: currentSettingsRecord?.prompt_versions || {},
            previousPromptTexts: extractPromptTextsFromSettingsRecord(currentSettingsRecord || {}),
            nextPromptTexts: buildNextPromptTexts(currentSettingsRecord || {}, preparedSettings),
            changedAt: new Date().toISOString(),
            changedBy: reqUser
        })
    };
}
