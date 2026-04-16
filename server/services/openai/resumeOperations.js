/**
 * OpenAI Resume Operations
 * Resume analysis and improvement using OpenAI
 */

import { safeLog } from '../../utils/logger.backend.js';
import { LLM_OPERATION_TIMEOUT_MS } from '../../config/constants.js';
import { callBusinessChatCompletion } from '../llmProvider.service.js';
import { metrics, buildLLMMetricLabel } from '../metrics.service.js';
import {
    isLikelyAnthropicModel,
    isLikelyDeepSeekModel,
    isLikelyHuggingFaceModel,
    isLikelyGlmModel,
    isLikelyMiniMaxModel
} from '../llmConfiguration.service.js';
import { cleanupHtml, normalizeUtf8Text, parseJsonFromLlmResponse, salvageResumeAnalysisFromText, stripLlmThinkingContent } from './textUtils.js';
import {
    normalizeAnalysisResponse,
    extractImprovementEnvelope,
    buildImprovementAnalysisResult,
    buildEmptyImprovementAnalysis,
    finalizeImprovedOutput
} from './resumeNormalization.js';
import { normalizeNonRetryableLlmProviderError } from '../llmGateway.service.js';

function inferMetricsProvider(model) {
    if (isLikelyAnthropicModel(model)) return 'anthropic';
    if (isLikelyDeepSeekModel(model)) return 'deepseek';
    if (isLikelyHuggingFaceModel(model)) return 'huggingface';
    if (isLikelyGlmModel(model)) return 'glm';
    if (isLikelyMiniMaxModel(model)) return 'minimax';
    return 'openai';
}

function isRecoverableStructuredJsonError(error) {
    const message = error?.message || '';
    return message.includes('Unexpected end of JSON input')
        || message.includes('Unterminated string in JSON')
        || message.includes('response truncated due to token limit')
        || message.includes("Expected ',' or '}' after property value")
        || message.includes('Expected property name or')
        || message.includes('Unexpected token');
}

function getAssistantContent(response) {
    return response?.choices?.[0]?.message?.content || '';
}

function buildJsonRepairPrompt(invalidPayload, operationType) {
    const truncatedPayload = String(invalidPayload || '').slice(0, 12000);
    return [
        `The following ${operationType} response was supposed to be valid JSON but is malformed.`,
        'Repair it into a valid compact JSON object only.',
        'Preserve the original meaning when possible.',
        'If a field is clearly incomplete or corrupted, omit it instead of inventing data.',
        '',
        truncatedPayload
    ].join('\n');
}

