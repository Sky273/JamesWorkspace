// ============================================
// LLM SERVICE - OpenAI, Anthropic and Ollama helpers
// ============================================

import axios from 'axios';
import { OPENAI_API_KEY, ANTHROPIC_API_KEY } from '../config/constants.js';
import { getLLMSettings } from './settings.service.js';
import { safeLog } from '../utils/logger.backend.js';
import { metrics } from './metrics.service.js';
import { callOllama, callOllamaWithVision } from './ollama.service.js';

export function getTokenParameter(model, tokenLimit) {
    const requiresCompletionTokens = model.match(/^(gpt-5(\.\d+)?(-\w+)?|gpt-4\.1|chatgpt-5|gpt-4o-2024-08-06|gpt-4o-2024-11-20|gpt-4o-mini-2024-07-18)/i);

    if (requiresCompletionTokens) {
        return { max_completion_tokens: tokenLimit };
    }

    return { max_tokens: tokenLimit };
}

export function supportsCustomTemperature(model) {
    const gpt5Model = model.match(/^(gpt-5(\.\d+)?(-\w+)?|chatgpt-5)/i);
    return !gpt5Model;
}

export function buildOpenAIParams(model, baseParams) {
    const params = {
        model,
        ...getTokenParameter(model, baseParams.maxTokens),
        ...baseParams.additionalParams
    };

    if (baseParams.temperature !== undefined && supportsCustomTemperature(model)) {
        params.temperature = baseParams.temperature;
    }

    if (baseParams.topP !== undefined) {
        params.top_p = baseParams.topP;
    }

    return params;
}

function buildRequestOptions(options = {}) {
    return {
        temperature: options.temperature,
        max_tokens: options.max_tokens || options.max_completion_tokens || options.max_output_tokens
    };
}

function getMetricsProviderLabel(provider, model) {
    return provider === 'ollama' ? `ollama:${model}` : model;
}

export async function callLLM(messages, options = {}) {
    try {
        const settings = await getLLMSettings();
        const model = settings.llmProvider === 'ollama' ? null : (settings.llmModel || 'gpt-4o');
        const provider = settings.llmProvider || 'openai';

        safeLog('info', 'Calling LLM', {
            model,
            provider,
            messageCount: messages.length,
            temperature: options.temperature,
            maxTokens: options.max_tokens,
            hasOpenAIKey: !!OPENAI_API_KEY,
            hasAnthropicKey: !!ANTHROPIC_API_KEY
        });

        if (provider === 'anthropic') {
            return await callAnthropic(messages, model, options);
        }

        if (provider === 'ollama') {
            const result = await callOllama(messages, model, settings, buildRequestOptions(options));
            metrics.trackLLMRequest(getMetricsProviderLabel(provider, result.actualModel || model), result.usage?.total_tokens || 0, true, result.usage?.prompt_tokens || 0, result.usage?.completion_tokens || 0);
            return result;
        }

        return await callOpenAI(messages, model, options);
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
            timeout: 300000
        }
    );

    const usage = response.data.usage || {};
    const inputTokens = usage.prompt_tokens || 0;
    const outputTokens = usage.completion_tokens || 0;
    const totalTokens = usage.total_tokens || (inputTokens + outputTokens);
    metrics.trackLLMRequest(model, totalTokens, true, inputTokens, outputTokens);

    const choices = response.data?.choices;
    if (!choices || choices.length === 0) {
        throw new Error('OpenAI returned no choices');
    }

    const content = choices[0]?.message?.content;
    if (!content) {
        if (choices[0]?.finish_reason === 'length') {
            throw new Error('Response truncated due to token limit');
        }
        throw new Error('OpenAI returned empty content');
    }

    return {
        content,
        model,
        actualModel: response.data.model,
        usage: response.data.usage
    };
}

async function callAnthropic(messages, model, options) {
    if (!ANTHROPIC_API_KEY) {
        throw new Error('Anthropic API key not configured');
    }

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
            timeout: 300000
        }
    );

    const usage = response.data.usage || {};
    const inputTokens = usage.input_tokens || 0;
    const outputTokens = usage.output_tokens || 0;
    const totalTokens = inputTokens + outputTokens;
    metrics.trackLLMRequest(model, totalTokens, true, inputTokens, outputTokens);

    return {
        content: response.data.content[0].text,
        model,
        actualModel: response.data.model,
        usage: response.data.usage
    };
}

export async function callLLMWithVision(systemPrompt, userContent, options = {}) {
    try {
        const settings = await getLLMSettings();
        const model = settings.llmProvider === 'ollama' ? null : (settings.llmModel || 'gpt-4o');
        const provider = settings.llmProvider || 'openai';

        safeLog('info', 'Calling LLM with vision', {
            model,
            provider,
            contentItems: userContent.length,
            hasImages: userContent.some(c => c.type === 'image_url')
        });

        if (provider === 'anthropic') {
            return await callAnthropicWithVision(systemPrompt, userContent, model, options);
        }

        if (provider === 'ollama') {
            const result = await callOllamaWithVision(systemPrompt, userContent, model, settings, buildRequestOptions(options));
            metrics.trackLLMRequest(getMetricsProviderLabel(provider, result.actualModel || model), result.usage?.total_tokens || 0, true, result.usage?.prompt_tokens || 0, result.usage?.completion_tokens || 0);
            return result;
        }

        return await callOpenAIWithVision(systemPrompt, userContent, model, options);
    } catch (error) {
        safeLog('error', 'LLM vision call failed', {
            error: error.message,
            stack: error.stack
        });
        throw error;
    }
}

async function callOpenAIWithVision(systemPrompt, userContent, model, options) {
    if (!OPENAI_API_KEY) {
        throw new Error('OpenAI API key not configured');
    }

    const visionModel = model.includes('gpt-4') ? model : 'gpt-4o';

    const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent }
    ];

    const requestBody = {
        model: visionModel,
        messages,
        ...getTokenParameter(visionModel, options.max_tokens || 4000)
    };

    if (options.temperature !== undefined && supportsCustomTemperature(visionModel)) {
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
            timeout: 600000
        }
    );

    const usage = response.data.usage || {};
    metrics.trackLLMRequest(visionModel, usage.total_tokens || 0, true, usage.prompt_tokens || 0, usage.completion_tokens || 0);

    const content = response.data.choices?.[0]?.message?.content;
    if (!content) {
        throw new Error('OpenAI vision returned empty content');
    }

    return {
        content,
        model: visionModel,
        actualModel: response.data.model,
        usage: response.data.usage
    };
}

async function callAnthropicWithVision(systemPrompt, userContent, model, options) {
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

    const requestBody = {
        model,
        system: systemPrompt,
        messages: [{ role: 'user', content: anthropicContent }],
        max_tokens: options.max_tokens || 4000
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
    metrics.trackLLMRequest(model, (usage.input_tokens || 0) + (usage.output_tokens || 0), true, usage.input_tokens || 0, usage.output_tokens || 0);

    return {
        content: response.data.content[0].text,
        model,
        actualModel: response.data.model,
        usage: response.data.usage
    };
}
