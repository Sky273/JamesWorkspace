import { resolveAvailableModel } from './llmAvailability.service.js';

export const LLM_PROVIDER_DEFAULT_MODELS = {
    openai: 'gpt-4o',
    anthropic: 'claude-3-5-sonnet-20241022',
    huggingface: 'MiniMaxAI/MiniMax-M2.7',
    gemma: 'gemma-4-31b-it',
    deepseek: 'deepseek-chat',
    glm: 'glm-5.1',
    minimax: 'MiniMax-M2.7',
    ollama: null
};

export const ALL_SUPPORTED_LLM_PROVIDERS = Object.freeze(Object.keys(LLM_PROVIDER_DEFAULT_MODELS));

const HUGGINGFACE_MODEL_ALIASES = Object.freeze({
    'minimax-m2.7:cloud': 'MiniMaxAI/MiniMax-M2.7',
    'minimaxai/minimax-m2.7': 'MiniMaxAI/MiniMax-M2.7',
    'minimaxai/minimax-m2.7:cloud': 'MiniMaxAI/MiniMax-M2.7',
    'minimaxai/minimax-m2.7:huggingface': 'MiniMaxAI/MiniMax-M2.7'
});

export function resolveHuggingFaceModelId(model = '') {
    const normalizedModel = String(model || '').trim();
    if (!normalizedModel) {
        return '';
    }

    return HUGGINGFACE_MODEL_ALIASES[normalizedModel.toLowerCase()] || normalizedModel;
}

export function normalizeModelForProvider(provider, model) {
    const normalizedProvider = String(provider || '').trim().toLowerCase();
    const normalizedModel = String(model || '').trim();
    if (!normalizedModel) {
        return normalizedModel;
    }

    if (normalizedProvider === 'huggingface') {
        return resolveHuggingFaceModelId(normalizedModel);
    }

    if (normalizedProvider === 'gemma') {
        const normalizedGemmaModel = normalizedModel.toLowerCase();
        if (normalizedGemmaModel === 'gemma-4-e2b-it' || normalizedGemmaModel === 'gemma-4-e4b-it') {
            return LLM_PROVIDER_DEFAULT_MODELS.gemma;
        }
        return normalizedGemmaModel;
    }

    return normalizedModel;
}

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
        if (normalizedModel === 'gpt-5.5') return 'gpt-5.4';
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

export function isLikelyGemmaModel(model = '') {
    return /^gemma(?:[-\d]|$)/i.test(String(model || '').trim());
}

export function isLikelyHuggingFaceModel(model = '') {
    const normalizedModel = String(model || '').trim();
    if (!normalizedModel) {
        return false;
    }

    if (HUGGINGFACE_MODEL_ALIASES[normalizedModel.toLowerCase()]) {
        return true;
    }

    return /^[^/\s]+\/[^/\s]+(?::[a-z0-9._-]+)?$/i.test(normalizedModel);
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
    const normalizedCandidateModel = normalizeModelForProvider(provider, candidateModel);

    const resolved = resolveAvailableModel(
        provider,
        normalizedCandidateModel,
        normalizeModelForProvider(provider, getProviderDefaultModel(provider))
    );
    return resolved.model;
}

export function resolveLLMRuntimeConfig(settings = {}, requestedModel) {
    const provider = resolveLLMProvider(settings);
    const model = resolveLLMModel({ provider, settings, requestedModel });
    return { provider, model };
}

export function resolveCompatibleProviderRuntimeConfig({ settings = {}, requestedModel, responseShape = 'openai' } = {}) {
    const configuredProvider = resolveLLMProvider(settings);
    const candidateModel = normalizeModelForProvider(configuredProvider, String(requestedModel || settings.llmModel || '').trim());

    if (configuredProvider === 'ollama') {
        return {
            provider: 'ollama',
            model: resolveLLMModel({ provider: 'ollama', settings, requestedModel })
        };
    }

    if (configuredProvider === 'huggingface' || (candidateModel && isLikelyHuggingFaceModel(candidateModel))) {
        if (responseShape === 'openai') {
            return {
                provider: 'huggingface',
                model: resolveLLMModel({ provider: 'huggingface', settings, requestedModel })
            };
        }

        return {
            provider: 'anthropic',
            model: isLikelyAnthropicModel(candidateModel) ? candidateModel : getProviderDefaultModel('anthropic')
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

    if (configuredProvider === 'gemma' || (candidateModel && isLikelyGemmaModel(candidateModel))) {
        if (responseShape === 'openai') {
            return {
                provider: 'gemma',
                model: resolveLLMModel({ provider: 'gemma', settings, requestedModel })
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
        isLikelyHuggingFaceModel(candidateModel) ||
        isLikelyDeepSeekModel(candidateModel) ||
        isLikelyGemmaModel(candidateModel) ||
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