export async function analyzeResume(resumeText, model, analysisPrompt, userMetadata = null, isImprovedCV = false, originalFileName = null, options = {}) {
    let prompt = analysisPrompt.replace('{TEXT}', resumeText);
    
    if (originalFileName) {
        prompt = prompt.replace('{FILENAME}', originalFileName);
    } else {
        prompt = prompt.replace('{FILENAME}', 'Non disponible');
    }
    
    const systemMessage = 'You are a JSON-only resume analysis API. Respond with valid JSON only.';
    const operationType = isImprovedCV ? 'Improved Resume Analysis' : 'Resume Analysis';
    const requestedMaxTokens = Number.isFinite(options.maxTokens) ? options.maxTokens : undefined;

    async function requestAnalysis({ compactRetry = false, repairPayload = null } = {}) {
        const userContent = repairPayload
            ? buildJsonRepairPrompt(repairPayload, operationType)
            : compactRetry
                ? `${prompt}\n\nReturn compact JSON only. Keep string fields concise. No markdown. No commentary outside the JSON object.`
                : prompt;

        return callBusinessChatCompletion({
            model,
            messages: [
                { role: 'system', content: systemMessage },
                {
                    role: 'user',
                    content: userContent
                }
            ],
            ...(repairPayload
                ? (requestedMaxTokens !== undefined ? { maxTokens: Math.min(requestedMaxTokens, 4000) } : {})
                : (requestedMaxTokens !== undefined ? { maxTokens: requestedMaxTokens } : {})),
            temperature: 0,
            responseFormat: { type: "json_object" },
            maxPromptLength: 120000,
            userMetadata,
            operationType
        });
    }

    let response;
    let initialContent = '';
    let compactRetryContent = '';
    let repairContent = '';
    try {
        response = await requestAnalysis();
        initialContent = getAssistantContent(response);
    } catch (error) {
        throw normalizeNonRetryableLlmProviderError(error);
    }

    let rawAnalysis;
    try {
        rawAnalysis = parseJsonFromLlmResponse(initialContent);
    } catch (parseError) {
        safeLog('warn', 'Resume analysis returned malformed JSON', {
            error: parseError.message,
            operationType,
            recoverable: isRecoverableStructuredJsonError(parseError)
        });

        try {
            response = await requestAnalysis({ compactRetry: true });
            compactRetryContent = getAssistantContent(response);
            rawAnalysis = parseJsonFromLlmResponse(compactRetryContent);
        } catch (compactRetryError) {
            const normalizedCompactRetryError = normalizeNonRetryableLlmProviderError(compactRetryError);
            if (normalizedCompactRetryError !== compactRetryError) {
                throw normalizedCompactRetryError;
            }

            safeLog('warn', 'Resume analysis compact JSON retry failed, attempting JSON repair', {
                error: compactRetryError.message,
                operationType
            });

            try {
                response = await requestAnalysis({ repairPayload: compactRetryContent || initialContent });
                repairContent = getAssistantContent(response);
                rawAnalysis = parseJsonFromLlmResponse(repairContent);
            } catch (error) {
                const normalizedError = normalizeNonRetryableLlmProviderError(error);
                if (normalizedError !== error) {
                    throw normalizedError;
                }

                const recoveredAnalysis = [
                    repairContent,
                    compactRetryContent,
                    initialContent
                ]
                    .map(candidate => salvageResumeAnalysisFromText(candidate))
                    .find(Boolean);

                if (recoveredAnalysis) {
                    safeLog('warn', 'Recovered resume analysis from non-JSON LLM output using loose-text salvage', {
                        operationType,
                        initialError: parseError.message,
                        compactRetryError: compactRetryError.message,
                        repairError: error.message,
                        recoveredKeys: Object.keys(recoveredAnalysis)
                    });
                    rawAnalysis = recoveredAnalysis;
                    return normalizeAnalysisResponse(rawAnalysis);
                }

                safeLog('error', 'Failed to recover malformed LLM analysis response', {
                    initialError: parseError.message,
                    compactRetryError: compactRetryError.message,
                    repairError: error.message,
                    responsePreview: (repairContent || compactRetryContent || initialContent).substring(0, 500)
                });

                throw new Error(normalizeUtf8Text('Le modèle LLM a retourné une réponse invalide. Veuillez réessayer ou contacter le support si le problème persiste.'));
            }
        }
    }
    
    safeLog('debug', 'Raw analysis from LLM', {
        allKeys: Object.keys(rawAnalysis),
        hasTags: !!rawAnalysis.tags,
        tagsContent: rawAnalysis.tags,
        hasTopSkills: !!rawAnalysis['Top Skills'],
        topSkillsContent: rawAnalysis['Top Skills'],
        hasSkills: !!rawAnalysis.skills,
        skillsContent: rawAnalysis.skills
    });
    
    const normalized = normalizeAnalysisResponse(rawAnalysis);
    
    safeLog('debug', 'Normalized analysis', {
        hasTags: !!normalized.tags,
        tagsSkillsCount: normalized.tags?.skills?.length || 0,
        tagsIndustriesCount: normalized.tags?.industries?.length || 0,
        tagsToolsCount: normalized.tags?.tools?.length || 0,
        tagsSoftSkillsCount: normalized.tags?.softSkills?.length || 0,
        tagsSkillsPreview: normalized.tags?.skills?.slice(0, 3),
        tagsToolsPreview: normalized.tags?.tools?.slice(0, 3),
        suggestionKeys: Object.keys(normalized.suggestions || {}),
        suggestionCounts: Object.fromEntries(Object.entries(normalized.suggestions || {}).map(([key, value]) => [key, Array.isArray(value) ? value.length : 0]))
    });
    
    return normalized;
}

export async function preAnalyzeResumeText(text, model, preAnalysisPrompt, userMetadata = null, originalFileName = null, options = {}) {
    const prompt = preAnalysisPrompt
        .replace(/{TEXT}/g, text)
        .replace(/{FILENAME}/g, originalFileName || 'Non disponible');

    const response = await callBusinessChatCompletion({
        model,
        messages: [
            {
                role: 'system',
                content: 'You clean and minimally structure extracted resume text. Respond with plain Markdown text only.'
            },
            {
                role: 'user',
                content: prompt
            }
        ],
        maxTokens: options.maxTokens ?? 12000,
        temperature: 0,
        timeout: 20 * 60 * 1000,
        maxPromptLength: 120000,
        userMetadata,
        operationType: 'Resume Pre-Analysis'
    });

    const content = normalizeUtf8Text(stripLlmThinkingContent(response.choices?.[0]?.message?.content || ''));
    return content.trim();
}

