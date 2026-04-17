import { safeLog } from '../../utils/logger.backend.js';
import { LLM_OPERATION_TIMEOUT_MS } from '../../config/constants.js';
import { callBusinessChatCompletion } from '../llmProvider.service.js';
import { metrics } from '../metrics.service.js';
import { cleanupHtml, normalizeUtf8Text, parseJsonFromLlmResponse, stripLlmThinkingContent } from './textUtils.js';
import {
    extractImprovementEnvelope,
    buildImprovementAnalysisResult,
    buildEmptyImprovementAnalysis,
    finalizeImprovedOutput
} from './resumeNormalization.js';
import { normalizeNonRetryableLlmProviderError } from '../llmGateway.service.js';

function isRecoverableStructuredJsonError(error) {
    const message = error?.message || '';
    return message.includes('Unexpected end of JSON input')
        || message.includes('Unterminated string in JSON')
        || message.includes('response truncated due to token limit')
        || message.includes("Expected ',' or '}' after property value")
        || message.includes('Expected property name or')
        || message.includes('Unexpected token');
}

export async function executeResumeImprovement({
    text,
    analysis,
    model,
    improvementPrompt,
    userMetadata,
    options = {},
    metricsProvider,
    resolveRemainingBudgetMs,
    isDeadlineExceededError
}) {
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
            responseFormat: { type: 'json_object' },
            timeout: resolveRemainingBudgetMs(options, LLM_OPERATION_TIMEOUT_MS, 'Resume Improvement'),
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
                throw new Error(normalizeUtf8Text('Le modèle LLM a retourné un CV amélioré vide. Veuillez réessayer.'));
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
                    resolveRemainingBudgetMs(options, LLM_OPERATION_TIMEOUT_MS, 'Resume Improvement');
                    response = await requestImprovement(true);
                    const retriedRawContent = stripLlmThinkingContent(response.choices[0].message.content);
                    const improvementPayload = extractImprovementEnvelope(parseJsonFromLlmResponse(retriedRawContent));
                    const cleanedText = cleanupHtml(improvementPayload.improvedText || '');

                    if (!cleanedText || cleanedText.trim().length === 0) {
                        throw new Error(normalizeUtf8Text('Le modèle LLM a retourné un CV amélioré vide. Veuillez réessayer.'));
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
                    if (isDeadlineExceededError(retryError)) {
                        throw retryError;
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
            throw new Error(normalizeUtf8Text("Le modèle LLM a retourné une réponse JSON invalide pour l'amélioration. Veuillez réessayer ou contacter le support si le problème persiste."));
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
        throw new Error(normalizeUtf8Text('Le modèle LLM a retourné une réponse vide. Veuillez réessayer.'));
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
