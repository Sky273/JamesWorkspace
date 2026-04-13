/**
 * Centralized field mappers for PostgreSQL snake_case <-> frontend format
 * Eliminates duplication of mapping logic across route files
 */

import {
    DEFAULT_ANALYSIS_PROMPT,
    DEFAULT_IMPROVEMENT_PROMPT,
    DEFAULT_MATCH_ANALYSIS_PROMPT,
    DEFAULT_ADAPTATION_PROMPT,
    DEFAULT_PRE_ANALYSIS_PROMPT
} from '../config/prompts.backend.js';
import { buildAiCreditSettingsDefaults } from '../config/aiCredits.js';

/**
 * Map a PostgreSQL llm_settings row to frontend format
 * @param {Object} row - Database row
 * @returns {Object} Frontend-formatted settings
 */
export function mapSettingsToFrontend(row) {
    const creditDefaults = buildAiCreditSettingsDefaults();
    return {
        id: row.id,
        llmProvider: row.llm_provider || 'openai',
        llmModel: row.llm_model || null,
        ollamaBaseUrl: row.ollama_base_url || '',
        ollamaVisionModel: row.ollama_vision_model || '',
        ollamaKeepAlive: row.ollama_keep_alive || '5m',
        ollamaNumCtx: row.ollama_num_ctx || 8192,
        llmModelParameters: row.llm_model_parameters || {},
        cvMode: row.cv_mode || 'nominative',
        chatbotEnabled: row.chatbot_enabled || 'on',
        webglEnabled: row.webgl_enabled || 'on',
        preAnalysisEnabled: row.pre_analysis_enabled ?? false,
        'Pre Analysis Prompt': row.pre_analysis_prompt || DEFAULT_PRE_ANALYSIS_PROMPT,
        'Analysis Prompt': row.analysis_prompt || DEFAULT_ANALYSIS_PROMPT,
        'Improvement Prompt': row.improvement_prompt || DEFAULT_IMPROVEMENT_PROMPT,
        'Match Analysis Prompt': row.match_analysis_prompt || DEFAULT_MATCH_ANALYSIS_PROMPT,
        'Adaptation Prompt': row.adaptation_prompt || DEFAULT_ADAPTATION_PROMPT,
        'Executive Summary Weight': row.executive_summary_weight || 20,
        'Skills Weight': row.skills_weight || 20,
        'Experience Weight': row.experience_weight || 20,
        'Education Weight': row.education_weight || 15,
        'ATS Weight': row.ats_weight || 15,
        'Hobbies Languages Weight': row.hobbies_languages_weight || 10,
        'Profile Matching Local Skill Weight': row.profile_matching_local_skill_weight || 6,
        'Profile Matching Local Tool Weight': row.profile_matching_local_tool_weight || 4,
        'Profile Matching Local Industry Weight': row.profile_matching_local_industry_weight || 3,
        'Profile Matching Local Soft Skill Weight': row.profile_matching_local_softskill_weight || 2,
        'Profile Matching Local Title Exact Weight': row.profile_matching_local_title_exact_weight || 5,
        'Profile Matching Local Title Token Weight': row.profile_matching_local_title_token_weight || 2,
        'Profile Matching Local Coverage Multiplier': row.profile_matching_local_coverage_multiplier || 3,
        firmInitialCredits: row.firm_initial_credits ?? creditDefaults.firmInitialCredits,
        aiCreditChatbotMessage: row.ai_credit_chatbot_message ?? creditDefaults.aiCreditChatbotMessage,
        aiCreditResumeAiModify: row.ai_credit_resume_ai_modify ?? creditDefaults.aiCreditResumeAiModify,
        aiCreditTemplateExtract: row.ai_credit_template_extract ?? creditDefaults.aiCreditTemplateExtract,
        aiCreditResumeAnalysis: row.ai_credit_resume_analysis ?? creditDefaults.aiCreditResumeAnalysis,
        aiCreditResumeImprovement: row.ai_credit_resume_improvement ?? creditDefaults.aiCreditResumeImprovement,
        aiCreditResumeAdaptation: row.ai_credit_resume_adaptation ?? creditDefaults.aiCreditResumeAdaptation,
        aiCreditResumeMatch: row.ai_credit_resume_match ?? creditDefaults.aiCreditResumeMatch,
        aiCreditProfileSearch: row.ai_credit_profile_search ?? creditDefaults.aiCreditProfileSearch,
        aiCreditProfileAnalysis: row.ai_credit_profile_analysis ?? creditDefaults.aiCreditProfileAnalysis,
        aiMaxTokensChatbotMessage: row.ai_max_tokens_chatbot_message ?? creditDefaults.aiMaxTokensChatbotMessage,
        aiMaxTokensResumeAiModify: row.ai_max_tokens_resume_ai_modify ?? creditDefaults.aiMaxTokensResumeAiModify,
        aiMaxTokensTemplateExtract: row.ai_max_tokens_template_extract ?? creditDefaults.aiMaxTokensTemplateExtract,
        aiMaxTokensResumeAnalysis: row.ai_max_tokens_resume_analysis ?? creditDefaults.aiMaxTokensResumeAnalysis,
        aiMaxTokensResumeImprovement: row.ai_max_tokens_resume_improvement ?? creditDefaults.aiMaxTokensResumeImprovement,
        aiMaxTokensResumeAdaptation: row.ai_max_tokens_resume_adaptation ?? creditDefaults.aiMaxTokensResumeAdaptation,
        aiMaxTokensResumeMatch: row.ai_max_tokens_resume_match ?? creditDefaults.aiMaxTokensResumeMatch,
        aiMaxTokensProfileSearch: row.ai_max_tokens_profile_search ?? creditDefaults.aiMaxTokensProfileSearch,
        aiMaxTokensProfileAnalysis: row.ai_max_tokens_profile_analysis ?? creditDefaults.aiMaxTokensProfileAnalysis,
        promptVersionState: row.prompt_versions || {},
        'DPO Name': row.dpo_name || '',
        'DPO Email': row.dpo_email || '',
        'DPO Phone': row.dpo_phone || ''
    };
}

