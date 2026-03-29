import axios from 'axios';
import { GLM_API_KEY, GLM_BASE_URL, MAX_PROMPT_LENGTH } from '../config/constants.js';
import { buildCapabilityAwareOpenAICompatibleParams } from './llmPayloadCapabilities.service.js';
import { flattenLlmTextContent, sanitizeOpenAICompatibleResponseBody } from './llmContent.service.js';
import { buildLLMMetricLabel, metrics } from './metrics.service.js';
import { safeLog } from '../utils/logger.backend.js';
import { validatePromptSize } from '../utils/postgresHelpers.js';
import { securityLog, LOG_LEVELS, SECURITY_EVENTS } from './security.service.js';
import { withRetry, getCircuitBreakerStates } from './retry.service.js';
import { clampModelMaxOutputTokens } from './llmModelCapabilities.service.js';

const GLM_CHAT_API_URL = `${GLM_BASE_URL.replace(/\/$/, '')}/chat/completions`;

function extractGLMContent(body = {}) {
    return body?.choices?.[0]?.message?.content || '';
}

export async function callGLM({
    model,
    messages,
    maxTokens = 4096,
    temperature = 0,
    topP = 1,
    responseFormat = null,
    timeout = 120000,
    maxPromptLength = MAX_PROMPT_LENGTH,
    userMetadata = null,
    operationType = 'GLM API request'
}) {
    if (!GLM_API_KEY) {
        throw new Error('GLM API key not configured on server');
    }

    if (!model) {
        throw new Error('Model is required');
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
        throw new Error('Messages array is required and must not be empty');
    }

    const { requestedMaxTokens, effectiveMaxTokens, providerCap } = clampModelMaxOutputTokens('glm', model, maxTokens, 4096);

    if (effectiveMaxTokens !== requestedMaxTokens) {
        safeLog('warn', 'Clamped GLM max tokens to provider limit', {
            model,
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
        action: userMetadata?.action || 'POST /glm-service',
        message: operationType,
        metadata: {
            model,
            messageCount: messages.length,
            maxTokens: effectiveMaxTokens
        }
    });

    try {
        const normalized = buildCapabilityAwareOpenAICompatibleParams('glm', model, {
            maxTokens: effectiveMaxTokens,
            temperature,
            topP,
            responseFormat,
            additionalParams: { messages },
            fallbackMaxTokens: 4096
        });

        const response = await axios.post(GLM_CHAT_API_URL, normalized.requestParams, {
            headers: {
                Authorization: `Bearer ${GLM_API_KEY}`,
                'Content-Type': 'application/json'
            },
            timeout,
            validateStatus: status => status < 500
        });

        if (response.status >= 400) {
            const error = new Error(response.data?.error?.message || 'GLM API error');
            error.response = response;
            throw error;
        }

        const usage = response.data?.usage || {};
        const inputTokens = usage.prompt_tokens || 0;
        const outputTokens = usage.completion_tokens || 0;
        const totalTokens = usage.total_tokens || (inputTokens + outputTokens);

        metrics.trackLLMRequest(buildLLMMetricLabel('glm', model), totalTokens, true, inputTokens, outputTokens);
        return sanitizeOpenAICompatibleResponseBody(response.data);
    } catch (error) {
        metrics.trackLLMRequest(buildLLMMetricLabel('glm', model), 0, false, 0, 0);
        safeLog('error', 'GLM API call failed', {
            error: error.message,
            status: error.response?.status,
            errorDetails: error.response?.data?.error?.message,
            model
        });
        throw error;
    }
}

export async function callGLMChat(messages, model, options = {}) {
    const response = await callGLM({
        model,
        messages,
        maxTokens: options.max_tokens || options.max_completion_tokens || options.max_output_tokens || 1000,
        temperature: options.temperature,
        topP: options.top_p,
        responseFormat: options.response_format,
        timeout: options.timeout || 120000,
        maxPromptLength: options.maxPromptLength,
        userMetadata: options.userMetadata,
        operationType: options.operationType || 'GLM chat request'
    });

    const content = extractGLMContent(response);
    if (!content) {
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
}

export async function callGLMWithCircuitBreaker(params) {
    const operationName = params.operationType || 'GLM API call';
    return withRetry(
        () => callGLM(params),
        {
            serviceName: 'glm',
            operationName,
            retryConfig: {
                maxRetries: 3,
                initialDelayMs: 2000,
                maxDelayMs: 60000
            }
        }
    );
}

export function getGLMCircuitBreakerStatus() {
    const states = getCircuitBreakerStates();
    return states.glm || { state: 'UNKNOWN', failures: 0 };
}
