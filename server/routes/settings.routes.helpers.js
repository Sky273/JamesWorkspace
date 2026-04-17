import { resolveAvailableModel } from '../services/llmAvailability.service.js';
import { getProviderDefaultModel, normalizeModelForProvider } from '../services/llmConfiguration.service.js';
import { buildLlmAdminMetadataWithOptions, sanitizeLlmModelParameters } from '../services/llmAdminParameters.service.js';
import { getPromptContract, getPromptDefinition } from '../config/llmGovernance.js';
import { validateOllamaModelExists } from '../services/ollamaAdmin.service.js';
import { normalizeBaseUrl } from '../services/ollama.request.js';
import {
    normalizeWeights,
    DEFAULT_ANALYSIS_PROMPT,
    DEFAULT_IMPROVEMENT_PROMPT,
    DEFAULT_MATCH_ANALYSIS_PROMPT,
    DEFAULT_ADAPTATION_PROMPT,
    DEFAULT_PRE_ANALYSIS_PROMPT
} from '../config/prompts.backend.js';
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
    buildAiCreditSettingsDefaults,
    DEFAULT_ALLOW_USER_REGISTRATION_WITHOUT_APPROVAL
} from '../config/aiCredits.js';
import {
    computeUpdatedPromptVersionState,
    extractPromptTextsFromFrontendSettings,
    extractPromptTextsFromSettingsRecord,
    resolvePromptVersionState
} from '../services/promptVersioning.service.js';
import { safeLog } from '../utils/logger.backend.js';
import { mapSettingsFromFrontend, mapSettingsToFrontend } from '../utils/mappers.js';

export const GOVERNED_PROMPT_KEYS = Object.freeze({
    'Pre Analysis Prompt': 'DEFAULT_PRE_ANALYSIS_PROMPT',
    'Analysis Prompt': 'DEFAULT_ANALYSIS_PROMPT',
    'Improvement Prompt': 'DEFAULT_IMPROVEMENT_PROMPT',
    'Match Analysis Prompt': 'DEFAULT_MATCH_ANALYSIS_PROMPT',
    'Adaptation Prompt': 'DEFAULT_ADAPTATION_PROMPT'
});

export function buildDefaultSettingsPayload(defaultModel) {
    const aiCreditDefaults = buildAiCreditSettingsDefaults();
    return {
        llmProvider: 'openai',
        llmModel: defaultModel,
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
        'Profile Matching Local Coverage Multiplier': PROFILE_MATCHING_LOCAL_COVERAGE_MULTIPLIER,
        allowUserRegistrationWithoutApproval: DEFAULT_ALLOW_USER_REGISTRATION_WITHOUT_APPROVAL,
        firmInitialCredits: aiCreditDefaults.firmInitialCredits,
        aiCreditChatbotMessage: aiCreditDefaults.aiCreditChatbotMessage,
        aiCreditResumeAiModify: aiCreditDefaults.aiCreditResumeAiModify,
        aiCreditTemplateExtract: aiCreditDefaults.aiCreditTemplateExtract,
        aiCreditResumeAnalysis: aiCreditDefaults.aiCreditResumeAnalysis,
        aiCreditResumeImprovement: aiCreditDefaults.aiCreditResumeImprovement,
        aiCreditResumeAdaptation: aiCreditDefaults.aiCreditResumeAdaptation,
        aiCreditResumeMatch: aiCreditDefaults.aiCreditResumeMatch,
        aiCreditProfileSearch: aiCreditDefaults.aiCreditProfileSearch,
        aiCreditProfileAnalysis: aiCreditDefaults.aiCreditProfileAnalysis,
        aiMaxTokensChatbotMessage: aiCreditDefaults.aiMaxTokensChatbotMessage,
        aiMaxTokensResumeAiModify: aiCreditDefaults.aiMaxTokensResumeAiModify,
        aiMaxTokensTemplateExtract: aiCreditDefaults.aiMaxTokensTemplateExtract,
        aiMaxTokensResumeAnalysis: aiCreditDefaults.aiMaxTokensResumeAnalysis,
        aiMaxTokensResumeImprovement: aiCreditDefaults.aiMaxTokensResumeImprovement,
        aiMaxTokensResumeAdaptation: aiCreditDefaults.aiMaxTokensResumeAdaptation,
        aiMaxTokensResumeMatch: aiCreditDefaults.aiMaxTokensResumeMatch,
        aiMaxTokensProfileSearch: aiCreditDefaults.aiMaxTokensProfileSearch,
        aiMaxTokensProfileAnalysis: aiCreditDefaults.aiMaxTokensProfileAnalysis
    };
}

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
        firmInitialCredits: canonicalLlmSettings.firmInitialCredits ?? settingsData.firmInitialCredits,
        aiCreditChatbotMessage: canonicalLlmSettings.aiCreditChatbotMessage ?? settingsData.aiCreditChatbotMessage,
        aiCreditResumeAiModify: canonicalLlmSettings.aiCreditResumeAiModify ?? settingsData.aiCreditResumeAiModify,
        aiCreditTemplateExtract: canonicalLlmSettings.aiCreditTemplateExtract ?? settingsData.aiCreditTemplateExtract,
        aiCreditResumeAnalysis: canonicalLlmSettings.aiCreditResumeAnalysis ?? settingsData.aiCreditResumeAnalysis,
        aiCreditResumeImprovement: canonicalLlmSettings.aiCreditResumeImprovement ?? settingsData.aiCreditResumeImprovement,
        aiCreditResumeAdaptation: canonicalLlmSettings.aiCreditResumeAdaptation ?? settingsData.aiCreditResumeAdaptation,
        aiCreditResumeMatch: canonicalLlmSettings.aiCreditResumeMatch ?? settingsData.aiCreditResumeMatch,
        aiCreditProfileSearch: canonicalLlmSettings.aiCreditProfileSearch ?? settingsData.aiCreditProfileSearch,
        aiCreditProfileAnalysis: canonicalLlmSettings.aiCreditProfileAnalysis ?? settingsData.aiCreditProfileAnalysis,
        aiMaxTokensChatbotMessage: canonicalLlmSettings.aiMaxTokensChatbotMessage ?? settingsData.aiMaxTokensChatbotMessage,
        aiMaxTokensResumeAiModify: canonicalLlmSettings.aiMaxTokensResumeAiModify ?? settingsData.aiMaxTokensResumeAiModify,
        aiMaxTokensTemplateExtract: canonicalLlmSettings.aiMaxTokensTemplateExtract ?? settingsData.aiMaxTokensTemplateExtract,
        aiMaxTokensResumeAnalysis: canonicalLlmSettings.aiMaxTokensResumeAnalysis ?? settingsData.aiMaxTokensResumeAnalysis,
        aiMaxTokensResumeImprovement: canonicalLlmSettings.aiMaxTokensResumeImprovement ?? settingsData.aiMaxTokensResumeImprovement,
        aiMaxTokensResumeAdaptation: canonicalLlmSettings.aiMaxTokensResumeAdaptation ?? settingsData.aiMaxTokensResumeAdaptation,
        aiMaxTokensResumeMatch: canonicalLlmSettings.aiMaxTokensResumeMatch ?? settingsData.aiMaxTokensResumeMatch,
        aiMaxTokensProfileSearch: canonicalLlmSettings.aiMaxTokensProfileSearch ?? settingsData.aiMaxTokensProfileSearch,
        aiMaxTokensProfileAnalysis: canonicalLlmSettings.aiMaxTokensProfileAnalysis ?? settingsData.aiMaxTokensProfileAnalysis,
        llmAvailability: canonicalLlmSettings.llmAvailability ?? settingsData.llmAvailability,
        llmModelCatalog: canonicalLlmSettings.llmModelCatalog ?? settingsData.llmModelCatalog,
        llmParameterDefinitions: canonicalLlmSettings.llmParameterDefinitions ?? settingsData.llmParameterDefinitions,
        promptVersionState: canonicalLlmSettings.promptVersionState ?? settingsData.promptVersionState
    };
}