/**
 * Map a PostgreSQL templates row to frontend PascalCase format
 * @param {Object} row - Database row
 * @returns {Object} Frontend-formatted template
 */
export function mapTemplateToFrontend(row) {
    return {
        id: row.id,
        Name: row.name,
        Description: row.description,
        Popular: row.popular || false,
        Status: row.status || 'active',
        Tags: row.tags || [],
        previewImage: row.preview_image_url || null,
        PreviewImage: row.preview_image_url || null,
        HeaderContent: row.header_content || '',
        TemplateContent: row.template_content || '',
        FooterContent: row.footer_content || '',
        FooterHeight: row.footer_height || 25,
        Stylesheet: row.stylesheet || '',
        FirmId: row.firm_id || null,
        FirmName: row.firm_name || null,
        lastUpdated: row.updated_at,
        LastUpdated: row.updated_at
    };
}

/**
 * Map frontend template data to PostgreSQL columns
 * @param {Object} data - Frontend data (PascalCase)
 * @returns {Object} Database column mapping (undefined values excluded)
 */
export function mapTemplateFromFrontend(data) {
    const getFirstDefinedValue = (...keys) => {
        for (const key of keys) {
            if (Object.prototype.hasOwnProperty.call(data, key) && data[key] !== undefined) {
                return data[key];
            }
        }
        return undefined;
    };

    const status = getFirstDefinedValue('Status', 'status');
    const fields = {
        name: getFirstDefinedValue('Name', 'name'),
        description: getFirstDefinedValue('Description', 'description'),
        popular: getFirstDefinedValue('Popular', 'popular'),
        status: typeof status === 'string' ? status.toLowerCase() : status,
        tags: getFirstDefinedValue('Tags', 'tags'),
        preview_image_url: getFirstDefinedValue('PreviewImage', 'previewImage'),
        header_content: getFirstDefinedValue('HeaderContent', 'headerContent'),
        template_content: getFirstDefinedValue('TemplateContent', 'templateContent'),
        footer_content: getFirstDefinedValue('FooterContent', 'footerContent'),
        footer_height: getFirstDefinedValue('FooterHeight', 'footerHeight'),
        stylesheet: getFirstDefinedValue('Stylesheet', 'stylesheet')
    };

    Object.keys(fields).forEach(key => {
        if (fields[key] === undefined) {
            delete fields[key];
        }
    });

    return fields;
}

