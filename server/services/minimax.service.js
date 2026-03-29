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
import { buildOpenAICompatibleParams } from './llmProviderCommon.service.js';

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

async function postToMiniMax(url, body, headers, timeout, operationType) {
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

export async function callMiniMaxOpenAICompatible({
    model,
    messages,
    maxTokens = 4096,
    temperature = 0,
    topP = 1,
    responseFormat = null,
    timeout = 90000,
    maxPromptLength = MAX_PROMPT_LENGTH,
    operationType = 'MiniMax OpenAI-compatible request'
}) {
    validateMiniMaxRequest(model, messages, maxPromptLength);

    const requestParams = buildOpenAICompatibleParams(model, {
        maxTokens,
        temperature,
        topP,
        additionalParams: {
            messages,
            ...(responseFormat && { response_format: responseFormat })
        }
    });

    try {
        const response = await postToMiniMax(
            `${MINIMAX_OPENAI_BASE_URL.replace(/\/$/, '')}/chat/completions`,
            requestParams,
            {
                Authorization: `Bearer ${MINIMAX_API_KEY}`,
                'Content-Type': 'application/json'
            },
            timeout,
            operationType
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
        metrics.trackLLMRequest(buildLLMMetricLabel('minimax', response.data?.model || model), totalTokens, true, inputTokens, outputTokens);

        return {
            content,
            model,
            actualModel: response.data?.model || model,
            usage,
            raw: response.data
        };
    } catch (error) {
        metrics.trackLLMRequest(buildLLMMetricLabel('minimax', model), 0, false, 0, 0);
        safeLog('error', 'MiniMax OpenAI-compatible API call failed', {
            model,
            operationType,
            error: error.message,
            status: error.response?.status,
            errorDetails: error.response?.data
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
    operationType = 'MiniMax Anthropic-compatible request'
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

    const requestBody = {
        model,
        messages: conversationMessages,
        max_tokens: maxTokens,
        top_p: topP
    };

    if (systemMessage?.content) {
        requestBody.system = systemMessage.content;
    }

    if (temperature !== undefined) {
        requestBody.temperature = temperature;
    }

    try {
        const response = await postToMiniMax(
            `${MINIMAX_ANTHROPIC_BASE_URL.replace(/\/$/, '')}/v1/messages`,
            requestBody,
            {
                'x-api-key': MINIMAX_API_KEY,
                'anthropic-version': '2023-06-01',
                'Content-Type': 'application/json'
            },
            timeout,
            operationType
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
        metrics.trackLLMRequest(buildLLMMetricLabel('minimax', response.data?.model || model), totalTokens, true, inputTokens, outputTokens);

        return {
            content,
            model,
            actualModel: response.data?.model || model,
            usage,
            raw: response.data
        };
    } catch (error) {
        metrics.trackLLMRequest(buildLLMMetricLabel('minimax', model), 0, false, 0, 0);
        safeLog('error', 'MiniMax Anthropic-compatible API call failed', {
            model,
            operationType,
            error: error.message,
            status: error.response?.status,
            errorDetails: error.response?.data
        });
        throw error;
    }
}
