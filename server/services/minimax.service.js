/**
 * MiniMax Service
 * Supports MiniMax's OpenAI-compatible and Anthropic-compatible text APIs.
 */

import axios from 'axios';
import {
    MAX_PROMPT_LENGTH,
    MINIMAX_API_KEY,
    MINIMAX_ANTHROPIC_BASE_URL,
    MINIMAX_OPENAI_BASE_URL
} from '../config/constants.js';
import { buildLLMMetricLabel, metrics } from './metrics.service.js';
import { withRetry } from './retry.service.js';
import { safeLog } from '../utils/logger.backend.js';
import { validatePromptSize } from '../utils/postgresHelpers.js';
import { extractTextFromContentBlocks, flattenLlmTextContent } from './llmContent.service.js';
import { buildCapabilityAwareAnthropicOptions, buildCapabilityAwareOpenAICompatibleParams } from './llmPayloadCapabilities.service.js';
import { isMiniMaxHighspeedModel, markModelUnavailable } from './llmAvailability.service.js';

function truncateForLog(value, maxLength = 2000) {
    if (value == null) {
        return value;
    }

    const asString = typeof value === 'string' ? value : JSON.stringify(value);
    if (asString.length <= maxLength) {
        return asString;
    }

    return `${asString.slice(0, maxLength)}... [truncated]`;
}

function serializeMiniMaxErrorPayload(error) {
    return {
        status: error.response?.status,
        statusText: error.response?.statusText,
        responseHeaders: error.response?.headers || null,
        errorDetails: error.response?.data ?? null,
        errorPreview: truncateForLog(error.response?.data)
    };
}

function validateMiniMaxRequest(model, messages, maxPromptLength = MAX_PROMPT_LENGTH) {
    if (!MINIMAX_API_KEY) {
        throw new Error('MiniMax API key not configured on server');
    }

    if (!model) {
        throw new Error('Model is required');
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
        throw new Error('Messages array is required and must not be empty');
    }

    if (maxPromptLength) {
        const combinedPrompt = messages
            .map(message => flattenLlmTextContent(message?.content))
            .filter(Boolean)
            .join('\n');
        const promptValidation = validatePromptSize(combinedPrompt, maxPromptLength);
        if (!promptValidation.valid) {
            const error = new Error(promptValidation.error);
            error.estimatedTokens = promptValidation.estimatedTokens;
            throw error;
        }
    }
}

function extractMiniMaxOpenAIContent(payload = {}) {
    const choices = payload?.choices;
    if (!Array.isArray(choices) || choices.length === 0) {
        return '';
    }

    const message = choices[0]?.message || {};
    if (typeof message.content === 'string' && message.content.trim()) {
        return message.content;
    }

    if (Array.isArray(message.content)) {
        const text = message.content
            .map(item => {
                if (typeof item === 'string') {
                    return item;
                }
                if (item?.type === 'text' && typeof item.text === 'string') {
                    return item.text;
                }
                if (typeof item?.content === 'string') {
                    return item.content;
                }
                return '';
            })
            .filter(Boolean)
            .join('\n')
            .trim();
        if (text) {
            return text;
        }
    }

    return '';
}

async function _postToMiniMax(url, body, headers, timeout, operationType) {
    return withRetry(
        () => axios.post(url, body, {
            headers,
            timeout
        }),
        {
            serviceName: 'minimax',
            operationName: operationType,
            retryConfig: {
                maxRetries: 3,
                initialDelayMs: 2000,
                maxDelayMs: 60000
            }
        }
    );
}

async function postToMiniMaxWithoutRetry(url, body, headers, timeout) {
    return axios.post(url, body, {
        headers,
        timeout
    });
}

async function executeMiniMaxPost(url, body, headers, timeout, operationType, useRetry = true) {
    if (!useRetry) {
        return postToMiniMaxWithoutRetry(url, body, headers, timeout);
    }

    return withRetry(
        () => axios.post(url, body, {
            headers,
            timeout
        }),
        {
            serviceName: 'minimax',
            operationName: operationType,
            retryConfig: {
                maxRetries: 3,
                initialDelayMs: 2000,
                maxDelayMs: 60000
            }
        }
    );
}

