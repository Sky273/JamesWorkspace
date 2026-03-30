const MAX_LLM_PROVIDER_KEYS = 50;
const LLM_PROVIDER_FALLBACK_KEY = 'other';

function sanitizeLLMMetricPart(value) {
    const sanitized = String(value || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9._-]/g, '')
        .slice(0, 40);

    return sanitized || 'unknown';
}

export function buildLLMMetricLabel(provider, model = '') {
    const normalizedProvider = sanitizeLLMMetricPart(provider);
    if (!model) {
        return normalizedProvider;
    }

    return `${normalizedProvider}:${sanitizeLLMMetricPart(model)}`;
}

export function normalizeLLMProviderKey(provider) {
    const [rawProvider = 'unknown', ...rawModelParts] = String(provider || 'unknown').split(':');
    return buildLLMMetricLabel(rawProvider, rawModelParts.join(':'));
}

export function pruneLLMProviderStats(byProvider) {
    const entries = Object.entries(byProvider);
    if (entries.length <= MAX_LLM_PROVIDER_KEYS) {
        return byProvider;
    }

    const fallbackStats = byProvider[LLM_PROVIDER_FALLBACK_KEY] || {
        requests: 0,
        totalTokens: 0,
        inputTokens: 0,
        outputTokens: 0
    };

    const sortedEntries = entries
        .filter(([key]) => key !== LLM_PROVIDER_FALLBACK_KEY)
        .sort(([, a], [, b]) => b.requests - a.requests);

    const keptEntries = sortedEntries.slice(0, MAX_LLM_PROVIDER_KEYS - 1);
    const prunedEntries = sortedEntries.slice(MAX_LLM_PROVIDER_KEYS - 1);

    const mergedFallback = prunedEntries.reduce((acc, [, stats]) => ({
        requests: acc.requests + (stats.requests || 0),
        totalTokens: acc.totalTokens + (stats.totalTokens || 0),
        inputTokens: acc.inputTokens + (stats.inputTokens || 0),
        outputTokens: acc.outputTokens + (stats.outputTokens || 0)
    }), { ...fallbackStats });

    return Object.fromEntries([
        ...keptEntries,
        [LLM_PROVIDER_FALLBACK_KEY, mergedFallback]
    ]);
}

export function getTrackedLLMProviderKey(byProvider, provider) {
    const normalizedKey = normalizeLLMProviderKey(provider);
    if (byProvider[normalizedKey]) {
        return normalizedKey;
    }

    const hasFallbackBucket = Boolean(byProvider[LLM_PROVIDER_FALLBACK_KEY]);
    const maxDistinctKeys = hasFallbackBucket ? MAX_LLM_PROVIDER_KEYS : MAX_LLM_PROVIDER_KEYS - 1;

    if (Object.keys(byProvider).length < maxDistinctKeys) {
        return normalizedKey;
    }

    return LLM_PROVIDER_FALLBACK_KEY;
}