export async function improveResume(text, analysis, model, improvementPromptTemplate, originalFileName = null, userMetadata = null, options = {}) {
    const analysisJson = JSON.stringify(analysis, null, 2);
    const fileNameValue = originalFileName || 'Non disponible';
    const improvementPrompt = improvementPromptTemplate
        .replace(/{ANALYSIS}/g, analysisJson)
        .replace(/{analysis}/g, analysisJson)
        .replace(/{TEXT}/g, text)
        .replace(/{text}/g, text)
        .replace(/{FILENAME}/g, fileNameValue)
        .replace(/{filename}/g, fileNameValue);

    if (process.env.NODE_ENV === 'development' || process.env.DEBUG_LLM === 'true') {
        safeLog('debug', '========== LLM IMPROVEMENT PROMPT DEBUG ==========');
        safeLog('debug', 'Model:', { model });
        safeLog('debug', 'Prompt length:', { length: improvementPrompt.length });
        safeLog('debug', '--- FULL PROMPT ---');
        safeLog('debug', improvementPrompt);
        safeLog('debug', '--- END PROMPT ---');
    }

    if (!text || text.trim().length < 100) {
        safeLog('error', 'Improvement input text too short', { 
            textLength: text?.length || 0,
            minRequired: 100
        });
        throw new Error(normalizeUtf8Text('Le texte du CV est trop court pour \u00eatre am\u00e9lior\u00e9 (minimum 100 caract\u00e8res).'));
}

    const metricsProvider = buildLLMMetricLabel(inferMetricsProvider(model), model);
    async function requestImprovement(compactRetry = false) {
        return callBusinessChatCompletion({
            model,
            messages: [
                { role: 'system', content: 'You are a professional resume improvement assistant. You MUST respond with valid JSON only, following the exact structure specified in the user prompt. Do not include any text outside the JSON object.' },
                {
                    role: 'user',
                    content: compactRetry
                        ? `${improvementPrompt}\n\nReturn compact JSON only. Keep string fields concise. Preserve the same JSON structure. No markdown.`
                        : improvementPrompt
                }
            ],
            maxTokens: options.maxTokens ?? 16384,
            temperature: 0.3,
            responseFormat: { type: "json_object" },
            timeout: LLM_OPERATION_TIMEOUT_MS,
            userMetadata,
            operationType: 'Resume Improvement'
        });
    }

    let response;
    try {
        response = await requestImprovement(false);
    } catch (error) {
        metrics.trackImprovementActivity({
            provider: metricsProvider,
            event: 'run',
            failedRuns: 1,
            inputChars: text.length,
            metadata: { source: 'provider-call', error: error.message, ...(userMetadata?.promptMetadata || {}) }
        });
        throw normalizeNonRetryableLlmProviderError(error);
    }

    const rawContent = stripLlmThinkingContent(response.choices[0].message.content);

    safeLog('info', 'LLM Improvement raw response preview:', { 
        isJSON: rawContent.startsWith('{'),
        hasImprovedText: rawContent.includes('"improvedText"'),
        hasImprovedCv: rawContent.includes('"improvedCV"'),
        preview: rawContent.substring(0, 300)
    });

    if (rawContent.startsWith('{')) {
        try {
            const improvementPayload = extractImprovementEnvelope(parseJsonFromLlmResponse(rawContent));
            const cleanedText = cleanupHtml(improvementPayload.improvedText || '');

            if (!cleanedText || cleanedText.trim().length === 0) {
                safeLog('error', 'LLM returned empty improved text in JSON response', {
                    topLevelKeys: Object.keys(improvementPayload.parsed || {}),
                    envelopeKeys: Object.keys(improvementPayload.envelope || {}),
                    hasTopLevelImprovedText: !!improvementPayload.parsed?.improvedText,
                    hasEnvelopeImprovedText: !!improvementPayload.envelope?.improvedText,
                    hasEnvelopeStructuredText: !!improvementPayload.envelope?.structuredText,
                    improvedTextLength: improvementPayload.improvedText?.length || 0,
                    cleanedTextLength: cleanedText?.length || 0
                });
                throw new Error(normalizeUtf8Text('Le mod\u00e8le LLM a retourn\u00e9 un CV am\u00e9lior\u00e9 vide. Veuillez r\u00e9essayer.'));
}

            const result = {
                text: cleanedText,
                analysis: buildImprovementAnalysisResult(improvementPayload, analysis)
            };

            metrics.trackImprovementActivity({
                provider: metricsProvider,
                event: 'run',
                successfulRuns: 1,
                structuredRuns: 1,
                inputChars: text.length,
                outputChars: cleanedText.length,
                metadata: { source: 'structured-json', ...(userMetadata?.promptMetadata || {}) }
            });

            safeLog('info', 'Parsed improvement result:', {
                hasText: !!result.text,
                textLength: result.text?.length,
                analysis: result.analysis
            });

            return result;
        } catch (parseError) {
            if (isRecoverableStructuredJsonError(parseError)) {
                safeLog('warn', 'Resume improvement returned malformed JSON, retrying once with compact JSON instructions', {
                    error: parseError.message,
                    model
                });

                try {
                    response = await requestImprovement(true);
                    const retriedRawContent = stripLlmThinkingContent(response.choices[0].message.content);
                    const improvementPayload = extractImprovementEnvelope(parseJsonFromLlmResponse(retriedRawContent));
                    const cleanedText = cleanupHtml(improvementPayload.improvedText || '');

                    if (!cleanedText || cleanedText.trim().length === 0) {
                        throw new Error(normalizeUtf8Text('Le mod\u00e8le LLM a retourn\u00e9 un CV am\u00e9lior\u00e9 vide. Veuillez r\u00e9essayer.'));
                    }

                    const result = {
                        text: cleanedText,
                        analysis: buildImprovementAnalysisResult(improvementPayload, analysis)
                    };

                    metrics.trackImprovementActivity({
                        provider: metricsProvider,
                        event: 'run',
                        successfulRuns: 1,
                        structuredRuns: 1,
                        inputChars: text.length,
                        outputChars: cleanedText.length,
                        metadata: { source: 'structured-json-retry-success', ...(userMetadata?.promptMetadata || {}) }
                    });

                    return result;
                } catch (retryError) {
                    const normalizedRetryError = normalizeNonRetryableLlmProviderError(retryError);
                    if (normalizedRetryError !== retryError) {
                        throw normalizedRetryError;
                    }
                    safeLog('error', 'Resume improvement retry failed', {
                        error: retryError.message,
                        model
                    });
                }
            }

            safeLog('error', 'Failed to parse LLM improvement response as JSON', {
                error: parseError.message,
                model,
                responsePreview: rawContent.substring(0, 500)
            });
            metrics.trackImprovementActivity({
                provider: metricsProvider,
                event: 'run',
                failedRuns: 1,
                inputChars: text.length,
                metadata: { source: 'structured-json', error: parseError.message, ...(userMetadata?.promptMetadata || {}) }
            });
            throw new Error(normalizeUtf8Text("Le mod\u00e8le LLM a retourn\u00e9 une r\u00e9ponse JSON invalide pour l'am\u00e9lioration. Veuillez r\u00e9essayer ou contacter le support si le probl\u00e8me persiste."));
}
    }

    const cleanedText = finalizeImprovedOutput({
        sourceText: text,
        selectedText: rawContent,
        context: { fallback: true }
    });
    
    if (!cleanedText || cleanedText.trim().length === 0) {
        safeLog('error', 'LLM returned empty content in fallback (non-JSON) response', {
            rawContentLength: rawContent?.length || 0,
            cleanedTextLength: cleanedText?.length || 0,
            rawContentPreview: rawContent?.substring(0, 200)
        });
        throw new Error(normalizeUtf8Text('Le mod\u00e8le LLM a retourn\u00e9 une r\u00e9ponse vide. Veuillez r\u00e9essayer.'));
}

    metrics.trackImprovementActivity({
        provider: metricsProvider,
        event: 'run',
        successfulRuns: 1,
        fallbackRuns: 1,
        inputChars: text.length,
        outputChars: cleanedText.length,
        metadata: { source: 'plain-text-fallback', ...(userMetadata?.promptMetadata || {}) }
    });
    
    return {
        text: cleanedText,
        analysis: buildEmptyImprovementAnalysis()
    };
}


