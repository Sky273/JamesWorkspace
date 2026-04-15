import axios from 'axios';
import { GEMINI_API_KEY, GEMINI_OPENAI_BASE_URL, LLM_OPERATION_TIMEOUT_MS } from '../config/constants.js';
import { buildCapabilityAwareOpenAICompatibleParams } from './llmPayloadCapabilities.service.js';
import { buildLLMMetricLabel, metrics } from './metrics.service.js';
import { safeLog } from '../utils/logger.backend.js';
import { validatePromptSize } from '../utils/postgresHelpers.js';
import { securityLog, LOG_LEVELS, SECURITY_EVENTS } from './security.service.js';
import { withRetry } from './retry.service.js';
import { flattenLlmTextContent, sanitizeOpenAICompatibleResponseBody } from './llmContent.service.js';
import { clampModelMaxOutputTokens } from './llmModelCapabilities.service.js';
import { markModelUnavailable } from './llmAvailability.service.js';
import { normalizeModelForProvider } from './llmConfiguration.service.js';

const GEMMA_CHAT_API_PATH = '/chat/completions';

function normalizeGemmaErrorString(value) {
    return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function summarizeGemmaProviderPayload(responseData) {
    if (responseData === null || responseData === undefined) {
        return '';
    }

    if (typeof responseData === 'string') {
        return responseData.trim();
    }

    try {
        const serialized = JSON.stringify(responseData);
        if (!serialized) {
            return '';
        }

        return serialized.length > 600
            ? `${serialized.slice(0, 600)}...`
            : serialized;
    } catch {
        return '';
    }
}

function summarizeGemmaProviderDetails(responseData) {
    const rawDetails = responseData?.error?.details;

    if (typeof rawDetails === 'string' && rawDetails.trim()) {
        return rawDetails.trim();
    }

    if (Array.isArray(rawDetails)) {
        return rawDetails
            .map((detail) => {
                if (typeof detail === 'string' && detail.trim()) {
                    return detail.trim();
                }
                if (detail && typeof detail === 'object') {
                    if (typeof detail.message === 'string' && detail.message.trim()) {
                        return detail.message.trim();
                    }
                    if (typeof detail.reason === 'string' && detail.reason.trim()) {
                        return detail.reason.trim();
                    }
                }
                return '';
            })
            .filter(Boolean)
            .join(' | ');
    }

    return '';
}

function getGemmaProviderErrorMessage(responseData, fallback = 'Gemma API error') {
    const directErrorMessage = normalizeGemmaErrorString(responseData?.error?.message);
    if (directErrorMessage) {
        return directErrorMessage;
    }

    const nestedErrorString = normalizeGemmaErrorString(responseData?.error);
    if (nestedErrorString && nestedErrorString.toLowerCase() !== 'gemma api error') {
        return nestedErrorString;
    }

    const topLevelMessage = normalizeGemmaErrorString(responseData?.message);
    if (topLevelMessage && topLevelMessage.toLowerCase() !== 'gemma api error') {
        return topLevelMessage;
    }

    const providerDetails = summarizeGemmaProviderDetails(responseData);
    if (providerDetails) {
        return providerDetails;
    }

    const providerPayload = summarizeGemmaProviderPayload(responseData);
    if (providerPayload && providerPayload.toLowerCase() !== 'gemma api error') {
        return `Gemma API error: ${providerPayload}`;
    }

    return fallback;
}

function shouldMarkGemmaModelUnavailable(error) {
    const status = error?.response?.status;
    const message = String(error?.response?.data?.error?.message || error?.message || '').toLowerCase();

    return status === 403
        || status === 404
        || ((status === 400 || status === 422) && (
            message.includes('model')
            && (message.includes('not found') || message.includes('not supported') || message.includes('permission') || message.includes('access'))
        ));
}

export async function callGemmaChat({
    model,
    messages,
    maxTokens = 4096,
    temperature = 0,
    topP = 1,
    responseFormat = null,
    timeout = LLM_OPERATION_TIMEOUT_MS,
    maxPromptLength,
    userMetadata = null,
    operationType = 'Gemma chat request',
    ...providerParameters
}) {
    if (!GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY not configured on server');
    }

    if (!model) {
        throw new Error('Model is required');
    }

    const resolvedModel = normalizeModelForProvider('gemma', model);

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
        throw new Error('Messages array is required and must not be empty');
    }

    const { requestedMaxTokens, effectiveMaxTokens, providerCap } = clampModelMaxOutputTokens('gemma', resolvedModel, maxTokens, 4096);
    if (providerCap && effectiveMaxTokens !== requestedMaxTokens) {
        safeLog('warn', 'Clamped Gemma max tokens to model limit', {
            model: resolvedModel,
            requestedMaxTokens,
            effectiveMaxTokens,
            providerCap
        });
    }

    if (maxPromptLength) {
        const combinedPrompt = messages.map(message => flattenLlmTextContent(message.content)).join('\n');
        const promptValidation = validatePromptSize(combinedPrompt, maxPromptLength);
        if (!promptValidation.valid) {
            const error = new Error(promptValidation.error);
            error.estimatedTokens = promptValidation.estimatedTokens;
            throw error;
        }
    }

    securityLog(LOG_LEVELS.INFO, SECURITY_EVENTS.LLM_REQUEST, {
        email: userMetadata?.email || 'system',
        ip: userMetadata?.ip || 'internal',
        action: userMetadata?.action || 'POST /gemma-service',
        message: operationType,
        metadata: {
            model: resolvedModel,
            messageCount: messages.length,
            maxTokens: effectiveMaxTokens
        }
    });

    const normalized = buildCapabilityAwareOpenAICompatibleParams('gemma', resolvedModel, {
        parameters: providerParameters,
        maxTokens: effectiveMaxTokens,
        temperature,
        topP,
        responseFormat,
        additionalParams: { messages },
        fallbackMaxTokens: 4096
    });

    const endpoint = `${GEMINI_OPENAI_BASE_URL.replace(/\/$/, '')}${GEMMA_CHAT_API_PATH}`;

    try {
        const response = await withRetry(
            () => axios.post(endpoint, normalized.requestParams, {
                headers: {
                    Authorization: `Bearer ${GEMINI_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                timeout,
                validateStatus: status => status < 500
            }),
            {
                serviceName: 'gemma',
                operationName: operationType,
                retryConfig: {
                    maxRetries: 2,
                    initialDelayMs: 2000,
                    maxDelayMs: 30000
                }
            }
        );

        if (response.status >= 400) {
            const error = new Error(getGemmaProviderErrorMessage(response.data));
            error.response = response;
            error.providerErrorDetails = summarizeGemmaProviderDetails(response.data);
            error.providerPayload = summarizeGemmaProviderPayload(response.data);
            throw error;
        }

        const usage = response.data?.usage || {};
        const inputTokens = usage.prompt_tokens || usage.input_tokens || 0;
        const outputTokens = usage.completion_tokens || usage.output_tokens || 0;
        const totalTokens = usage.total_tokens || (inputTokens + outputTokens);
        metrics.trackLLMRequest(buildLLMMetricLabel('gemma', resolvedModel), totalTokens, true, inputTokens, outputTokens);

        return sanitizeOpenAICompatibleResponseBody(response.data);
    } catch (error) {
        metrics.trackLLMRequest(buildLLMMetricLabel('gemma', resolvedModel), 0, false, 0, 0);
        if (shouldMarkGemmaModelUnavailable(error)) {
            void markModelUnavailable('gemma', resolvedModel, 'provider_model_access_denied', null);
        }
        safeLog('error', 'Gemma API call failed', {
            model: resolvedModel,
            error: error.message,
            status: error?.response?.status,
            providerError: getGemmaProviderErrorMessage(error?.response?.data, error.message),
            providerDetails: summarizeGemmaProviderDetails(error?.response?.data),
            providerPayload: summarizeGemmaProviderPayload(error?.response?.data)
        });
        throw error;
    }
}