export function getModelPricing(model) {
    const modelLower = model.toLowerCase();

    if (modelLower.includes('gpt-5.2-pro')) return { input: 21.00, output: 168.00 };
    if (modelLower.includes('gpt-5.2')) return { input: 1.75, output: 14.00 };
    if (modelLower.includes('gpt-5-nano') || modelLower.includes('gpt-5.2-nano')) return { input: 0.05, output: 0.40 };
    if (modelLower.includes('gpt-5-mini') || modelLower.includes('gpt-5.2-mini')) return { input: 0.25, output: 2.00 };
    if (modelLower.includes('gpt-5.1')) return { input: 4.00, output: 12.00 };
    if (modelLower.includes('gpt-5-pro')) return { input: 8.00, output: 24.00 };
    if (modelLower.includes('gpt-5-codex')) return { input: 6.00, output: 18.00 };
    if (modelLower.includes('gpt-5')) return { input: 3.00, output: 10.00 };
    if (modelLower.includes('gpt-4.1-nano')) return { input: 0.10, output: 0.40 };
    if (modelLower.includes('gpt-4.1-mini')) return { input: 0.40, output: 1.60 };
    if (modelLower.includes('gpt-4.1')) return { input: 2.00, output: 8.00 };
    if (modelLower.includes('gpt-4o-mini')) return { input: 0.15, output: 0.60 };
    if (modelLower.includes('gpt-4o')) return { input: 2.50, output: 10.00 };
    if (modelLower.includes('gpt-4-turbo')) return { input: 10.00, output: 30.00 };
    if (modelLower.includes('gpt-4')) return { input: 30.00, output: 60.00 };
    if (modelLower.includes('gpt-3.5-turbo')) return { input: 0.50, output: 1.50 };
    if (modelLower.includes('o3-pro')) return { input: 20.00, output: 80.00 };
    if (modelLower.includes('o3-mini')) return { input: 1.10, output: 4.40 };
    if (modelLower.includes('o3')) return { input: 10.00, output: 40.00 };
    if (modelLower.includes('o1-pro')) return { input: 150.00, output: 600.00 };
    if (modelLower.includes('o1-preview')) return { input: 15.00, output: 60.00 };
    if (modelLower.includes('o1-mini')) return { input: 3.00, output: 12.00 };
    if (modelLower.includes('o1')) return { input: 15.00, output: 60.00 };
    if (modelLower.includes('claude-opus-4.6') || modelLower.includes('claude-4-opus')) return { input: 5.00, output: 25.00 };
    if (modelLower.includes('claude-sonnet-4.6') || modelLower.includes('claude-4-sonnet')) return { input: 3.00, output: 15.00 };
    if (modelLower.includes('claude-haiku-4.5') || modelLower.includes('claude-4-haiku')) return { input: 1.00, output: 5.00 };
    if (modelLower.includes('claude-3-opus') || modelLower.includes('claude-opus-4.1')) return { input: 15.00, output: 75.00 };
    if (modelLower.includes('claude-3-5-sonnet') || modelLower.includes('claude-3.5-sonnet')) return { input: 3.00, output: 15.00 };
    if (modelLower.includes('claude-3-sonnet')) return { input: 3.00, output: 15.00 };
    if (modelLower.includes('claude-3-haiku')) return { input: 0.25, output: 1.25 };
    if (modelLower.includes('claude')) return { input: 3.00, output: 15.00 };

    return { input: 1.75, output: 14.00 };
}

export function calculateLLMCost(byProvider) {
    let totalCost = 0;

    for (const [provider, stats] of Object.entries(byProvider)) {
        const pricing = getModelPricing(provider);

        if (stats.inputTokens > 0 || stats.outputTokens > 0) {
            const inputCost = (stats.inputTokens / 1_000_000) * pricing.input;
            const outputCost = (stats.outputTokens / 1_000_000) * pricing.output;
            totalCost += inputCost + outputCost;
        } else if (stats.totalTokens > 0) {
            const estimatedInput = stats.totalTokens * 0.7;
            const estimatedOutput = stats.totalTokens * 0.3;
            const inputCost = (estimatedInput / 1_000_000) * pricing.input;
            const outputCost = (estimatedOutput / 1_000_000) * pricing.output;
            totalCost += inputCost + outputCost;
        }
    }

    return totalCost.toFixed(4);
}

export function calculateCostByProvider(byProvider) {
    const costs = {};

    for (const [provider, stats] of Object.entries(byProvider)) {
        const pricing = getModelPricing(provider);

        let inputTokens = stats.inputTokens;
        let outputTokens = stats.outputTokens;
        let isEstimated = false;

        if (inputTokens === 0 && outputTokens === 0 && stats.totalTokens > 0) {
            inputTokens = Math.round(stats.totalTokens * 0.7);
            outputTokens = Math.round(stats.totalTokens * 0.3);
            isEstimated = true;
        }

        const inputCost = (inputTokens / 1_000_000) * pricing.input;
        const outputCost = (outputTokens / 1_000_000) * pricing.output;

        costs[provider] = {
            inputCost: inputCost.toFixed(4),
            outputCost: outputCost.toFixed(4),
            totalCost: (inputCost + outputCost).toFixed(4),
            inputTokens,
            outputTokens,
            isEstimated
        };
    }

    return costs;
}
