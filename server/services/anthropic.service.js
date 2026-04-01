import axios from 'axios';
import { ANTHROPIC_API_KEY } from '../config/constants.js';
import { buildLLMMetricLabel, metrics } from './metrics.service.js';
import { extractTextFromContentBlocks } from './llmContent.service.js';
import { normalizeAnthropicContent } from './llmProviderCommon.service.js';
import { buildCapabilityAwareAnthropicOptions } from './llmPayloadCapabilities.service.js';
import { markModelUnavailable } from './llmAvailability.service.js';
import { inferProviderFallbackModel } from './llmConfiguration.service.js';
import { withRetry } from './retry.service.js';

function shouldMarkAnthropicModelUnavailable(error) {
    const status = error?.response?.status;
    const message = String(error?.response?.data?.error?.message || error?.message || '').toLowerCase();

    return status === 403
        || status === 404
        || ((status === 400 || status === 422) && (
            message.includes('model')
            && (message.includes('not found') || message.includes('not exist') || message.includes('permission') || message.includes('access'))
        ));
}

export async function callAnthropicChat(messages, model, options = {}) {
    if (!ANTHROPIC_API_KEY) {
        throw new Error('Anthropic API key not configured');
    }

    const systemMessages = messages.filter(message => message.role === 'system');
    const conversationMessages = messages
        .filter(message => message.role !== 'system')
        .map(message => ({
            role: message.role,
            content: normalizeAnthropicContent(message.content)
        }));

    const normalized = buildCapabilityAwareAnthropicOptions('anthropic', model, {
        parameters: options,
        maxTokens: options.max_tokens || 1000,
        temperature: options.temperature,
        topP: options.top_p,
        fallbackMaxTokens: 1000
    });

    const requestBody = {
        model,
        messages: conversationMessages,
        max_tokens: normalized.effectiveMaxTokens
    };

    if (systemMessages.length > 0) {
        requestBody.system = systemMessages
            .flatMap(message => normalizeAnthropicContent(message.content))
            .filter(Boolean);
    }

    Object.assign(requestBody, normalized.requestParams);
    requestBody.max_tokens = normalized.effectiveMaxTokens;

    try {
        const response = await withRetry(
            () => axios.post(
                'https://api.anthropic.com/v1/messages',
                requestBody,
                {
                    headers: {
                        'x-api-key': ANTHROPIC_API_KEY,
                        'anthropic-version': '2023-06-01',
                        'Content-Type': 'application/json'
                    },
                    timeout: options.timeout || 300000
                }
            ),
            {
                serviceName: 'anthropic',
                operationName: options.operationType || `Anthropic ${model} chat request`,
                retryConfig: {
                    maxRetries: 3,
                    initialDelayMs: 2000,
                    maxDelayMs: 60000
                }
            }
        );

        const usage = response.data.usage || {};
        const inputTokens = usage.input_tokens || 0;
        const outputTokens = usage.output_tokens || 0;
        const totalTokens = inputTokens + outputTokens;
        metrics.trackLLMRequest(buildLLMMetricLabel('anthropic', model), totalTokens, true, inputTokens, outputTokens);

        const content = extractTextFromContentBlocks(response.data?.content);
        if (!content) {
            throw new Error('Anthropic returned empty content');
        }

        return {
            content,
            model,
            actualModel: response.data.model,
            usage: response.data.usage
        };
    } catch (error) {
        metrics.trackLLMRequest(buildLLMMetricLabel('anthropic', model), 0, false, 0, 0);
        if (shouldMarkAnthropicModelUnavailable(error)) {
            void markModelUnavailable('anthropic', model, 'provider_model_access_denied', inferProviderFallbackModel('anthropic', model));
        }
        throw error;
    }
}

export async function callAnthropicVision(systemPrompt, userContent, model, options = {}) {
    if (!ANTHROPIC_API_KEY) {
        throw new Error('Anthropic API key not configured');
    }

    const anthropicContent = userContent.map(item => {
        if (item.type === 'image_url') {
            const dataUrl = item.image_url.url;
            const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
            if (matches) {
                return {
                    type: 'image',
                    source: {
                        type: 'base64',
                        media_type: matches[1],
                        data: matches[2]
                    }
                };
            }
        }
        return { type: 'text', text: item.text || item.content || '' };
    });

    const normalized = buildCapabilityAwareAnthropicOptions('anthropic', model, {
        parameters: options,
        maxTokens: options.max_tokens || 4000,
        temperature: options.temperature,
        topP: options.top_p,
        fallbackMaxTokens: 4000
    });

    const requestBody = {
        model,
        system: [{ type: 'text', text: systemPrompt }],
        messages: [{ role: 'user', content: anthropicContent }],
        max_tokens: normalized.effectiveMaxTokens
    };
    Object.assign(requestBody, normalized.requestParams);
    requestBody.max_tokens = normalized.effectiveMaxTokens;

    try {
        const response = await withRetry(
            () => axios.post(
                'https://api.anthropic.com/v1/messages',
                requestBody,
                {
                    headers: {
                        'x-api-key': ANTHROPIC_API_KEY,
                        'anthropic-version': '2023-06-01',
                        'Content-Type': 'application/json'
                    },
                    timeout: options.timeout || 600000
                }
            ),
            {
                serviceName: 'anthropic',
                operationName: options.operationType || `Anthropic ${model} vision request`,
                retryConfig: {
                    maxRetries: 3,
                    initialDelayMs: 2000,
                    maxDelayMs: 60000
                }
            }
        );

        const usage = response.data.usage || {};
        metrics.trackLLMRequest(buildLLMMetricLabel('anthropic', model), (usage.input_tokens || 0) + (usage.output_tokens || 0), true, usage.input_tokens || 0, usage.output_tokens || 0);

        const content = extractTextFromContentBlocks(response.data?.content);
        if (!content) {
            throw new Error('Anthropic vision returned empty content');
        }

        return {
            content,
            model,
            actualModel: response.data.model,
            usage: response.data.usage
        };
    } catch (error) {
        metrics.trackLLMRequest(buildLLMMetricLabel('anthropic', model), 0, false, 0, 0);
        if (shouldMarkAnthropicModelUnavailable(error)) {
            void markModelUnavailable('anthropic', model, 'provider_model_access_denied', inferProviderFallbackModel('anthropic', model));
        }
        throw error;
    }
}
