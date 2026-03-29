import { resolveAvailableModel } from './llmAvailability.service.js';

export const LLM_PROVIDER_DEFAULT_MODELS = {
    openai: 'gpt-4o',
    anthropic: 'claude-3-5-sonnet-20241022',
    deepseek: 'deepseek-chat',
    glm: 'glm-5.1',
    minimax: 'MiniMax-M2.7',
    ollama: null
};

export function getProviderDefaultModel(provider) {
    return LLM_PROVIDER_DEFAULT_MODELS[provider] || LLM_PROVIDER_DEFAULT_MODELS.openai;
}

export function inferProviderFallbackModel(provider, model = '') {
    const normalizedProvider = String(provider || '').trim().toLowerCase();
    const normalizedModel = String(model || '').trim();

    if (!normalizedModel) {
        return null;
    }

    if (normalizedProvider === 'glm') {
        if (normalizedModel === 'glm-5.1') return 'glm-5';
        return null;
    }

    if (normalizedProvider === 'deepseek') {
        if (normalizedModel === 'deepseek-reasoner') return 'deepseek-chat';
        return null;
    }

    if (normalizedProvider === 'openai') {
        if (normalizedModel === 'gpt-5.4-pro') return 'gpt-5.4';
        if (normalizedModel === 'gpt-5.2-pro') return 'gpt-5.2';
        if (normalizedModel === 'gpt-5.1') return 'gpt-5';
        if (normalizedModel === 'gpt-5') return 'gpt-5-mini';
        if (normalizedModel === 'gpt-4.1') return 'gpt-4.1-mini';
        if (normalizedModel === 'gpt-4o') return 'gpt-4o-mini';
        return null;
    }

    if (normalizedProvider === 'anthropic') {
        if (normalizedModel === 'claude-opus-4-1-20250805') return 'claude-opus-4-20250514';
        if (normalizedModel === 'claude-opus-4-20250514') return 'claude-sonnet-4-20250514';
        if (normalizedModel === 'claude-3-7-sonnet-20250219') return 'claude-3-5-sonnet-20241022';
        return null;
    }

    if (normalizedProvider === 'minimax' && /-highspeed$/i.test(normalizedModel)) {
        return normalizedModel.replace(/-highspeed$/i, '');
    }

    return null;
}

export function isLikelyOpenAIModel(model = '') {
    return /^(gpt|chatgpt|o\d|text-embedding|whisper|davinci|babbage|omni)/i.test(String(model || '').trim());
}

export function isLikelyAnthropicModel(model = '') {
    return /^claude/i.test(String(model || '').trim());
}

export function isLikelyDeepSeekModel(model = '') {
    return /^deepseek/i.test(String(model || '').trim());
}

export function isLikelyGlmModel(model = '') {
    return /^glm/i.test(String(model || '').trim());
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
        : (requestedModel || settings.llmModel || getProviderDefaultModel(provider));

    const resolved = resolveAvailableModel(provider, candidateModel, getProviderDefaultModel(provider));
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
                model: isLikelyAnthropicModel(candidateModel) ? candidateModel : getProviderDefaultModel('anthropic')
            };
        }

    if (configuredProvider === 'glm' || (candidateModel && isLikelyGlmModel(candidateModel))) {
        if (responseShape === 'openai') {
            return {
                provider: 'glm',
                model: resolveLLMModel({ provider: 'glm', settings, requestedModel })
            };
        }

            return {
                provider: 'anthropic',
                model: isLikelyAnthropicModel(candidateModel) ? candidateModel : getProviderDefaultModel('anthropic')
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
        isLikelyGlmModel(candidateModel) ||
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
