import { callOllama, callOllamaWithVision } from './ollama.service.js';
import { callMiniMaxOpenAICompatible } from './minimax.service.js';
import { callAnthropicChat, callAnthropicVision } from './anthropic.service.js';
import { callDeepSeekWithCircuitBreaker } from './deepseek.service.js';
import { callGemmaChat } from './gemma.service.js';
import { callGLMWithCircuitBreaker } from './glm.service.js';
import { callHuggingFaceWithCircuitBreaker } from './huggingface.service.js';
import { callOpenAI } from './openai/apiClient.js';
import { callOpenAIVisionChat } from './openaiChat.service.js';
import { buildLLMMetricLabel, metrics } from './metrics.service.js';
import { LLM_OPERATION_TIMEOUT_MS } from '../config/constants.js';
import { safeLog } from '../utils/logger.backend.js';

function buildRequestOptions(options = {}) {
    return {
        ...options,
        max_tokens: options.max_tokens || options.max_completion_tokens || options.max_output_tokens
    };
}

function getMetricsProviderLabel(provider, model) {
    return buildLLMMetricLabel(provider, model);
}

function buildAppliedOptionsSummary(options = {}) {
    const parameterKeys = Object.keys(options).sort();
    return {
        parameterKeys,
        maxTokens: options.max_tokens || options.max_completion_tokens || options.max_output_tokens || null,
        temperature: options.temperature ?? null,
        topP: options.top_p ?? null,
        hasMetadata: Boolean(options.metadata),
        hasTools: Array.isArray(options.tools) && options.tools.length > 0,
        hasResponseFormat: Boolean(options.response_format)
    };
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
        ...options,
        maxTokens: options.max_tokens || options.max_completion_tokens || options.max_output_tokens || 1000,
        temperature: options.temperature,
        topP: options.top_p,
        responseFormat: options.response_format,
        timeout: options.timeout || LLM_OPERATION_TIMEOUT_MS
    });

    return unwrapOpenAICompatibleResponse(response, model);
}

async function invokeDeepSeekChat({ model, messages, options }) {
    return callDeepSeekWithCircuitBreaker({
        model,
        messages,
        ...options,
        maxTokens: options.max_tokens || options.max_completion_tokens || options.max_output_tokens || 1000,
        temperature: options.temperature,
        topP: options.top_p,
        responseFormat: options.response_format,
        timeout: options.timeout || LLM_OPERATION_TIMEOUT_MS,
        operationType: options.operationType || 'DeepSeek chat request'
    }).then((response) => {
        const choices = response?.choices;
        const content = choices?.[0]?.message?.content;
        if (!Array.isArray(choices) || !content) {
            if (response?.choices?.[0]?.finish_reason === 'length') {
                throw new Error('DeepSeek response truncated due to token limit');
            }
            throw new Error('DeepSeek returned empty content');
        }

        return {
            content,
            model,
            actualModel: response.model || model,
            usage: response.usage
        };
    });
}

async function invokeDeepSeekVision() {
    throw new Error('DeepSeek vision is not supported by this integration');
}

async function invokeHuggingFaceChat({ model, messages, options }) {
    return callHuggingFaceWithCircuitBreaker({
        model,
        messages,
        ...options,
        maxTokens: options.max_tokens || options.max_completion_tokens || options.max_output_tokens || 1000,
        temperature: options.temperature,
        topP: options.top_p,
        responseFormat: options.response_format,
        timeout: options.timeout || LLM_OPERATION_TIMEOUT_MS,
        operationType: options.operationType || 'Hugging Face chat request'
    }).then((response) => {
        const choices = response?.choices;
        const content = choices?.[0]?.message?.content;
        if (!Array.isArray(choices) || !content) {
            throw new Error('Hugging Face returned empty content');
        }

        return {
            content,
            model,
            actualModel: response.model || model,
            usage: response.usage
        };
    });
}

async function invokeHuggingFaceVision() {
    throw new Error('Hugging Face vision is not supported by this integration');
}

