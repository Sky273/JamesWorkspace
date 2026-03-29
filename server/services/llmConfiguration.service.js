import { resolveAvailableModel } from './llmAvailability.service.js';

export const LLM_PROVIDER_DEFAULT_MODELS = {
    openai: 'gpt-4o',
    anthropic: 'claude-3-5-sonnet-20241022',
    deepseek: 'deepseek-chat',
    minimax: 'MiniMax-M2.7',
    ollama: null
};

export function isLikelyOpenAIModel(model = '') {
    return /^(gpt|chatgpt|o\d|text-embedding|whisper|davinci|babbage|omni)/i.test(String(model || '').trim());
}

export function isLikelyAnthropicModel(model = '') {
    return /^claude/i.test(String(model || '').trim());
}

export function isLikelyDeepSeekModel(model = '') {
    return /^deepseek/i.test(String(model || '').trim());
}

export function isLikelyMiniMaxModel(model = '') {
    return /^minimax/i.test(String(model || '').trim());
}

export function resolveLLMProvider(settings = {}) {
    return settings.llmProvider || 'openai';
}

export function resolveLLMModel({ provider, settings = {}, requestedModel } = {}) {
    const candidateModel = provider === 'ollama'
        ? (requestedModel || settings.llmModel || null)
        : (requestedModel || settings.llmModel || LLM_PROVIDER_DEFAULT_MODELS[provider] || LLM_PROVIDER_DEFAULT_MODELS.openai);

    const resolved = resolveAvailableModel(provider, candidateModel, LLM_PROVIDER_DEFAULT_MODELS[provider] || LLM_PROVIDER_DEFAULT_MODELS.openai);
    return resolved.model;
}

export function resolveLLMRuntimeConfig(settings = {}, requestedModel) {
    const provider = resolveLLMProvider(settings);
    const model = resolveLLMModel({ provider, settings, requestedModel });
    return { provider, model };
}

export function resolveCompatibleProviderRuntimeConfig({ settings = {}, requestedModel, responseShape = 'openai' } = {}) {
    const configuredProvider = resolveLLMProvider(settings);
    const candidateModel = String(requestedModel || settings.llmModel || '').trim();

    if (configuredProvider === 'ollama') {
        return {
            provider: 'ollama',
            model: resolveLLMModel({ provider: 'ollama', settings, requestedModel })
        };
    }

    if (configuredProvider === 'deepseek' || (candidateModel && isLikelyDeepSeekModel(candidateModel))) {
        if (responseShape === 'openai') {
            return {
                provider: 'deepseek',
                model: resolveLLMModel({ provider: 'deepseek', settings, requestedModel })
            };
        }

        return {
            provider: 'anthropic',
            model: isLikelyAnthropicModel(candidateModel) ? candidateModel : LLM_PROVIDER_DEFAULT_MODELS.anthropic
        };
    }

    if (configuredProvider === 'minimax' || (candidateModel && isLikelyMiniMaxModel(candidateModel))) {
        return {
            provider: 'minimax',
            model: resolveLLMModel({ provider: 'minimax', settings, requestedModel })
        };
    }

    const looksLikeKnownHostedModel =
        isLikelyOpenAIModel(candidateModel) ||
        isLikelyAnthropicModel(candidateModel) ||
        isLikelyDeepSeekModel(candidateModel) ||
        isLikelyMiniMaxModel(candidateModel);

    if (candidateModel && !looksLikeKnownHostedModel && settings?.ollamaBaseUrl) {
        return {
            provider: 'ollama',
            model: resolveLLMModel({ provider: 'ollama', settings, requestedModel })
        };
    }

    const provider = responseShape === 'anthropic' ? 'anthropic' : 'openai';
    return {
        provider,
        model: resolveLLMModel({ provider, settings, requestedModel })
    };
}
