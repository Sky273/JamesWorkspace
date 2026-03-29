import axios from 'axios';
import { OPENAI_API_KEY } from '../config/constants.js';
import { buildLLMMetricLabel, metrics } from './metrics.service.js';
import { stripLlmThinkingContent } from './openai/textUtils.js';
import { buildCapabilityAwareOpenAICompatibleParams } from './llmPayloadCapabilities.service.js';

export async function callOpenAIChat(messages, model, options = {}) {
    if (!OPENAI_API_KEY) {
        throw new Error('OpenAI API key not configured');
    }

    const normalized = buildCapabilityAwareOpenAICompatibleParams('openai', model, {
        maxTokens: options.max_tokens || 1000,
        temperature: options.temperature,
        topP: options.top_p,
        responseFormat: options.response_format,
        additionalParams: { messages },
        fallbackMaxTokens: 1000
    });

    const requestBody = normalized.requestParams;

    const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        requestBody,
        {
            headers: {
                Authorization: `Bearer ${OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            },
            timeout: 300000
        }
    );

    const usage = response.data.usage || {};
    const inputTokens = usage.prompt_tokens || 0;
    const outputTokens = usage.completion_tokens || 0;
    const totalTokens = usage.total_tokens || (inputTokens + outputTokens);
    metrics.trackLLMRequest(buildLLMMetricLabel('openai', model), totalTokens, true, inputTokens, outputTokens);

    const choices = response.data?.choices;
    if (!choices || choices.length === 0) {
        throw new Error('OpenAI returned no choices');
    }

    const content = stripLlmThinkingContent(choices[0]?.message?.content);
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

export async function callOpenAIVisionChat(systemPrompt, userContent, model, options = {}) {
    if (!OPENAI_API_KEY) {
        throw new Error('OpenAI API key not configured');
    }

    const visionModel = model.includes('gpt-4') ? model : 'gpt-4o';
    const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent }
    ];

    const normalized = buildCapabilityAwareOpenAICompatibleParams('openai', visionModel, {
        maxTokens: options.max_tokens || 4000,
        temperature: options.temperature,
        topP: options.top_p,
        additionalParams: { messages },
        fallbackMaxTokens: 4000
    });

    const requestBody = normalized.requestParams;

    const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        requestBody,
        {
            headers: {
                Authorization: `Bearer ${OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            },
            timeout: 600000
        }
    );

    const usage = response.data.usage || {};
    metrics.trackLLMRequest(buildLLMMetricLabel('openai', visionModel), usage.total_tokens || 0, true, usage.prompt_tokens || 0, usage.completion_tokens || 0);

    const content = stripLlmThinkingContent(response.data.choices?.[0]?.message?.content);
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