export function buildPresentationSettingsResponse(settings) {
    if (!settings) {
        return {
            chatbotEnabled: 'on',
            webglEnabled: 'on'
        };
    }

    const mapped = mapSettingsToFrontend(settings);
    return {
        chatbotEnabled: mapped.chatbotEnabled ?? 'on',
        webglEnabled: mapped.webglEnabled ?? 'on'
    };
}

export function buildPublicHomeSettingsResponse(settings) {
    if (!settings) {
        return {
            publicHomeEnabled: null
        };
    }

    const mapped = mapSettingsToFrontend(settings);
    return {
        publicHomeEnabled: typeof mapped.publicHomeEnabled === 'boolean' ? mapped.publicHomeEnabled : null
    };
}

export async function buildPersistedSettingsResponse(settingsRecord, getProviderAvailabilityFlags) {
    return decorateSettingsResponse(mapSettingsToFrontend(settingsRecord), getProviderAvailabilityFlags);
}

export async function prepareRouteSettingsMutation(rawSettings, { getProviderAvailabilityFlags, reqUser, currentSettingsRecord }) {
    const normalizedSettings = normalizeRequestedSettingsModel(normalizeWeights(rawSettings));
    return prepareSettingsMutationPayload(normalizedSettings, {
        getProviderAvailabilityFlags,
        reqUser,
        currentSettingsRecord
    });
}

export function buildSettingsCreateFields(settingsData) {
    return {
        name: settingsData.llmModel || 'Default Settings',
        ...mapSettingsFromFrontend(settingsData),
        status: 'active'
    };
}

export function buildSettingsUpdateFields(settingsData) {
    return mapSettingsFromFrontend(settingsData);
}

export function resolveConfiguredOllamaBaseUrl(settings = {}) {
    const candidate = settings?.ollamaBaseUrl;
    if (!candidate || !String(candidate).trim()) {
        throw Object.assign(new Error('Ollama base URL is not configured.'), { statusCode: 400 });
    }

    return normalizeBaseUrl(candidate);
}

export async function prepareSettingsConnectionTestPayload(rawSettings, { getProviderAvailabilityFlags }) {
    let settingsData = normalizeRequestedSettingsModel(normalizeWeights(rawSettings));
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

    if (!settingsData.llmModelParameters) {
        return settingsData;
    }

    return {
        ...settingsData,
        llmModelParameters: sanitizeLlmModelParameters(settingsData.llmModelParameters, getProviderAvailabilityFlags(), {
            ollamaModels: ollamaDiscovery?.modelCatalog || []
        })
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
