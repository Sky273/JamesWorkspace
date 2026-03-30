/**
 * OpenAI Mission Operations
 * Resume-mission matching and adaptation using OpenAI
 */

import { safeLog } from '../../utils/logger.backend.js';
import { callBusinessChatCompletion } from '../llmProvider.service.js';
import metrics, { buildLLMMetricLabel } from '../metrics.service.js';
import {
    isLikelyAnthropicModel,
    isLikelyDeepSeekModel,
    isLikelyGlmModel,
    isLikelyMiniMaxModel
} from '../llmConfiguration.service.js';
import { normalizeUtf8Text, parseJsonFromLlmResponse, stripLlmThinkingContent } from './textUtils.js';
import { validateAdaptationPayload, validateMatchAnalysisPayload } from './contracts.js';
import { buildAdaptationResult, normalizeMatchAnalysis } from './missionNormalization.js';

function inferMetricsProvider(model) {
    if (isLikelyAnthropicModel(model)) return 'anthropic';
    if (isLikelyDeepSeekModel(model)) return 'deepseek';
    if (isLikelyGlmModel(model)) return 'glm';
    if (isLikelyMiniMaxModel(model)) return 'minimax';
    return 'openai';
}

function isRecoverableMatchingJsonError(error) {
    const message = error?.message || '';
    return message.includes('Unexpected end of JSON input')
        || message.includes('Unterminated string in JSON')
        || message.includes('response truncated due to token limit');
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
export async function matchResumeWithMission(resumeText, missionTitle, missionContent, model, matchAnalysisPrompt, userMetadata = null) {
    const prompt = matchAnalysisPrompt
        .replace('{RESUME_TEXT}', resumeText)
        .replace('{MISSION_TITLE}', missionTitle)
        .replace('{MISSION_CONTENT}', missionContent);

    const metricsProvider = buildLLMMetricLabel(inferMetricsProvider(model), model);
    async function requestMatchAnalysis(compactRetry = false) {
        return callBusinessChatCompletion({
            model,
            messages: [
                { role: 'system', content: 'You are a JSON-only resume-mission matching API. Respond with valid JSON only.' },
                {
                    role: 'user',
                    content: compactRetry
                        ? `${prompt}\n\nReturn compact JSON only. Keep all string values concise. No markdown. No commentary outside the JSON object.`
                        : prompt
                }
            ],
            maxTokens: 4096,
            temperature: 0.3,
            responseFormat: { type: "json_object" },
            userMetadata,
            operationType: 'Resume-Mission Matching'
        });
    }

    let response;
    try {
        response = await requestMatchAnalysis(false);
    } catch (error) {
        metrics.trackAdaptationActivity({
            provider: metricsProvider,
            event: 'match',
            matchRuns: 1,
            failedRuns: 1,
            inputChars: resumeText.length + missionTitle.length + missionContent.length,
            metadata: { source: 'match-provider-call', error: error.message }
        });
        throw error;
    }

    try {
        const rawAnalysis = validateMatchAnalysisPayload(
            parseJsonFromLlmResponse(response.choices[0].message.content)
        );
        metrics.trackAdaptationActivity({
            provider: metricsProvider,
            event: 'match',
            matchRuns: 1,
            structuredRuns: 1,
            inputChars: resumeText.length + missionTitle.length + missionContent.length,
            outputChars: JSON.stringify(rawAnalysis).length,
            metadata: { source: 'match-analysis' }
        });
        // Normalize the response to ensure frontend compatibility while preserving full data
        return normalizeMatchAnalysis(rawAnalysis);
    } catch (parseError) {
        if (isRecoverableMatchingJsonError(parseError)) {
            safeLog('warn', 'Matching response returned malformed JSON, retrying once with compact JSON instructions', {
                error: parseError.message
            });

            metrics.trackAdaptationActivity({
                provider: metricsProvider,
                event: 'match',
                matchRuns: 1,
                metadata: { source: 'match-analysis-retry', error: parseError.message }
            });

            try {
                response = await requestMatchAnalysis(true);
                const rawAnalysis = validateMatchAnalysisPayload(
                    parseJsonFromLlmResponse(response.choices[0].message.content)
                );
                metrics.trackAdaptationActivity({
                    provider: metricsProvider,
                    event: 'match',
                    matchRuns: 1,
                    structuredRuns: 1,
                    inputChars: resumeText.length + missionTitle.length + missionContent.length,
                    outputChars: JSON.stringify(rawAnalysis).length,
                    metadata: { source: 'match-analysis-retry-success' }
                });
                return normalizeMatchAnalysis(rawAnalysis);
            } catch (retryError) {
                safeLog('error', 'Matching response retry failed', {
                    error: retryError.message
                });
            }
        }

        safeLog('error', 'Failed to parse LLM matching response as JSON', {
            error: parseError.message,
            responsePreview: response.choices[0].message.content.substring(0, 500)
        });
        metrics.trackAdaptationActivity({
            provider: metricsProvider,
            event: 'match',
            matchRuns: 1,
            failedRuns: 1,
            inputChars: resumeText.length + missionTitle.length + missionContent.length,
            metadata: { source: 'match-analysis', error: parseError.message }
        });
        throw new Error(normalizeUtf8Text('Le mod\u00e8le LLM a retourn\u00e9 une r\u00e9ponse invalide pour le matching. Veuillez r\u00e9essayer ou contacter le support si le probl\u00e8me persiste.'));
}
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
    userMetadata = null
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

    const systemPrompt = `You are an expert HR consultant specialized in CV adaptation. 
You must respond with a valid JSON object following the exact structure specified in the user prompt.
Do NOT wrap your response in markdown code blocks. Return ONLY the JSON object.
Respond in the same language as the resume.`;

    const metricsProvider = buildLLMMetricLabel(inferMetricsProvider(model), model);
    const inputChars = resumeText.length + missionTitle.length + missionContent.length;
    let response;
    try {
        response = await callBusinessChatCompletion({
            model,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: prompt }
            ],
            maxTokens: 8192,
            temperature: 0.4,
            timeout: 120000,
            responseFormat: { type: "json_object" },
            userMetadata,
            operationType: 'Resume Adaptation'
        });
    } catch (error) {
        metrics.trackAdaptationActivity({
            provider: metricsProvider,
            event: 'run',
            failedRuns: 1,
            inputChars,
            metadata: { source: 'adapt-provider-call', error: error.message }
        });
        throw error;
    }

    // Clean markdown code blocks if present
    const content = stripLlmThinkingContent(response.choices[0].message.content);
    
    // Parse the structured JSON response
    try {
        const parsed = validateAdaptationPayload(parseJsonFromLlmResponse(content));
        const result = buildAdaptationResult(parsed, content);
        metrics.trackAdaptationActivity({
            provider: metricsProvider,
            event: 'run',
            successfulRuns: 1,
            inputChars,
            ...result.tracking
        });
        return {
            adaptedText: result.adaptedText,
            adaptedTitle: result.adaptedTitle,
            ...(result.structuredData ? { structuredData: result.structuredData } : {})
        };
    } catch {
        // If JSON parsing fails, fall back to treating the whole content as adaptedText
        safeLog('warn', 'adaptResumeToMission: Could not parse JSON response, falling back to plain text');
    }
    metrics.trackAdaptationActivity({
        provider: metricsProvider,
        event: 'run',
        successfulRuns: 1,
        fallbackRuns: 1,
        inputChars,
        outputChars: content.length,
        metadata: { source: 'plain-text-fallback' }
    });
    
    return {
        adaptedText: content,
        adaptedTitle: null
    };
}



