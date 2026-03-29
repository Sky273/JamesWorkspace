import axios from 'axios';
import { ANTHROPIC_API_KEY } from '../config/constants.js';
import { buildLLMMetricLabel, metrics } from './metrics.service.js';
import { extractTextFromContentBlocks } from './llmContent.service.js';
import { normalizeAnthropicContent } from './llmProviderCommon.service.js';
import { clampModelMaxOutputTokens } from './llmModelCapabilities.service.js';

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

    const { effectiveMaxTokens } = clampModelMaxOutputTokens('anthropic', model, options.max_tokens || 1000, 1000);

    const requestBody = {
        model,
        messages: conversationMessages,
        max_tokens: effectiveMaxTokens
    };

    if (systemMessages.length > 0) {
        requestBody.system = systemMessages
            .flatMap(message => normalizeAnthropicContent(message.content))
            .filter(Boolean);
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
            timeout: 300000
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

    const { effectiveMaxTokens } = clampModelMaxOutputTokens('anthropic', model, options.max_tokens || 4000, 4000);

    const requestBody = {
        model,
        system: [{ type: 'text', text: systemPrompt }],
        messages: [{ role: 'user', content: anthropicContent }],
        max_tokens: effectiveMaxTokens
    };

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
            timeout: 600000
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
}
