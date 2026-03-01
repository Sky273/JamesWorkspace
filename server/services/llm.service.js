// ============================================
// LLM SERVICE - OpenAI and Anthropic helpers
// ============================================

import axios from 'axios';
import { OPENAI_API_KEY, ANTHROPIC_API_KEY } from '../config/constants.js';
import { getLLMSettings } from './settings.service.js';
import { safeLog } from '../utils/logger.backend.js';
import { metrics } from './metrics.service.js';

/**
 * Helper function to determine the correct token parameter based on model
 * Different OpenAI models use different token parameter names
 * - Newer models (gpt-4o-2024-08-06+, gpt-5+, gpt-4.1+): max_completion_tokens
 * - Older models (gpt-3.5-turbo, gpt-4, gpt-4-turbo, etc.): max_tokens
 */
export function getTokenParameter(model, tokenLimit) {
    const requiresCompletionTokens = model.match(/^(gpt-5(\.\d+)?(-\w+)?|gpt-4\.1|chatgpt-5|gpt-4o-2024-08-06|gpt-4o-2024-11-20|gpt-4o-mini-2024-07-18)/i);
    
    if (requiresCompletionTokens) {
        return { max_completion_tokens: tokenLimit };
    }
    
    return { max_tokens: tokenLimit };
}

/**
 * Helper function to check if model supports custom temperature
 * GPT-5+ models (including gpt-5.x versions) only support temperature = 1 (default)
 */
export function supportsCustomTemperature(model) {
    const gpt5Model = model.match(/^(gpt-5(\.\d+)?(-\w+)?|chatgpt-5)/i);
    return !gpt5Model;
}

/**
 * Helper function to build OpenAI request parameters with model-specific compatibility
 */
export function buildOpenAIParams(model, baseParams) {
    const params = {
        model,
        ...getTokenParameter(model, baseParams.maxTokens),
        ...baseParams.additionalParams
    };
    
    // Only add temperature if model supports it
    if (baseParams.temperature !== undefined && supportsCustomTemperature(model)) {
        params.temperature = baseParams.temperature;
    }
    
    // Add top_p for nucleus sampling (default 1 = consider all tokens)
    if (baseParams.topP !== undefined) {
        params.top_p = baseParams.topP;
    }
    
    return params;
}

/**
 * Call LLM with messages and options
 * Automatically uses the configured model from settings
 * @param {Array} messages - Array of message objects with role and content
 * @param {Object} options - Optional parameters (temperature, max_tokens)
 * @returns {Promise<Object>} - LLM response with content, model, and usage
 */
export async function callLLM(messages, options = {}) {
    try {
        // Get configured model from Settings (centralized)
        const settings = await getLLMSettings();
        const model = settings.llmModel || 'gpt-4o';
        const provider = settings.llmProvider || 'openai';

        safeLog('info', 'Calling LLM', { 
            model, 
            provider,
            messageCount: messages.length,
            temperature: options.temperature,
            maxTokens: options.max_tokens,
            hasOpenAIKey: !!OPENAI_API_KEY,
            hasAnthropicKey: !!ANTHROPIC_API_KEY,
            openAIKeyPrefix: OPENAI_API_KEY ? OPENAI_API_KEY.substring(0, 7) + '...' : 'NOT SET'
        });

        if (provider === 'anthropic') {
            return await callAnthropic(messages, model, options);
        } else {
            return await callOpenAI(messages, model, options);
        }
    } catch (error) {
        safeLog('error', 'LLM call failed', { 
            error: error.message,
            stack: error.stack,
            response: error.response?.data,
            status: error.response?.status
        });
        throw error;
    }
}

/**
 * Call OpenAI API
 */
async function callOpenAI(messages, model, options) {
    if (!OPENAI_API_KEY) {
        throw new Error('OpenAI API key not configured');
    }

    const requestBody = {
        model,
        messages,
        ...getTokenParameter(model, options.max_tokens || 1000)
    };

    if (options.temperature !== undefined && supportsCustomTemperature(model)) {
        requestBody.temperature = options.temperature;
    }

    const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        requestBody,
        {
            headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            },
            timeout: 120000 // Increase timeout for large context
        }
    );

    // Log raw response for debugging
    safeLog('debug', 'OpenAI raw response', {
        hasChoices: !!response.data?.choices,
        choicesLength: response.data?.choices?.length,
        finishReason: response.data?.choices?.[0]?.finish_reason,
        hasContent: !!response.data?.choices?.[0]?.message?.content,
        contentLength: response.data?.choices?.[0]?.message?.content?.length || 0,
        model: response.data?.model
    });

    // Track LLM metrics
    const usage = response.data.usage || {};
    const inputTokens = usage.prompt_tokens || 0;
    const outputTokens = usage.completion_tokens || 0;
    const totalTokens = usage.total_tokens || (inputTokens + outputTokens);
    metrics.trackLLMRequest(model, totalTokens, true, inputTokens, outputTokens);

    // Extract content with better error handling
    const choices = response.data?.choices;
    if (!choices || choices.length === 0) {
        safeLog('error', 'OpenAI returned no choices', { 
            responseData: JSON.stringify(response.data).substring(0, 500)
        });
        throw new Error('OpenAI returned no choices');
    }

    const content = choices[0]?.message?.content;
    if (!content) {
        safeLog('error', 'OpenAI returned empty content', {
            finishReason: choices[0]?.finish_reason,
            message: JSON.stringify(choices[0]?.message).substring(0, 200)
        });
        // If finish_reason is 'length', the response was truncated
        if (choices[0]?.finish_reason === 'length') {
            throw new Error('Response truncated due to token limit');
        }
        throw new Error('OpenAI returned empty content');
    }

    return {
        content,
        model: model, // Use configured model, not the one returned by API (which includes date suffix)
        actualModel: response.data.model, // Keep actual model for debugging
        usage: response.data.usage
    };
}

/**
 * Call Anthropic API
 */
async function callAnthropic(messages, model, options) {
    if (!ANTHROPIC_API_KEY) {
        throw new Error('Anthropic API key not configured');
    }

    // Extract system message if present
    const systemMessage = messages.find(m => m.role === 'system');
    const conversationMessages = messages.filter(m => m.role !== 'system');

    const requestBody = {
        model,
        messages: conversationMessages,
        max_tokens: options.max_tokens || 1000
    };

    if (systemMessage) {
        requestBody.system = systemMessage.content;
    }

    if (options.temperature !== undefined) {
        requestBody.temperature = options.temperature;
    }

    const response = await axios.post(
        'https://api.anthropic.com/v1/messages',
        requestBody,
        {
            headers: {
                'x-api-key': ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01',
                'Content-Type': 'application/json'
            },
            timeout: 60000
        }
    );

    // Track LLM metrics
    const usage = response.data.usage || {};
    const inputTokens = usage.input_tokens || 0;
    const outputTokens = usage.output_tokens || 0;
    const totalTokens = inputTokens + outputTokens;
    metrics.trackLLMRequest(model, totalTokens, true, inputTokens, outputTokens);

    return {
        content: response.data.content[0].text,
        model: model, // Use configured model, not the one returned by API
        actualModel: response.data.model, // Keep actual model for debugging
        usage: response.data.usage
    };
}
