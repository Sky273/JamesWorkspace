import { getProviderAvailabilityFlags } from './llmAvailability.service.js';
import { getPersistableParameterDefinitions, getSupportedParameterDefinitions } from './llmModelCapabilities.service.js';
import { normalizeGenerationOptions, sanitizePersistedGenerationParameters } from './llmPayloadCapabilities.service.js';

const DEFAULT_MAX_OUTPUT_TOKENS = 4096;
const OLLAMA_GLOBAL_KEY = '__global__';
const OLLAMA_GENERIC_MODEL_KEY = '__model__';

const PROVIDER_MODEL_CATALOG = Object.freeze({
    openai: [
        { value: 'gpt-5.4', label: 'gpt-5.4' },
        { value: 'gpt-5.4-pro', label: 'gpt-5.4-pro' },
        { value: 'gpt-5.2', label: 'gpt-5.2' },
        { value: 'gpt-5.2-pro', label: 'gpt-5.2-pro' },
        { value: 'gpt-5.1', label: 'gpt-5.1' },
        { value: 'gpt-5', label: 'gpt-5' },
        { value: 'gpt-5-mini', label: 'gpt-5-mini' },
        { value: 'gpt-5-nano', label: 'gpt-5-nano' },
        { value: 'gpt-4.1', label: 'gpt-4.1' },
        { value: 'gpt-4.1-mini', label: 'gpt-4.1-mini' },
        { value: 'gpt-4.1-nano', label: 'gpt-4.1-nano' },
        { value: 'gpt-4o', label: 'gpt-4o' },
        { value: 'gpt-4o-mini', label: 'gpt-4o-mini' }
    ],
    anthropic: [
        { value: 'claude-opus-4-1-20250805', label: 'claude-opus-4-1-20250805' },
        { value: 'claude-opus-4-20250514', label: 'claude-opus-4-20250514' },
        { value: 'claude-sonnet-4-20250514', label: 'claude-sonnet-4-20250514' },
        { value: 'claude-3-7-sonnet-20250219', label: 'claude-3-7-sonnet-20250219' },
        { value: 'claude-3-5-sonnet-20241022', label: 'claude-3-5-sonnet-20241022' },
        { value: 'claude-3-5-haiku-20241022', label: 'claude-3-5-haiku-20241022' }
    ],
    deepseek: [
        { value: 'deepseek-chat', label: 'DeepSeek-V3.2 - Standard (API: deepseek-chat)' },
        { value: 'deepseek-reasoner', label: 'DeepSeek-V3.2 - Raisonnement (API: deepseek-reasoner)' }
    ],
    glm: [
        { value: 'glm-5.1', label: 'GLM-5.1' },
        { value: 'glm-5', label: 'GLM-5' }
    ],
    minimax: [
        { value: 'MiniMax-M2.7', label: 'MiniMax-M2.7' },
        { value: 'MiniMax-M2.5', label: 'MiniMax-M2.5' },
        { value: 'M2-her', label: 'M2-her' },
        { value: 'MiniMax-M2.1', label: 'MiniMax-M2.1' },
        { value: 'MiniMax-M2', label: 'MiniMax-M2' },
        { value: 'MiniMax-M2.7-highspeed', label: 'MiniMax-M2.7-highspeed', requiresHighspeed: true },
        { value: 'MiniMax-M2.5-highspeed', label: 'MiniMax-M2.5-highspeed', requiresHighspeed: true },
        { value: 'MiniMax-M2.1-highspeed', label: 'MiniMax-M2.1-highspeed', requiresHighspeed: true }
    ],
    ollama: []
});

function buildParameterDefinitionsForModel(provider, model) {
    return getSupportedParameterDefinitions(provider, model);
}

function getModelKey(provider, model) {
    if (provider === 'ollama') {
        return String(model || '').trim();
    }
    return String(model || '').trim();
}

export function getDefaultParametersForModel(provider, model) {
    const definitions = buildParameterDefinitionsForModel(provider, model);
    return Object.fromEntries(
        Object.entries(definitions)
            .filter(([, definition]) => definition.defaultValue !== undefined && definition.defaultValue !== null)
            .map(([key, definition]) => [key, definition.defaultValue])
    );
}

