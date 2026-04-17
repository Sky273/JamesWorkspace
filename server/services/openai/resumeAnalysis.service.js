import { safeLog } from '../../utils/logger.backend.js';
import { LLM_OPERATION_TIMEOUT_MS } from '../../config/constants.js';
import { callBusinessChatCompletion } from '../llmProvider.service.js';
import {
    normalizeUtf8Text,
    parseJsonFromLlmResponse,
    salvageResumeAnalysisFromTextDetailed
} from './textUtils.js';
import { normalizeAnalysisResponse } from './resumeNormalization.js';
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

function buildSalvageSourceEntries(initialContent, compactRetryContent, repairContent) {
    return [
        { source: 'repair', content: repairContent },
        { source: 'compact-retry', content: compactRetryContent },
        { source: 'initial', content: initialContent }
    ].filter(entry => typeof entry.content === 'string' && entry.content.trim());
}

export async function executeResumeAnalysis({
    model,
    prompt,
    userMetadata,
    operationType,
    requestedMaxTokens,
    resolveRemainingBudgetMs,
    inferMetricsProvider,
    originalParseOptions = {}
}) {
    const systemMessage = 'You are a JSON-only resume analysis API. Respond with valid JSON only.';

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
            responseFormat: { type: 'json_object' },
            timeout: resolveRemainingBudgetMs(originalParseOptions, LLM_OPERATION_TIMEOUT_MS, operationType),
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
            resolveRemainingBudgetMs(originalParseOptions, LLM_OPERATION_TIMEOUT_MS, operationType);
            response = await requestAnalysis({ compactRetry: true });
            compactRetryContent = getAssistantContent(response);
            rawAnalysis = parseJsonFromLlmResponse(compactRetryContent);
        } catch (compactRetryError) {
            const normalizedCompactRetryError = normalizeNonRetryableLlmProviderError(compactRetryError);
            if (normalizedCompactRetryError !== compactRetryError) {
                throw normalizedCompactRetryError;
            }
            if (compactRetryError?.code === 'LLM_ITEM_DEADLINE_EXCEEDED') {
                throw compactRetryError;
            }

            safeLog('warn', 'Resume analysis compact JSON retry failed, attempting JSON repair', {
                error: compactRetryError.message,
                operationType
            });

            try {
                resolveRemainingBudgetMs(originalParseOptions, LLM_OPERATION_TIMEOUT_MS, operationType);
                response = await requestAnalysis({ repairPayload: compactRetryContent || initialContent });
                repairContent = getAssistantContent(response);
                rawAnalysis = parseJsonFromLlmResponse(repairContent);
            } catch (error) {
                const normalizedError = normalizeNonRetryableLlmProviderError(error);
                if (normalizedError !== error) {
                    throw normalizedError;
                }
                if (error?.code === 'LLM_ITEM_DEADLINE_EXCEEDED') {
                    throw error;
                }

                const recoveredAnalysisAttempt = buildSalvageSourceEntries(initialContent, compactRetryContent, repairContent)
                    .map((entry) => ({
                        ...entry,
                        salvage: salvageResumeAnalysisFromTextDetailed(entry.content)
                    }))
                    .find((entry) => entry.salvage);

                if (recoveredAnalysisAttempt) {
                    const { source, content, salvage } = recoveredAnalysisAttempt;
                    safeLog('warn', 'Recovered resume analysis from non-JSON LLM output using loose-text salvage', {
                        operationType,
                        providerHint: inferMetricsProvider(model),
                        model,
                        salvageSource: source,
                        salvageDetectedStructure: salvage.metadata.detectedStructure,
                        initialError: parseError.message,
                        compactRetryError: compactRetryError.message,
                        repairError: error.message,
                        recoveredKeys: Object.keys(salvage.payload),
                        recoveredFields: salvage.metadata.recoveredFields,
                        missingFields: salvage.metadata.missingFields,
                        recoveredCounts: salvage.metadata.counts,
                        responsePreview: content.substring(0, 500)
                    });
                    rawAnalysis = salvage.payload;
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

    return normalizeAnalysisResponse(rawAnalysis);
}
