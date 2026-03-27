/**
 * Provider-aware chat completion helper for business flows.
 * Keeps OpenAI response shape for callers, while routing to the configured provider.
 */

import { getLLMSettings } from './settings.service.js';
import { callOpenAI } from './openai/apiClient.js';
import { callOllama } from './ollama.service.js';
import { callMiniMaxOpenAICompatible } from './minimax.service.js';
import { safeLog } from '../utils/logger.backend.js';
import { normalizeUtf8Text } from './openai/textUtils.js';

const BUSINESS_CV_OPERATION_TIMEOUTS_MS = {
    'Resume Analysis': 20 * 60 * 1000,
    'Improved Resume Analysis': 20 * 60 * 1000,
    'Resume Improvement': 25 * 60 * 1000
};

function resolveBusinessOperationTimeout(operationType, timeout) {
    const operationTimeout = BUSINESS_CV_OPERATION_TIMEOUTS_MS[operationType];
    if (operationTimeout) {
        return Math.max(operationTimeout, Number(timeout) || 0);
    }

    return timeout;
}

function normalizeMessagesContent(messages = []) {
    return (messages || []).map(message => ({
        ...message,
        content: typeof message?.content === 'string'
            ? normalizeUtf8Text(message.content)
            : Array.isArray(message?.content)
                ? message.content.map(block => ({
                    ...block,
                    text: typeof block?.text === 'string' ? normalizeUtf8Text(block.text) : block?.text,
                    content: typeof block?.content === 'string' ? normalizeUtf8Text(block.content) : block?.content,
                    thinking: typeof block?.thinking === 'string' ? normalizeUtf8Text(block.thinking) : block?.thinking
                }))
                : message?.content
    }));
}

function toOpenAIShape(result) {
    return {
        id: `ollama-${Date.now()}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: result.actualModel || result.model,
        choices: [{
            index: 0,
            message: {
                role: 'assistant',
                content: result.content
            },
            finish_reason: 'stop'
        }],
        usage: result.usage || {
            prompt_tokens: 0,
            completion_tokens: 0,
            total_tokens: 0
        }
    };
}

export async function callBusinessChatCompletion({
    model,
    messages,
    maxTokens = 4096,
    temperature = 0,
    topP = 1,
    responseFormat = null,
    timeout = 90000,
    maxPromptLength,
    userMetadata = null,
    operationType = 'LLM business operation'
}) {
    const settings = await getLLMSettings();
    const provider = settings?.llmProvider || 'openai';
    const configuredModel = settings?.llmModel || model;
    const normalizedMessages = normalizeMessagesContent(messages);
    const effectiveModel = provider === 'ollama' ? (model || configuredModel || null) : (model || configuredModel);

    if (provider !== 'ollama' && !effectiveModel) {
        throw new Error('Model is required');
    }

    if (provider === 'ollama') {
        safeLog('info', 'Routing business LLM call to Ollama', {
            operationType,
            provider,
            model: effectiveModel || 'runtime:auto',
            messageCount: normalizedMessages.length
        });

        const result = await callOllama(normalizedMessages, effectiveModel, settings, {
            temperature,
            max_tokens: maxTokens,
            timeout: resolveBusinessOperationTimeout(operationType, timeout),
            operationType
        });

        return toOpenAIShape(result);
    }

    if (provider === 'minimax') {
        safeLog('info', 'Routing business LLM call to MiniMax', {
            operationType,
            provider,
            model: effectiveModel,
            messageCount: normalizedMessages.length
        });

        const result = await callMiniMaxOpenAICompatible({
            model: effectiveModel,
            messages: normalizedMessages,
            maxTokens,
            temperature,
            topP,
            responseFormat,
            timeout: resolveBusinessOperationTimeout(operationType, timeout),
            maxPromptLength,
            operationType
        });

        return toOpenAIShape(result);
    }

    return callOpenAI({
        model: effectiveModel,
        messages: normalizedMessages,
        maxTokens,
        temperature,
        topP,
        responseFormat,
        timeout,
        maxPromptLength,
        userMetadata,
        operationType
    });
}