export function getExposedModelsForProvider(provider, availability = getProviderAvailabilityFlags(), options = {}) {
    const providerKey = String(provider || '').trim().toLowerCase();
    if (providerKey === 'ollama') {
        return Array.isArray(options.ollamaModels) ? options.ollamaModels : [];
    }
    const runtimeUnavailableModels = availability?.[providerKey]?.runtimeUnavailableModels || [];
    const highspeedEnabled = availability?.[providerKey]?.highspeedEnabled === true;
    const models = PROVIDER_MODEL_CATALOG[providerKey] || [];

    return models
        .filter((entry) => !runtimeUnavailableModels.includes(entry.value))
        .filter((entry) => !entry.requiresHighspeed || highspeedEnabled)
        .map((entry) => ({ value: entry.value, label: entry.label }));
}

export function buildLlmModelCatalog(availability = getProviderAvailabilityFlags(), options = {}) {
    return Object.fromEntries(
        Object.keys(PROVIDER_MODEL_CATALOG).map((provider) => [
            provider,
            getExposedModelsForProvider(provider, availability, options)
        ])
    );
}

export function buildLlmParameterDefinitions(availability = getProviderAvailabilityFlags(), options = {}) {
    return Object.fromEntries(
        Object.keys(PROVIDER_MODEL_CATALOG).map((provider) => [
            provider,
            provider === 'ollama'
                ? Object.fromEntries([
                    [OLLAMA_GLOBAL_KEY, buildParameterDefinitionsForModel(provider, OLLAMA_GLOBAL_KEY)],
                    [OLLAMA_GENERIC_MODEL_KEY, buildParameterDefinitionsForModel(provider, OLLAMA_GENERIC_MODEL_KEY)],
                    ...getExposedModelsForProvider(provider, availability, options).map((entry) => [
                        entry.value,
                        buildParameterDefinitionsForModel(provider, entry.value)
                    ])
                ])
                : Object.fromEntries(
                    getExposedModelsForProvider(provider, availability, options).map((entry) => [
                        entry.value,
                        buildParameterDefinitionsForModel(provider, entry.value)
                    ])
                )
        ])
    );
}

export function sanitizeLlmModelParameters(parameters = {}, availability = getProviderAvailabilityFlags(), options = {}) {
    if (!parameters || typeof parameters !== 'object' || Array.isArray(parameters)) {
        return {};
    }

    const definitions = buildLlmParameterDefinitions(availability, options);
    const sanitized = {};

    for (const [provider, models] of Object.entries(parameters)) {
        if (!models || typeof models !== 'object' || Array.isArray(models)) {
            continue;
        }

        const providerDefinitions = definitions[provider];
        if (!providerDefinitions) {
            continue;
        }

        for (const [modelKey, rawParams] of Object.entries(models)) {
            if (!rawParams || typeof rawParams !== 'object' || Array.isArray(rawParams)) {
                continue;
            }

            const modelDefinitions = provider === 'ollama'
                ? (providerDefinitions[modelKey] || providerDefinitions[OLLAMA_GENERIC_MODEL_KEY])
                : providerDefinitions[modelKey];
            if (!modelDefinitions) {
                if (provider !== 'ollama') {
                    const providerPersistableDefinitions = getPersistableParameterDefinitions(provider, modelKey);
                    if (Object.keys(providerPersistableDefinitions).length === 0) {
                        continue;
                    }
                } else if (!providerDefinitions[OLLAMA_GENERIC_MODEL_KEY]) {
                    continue;
                }
            }

            const sanitizedParams = {};
            const persistableDefinitions = provider === 'ollama'
                ? (getPersistableParameterDefinitions(provider, modelKey) || providerDefinitions[OLLAMA_GENERIC_MODEL_KEY] || {})
                : getPersistableParameterDefinitions(provider, modelKey);

            for (const paramKey of Object.keys(rawParams)) {
                if (!Object.prototype.hasOwnProperty.call(persistableDefinitions, paramKey)
                    && !['max_tokens', 'max_completion_tokens', 'max_output_tokens'].includes(paramKey)) {
                    continue;
                }

                if (!Object.prototype.hasOwnProperty.call(rawParams, paramKey)) {
                    continue;
                }

                const rawValue = rawParams[paramKey];
                const persisted = sanitizePersistedGenerationParameters(provider, modelKey, {
                    parameters: { [paramKey]: rawValue },
                    fallbackMaxTokens: DEFAULT_MAX_OUTPUT_TOKENS
                }).parameters;

                if (['max_tokens', 'max_completion_tokens', 'max_output_tokens'].includes(paramKey)) {
                    Object.assign(sanitizedParams, persisted);
                    continue;
                }

                if (Object.prototype.hasOwnProperty.call(persisted, paramKey)) {
                    sanitizedParams[paramKey] = persisted[paramKey];
                }
            }

            if (Object.keys(sanitizedParams).length > 0) {
                sanitized[provider] ||= {};
                sanitized[provider][modelKey] = sanitizedParams;
            }
        }
    }

    return sanitized;
}