/**
 * Map frontend settings data to PostgreSQL llm_settings columns
 * @param {Object} data - Frontend data (after normalizeWeights)
 * @returns {Object} Database column mapping (undefined values excluded)
 */
export function mapSettingsFromFrontend(data) {
    const fields = {
        llm_provider: data.llmProvider,
        llm_model: data.llmModel,
        ollama_base_url: data.ollamaBaseUrl,
        ollama_vision_model: data.ollamaVisionModel,
        ollama_keep_alive: data.ollamaKeepAlive,
        ollama_num_ctx: data.ollamaNumCtx,
        llm_model_parameters: data.llmModelParameters,
        cv_mode: data.cvMode,
        chatbot_enabled: data.chatbotEnabled,
        webgl_enabled: data.webglEnabled,
        pre_analysis_enabled: data.preAnalysisEnabled,
        pre_analysis_prompt: data['Pre Analysis Prompt'],
        analysis_prompt: data['Analysis Prompt'],
        improvement_prompt: data['Improvement Prompt'],
        match_analysis_prompt: data['Match Analysis Prompt'],
        adaptation_prompt: data['Adaptation Prompt'],
        executive_summary_weight: data['Executive Summary Weight'],
        skills_weight: data['Skills Weight'],
        experience_weight: data['Experience Weight'],
        education_weight: data['Education Weight'],
        ats_weight: data['ATS Weight'],
        hobbies_languages_weight: data['Hobbies Languages Weight'],
        profile_matching_local_skill_weight: data['Profile Matching Local Skill Weight'],
        profile_matching_local_tool_weight: data['Profile Matching Local Tool Weight'],
        profile_matching_local_industry_weight: data['Profile Matching Local Industry Weight'],
        profile_matching_local_softskill_weight: data['Profile Matching Local Soft Skill Weight'],
        profile_matching_local_title_exact_weight: data['Profile Matching Local Title Exact Weight'],
        profile_matching_local_title_token_weight: data['Profile Matching Local Title Token Weight'],
        profile_matching_local_coverage_multiplier: data['Profile Matching Local Coverage Multiplier'],
        firm_initial_credits: data.firmInitialCredits,
        ai_credit_chatbot_message: data.aiCreditChatbotMessage,
        ai_credit_resume_ai_modify: data.aiCreditResumeAiModify,
        ai_credit_template_extract: data.aiCreditTemplateExtract,
        ai_credit_resume_analysis: data.aiCreditResumeAnalysis,
        ai_credit_resume_improvement: data.aiCreditResumeImprovement,
        ai_credit_resume_adaptation: data.aiCreditResumeAdaptation,
        ai_credit_resume_match: data.aiCreditResumeMatch,
        ai_credit_profile_search: data.aiCreditProfileSearch,
        ai_credit_profile_analysis: data.aiCreditProfileAnalysis,
        ai_max_tokens_chatbot_message: data.aiMaxTokensChatbotMessage,
        ai_max_tokens_resume_ai_modify: data.aiMaxTokensResumeAiModify,
        ai_max_tokens_template_extract: data.aiMaxTokensTemplateExtract,
        ai_max_tokens_resume_analysis: data.aiMaxTokensResumeAnalysis,
        ai_max_tokens_resume_improvement: data.aiMaxTokensResumeImprovement,
        ai_max_tokens_resume_adaptation: data.aiMaxTokensResumeAdaptation,
        ai_max_tokens_resume_match: data.aiMaxTokensResumeMatch,
        ai_max_tokens_profile_search: data.aiMaxTokensProfileSearch,
        ai_max_tokens_profile_analysis: data.aiMaxTokensProfileAnalysis,
        prompt_versions: data.promptVersionState,
        dpo_name: data['DPO Name'],
        dpo_email: data['DPO Email'],
        dpo_phone: data['DPO Phone']
    };

    Object.keys(fields).forEach(key => {
        if (fields[key] === undefined) {
            delete fields[key];
        }
    });

    return fields;
}