function getMiniMaxStandardFallbackModel(model = '') {
    return isMiniMaxHighspeedModel(model) ? String(model).replace(/-highspeed$/i, '') : null;
}

function shouldFallbackFromMiniMaxHighspeed(error) {
    const status = error?.response?.status;
    return status === 500 || status === 403 || status === 401;
}

function persistMiniMaxRuntimeUnavailabilityInBackground(model, fallbackModel) {
    Promise.resolve(
        markModelUnavailable('minimax', model, 'minimax_highspeed_runtime_unavailable', fallbackModel)
    ).catch(persistenceError => {
        safeLog('error', 'Failed to persist MiniMax highspeed runtime unavailability', {
            model,
            fallbackModel,
            error: persistenceError.message
        });
    });
}

export async function callMiniMaxOpenAICompatible({
    model,
    messages,
    maxTokens = 4096,
    temperature = 0,
    topP = 1,
    responseFormat = null,
    timeout = 90000,
    maxPromptLength = MAX_PROMPT_LENGTH,
    operationType = 'MiniMax OpenAI-compatible request',
    useRetry = true,
    ...providerParameters
}) {
    validateMiniMaxRequest(model, messages, maxPromptLength);

    const executeRequest = async (effectiveModel) => {
        const normalized = buildCapabilityAwareOpenAICompatibleParams('minimax', effectiveModel, {
            parameters: providerParameters,
            maxTokens,
            temperature,
            topP,
            responseFormat,
            additionalParams: { messages },
            fallbackMaxTokens: 4096
        });

        if (normalized.droppedParams.length > 0) {
            safeLog('warn', 'Dropped unsupported MiniMax OpenAI-compatible params', {
                model: effectiveModel,
                operationType,
                droppedParams: normalized.droppedParams
            });
        }

        const response = await executeMiniMaxPost(
            `${MINIMAX_OPENAI_BASE_URL.replace(/\/$/, '')}/chat/completions`,
            normalized.requestParams,
            {
                Authorization: `Bearer ${MINIMAX_API_KEY}`,
                'Content-Type': 'application/json'
            },
            timeout,
            operationType,
            useRetry
        );

        const content = extractMiniMaxOpenAIContent(response.data);
        if (!content) {
            safeLog('error', 'MiniMax OpenAI-compatible response contained no usable text', {
                model,
                operationType,
                topLevelKeys: Object.keys(response.data || {})
            });
            throw new Error('MiniMax returned empty content');
        }

        const usage = response.data?.usage || {};
        const inputTokens = usage.input_tokens || usage.prompt_tokens || 0;
        const outputTokens = usage.output_tokens || usage.completion_tokens || 0;
        const totalTokens = usage.total_tokens || (inputTokens + outputTokens);
        metrics.trackLLMRequest(buildLLMMetricLabel('minimax', response.data?.model || effectiveModel), totalTokens, true, inputTokens, outputTokens);

        return {
            content,
            model: effectiveModel,
            actualModel: response.data?.model || effectiveModel,
            usage,
            raw: response.data
        };
    };

    try {
        return await executeRequest(model);
    } catch (error) {
        const fallbackModel = getMiniMaxStandardFallbackModel(model);
        if (fallbackModel && shouldFallbackFromMiniMaxHighspeed(error)) {
            persistMiniMaxRuntimeUnavailabilityInBackground(model, fallbackModel);
            safeLog('warn', 'MiniMax highspeed model failed, retrying with standard variant', {
                model,
                fallbackModel,
                operationType,
                ...serializeMiniMaxErrorPayload(error)
            });
            try {
                return await executeRequest(fallbackModel);
            } catch (fallbackError) {
                metrics.trackLLMRequest(buildLLMMetricLabel('minimax', fallbackModel), 0, false, 0, 0);
                throw fallbackError;
            }
        }
        metrics.trackLLMRequest(buildLLMMetricLabel('minimax', model), 0, false, 0, 0);
        safeLog('error', 'MiniMax OpenAI-compatible API call failed', {
            model,
            operationType,
            url: `${MINIMAX_OPENAI_BASE_URL.replace(/\/$/, '')}/chat/completions`,
            error: error.message,
            ...serializeMiniMaxErrorPayload(error)
        });
        throw error;
    }
}