export function resolvePersistedModelParameters(settings = {}, provider, model) {
    const sanitized = sanitizeLlmModelParameters(settings.llmModelParameters, settings.llmAvailability || getProviderAvailabilityFlags(), {
        ollamaModels: settings.ollamaDiscoveredModels || []
    });
    const modelKey = getModelKey(provider, model);

    if (provider === 'ollama') {
        return {
            modelKey,
            parameters: {
                ...(sanitized?.[provider]?.[OLLAMA_GLOBAL_KEY] || {}),
                ...(sanitized?.[provider]?.[modelKey] || {}),
                ...(sanitized?.[provider]?.[OLLAMA_GENERIC_MODEL_KEY] || {})
            }
        };
    }

    return {
        modelKey,
        parameters: sanitized?.[provider]?.[modelKey] || {}
    };
}

function pickDefinedProperty(source = {}, keys = []) {
    for (const key of keys) {
        if (Object.prototype.hasOwnProperty.call(source, key) && source[key] !== undefined) {
            return source[key];
        }
    }

    return undefined;
}

export function resolveEffectiveModelParameters({ settings = {}, provider, model, overrides = {} } = {}) {
    const modelKey = getModelKey(provider, model);
    const defaultParameters = getDefaultParametersForModel(provider, modelKey);
    const persistedParameters = resolvePersistedModelParameters(settings, provider, modelKey).parameters;
    const rawMaxTokens = pickDefinedProperty(overrides, ['max_output_tokens', 'max_completion_tokens', 'max_tokens'])
        ?? pickDefinedProperty(persistedParameters, ['max_output_tokens', 'max_completion_tokens', 'max_tokens'])
        ?? pickDefinedProperty(defaultParameters, ['max_output_tokens', 'max_completion_tokens', 'max_tokens']);
    const mergedParameters = {
        ...defaultParameters,
        ...persistedParameters,
        ...overrides
    };
    delete mergedParameters.max_tokens;
    delete mergedParameters.max_completion_tokens;
    delete mergedParameters.max_output_tokens;

    const fallbackMaxTokens = pickDefinedProperty(defaultParameters, ['max_tokens', 'max_completion_tokens', 'max_output_tokens'])
        || DEFAULT_MAX_OUTPUT_TOKENS;
    const normalized = normalizeGenerationOptions(provider, modelKey, {
        parameters: mergedParameters,
        maxTokens: rawMaxTokens,
        fallbackMaxTokens
    });

    return {
        modelKey,
        parameters: normalized.parameters,
        defaults: defaultParameters,
        persisted: persistedParameters
    };
}

export function buildLlmAdminMetadata(availability = getProviderAvailabilityFlags()) {
    return buildLlmAdminMetadataWithOptions(availability, {});
}

export function buildLlmAdminMetadataWithOptions(availability = getProviderAvailabilityFlags(), options = {}) {
    return {
        llmModelCatalog: buildLlmModelCatalog(availability, options),
        llmParameterDefinitions: buildLlmParameterDefinitions(availability, options)
    };
}

export { OLLAMA_GLOBAL_KEY, OLLAMA_GENERIC_MODEL_KEY };
