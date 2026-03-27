/**
 * Provider-aware chat completion helper for business flows.
 * Keeps OpenAI response shape for callers, while routing to Ollama when configured.
 */

import { getLLMSettings } from './settings.service.js';
import { callOpenAI } from './openai/apiClient.js';
import { callOllama } from './ollama.service.js';
import { safeLog } from '../utils/logger.backend.js';

const OLLAMA_CV_OPERATION_TIMEOUTS_MS = {
    'Resume Analysis': 20 * 60 * 1000,
    'Improved Resume Analysis': 20 * 60 * 1000,
    'Resume Improvement': 25 * 60 * 1000
};

function resolveBusinessOllamaTimeout(operationType, timeout) {
    const operationTimeout = OLLAMA_CV_OPERATION_TIMEOUTS_MS[operationType];
    if (operationTimeout) {
        return Math.max(operationTimeout, Number(timeout) || 0);
    }

    return timeout;
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
    const effectiveModel = provider === 'ollama' ? null : (model || configuredModel);

    if (!effectiveModel) {
        throw new Error('Model is required');
    }

    if (provider === 'ollama') {
        safeLog('info', 'Routing business LLM call to Ollama', {
            operationType,
            provider,
            model: settings?.llmModel || 'runtime:auto',
            messageCount: messages?.length || 0
        });

        const result = await callOllama(messages, effectiveModel, settings, {
            temperature,
            max_tokens: maxTokens,
            timeout: resolveBusinessOllamaTimeout(operationType, timeout)
        });

        return toOpenAIShape(result);
    }

    return callOpenAI({
        model: effectiveModel,
        messages,
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
