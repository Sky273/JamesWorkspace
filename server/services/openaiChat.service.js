import { buildLLMMetricLabel, metrics } from './metrics.service.js';
import { stripLlmThinkingContent } from './openai/textUtils.js';
import { callOpenAIWithCircuitBreaker } from './openai/apiClient.js';

export async function callOpenAIChat(messages, model, options = {}) {
    const response = await callOpenAIWithCircuitBreaker({
        model,
        messages,
        maxTokens: options.max_tokens || 1000,
        temperature: options.temperature,
        topP: options.top_p,
        responseFormat: options.response_format,
        timeout: options.timeout || 300000,
        operationType: options.operationType || `OpenAI ${model} chat request`
    });

    const usage = response.usage || {};
    const inputTokens = usage.prompt_tokens || 0;
    const outputTokens = usage.completion_tokens || 0;
    const totalTokens = usage.total_tokens || (inputTokens + outputTokens);
    metrics.trackLLMRequest(buildLLMMetricLabel('openai', model), totalTokens, true, inputTokens, outputTokens);

    const choices = response?.choices;
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
        actualModel: response.model,
        usage: response.usage
    };
}

export async function callOpenAIVisionChat(systemPrompt, userContent, model, options = {}) {
    const visionModel = model.includes('gpt-4') ? model : 'gpt-4o';
    const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent }
    ];
    const response = await callOpenAIWithCircuitBreaker({
        model: visionModel,
        messages,
        maxTokens: options.max_tokens || 4000,
        temperature: options.temperature,
        topP: options.top_p,
        timeout: options.timeout || 600000,
        operationType: options.operationType || `OpenAI ${visionModel} vision request`
    });

    const usage = response.usage || {};
    metrics.trackLLMRequest(buildLLMMetricLabel('openai', visionModel), usage.total_tokens || 0, true, usage.prompt_tokens || 0, usage.completion_tokens || 0);

    const content = stripLlmThinkingContent(response.choices?.[0]?.message?.content);
    if (!content) {
        throw new Error('OpenAI vision returned empty content');
    }

    return {
        content,
        model: visionModel,
        actualModel: response.model,
        usage: response.usage
    };
}
