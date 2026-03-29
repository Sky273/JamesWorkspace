/**
 * Central model capabilities for hosted LLM providers.
 * Values are intentionally limited to models we expose or pattern-match in this app.
 */

const PROVIDER_CAPABILITIES = {
    openai: [
        {
            match: /^gpt-5.4-pro(?:$|-)/i,
            maxOutputTokens: 128000,
            tokenParameter: 'max_completion_tokens',
            defaultReasoningEffort: 'medium',
            reasoningEfforts: ['medium', 'high', 'xhigh'],
            responsesPreferred: true,
            responsesOnly: true
        },
        {
            match: /^gpt-5.4(?:$|-)/i,
            maxOutputTokens: 128000,
            tokenParameter: 'max_completion_tokens',
            defaultReasoningEffort: 'none',
            reasoningEfforts: ['none', 'low', 'medium', 'high', 'xhigh'],
            responsesPreferred: true
        },
        {
            match: /^gpt-5.2-pro(?:$|-)/i,
            maxOutputTokens: 128000,
            tokenParameter: 'max_completion_tokens',
            defaultReasoningEffort: 'medium',
            reasoningEfforts: ['medium', 'high', 'xhigh'],
            responsesPreferred: true,
            responsesOnly: true
        },
        {
            match: /^gpt-5.2(?:$|-)/i,
            maxOutputTokens: 128000,
            tokenParameter: 'max_completion_tokens',
            defaultReasoningEffort: 'none',
            reasoningEfforts: ['none', 'low', 'medium', 'high', 'xhigh'],
            responsesPreferred: true
        },
        {
            match: /^gpt-5.1(?:$|-)/i,
            maxOutputTokens: 128000,
            tokenParameter: 'max_completion_tokens',
            defaultReasoningEffort: 'none',
            reasoningEfforts: ['none', 'low', 'medium', 'high'],
            responsesPreferred: true
        },
        {
            match: /^gpt-5(?:$|-)/i,
            maxOutputTokens: 128000,
            tokenParameter: 'max_completion_tokens',
            defaultReasoningEffort: 'medium',
            reasoningEfforts: ['minimal', 'low', 'medium', 'high'],
            responsesPreferred: true
        },
        {
            match: /^gpt-4.1(?:$|-)/i,
            maxOutputTokens: 32768,
            tokenParameter: 'max_completion_tokens'
        },
        {
            match: /^gpt-4o(?:$|-)/i,
            maxOutputTokens: 16384,
            tokenParameter: 'max_tokens'
        }
    ],
    anthropic: [
        {
            match: /^claude-opus-4-1-20250805$/i,
            maxOutputTokens: 32000,
            tokenParameter: 'max_tokens',
            disallowTemperatureAndTopP: true
        },
        {
            match: /^claude-opus-4-20250514$/i,
            maxOutputTokens: 32000,
            tokenParameter: 'max_tokens'
        },
        {
            match: /^claude-sonnet-4-20250514$/i,
            maxOutputTokens: 64000,
            tokenParameter: 'max_tokens'
        },
        {
            match: /^claude-3-7-sonnet-20250219$/i,
            maxOutputTokens: 64000,
            tokenParameter: 'max_tokens',
            maxOutputTokensWithBeta: 128000,
            betaHeader: 'output-128k-2025-02-19'
        },
        {
            match: /^claude-3-5-sonnet-20241022$/i,
            maxOutputTokens: 8192,
            tokenParameter: 'max_tokens'
        },
        {
            match: /^claude-3-5-haiku-20241022$/i,
            maxOutputTokens: 8192,
            tokenParameter: 'max_tokens'
        },
        {
            match: /^claude-3-haiku-20240307$/i,
            maxOutputTokens: 4096,
            tokenParameter: 'max_tokens'
        }
    ],
    deepseek: [
        {
            match: /^deepseek-chat$/i,
            maxOutputTokens: 8192,
            tokenParameter: 'max_tokens'
        },
        {
            match: /^deepseek-reasoner$/i,
            maxOutputTokens: 64000,
            tokenParameter: 'max_tokens'
        }
    ],
    minimax: [
        {
            match: /^MiniMax-M2$/i,
            maxOutputTokens: 128000,
            tokenParameter: 'max_tokens',
            supportsResponseFormat: false,
            temperatureRange: { min: 0, maxExclusive: 1 },
            topPRange: { min: 0, maxInclusive: 1 }
        },
        {
            match: /^MiniMax-M2.7(?:-highspeed)?$/i,
            tokenParameter: 'max_tokens',
            supportsResponseFormat: false,
            temperatureRange: { min: 0, maxExclusive: 1 },
            topPRange: { min: 0, maxInclusive: 1 }
        },
        {
            match: /^MiniMax-M2.5(?:-highspeed)?$/i,
            tokenParameter: 'max_tokens',
            supportsResponseFormat: false,
            temperatureRange: { min: 0, maxExclusive: 1 },
            topPRange: { min: 0, maxInclusive: 1 }
        },
        {
            match: /^MiniMax-M2.1(?:-highspeed)?$/i,
            tokenParameter: 'max_tokens',
            supportsResponseFormat: false,
            temperatureRange: { min: 0, maxExclusive: 1 },
            topPRange: { min: 0, maxInclusive: 1 }
        },
        {
            match: /^M2-her$/i,
            tokenParameter: 'max_tokens',
            supportsResponseFormat: false,
            temperatureRange: { min: 0, maxExclusive: 1 },
            topPRange: { min: 0, maxInclusive: 1 }
        }
    ]
};

export function getModelCapabilities(provider, model) {
    const providerKey = String(provider || '').trim().toLowerCase();
    const normalizedModel = String(model || '').trim();
    const capabilities = PROVIDER_CAPABILITIES[providerKey] || [];
    return capabilities.find(entry => entry.match.test(normalizedModel)) || null;
}

export function clampModelMaxOutputTokens(provider, model, requestedMaxTokens, fallbackMaxTokens = 4096) {
    const capabilities = getModelCapabilities(provider, model);
    const parsedRequestedMaxTokens = Number.isFinite(requestedMaxTokens)
        ? Math.floor(requestedMaxTokens)
        : fallbackMaxTokens;
    const sanitizedRequestedMaxTokens = Math.max(1, parsedRequestedMaxTokens);
    const providerCap = capabilities?.maxOutputTokens;

    return {
        requestedMaxTokens: sanitizedRequestedMaxTokens,
        effectiveMaxTokens: typeof providerCap === 'number'
            ? Math.min(sanitizedRequestedMaxTokens, providerCap)
            : sanitizedRequestedMaxTokens,
        providerCap: typeof providerCap === 'number' ? providerCap : null,
        capabilities
    };
}
