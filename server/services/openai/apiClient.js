/**
 * OpenAI API Client
 * Core API call function with GPT-5 Responses API support
 */

import axios from 'axios';
import { OPENAI_API_KEY, MAX_PROMPT_LENGTH } from '../../config/constants.js';
import { buildCapabilityAwareOpenAICompatibleParams } from '../llmPayloadCapabilities.service.js';
import { buildLLMMetricLabel, metrics } from '../metrics.service.js';
import { safeLog } from '../../utils/logger.backend.js';
import { validatePromptSize } from '../../utils/postgresHelpers.js';
import { securityLog, LOG_LEVELS, SECURITY_EVENTS } from '../security.service.js';
import { withRetry, getCircuitBreakerStates } from '../retry.service.js';
import { extractOpenAIResponsesText, flattenLlmTextContent, sanitizeOpenAICompatibleResponseBody } from '../llmContent.service.js';
import { clampModelMaxOutputTokens } from '../llmModelCapabilities.service.js';
import { markModelUnavailable } from '../llmAvailability.service.js';
import { inferProviderFallbackModel } from '../llmConfiguration.service.js';

const OPENAI_CHAT_API_URL = 'https://api.openai.com/v1/chat/completions';
const OPENAI_RESPONSES_API_URL = 'https://api.openai.com/v1/responses';

function shouldMarkOpenAIModelUnavailable(error) {
    const status = error?.response?.status;
    const message = String(error?.response?.data?.error?.message || error?.message || '').toLowerCase();

    return status === 403
        || status === 404
        || ((status === 400 || status === 422) && (
            message.includes('model')
            && (message.includes('does not exist') || message.includes('do not have access') || message.includes('not found') || message.includes('permission'))
        ));
}

/**
 * Call OpenAI API with common error handling and metrics tracking
 * @param {Object} params - Request parameters
 * @param {string} params.model - OpenAI model to use
 * @param {Array} params.messages - Array of message objects
 * @param {number} params.maxTokens - Maximum tokens in response
 * @param {number} params.temperature - Temperature for response
 * @param {Object} params.responseFormat - Response format (e.g., { type: "json_object" })
 * @param {number} params.timeout - Request timeout in milliseconds
 * @param {number} params.maxPromptLength - Maximum prompt length for validation
 * @returns {Promise<Object>} - OpenAI response data
 */
