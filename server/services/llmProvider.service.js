/**
 * Provider-aware chat completion helper for business flows.
 * Keeps OpenAI response shape for callers, while routing to the configured provider.
 */

import { getLLMSettings } from './settings.service.js';
import { resolveLLMRuntimeConfig } from './llmConfiguration.service.js';
import { callProviderChat } from './llmGateway.service.js';
import { toOpenAICompatibleResponse } from './llmProviderCommon.service.js';
import { resolveEffectiveModelParameters } from './llmAdminParameters.service.js';
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
    const { provider, model: effectiveModel } = resolveLLMRuntimeConfig(settings, model);
    const normalizedMessages = normalizeMessagesContent(messages);
    const { parameters } = resolveEffectiveModelParameters({
        settings,
        provider,
        model: effectiveModel,
        overrides: {
            temperature,
            top_p: topP,
            max_tokens: maxTokens,
            response_format: responseFormat
        }
    });

    if (provider !== 'ollama' && !effectiveModel) {
        throw new Error('Model is required');
    }

    safeLog('info', 'Routing business LLM call via provider gateway', {
        operationType,
        provider,
        model: effectiveModel || 'runtime:auto',
        messageCount: normalizedMessages.length
    });

    const result = await callProviderChat({
        provider,
        model: effectiveModel,
        messages: normalizedMessages,
        settings,
        options: {
            ...parameters,
            timeout: resolveBusinessOperationTimeout(operationType, timeout),
            maxPromptLength,
            userMetadata,
            operationType
        }
    });

    return toOpenAICompatibleResponse(result, provider);
}
