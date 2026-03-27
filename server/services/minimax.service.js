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
import { metrics } from './metrics.service.js';
import { safeLog } from '../utils/logger.backend.js';
import { validatePromptSize } from '../utils/postgresHelpers.js';

function getTokenParameter(model, tokenLimit) {
    const requiresCompletionTokens = model.match(/^(gpt-5(\.\d+)?(-\w+)?|gpt-4\.1|chatgpt-5|gpt-4o-2024-08-06|gpt-4o-2024-11-20|gpt-4o-mini-2024-07-18)/i);
    return requiresCompletionTokens ? { max_completion_tokens: tokenLimit } : { max_tokens: tokenLimit };
}

function supportsCustomTemperature(model) {
    return !model.match(/^(gpt-5(\.\d+)?(-\w+)?|chatgpt-5)/i);
}

function buildOpenAICompatibleParams(model, { maxTokens, temperature, topP, additionalParams }) {
    const params = {
        model,
        ...getTokenParameter(model, maxTokens),
        ...additionalParams
    };

    if (temperature !== undefined && supportsCustomTemperature(model)) {
        params.temperature = temperature;
    }

    if (topP !== undefined) {
        params.top_p = topP;
    }

    return params;
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
        const combinedPrompt = messages.map(message => String(message?.content || '')).join('\n');
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

function extractMiniMaxAnthropicContent(payload = {}) {
    const contentBlocks = payload?.content;
    if (!Array.isArray(contentBlocks) || contentBlocks.length === 0) {
        return '';
    }

    return contentBlocks
        .map(block => {
            if (block?.type === 'text' && typeof block.text === 'string') {
                return block.text;
            }
            if (block?.type === 'thinking' && typeof block.thinking === 'string') {
                return block.thinking;
            }
            return '';
        })
        .filter(Boolean)
        .join('\n')
        .trim();
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
        const response = await axios.post(
            `${MINIMAX_OPENAI_BASE_URL.replace(/\/$/, '')}/chat/completions`,
            requestParams,
            {
                headers: {
                    Authorization: `Bearer ${MINIMAX_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                timeout
            }
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
        metrics.trackLLMRequest(`minimax:${response.data?.model || model}`, totalTokens, true, inputTokens, outputTokens);

        return {
            content,
            model,
            actualModel: response.data?.model || model,
            usage,
            raw: response.data
        };
    } catch (error) {
        metrics.trackLLMRequest(`minimax:${model}`, 0, false, 0, 0);
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
        const response = await axios.post(
            `${MINIMAX_ANTHROPIC_BASE_URL.replace(/\/$/, '')}/v1/messages`,
            requestBody,
            {
                headers: {
                    'x-api-key': MINIMAX_API_KEY,
                    'anthropic-version': '2023-06-01',
                    'Content-Type': 'application/json'
                },
                timeout
            }
        );

        const content = extractMiniMaxAnthropicContent(response.data);
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
        metrics.trackLLMRequest(`minimax:${response.data?.model || model}`, totalTokens, true, inputTokens, outputTokens);

        return {
            content,
            model,
            actualModel: response.data?.model || model,
            usage,
            raw: response.data
        };
    } catch (error) {
        metrics.trackLLMRequest(`minimax:${model}`, 0, false, 0, 0);
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
