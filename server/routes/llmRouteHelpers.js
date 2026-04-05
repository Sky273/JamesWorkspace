export const LLM_FAMILY_INDICATORS = ['openai', 'anthropic', 'deepseek', 'glm', 'minimax', 'ollama'];

export function normalizeCircuitBreakerIndicator(provider, indicator) {
    if (indicator && typeof indicator === 'object' && !Array.isArray(indicator)) {
        return {
            provider,
            supported: provider !== 'ollama',
            state: indicator.state || 'UNKNOWN',
            failures: indicator.failures || 0,
            lastFailureTime: indicator.lastFailureTime || null
        };
    }

    if (typeof indicator === 'string') {
        return {
            provider,
            supported: provider !== 'ollama',
            state: indicator.toUpperCase(),
            failures: 0,
            lastFailureTime: null
        };
    }

    if (provider === 'ollama') {
        return {
            provider,
            supported: false,
            state: 'NOT_APPLICABLE',
            failures: 0,
            lastFailureTime: null
        };
    }

    return {
        provider,
        supported: true,
        state: 'UNKNOWN',
        failures: 0,
        lastFailureTime: null
    };
}

export function buildCircuitBreakerIndicators(states = {}) {
    return Object.fromEntries(LLM_FAMILY_INDICATORS.map((provider) => [
        provider,
        normalizeCircuitBreakerIndicator(provider, states[provider])
    ]));
}

export function buildConfiguredCircuitBreakerIndicators(states = {}, configuredProviders = {}) {
    const indicators = buildCircuitBreakerIndicators(states);

    for (const [provider, configured] of Object.entries(configuredProviders)) {
        if (indicators[provider]) {
            indicators[provider].configured = Boolean(configured);
        }
    }

    return indicators;
}

export function validateMessageLengths(messages, flattenLlmTextContent, maxPromptLength) {
    if (!messages || !Array.isArray(messages)) {
        return null;
    }

    for (const message of messages) {
        const content = flattenLlmTextContent(message.content);
        if (content && content.length > maxPromptLength) {
            return `Message content exceeds maximum length of ${maxPromptLength}`;
        }
    }

    return null;
}

export function getRequestedMaxTokens(body = {}) {
    return body.max_tokens || body.max_completion_tokens || body.max_output_tokens || 4096;
}

export function isGpt5ResponsesModel(model, allowResponsesApi = true) {
    return Boolean(allowResponsesApi && model?.match(/^gpt-5/i));
}

export function buildOpenAIProxyRequest({ model, body = {}, allowResponsesApi = true }) {
    if (isGpt5ResponsesModel(model, allowResponsesApi)) {
        const {
            messages,
            input,
            response_format: responseFormat,
            reasoning_effort: reasoningEffort,
            max_tokens: maxTokens,
            max_completion_tokens: maxCompletionTokens,
            max_output_tokens: maxOutputTokens,
            verbosity,
            ...passthroughBody
        } = body;
        const requestBody = {
            model,
            input: messages || input,
            ...passthroughBody
        };
        const isProModel = Boolean(model.match(/gpt-5\.\d+-pro/i));
        requestBody.reasoning = { effort: reasoningEffort || (isProModel ? 'medium' : 'none') };

        if (responseFormat || verbosity) {
            requestBody.text = {
                ...(responseFormat ? { format: responseFormat } : {}),
                ...(verbosity ? { verbosity } : {})
            };
        }

        if (maxTokens) {
            requestBody.max_output_tokens = maxTokens;
        } else if (maxCompletionTokens) {
            requestBody.max_output_tokens = maxCompletionTokens;
        } else if (maxOutputTokens) {
            requestBody.max_output_tokens = maxOutputTokens;
        }

        return {
            openAiUrl: 'https://api.openai.com/v1/responses',
            requestBody,
            usesResponsesApi: true
        };
    }

    return {
        openAiUrl: 'https://api.openai.com/v1/chat/completions',
        requestBody: {
            ...body,
            model
        },
        usesResponsesApi: false
    };
}

export function extractUsageTokens(usage = {}) {
    const inputTokens = usage.input_tokens || usage.prompt_tokens || 0;
    const outputTokens = usage.output_tokens || usage.completion_tokens || 0;
    const totalTokens = usage.total_tokens || (inputTokens + outputTokens);

    return {
        inputTokens,
        outputTokens,
        totalTokens
    };
}
