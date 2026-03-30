/**
 * OpenAI Resume Operations
 * Resume analysis and improvement using OpenAI
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
import { cleanupHtml, normalizeUtf8Text, parseJsonFromLlmResponse, stripLlmThinkingContent } from './textUtils.js';
import {
    normalizeAnalysisResponse,
    extractImprovementEnvelope,
    buildImprovementAnalysisResult,
    buildEmptyImprovementAnalysis,
    finalizeImprovedOutput
} from './resumeNormalization.js';

function inferMetricsProvider(model) {
    if (isLikelyAnthropicModel(model)) return 'anthropic';
    if (isLikelyDeepSeekModel(model)) return 'deepseek';
    if (isLikelyGlmModel(model)) return 'glm';
    if (isLikelyMiniMaxModel(model)) return 'minimax';
    return 'openai';
}


export async function analyzeResume(resumeText, model, analysisPrompt, userMetadata = null, isImprovedCV = false, originalFileName = null) {
    let prompt = analysisPrompt.replace('{TEXT}', resumeText);
    
    if (originalFileName) {
        prompt = prompt.replace('{FILENAME}', originalFileName);
    } else {
        prompt = prompt.replace('{FILENAME}', 'Non disponible');
    }
    
    const systemMessage = 'You are a JSON-only resume analysis API. Respond with valid JSON only.';

    const response = await callBusinessChatCompletion({
        model,
        messages: [
            { role: 'system', content: systemMessage },
            { role: 'user', content: prompt }
        ],
        maxTokens: 16000,
        temperature: 0.3,
        responseFormat: { type: "json_object" },
        maxPromptLength: 120000,
        userMetadata,
        operationType: isImprovedCV ? 'Improved Resume Analysis' : 'Resume Analysis'
    });

    let rawAnalysis;
    try {
        rawAnalysis = parseJsonFromLlmResponse(response.choices[0].message.content);
    } catch (parseError) {
        safeLog('error', 'Failed to parse LLM analysis response as JSON', {
            error: parseError.message,
            responsePreview: response.choices[0].message.content.substring(0, 500)
        });
        throw new Error(normalizeUtf8Text('Le mod\u00e8le LLM a retourn\u00e9 une r\u00e9ponse invalide. Veuillez r\u00e9essayer ou contacter le support si le probl\u00e8me persiste.'));
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

export async function improveResume(text, analysis, model, improvementPromptTemplate, originalFileName = null, userMetadata = null) {
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

    let response;
    try {
        response = await callBusinessChatCompletion({
            model,
            messages: [
                { role: 'system', content: 'You are a professional resume improvement assistant. You MUST respond with valid JSON only, following the exact structure specified in the user prompt. Do not include any text outside the JSON object.' },
                { role: 'user', content: improvementPrompt }
            ],
            maxTokens: 16384,
            temperature: 0.3,
            responseFormat: { type: "json_object" },
            timeout: 300000,
            userMetadata,
            operationType: 'Resume Improvement'
        });
    } catch (error) {
        metrics.trackImprovementActivity({
            provider: metricsProvider,
            event: 'run',
            failedRuns: 1,
            inputChars: text.length,
            metadata: { source: 'provider-call', error: error.message }
        });
        throw error;
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
                    topLevelKeys: Object.keys(parsed || {}),
                    envelopeKeys: Object.keys(improvementPayload.envelope || {}),
                    hasTopLevelImprovedText: !!parsed.improvedText,
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
                metadata: { source: 'structured-json' }
            });

            safeLog('info', 'Parsed improvement result:', {
                hasText: !!result.text,
                textLength: result.text?.length,
                analysis: result.analysis
            });

            return result;
        } catch (parseError) {
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
                metadata: { source: 'structured-json', error: parseError.message }
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
        metadata: { source: 'plain-text-fallback' }
    });
    
    return {
        text: cleanedText,
        analysis: buildEmptyImprovementAnalysis()
    };
}


