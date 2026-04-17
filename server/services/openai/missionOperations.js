/**
 * OpenAI Mission Operations
 * Resume-mission matching and adaptation using OpenAI
 */

import { buildLLMMetricLabel } from '../metrics.service.js';
import {
    isLikelyAnthropicModel,
    isLikelyDeepSeekModel,
    isLikelyHuggingFaceModel,
    isLikelyGlmModel,
    isLikelyMiniMaxModel
} from '../llmConfiguration.service.js';
import { executeMissionMatchAnalysis } from './missionMatching.service.js';
import { executeMissionAdaptation } from './missionAdaptation.service.js';

function inferMetricsProvider(model) {
    if (isLikelyAnthropicModel(model)) return 'anthropic';
    if (isLikelyDeepSeekModel(model)) return 'deepseek';
    if (isLikelyHuggingFaceModel(model)) return 'huggingface';
    if (isLikelyGlmModel(model)) return 'glm';
    if (isLikelyMiniMaxModel(model)) return 'minimax';
    return 'openai';
}

/**
 * Match resume with mission using OpenAI
 * @param {string} resumeText - Resume text
 * @param {string} missionTitle - Mission title
 * @param {string} missionContent - Mission content
 * @param {string} model - OpenAI model to use
 * @param {string} matchAnalysisPrompt - Match analysis prompt template
 * @returns {Promise<Object>} - Parsed match analysis result (normalized for frontend compatibility)
 */
export async function matchResumeWithMission(resumeText, missionTitle, missionContent, model, matchAnalysisPrompt, userMetadata = null, options = {}) {
    const prompt = matchAnalysisPrompt
        .replace('{RESUME_TEXT}', resumeText)
        .replace('{MISSION_TITLE}', missionTitle)
        .replace('{MISSION_CONTENT}', missionContent);

    const metricsProvider = buildLLMMetricLabel(inferMetricsProvider(model), model);
    return executeMissionMatchAnalysis({
        prompt,
        model,
        options,
        userMetadata,
        metricsProvider,
        inputChars: resumeText.length + missionTitle.length + missionContent.length
    });
}

/**
 * Adapt resume to mission using OpenAI
 * @param {Object} params - Adaptation parameters
 * @param {string} params.resumeText - Resume text
 * @param {string} params.missionTitle - Mission title
 * @param {string} params.missionContent - Mission content
 * @param {Object} params.matchAnalysis - Match analysis result
 * @param {string} params.model - OpenAI model to use
 * @param {string} params.adaptationPrompt - Adaptation prompt template (with {ACCEPTED_INDUSTRIES}, {ANONYMIZATION_RULES}, {FILENAME} already injected)
 * @returns {Promise<Object>} - { adaptedText, adaptedTitle, structuredData }
 */
export async function adaptResumeToMission({
    resumeText,
    missionTitle,
    missionContent,
    matchAnalysis,
    model,
    adaptationPrompt,
    userMetadata = null,
    maxTokens = null
}) {
    const matchAnalysisStr = JSON.stringify(matchAnalysis, null, 2);
    const prompt = adaptationPrompt
        .replace('{RESUME_TEXT}', resumeText)
        .replace('{MISSION_TITLE}', missionTitle)
        .replace('{MISSION_CONTENT}', missionContent)
        // New placeholder name used by the updated default prompt
        .replace('{MATCH_ANALYSIS_JSON}', matchAnalysisStr)
        // Legacy placeholder for backward-compatibility with user-customized prompts
        .replace('{MATCH_ANALYSIS}', matchAnalysisStr);

    const metricsProvider = buildLLMMetricLabel(inferMetricsProvider(model), model);
    return executeMissionAdaptation({
        resumeText,
        missionTitle,
        missionContent,
        prompt,
        model,
        userMetadata,
        maxTokens,
        metricsProvider
    });
}



