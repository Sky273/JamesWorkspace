import axios from 'axios';
import { DEEPSEEK_API_KEY, DEEPSEEK_BASE_URL, MAX_PROMPT_LENGTH } from '../config/constants.js';
import { buildCapabilityAwareOpenAICompatibleParams } from './llmPayloadCapabilities.service.js';
import { extractDeepSeekContent, flattenLlmTextContent, sanitizeOpenAICompatibleResponseBody } from './llmContent.service.js';
import { buildLLMMetricLabel, metrics } from './metrics.service.js';
import { safeLog } from '../utils/logger.backend.js';
import { validatePromptSize } from '../utils/postgresHelpers.js';
import { securityLog, LOG_LEVELS, SECURITY_EVENTS } from './security.service.js';
import { withRetry, getCircuitBreakerStates } from './retry.service.js';
import { clampModelMaxOutputTokens } from './llmModelCapabilities.service.js';

const DEEPSEEK_CHAT_API_URL = `${DEEPSEEK_BASE_URL.replace(/\/$/, '')}/chat/completions`;

export async function callDeepSeek({
    model,
    messages,
    maxTokens = 4096,
    temperature = 0,
    topP = 1,
    responseFormat = null,
    timeout = 120000,
    maxPromptLength = MAX_PROMPT_LENGTH,
    userMetadata = null,
    operationType = 'DeepSeek API request'
}) {
    if (!DEEPSEEK_API_KEY) {
        throw new Error('DeepSeek API key not configured on server');
    }

    if (!model) {
        throw new Error('Model is required');
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
        throw new Error('Messages array is required and must not be empty');
    }

    const { requestedMaxTokens, effectiveMaxTokens, providerCap } = clampModelMaxOutputTokens('deepseek', model, maxTokens, 4096);

    if (effectiveMaxTokens !== requestedMaxTokens) {
        safeLog('warn', 'Clamped DeepSeek max tokens to provider limit', {
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
        action: userMetadata?.action || 'POST /deepseek-service',
        message: operationType,
        metadata: {
            model,
            messageCount: messages.length,
            maxTokens: effectiveMaxTokens
        }
    });

    try {
        const normalized = buildCapabilityAwareOpenAICompatibleParams('deepseek', model, {
            maxTokens: effectiveMaxTokens,
            temperature,
            topP,
            responseFormat,
            additionalParams: { messages },
            fallbackMaxTokens: 4096
        });

        const requestParams = normalized.requestParams;

        safeLog('info', 'DeepSeek request', {
            model,
            messageCount: messages.length,
            maxTokens: effectiveMaxTokens,
            temperature,
            topP
        });

        const response = await axios.post(DEEPSEEK_CHAT_API_URL, requestParams, {
            headers: {
                Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
                'Content-Type': 'application/json'
            },
            timeout,
            validateStatus: status => status < 500
        });

        if (response.status >= 400) {
            const error = new Error(response.data?.error?.message || 'DeepSeek API error');
            error.response = response;
            throw error;
        }

        const usage = response.data?.usage || {};
        const inputTokens = usage.prompt_tokens || 0;
        const outputTokens = usage.completion_tokens || 0;
        const totalTokens = usage.total_tokens || (inputTokens + outputTokens);

        metrics.trackLLMRequest(buildLLMMetricLabel('deepseek', model), totalTokens, true, inputTokens, outputTokens);
        return sanitizeOpenAICompatibleResponseBody(response.data);
    } catch (error) {
        metrics.trackLLMRequest(buildLLMMetricLabel('deepseek', model), 0, false, 0, 0);
        safeLog('error', 'DeepSeek API call failed', {
            error: error.message,
            status: error.response?.status,
            errorDetails: error.response?.data?.error?.message,
            model
        });
        throw error;
    }
}

export async function callDeepSeekChat(messages, model, options = {}) {
    const response = await callDeepSeek({
        model,
        messages,
        maxTokens: options.max_tokens || options.max_completion_tokens || options.max_output_tokens || 1000,
        temperature: options.temperature,
        topP: options.top_p,
        responseFormat: options.response_format,
        timeout: options.timeout || 120000,
        maxPromptLength: options.maxPromptLength,
        userMetadata: options.userMetadata,
        operationType: options.operationType || 'DeepSeek chat request'
    });

    const content = extractDeepSeekContent(response);
    if (!content) {
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
}

export async function callDeepSeekWithCircuitBreaker(params) {
    const operationName = params.operationType || 'DeepSeek API call';
    return withRetry(
        () => callDeepSeek(params),
        {
            serviceName: 'deepseek',
            operationName,
            retryConfig: {
                maxRetries: 3,
                initialDelayMs: 2000,
                maxDelayMs: 60000
            }
        }
    );
}

export function getDeepSeekCircuitBreakerStatus() {
    const states = getCircuitBreakerStates();
    return states.deepseek || { state: 'UNKNOWN', failures: 0 };
}
