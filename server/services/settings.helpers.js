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
import {
    buildAiCreditSettingsDefaults,
    DEFAULT_ALLOW_USER_REGISTRATION_WITHOUT_APPROVAL
} from '../config/aiCredits.js';
import { resolveAvailableModel, getProviderAvailabilityFlags } from './llmAvailability.service.js';
import { getProviderDefaultModel } from './llmConfiguration.service.js';
import { buildLlmAdminMetadataWithOptions, sanitizeLlmModelParameters } from './llmAdminParameters.service.js';
import { extractPromptTextsFromSettingsRecord, resolvePromptVersionState } from './promptVersioning.service.js';
import { safeLog } from '../utils/logger.backend.js';

export const CANONICAL_LLM_SETTINGS_KEY = 'default';
const DEFAULT_LLM_PROVIDER = 'openai';

export function buildCanonicalSettingsDefaults(fields = {}) {
    return {
        settings_key: CANONICAL_LLM_SETTINGS_KEY,
        name: 'Default Settings',
        status: 'active',
        ...fields
    };
}

export function buildMappedLlmSettings(dbSettings) {
    const creditDefaults = buildAiCreditSettingsDefaults();
    return {
        llmModel: dbSettings.llm_model,
        llmProvider: dbSettings.llm_provider || DEFAULT_LLM_PROVIDER,
        ollamaBaseUrl: dbSettings.ollama_base_url || OLLAMA_BASE_URL || '',
        ollamaVisionModel: dbSettings.ollama_vision_model || '',
        ollamaKeepAlive: dbSettings.ollama_keep_alive || '5m',
        ollamaNumCtx: dbSettings.ollama_num_ctx || 8192,
        llmModelParameters: sanitizeLlmModelParameters(
            dbSettings.llm_model_parameters || {},
            getProviderAvailabilityFlags()
        ),
        cvMode: dbSettings.cv_mode,
        chatbotEnabled: dbSettings.chatbot_enabled,
        webglEnabled: dbSettings.webgl_enabled,
        publicHomeEnabled: dbSettings.public_home_enabled,
        preAnalysisEnabled: dbSettings.pre_analysis_enabled ?? false,
        'Pre Analysis Prompt': dbSettings.pre_analysis_prompt,
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
        allowUserRegistrationWithoutApproval: dbSettings.allow_user_registration_without_approval ?? DEFAULT_ALLOW_USER_REGISTRATION_WITHOUT_APPROVAL,
        firmInitialCredits: dbSettings.firm_initial_credits ?? creditDefaults.firmInitialCredits,
        aiCreditChatbotMessage: dbSettings.ai_credit_chatbot_message ?? creditDefaults.aiCreditChatbotMessage,
        aiCreditResumeAiModify: dbSettings.ai_credit_resume_ai_modify ?? creditDefaults.aiCreditResumeAiModify,
        aiCreditResumeAnalysis: dbSettings.ai_credit_resume_analysis ?? creditDefaults.aiCreditResumeAnalysis,
        aiCreditResumeImprovement: dbSettings.ai_credit_resume_improvement ?? creditDefaults.aiCreditResumeImprovement,
        aiCreditResumeAdaptation: dbSettings.ai_credit_resume_adaptation ?? creditDefaults.aiCreditResumeAdaptation,
        aiCreditResumeMatch: dbSettings.ai_credit_resume_match ?? creditDefaults.aiCreditResumeMatch,
        aiCreditProfileSearch: dbSettings.ai_credit_profile_search ?? creditDefaults.aiCreditProfileSearch,
        aiCreditProfileAnalysis: dbSettings.ai_credit_profile_analysis ?? creditDefaults.aiCreditProfileAnalysis,
        aiMaxTokensChatbotMessage: dbSettings.ai_max_tokens_chatbot_message ?? creditDefaults.aiMaxTokensChatbotMessage,
        aiMaxTokensResumeAiModify: dbSettings.ai_max_tokens_resume_ai_modify ?? creditDefaults.aiMaxTokensResumeAiModify,
        aiMaxTokensResumeAnalysis: dbSettings.ai_max_tokens_resume_analysis ?? creditDefaults.aiMaxTokensResumeAnalysis,
        aiMaxTokensResumeImprovement: dbSettings.ai_max_tokens_resume_improvement ?? creditDefaults.aiMaxTokensResumeImprovement,
        aiMaxTokensResumeAdaptation: dbSettings.ai_max_tokens_resume_adaptation ?? creditDefaults.aiMaxTokensResumeAdaptation,
        aiMaxTokensResumeMatch: dbSettings.ai_max_tokens_resume_match ?? creditDefaults.aiMaxTokensResumeMatch,
        aiMaxTokensProfileSearch: dbSettings.ai_max_tokens_profile_search ?? creditDefaults.aiMaxTokensProfileSearch,
        aiMaxTokensProfileAnalysis: dbSettings.ai_max_tokens_profile_analysis ?? creditDefaults.aiMaxTokensProfileAnalysis,
        promptVersionState: resolvePromptVersionState({
            storedState: dbSettings.prompt_versions || {},
            promptTexts: extractPromptTextsFromSettingsRecord(dbSettings),
            fallbackTimestamp: dbSettings.updated_at || dbSettings.created_at || null
        }),
        llmAvailabilityState: dbSettings.llm_availability_state || {},
        ollamaDiscoveredModels: [],
        ollamaModelCapabilities: {}
    };
}

