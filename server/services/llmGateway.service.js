import { callOllama, callOllamaWithVision } from './ollama.service.js';
import { callMiniMaxOpenAICompatible } from './minimax.service.js';
import { callAnthropicChat, callAnthropicVision } from './anthropic.service.js';
import { callOpenAI } from './openai/apiClient.js';
import { callOpenAIVisionChat } from './openaiChat.service.js';
import { metrics } from './metrics.service.js';
import { safeLog } from '../utils/logger.backend.js';

function buildRequestOptions(options = {}) {
    return {
        temperature: options.temperature,
        max_tokens: options.max_tokens || options.max_completion_tokens || options.max_output_tokens,
        timeout: options.timeout,
        operationType: options.operationType,
        num_ctx: options.num_ctx
    };
}

function getMetricsProviderLabel(provider, model) {
    if (provider === 'ollama') {
        return `ollama:${model}`;
    }
    if (provider === 'minimax') {
        return `minimax:${model}`;
    }
    return model;
}

function unwrapOpenAICompatibleResponse(response, fallbackModel) {
    const choices = response?.choices;
    const content = choices?.[0]?.message?.content;
    if (!Array.isArray(choices) || !content) {
        throw new Error('OpenAI returned no usable content');
    }

    return {
        content,
        model: fallbackModel,
        actualModel: response.model || fallbackModel,
        usage: response.usage
    };
}

async function invokeOpenAIChat({ model, messages, options }) {
    const response = await callOpenAI({
        model,
        messages,
        maxTokens: options.max_tokens || options.max_completion_tokens || options.max_output_tokens || 1000,
        temperature: options.temperature,
        topP: options.top_p,
        responseFormat: options.response_format,
        timeout: options.timeout || 90000,
        maxPromptLength: options.maxPromptLength,
        userMetadata: options.userMetadata,
        operationType: options.operationType
    });

    return unwrapOpenAICompatibleResponse(response, model);
}

async function invokeOllamaChat({ model, messages, settings, options }) {
    const result = await callOllama(messages, model, settings, buildRequestOptions(options));
    metrics.trackLLMRequest(getMetricsProviderLabel('ollama', result.actualModel || model), result.usage?.total_tokens || 0, true, result.usage?.prompt_tokens || 0, result.usage?.completion_tokens || 0);
    return result;
}

async function invokeOllamaVision({ model, systemPrompt, userContent, settings, options }) {
    const result = await callOllamaWithVision(systemPrompt, userContent, model, settings, buildRequestOptions(options));
    metrics.trackLLMRequest(getMetricsProviderLabel('ollama', result.actualModel || model), result.usage?.total_tokens || 0, true, result.usage?.prompt_tokens || 0, result.usage?.completion_tokens || 0);
    return result;
}

async function invokeMiniMaxChat({ model, messages, options }) {
    return callMiniMaxOpenAICompatible({
        model,
        messages,
        maxTokens: options.max_tokens || options.max_completion_tokens || options.max_output_tokens || 1000,
        temperature: options.temperature,
        topP: options.top_p,
        responseFormat: options.response_format,
        timeout: options.timeout || 300000,
        maxPromptLength: options.maxPromptLength,
        operationType: options.operationType || 'MiniMax OpenAI-compatible request'
    });
}

async function invokeMiniMaxVision() {
    throw new Error('MiniMax vision is not supported by this integration');
}

const LLM_PROVIDER_REGISTRY = {
    openai: {
        chat: invokeOpenAIChat,
        vision: ({ model, systemPrompt, userContent, options }) => callOpenAIVisionChat(systemPrompt, userContent, model, options)
    },
    anthropic: {
        chat: ({ model, messages, options }) => callAnthropicChat(messages, model, options),
        vision: ({ model, systemPrompt, userContent, options }) => callAnthropicVision(systemPrompt, userContent, model, options)
    },
    minimax: {
        chat: invokeMiniMaxChat,
        vision: invokeMiniMaxVision
    },
    ollama: {
        chat: invokeOllamaChat,
        vision: invokeOllamaVision
    }
};

function getProviderAdapter(provider) {
    const adapter = LLM_PROVIDER_REGISTRY[provider];
    if (!adapter) {
        throw new Error(`Unsupported LLM provider: ${provider}`);
    }
    return adapter;
}

export async function callProviderChat({ provider, model, messages, settings = {}, options = {} }) {
    return getProviderAdapter(provider).chat({ provider, model, messages, settings, options });
}

export async function callProviderVision({ provider, model, systemPrompt, userContent, settings = {}, options = {} }) {
    return getProviderAdapter(provider).vision({ provider, model, systemPrompt, userContent, settings, options });
}

export function logGatewayCall({ provider, model, messageCount, temperature, maxTokens, hasImages = false, vision = false }) {
    safeLog('info', vision ? 'Calling LLM with vision' : 'Calling LLM', {
        model,
        provider,
        messageCount,
        temperature,
        maxTokens,
        hasImages
    });
}

export { LLM_PROVIDER_REGISTRY };