export async function callMiniMaxAnthropicCompatible({
    model,
    messages,
    maxTokens = 4096,
    temperature = 0,
    topP = 1,
    timeout = 90000,
    maxPromptLength = MAX_PROMPT_LENGTH,
    operationType = 'MiniMax Anthropic-compatible request',
    useRetry = true,
    ...providerParameters
}) {
    validateMiniMaxRequest(model, messages, maxPromptLength);

    const systemMessage = messages.find(message => message.role === 'system');
    const conversationMessages = messages
        .filter(message => message.role !== 'system')
        .map(message => ({
            role: message.role,
            content: typeof message.content === 'string'
                ? [{ type: 'text', text: message.content }]
                : message.content
        }));

    const executeRequest = async (effectiveModel) => {
        const normalized = buildCapabilityAwareAnthropicOptions('minimax', effectiveModel, {
            parameters: providerParameters,
            maxTokens,
            temperature,
            topP,
            fallbackMaxTokens: 4096
        });

        const requestBody = {
            model: effectiveModel,
            messages: conversationMessages,
            max_tokens: normalized.effectiveMaxTokens
        };
        Object.assign(requestBody, normalized.requestParams);
        requestBody.max_tokens = normalized.effectiveMaxTokens;

        if (systemMessage?.content) {
            requestBody.system = systemMessage.content;
        }

        if (normalized.droppedParams.length > 0) {
            safeLog('warn', 'Dropped unsupported MiniMax Anthropic-compatible params', {
                model: effectiveModel,
                operationType,
                droppedParams: normalized.droppedParams
            });
        }

        const response = await executeMiniMaxPost(
            `${MINIMAX_ANTHROPIC_BASE_URL.replace(/\/$/, '')}/v1/messages`,
            requestBody,
            {
                'x-api-key': MINIMAX_API_KEY,
                'anthropic-version': '2023-06-01',
                'Content-Type': 'application/json'
            },
            timeout,
            operationType,
            useRetry
        );

        const content = extractTextFromContentBlocks(response.data?.content);
        if (!content) {
            safeLog('error', 'MiniMax Anthropic-compatible response contained no usable text', {
                model,
                operationType,
                topLevelKeys: Object.keys(response.data || {})
            });
            throw new Error('MiniMax returned empty content');
        }

        const usage = response.data?.usage || {};
        const inputTokens = usage.input_tokens || 0;
        const outputTokens = usage.output_tokens || 0;
        const totalTokens = usage.total_tokens || (inputTokens + outputTokens);
        metrics.trackLLMRequest(buildLLMMetricLabel('minimax', response.data?.model || effectiveModel), totalTokens, true, inputTokens, outputTokens);

        return {
            content,
            model: effectiveModel,
            actualModel: response.data?.model || effectiveModel,
            usage,
            raw: response.data
        };
    };

    try {
        return await executeRequest(model);
    } catch (error) {
        const fallbackModel = getMiniMaxStandardFallbackModel(model);
        if (fallbackModel && shouldFallbackFromMiniMaxHighspeed(error)) {
            persistMiniMaxRuntimeUnavailabilityInBackground(model, fallbackModel);
            safeLog('warn', 'MiniMax highspeed model failed on Anthropic-compatible route, retrying with standard variant', {
                model,
                fallbackModel,
                operationType,
                ...serializeMiniMaxErrorPayload(error)
            });
            try {
                return await executeRequest(fallbackModel);
            } catch (fallbackError) {
                metrics.trackLLMRequest(buildLLMMetricLabel('minimax', fallbackModel), 0, false, 0, 0);
                throw fallbackError;
            }
        }
        metrics.trackLLMRequest(buildLLMMetricLabel('minimax', model), 0, false, 0, 0);
        safeLog('error', 'MiniMax Anthropic-compatible API call failed', {
            model,
            operationType,
            url: `${MINIMAX_ANTHROPIC_BASE_URL.replace(/\/$/, '')}/v1/messages`,
            error: error.message,
            ...serializeMiniMaxErrorPayload(error)
        });
        throw error;
    }
}