export async function callOpenAI({
    model,
    messages,
    maxTokens = 4096,
    temperature = 0,
    topP = 1,
    responseFormat = null,
    timeout = 90000,
    maxPromptLength = MAX_PROMPT_LENGTH,
    userMetadata = null,  // Optional: { email, ip, action } for security logging
    operationType = 'OpenAI Service API request',  // Description for logging
    ...providerParameters
}) {
    if (!OPENAI_API_KEY) {
        throw new Error('OpenAI API key not configured on server');
    }

    if (!model) {
        throw new Error('Model is required');
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
        throw new Error('Messages array is required and must not be empty');
    }

    const { requestedMaxTokens, effectiveMaxTokens, providerCap, capabilities } = clampModelMaxOutputTokens('openai', model, maxTokens, 4096);

    if (providerCap && effectiveMaxTokens !== requestedMaxTokens) {
        safeLog('warn', 'Clamped OpenAI max tokens to model limit', {
            model,
            requestedMaxTokens,
            effectiveMaxTokens,
            providerCap
        });
    }

    // Validate prompt size if maxPromptLength is specified
    if (maxPromptLength) {
        const combinedPrompt = messages.map(m => flattenLlmTextContent(m.content)).join('\n');
        const promptValidation = validatePromptSize(combinedPrompt, maxPromptLength);
        if (!promptValidation.valid) {
            const error = new Error(promptValidation.error);
            error.estimatedTokens = promptValidation.estimatedTokens;
            throw error;
        }
    }

    // Log LLM request for security monitoring
    securityLog(LOG_LEVELS.INFO, SECURITY_EVENTS.LLM_REQUEST, {
        email: userMetadata?.email || 'system',
        ip: userMetadata?.ip || 'internal',
        action: userMetadata?.action || `POST /openai-service`,
        message: operationType,
        metadata: { 
            model: model,
            messageCount: messages.length,
            maxTokens: effectiveMaxTokens
        }
    });

    try {
        // Check if this is a GPT-5 model - they require the Responses API
        const isGPT5Model = model.match(/^gpt-5/i);
        
        let apiUrl;
        let requestParams;
        
        if (isGPT5Model) {
            // GPT-5 models use the Responses API
            apiUrl = OPENAI_RESPONSES_API_URL;

            const normalized = buildCapabilityAwareOpenAICompatibleParams('openai', model, {
                parameters: providerParameters,
                maxTokens: effectiveMaxTokens,
                temperature,
                topP,
                responseFormat,
                fallbackMaxTokens: 4096
            });
            const reasoningEffort = normalized.parameters.reasoning_effort || capabilities?.defaultReasoningEffort || 'medium';

            requestParams = {
                model,
                input: messages,
                reasoning: { effort: reasoningEffort },
                max_output_tokens: normalized.effectiveMaxTokens
            };

            const passthroughParameters = { ...normalized.parameters };
            delete passthroughParameters.reasoning_effort;
            delete passthroughParameters.max_completion_tokens;
            delete passthroughParameters.max_output_tokens;
            delete passthroughParameters.max_tokens;
            delete passthroughParameters.response_format;
            delete passthroughParameters.verbosity;

            Object.assign(requestParams, passthroughParameters);

            if (normalized.parameters.response_format || normalized.parameters.verbosity) {
                requestParams.text = {
                    ...(normalized.parameters.response_format ? { format: normalized.parameters.response_format } : {}),
                    ...(normalized.parameters.verbosity ? { verbosity: normalized.parameters.verbosity } : {})
                };
            }

            safeLog('info', 'LLM Request', { model, messageCount: messages.length, maxTokens: effectiveMaxTokens, reasoningEffort, temperature, topP });
        } else {
            // Standard models use Chat Completions API
            apiUrl = OPENAI_CHAT_API_URL;
            
            const normalized = buildCapabilityAwareOpenAICompatibleParams('openai', model, {
                parameters: providerParameters,
                maxTokens: effectiveMaxTokens,
                temperature,
                topP,
                responseFormat,
                additionalParams: { messages },
                fallbackMaxTokens: 4096
            });

            requestParams = normalized.requestParams;
            
            safeLog('info', 'LLM Request', { model, messageCount: messages.length, maxTokens: effectiveMaxTokens, temperature, topP });
        }

        const response = await axios.post(apiUrl, requestParams, {
            headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            },
            timeout: isGPT5Model ? Math.max(timeout, 180000) : timeout, // GPT-5 models need longer timeout
            validateStatus: function (status) {
                return status < 500; // Resolve for all non-5xx status codes to capture error details
            }
        });
        
        // Check if response indicates an error (4xx status)
        if (response.status >= 400) {
            safeLog('error', 'OpenAI API returned error', {
                status: response.status,
                errorMessage: response.data?.error?.message || 'Unknown error',
                model
            });
            const error = new Error(response.data?.error?.message || 'OpenAI API error');
            error.response = response;
            throw error;
        }

        const usage = response.data?.usage || {};
        // Responses API uses input_tokens/output_tokens, Chat Completions uses prompt_tokens/completion_tokens
        const inputTokens = usage.input_tokens || usage.prompt_tokens || 0;
        const outputTokens = usage.output_tokens || usage.completion_tokens || 0;
        const totalTokens = usage.total_tokens || (inputTokens + outputTokens);
        
        safeLog('info', 'LLM Token usage', { inputTokens, outputTokens, totalTokens });
        metrics.trackLLMRequest(buildLLMMetricLabel('openai', model), totalTokens, true, inputTokens, outputTokens);

        // Transform Responses API format to Chat Completions API format for consistency
        if (isGPT5Model && response.data?.output) {
            const textContent = extractOpenAIResponsesText(response.data.output || []);
            
            const transformedResponse = {
                id: response.data.id,
                object: 'chat.completion',
                created: Date.now(),
                model: model,
                choices: [{
                    index: 0,
                    message: {
                        role: 'assistant',
                        content: textContent
                    },
                    finish_reason: response.data.status === 'completed' ? 'stop' : response.data.status
                }],
                usage: response.data.usage
            };
            
            safeLog('debug', 'Transformed Responses API response to Chat Completions format');
            return transformedResponse;
        }

        return sanitizeOpenAICompatibleResponseBody(response.data);
    } catch (error) {
        metrics.trackLLMRequest(buildLLMMetricLabel('openai', model), 0, false, 0, 0);
        if (shouldMarkOpenAIModelUnavailable(error)) {
            void markModelUnavailable('openai', model, 'provider_model_access_denied', inferProviderFallbackModel('openai', model));
        }
        safeLog('error', 'OpenAI API call failed', {
            error: error.message,
            status: error.response?.status,
            errorDetails: error.response?.data?.error?.message,
            model
        });
        throw error;
    }
}

// ============================================
// CIRCUIT BREAKER WRAPPED FUNCTIONS
// ============================================

/**
 * Call OpenAI API with circuit breaker protection
 * Wraps callOpenAI with retry logic and circuit breaker pattern
 * @param {Object} params - Same parameters as callOpenAI
 * @returns {Promise<Object>} - OpenAI response data
 */
export async function callOpenAIWithCircuitBreaker(params) {
    const operationName = params.operationType || 'OpenAI API call';
    
    return withRetry(
        () => callOpenAI(params),
        {
            serviceName: 'openai',
            operationName,
            retryConfig: {
                maxRetries: 2,
                initialDelayMs: 2000,
                maxDelayMs: 30000
            }
        }
    );
}

/**
 * Get OpenAI circuit breaker status
 * @returns {Object} Circuit breaker state for OpenAI
 */
export function getOpenAICircuitBreakerStatus() {
    const states = getCircuitBreakerStates();
    return states.openai || { state: 'UNKNOWN', failures: 0 };
}