export function applyResolvedLlmAvailability(settings) {
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
    Object.assign(settings, buildLlmAdminMetadataWithOptions(settings.llmAvailability, {
        ollamaModels: []
    }));

    return settings;
}

export function parseRating(rating) {
    if (typeof rating === 'number') {
        return rating;
    }

    if (typeof rating === 'string') {
        const parsed = parseFloat(rating.replace('%', ''));
        return isNaN(parsed) ? 0 : parsed;
    }

    return 0;
}

export function buildWeightedGlobalRatingDetails(analysis, llmSettings = {}) {
    const weights = {
        executiveSummary: llmSettings['Executive Summary Weight'] || 20,
        skills: llmSettings['Skills Weight'] || 20,
        experience: llmSettings['Experience Weight'] || 20,
        education: llmSettings['Education Weight'] || 15,
        ats: llmSettings['ATS Weight'] || 15,
        hobbiesLanguages: llmSettings['Hobbies Languages Weight'] || 10
    };

    const totalWeight = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
    const normalizedWeights = {};
    for (const [key, value] of Object.entries(weights)) {
        normalizedWeights[key] = totalWeight > 0 ? (value / totalWeight) * 100 : 100 / 6;
    }

    const scores = {
        executiveSummary: parseRating(analysis.executiveSummaryRating || analysis['Executive Summary'] || 0),
        skills: parseRating(analysis.skillsRating || analysis['Skills'] || 0),
        experience: parseRating(analysis.experiencesRating || analysis['Experience'] || 0),
        education: parseRating(analysis.educationRating || analysis['Education'] || 0),
        ats: parseRating(analysis.atsOptimizationRating || analysis['ATS Compatibility'] || analysis['ATS'] || 0),
        hobbiesLanguages: parseRating(analysis.hobbiesLanguagesRating || analysis['Hobbies Languages'] || 0)
    };

    let weightedSum = 0;
    let appliedWeight = 0;
    for (const [key, score] of Object.entries(scores)) {
        const weight = normalizedWeights[key];
        weightedSum += score * weight;
        appliedWeight += weight;
    }

    const calculatedGlobalRating = appliedWeight > 0 ? Math.round(weightedSum / appliedWeight) : 0;
    const globalRatingStr = `${calculatedGlobalRating}%`;

    return {
        scores,
        normalizedWeights,
        calculatedGlobalRating,
        globalRatingStr,
        originalGlobalRating: analysis.globalRating || analysis['Global Rating']
    };
}
