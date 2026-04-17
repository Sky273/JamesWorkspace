import { safeLog } from '../../utils/logger.backend.js';
import { callBusinessChatCompletion } from '../llmProvider.service.js';
import { metrics } from '../metrics.service.js';
import { normalizeUtf8Text, parseJsonFromLlmResponse } from './textUtils.js';
import { validateMatchAnalysisPayload } from './contracts.js';
import { normalizeMatchAnalysis } from './missionNormalization.js';

function isRecoverableMatchingJsonError(error) {
    const message = error?.message || '';
    return message.includes('Unexpected end of JSON input')
        || message.includes('Unterminated string in JSON')
        || message.includes('response truncated due to token limit');
}

export async function executeMissionMatchAnalysis({
    prompt,
    model,
    options = {},
    userMetadata = null,
    metricsProvider,
    inputChars
}) {
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
            maxTokens: options.maxTokens ?? 4096,
            temperature: 0.3,
            responseFormat: { type: 'json_object' },
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
            inputChars,
            metadata: { source: 'match-provider-call', error: error.message, ...(userMetadata?.promptMetadata || {}) }
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
            inputChars,
            outputChars: JSON.stringify(rawAnalysis).length,
            metadata: { source: 'match-analysis', ...(userMetadata?.promptMetadata || {}) }
        });
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
                metadata: { source: 'match-analysis-retry', error: parseError.message, ...(userMetadata?.promptMetadata || {}) }
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
                    inputChars,
                    outputChars: JSON.stringify(rawAnalysis).length,
                    metadata: { source: 'match-analysis-retry-success', ...(userMetadata?.promptMetadata || {}) }
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
            inputChars,
            metadata: { source: 'match-analysis', error: parseError.message, ...(userMetadata?.promptMetadata || {}) }
        });
        throw new Error(normalizeUtf8Text('Le modèle LLM a retourné une réponse invalide pour le matching. Veuillez réessayer ou contacter le support si le problème persiste.'));
    }
}