async function invokeGemmaChat({ model, messages, options }) {
    return callGemmaChat({
        model,
        messages,
        ...options,
        maxTokens: options.max_tokens || options.max_completion_tokens || options.max_output_tokens || 1000,
        temperature: options.temperature,
        topP: options.top_p,
        responseFormat: options.response_format,
        timeout: options.timeout || LLM_OPERATION_TIMEOUT_MS,
        operationType: options.operationType || 'Gemma chat request'
    }).then((response) => {
        const choices = response?.choices;
        const content = choices?.[0]?.message?.content;
        if (!Array.isArray(choices) || !content) {
            throw new Error('Gemma returned empty content');
        }

        return {
            content,
            model,
            actualModel: response.model || model,
            usage: response.usage
        };
    });
}

async function invokeGemmaVision() {
    throw new Error('Gemma vision is not supported by this integration');
}

async function invokeGLMChat({ model, messages, options }) {
    return callGLMWithCircuitBreaker({
        model,
        messages,
        ...options,
        maxTokens: options.max_tokens || options.max_completion_tokens || options.max_output_tokens || 1000,
        temperature: options.temperature,
        topP: options.top_p,
        responseFormat: options.response_format,
        timeout: options.timeout || LLM_OPERATION_TIMEOUT_MS,
        operationType: options.operationType || 'GLM chat request'
    }).then((response) => {
        const choices = response?.choices;
        const content = choices?.[0]?.message?.content;
        if (!Array.isArray(choices) || !content) {
            if (response?.choices?.[0]?.finish_reason === 'length') {
                throw new Error('GLM response truncated due to token limit');
            }
            throw new Error('GLM returned empty content');
        }

        return {
            content,
            model,
            actualModel: response.model || model,
            usage: response.usage
        };
    });
}

async function invokeGLMVision() {
    throw new Error('GLM vision is not supported by this integration');
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
        ...options,
        maxTokens: options.max_tokens || options.max_completion_tokens || options.max_output_tokens || 1000,
        temperature: options.temperature,
        topP: options.top_p,
        responseFormat: options.response_format,
        timeout: options.timeout || LLM_OPERATION_TIMEOUT_MS,
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
    deepseek: {
        chat: invokeDeepSeekChat,
        vision: invokeDeepSeekVision
    },
    huggingface: {
        chat: invokeHuggingFaceChat,
        vision: invokeHuggingFaceVision
    },
    gemma: {
        chat: invokeGemmaChat,
        vision: invokeGemmaVision
    },
    glm: {
        chat: invokeGLMChat,
        vision: invokeGLMVision
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

function buildProviderErrorMessage(error) {
    const status = error?.response?.status;
    const providerMessage = String(error?.response?.data?.error?.message || error?.message || '').trim();

    return {
        status,
        providerMessage,
        lowerMessage: providerMessage.toLowerCase()
    };
}

export function isNonRetryableLlmProviderError(error) {
    const { status, lowerMessage } = buildProviderErrorMessage(error);

    if (status === 401 || status === 403) {
        return true;
    }

    return lowerMessage.includes('token expired or incorrect')
        || lowerMessage.includes('invalid api key')
        || lowerMessage.includes('incorrect api key')
        || lowerMessage.includes('authentication')
        || lowerMessage.includes('unauthorized')
        || lowerMessage.includes('access denied')
        || lowerMessage.includes('api key not configured')
        || lowerMessage.includes('expired token');
}

export function normalizeNonRetryableLlmProviderError(error) {
    if (!isNonRetryableLlmProviderError(error)) {
        return error;
    }

    const normalizedError = new Error("Le fournisseur IA est actuellement mal configuré ou son jeton d'accès a expiré. Contactez un administrateur.");
    normalizedError.code = 'LLM_PROVIDER_AUTH_ERROR';
    normalizedError.retryable = false;
    normalizedError.statusCode = 502;
    normalizedError.cause = error;
    normalizedError.providerStatus = error?.response?.status ?? null;
    normalizedError.originalMessage = error?.message || null;

    return normalizedError;
}

export async function callProviderChat({ provider, model, messages, settings = {}, options = {} }) {
    safeLog('debug', 'Applying resolved LLM model parameters', {
        provider,
        model,
        messageCount: messages?.length || 0,
        ...buildAppliedOptionsSummary(options)
    });
    return getProviderAdapter(provider).chat({ provider, model, messages, settings, options });
}

export async function callProviderVision({ provider, model, systemPrompt, userContent, settings = {}, options = {} }) {
    safeLog('debug', 'Applying resolved vision model parameters', {
        provider,
        model,
        contentCount: userContent?.length || 0,
        ...buildAppliedOptionsSummary(options)
    });
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
