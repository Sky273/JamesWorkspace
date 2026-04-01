import { getProviderAvailabilityFlags } from './llmAvailability.service.js';
import { getModelCapabilities, clampModelMaxOutputTokens } from './llmModelCapabilities.service.js';
import { normalizeGenerationOptions } from './llmPayloadCapabilities.service.js';

const DEFAULT_MAX_OUTPUT_TOKENS = 4096;
const OLLAMA_MODEL_KEY = '__default__';

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
    ollama: [
        { value: OLLAMA_MODEL_KEY, label: 'Ollama runtime defaults' }
    ]
});

function toFiniteNumber(value) {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }

    if (typeof value === 'string' && value.trim() !== '') {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) {
            return parsed;
        }
    }

    return null;
}

function clampToRange(value, definition) {
    const parsed = toFiniteNumber(value);
    if (parsed === null) {
        return undefined;
    }

    if (definition.min !== undefined && parsed < definition.min) {
        return undefined;
    }
    if (definition.max !== undefined && parsed > definition.max) {
        return undefined;
    }
    if (definition.maxInclusive !== undefined && parsed > definition.maxInclusive) {
        return undefined;
    }
    if (definition.maxExclusive !== undefined && parsed >= definition.maxExclusive) {
        return undefined;
    }

    return definition.type === 'integer' ? Math.floor(parsed) : parsed;
}

function buildTokenParameterDefinition(provider, model) {
    const capabilities = getModelCapabilities(provider, model);
    const tokenParameter = capabilities?.tokenParameter || 'max_tokens';
    const { providerCap } = clampModelMaxOutputTokens(provider, model, DEFAULT_MAX_OUTPUT_TOKENS, DEFAULT_MAX_OUTPUT_TOKENS);
    const maxValue = providerCap || DEFAULT_MAX_OUTPUT_TOKENS;
    const defaultValue = Math.min(DEFAULT_MAX_OUTPUT_TOKENS, maxValue);

    return {
        key: tokenParameter,
        type: 'integer',
        label: tokenParameter === 'max_completion_tokens' ? 'Max completion tokens' : 'Max tokens',
        min: 1,
        max: maxValue,
        defaultValue,
        helpText: 'Upper bound used by default when the application requests a text generation.'
    };
}

function buildParameterDefinitionsForModel(provider, model) {
    if (provider === 'ollama') {
        return {
            num_ctx: {
                key: 'num_ctx',
                type: 'integer',
                label: 'Context window',
                min: 1024,
                max: 262144,
                defaultValue: 8192,
                helpText: 'Default Ollama context window.'
            },
            keep_alive: {
                key: 'keep_alive',
                type: 'string',
                label: 'Keep alive',
                defaultValue: '5m',
                helpText: 'How long Ollama keeps the model loaded after a request.'
            }
        };
    }

    const capabilities = getModelCapabilities(provider, model);
    const definitions = {
        [buildTokenParameterDefinition(provider, model).key]: buildTokenParameterDefinition(provider, model)
    };

    const supportsTemperature = capabilities?.supportsTemperature ?? !capabilities?.disallowTemperatureAndTopP;
    if (supportsTemperature) {
        definitions.temperature = {
            key: 'temperature',
            type: 'number',
            label: 'Temperature',
            min: capabilities?.temperatureRange?.min ?? 0,
            max: capabilities?.temperatureRange?.max ?? capabilities?.temperatureRange?.maxInclusive ?? 2,
            maxInclusive: capabilities?.temperatureRange?.maxInclusive,
            maxExclusive: capabilities?.temperatureRange?.maxExclusive,
            step: 0.1,
            defaultValue: 0,
            helpText: 'Controls randomness. Lower values produce more deterministic outputs.'
        };
    }

    const supportsTopP = capabilities?.supportsTopP ?? !capabilities?.disallowTemperatureAndTopP;
    if (supportsTopP) {
        definitions.top_p = {
            key: 'top_p',
            type: 'number',
            label: 'Top P',
            min: capabilities?.topPRange?.min ?? 0,
            max: capabilities?.topPRange?.max ?? capabilities?.topPRange?.maxInclusive ?? 1,
            maxInclusive: capabilities?.topPRange?.maxInclusive,
            maxExclusive: capabilities?.topPRange?.maxExclusive,
            step: 0.05,
            defaultValue: 1,
            helpText: 'Alternative sampling control. Keep at 1 unless you have a clear need.'
        };
    }

    if (Array.isArray(capabilities?.reasoningEfforts) && capabilities.reasoningEfforts.length > 0) {
        definitions.reasoning_effort = {
            key: 'reasoning_effort',
            type: 'enum',
            label: 'Reasoning effort',
            options: capabilities.reasoningEfforts.map((value) => ({
                value,
                label: value
            })),
            defaultValue: capabilities.defaultReasoningEffort || capabilities.reasoningEfforts[0],
            helpText: 'Reasoning intensity used by supported OpenAI models.'
        };
    }

    return definitions;
}

function getModelKey(provider, model) {
    return provider === 'ollama' ? OLLAMA_MODEL_KEY : String(model || '').trim();
}

export function getDefaultParametersForModel(provider, model) {
    const definitions = buildParameterDefinitionsForModel(provider, model);
    return Object.fromEntries(
        Object.entries(definitions).map(([key, definition]) => [key, definition.defaultValue])
    );
}

export function getExposedModelsForProvider(provider, availability = getProviderAvailabilityFlags()) {
    const providerKey = String(provider || '').trim().toLowerCase();
    const runtimeUnavailableModels = availability?.[providerKey]?.runtimeUnavailableModels || [];
    const highspeedEnabled = availability?.[providerKey]?.highspeedEnabled === true;
    const models = PROVIDER_MODEL_CATALOG[providerKey] || [];

    return models
        .filter((entry) => !runtimeUnavailableModels.includes(entry.value))
        .filter((entry) => !entry.requiresHighspeed || highspeedEnabled)
        .map((entry) => ({ value: entry.value, label: entry.label }));
}

export function buildLlmModelCatalog(availability = getProviderAvailabilityFlags()) {
    return Object.fromEntries(
        Object.keys(PROVIDER_MODEL_CATALOG).map((provider) => [
            provider,
            getExposedModelsForProvider(provider, availability)
        ])
    );
}

export function buildLlmParameterDefinitions(availability = getProviderAvailabilityFlags()) {
    return Object.fromEntries(
        Object.keys(PROVIDER_MODEL_CATALOG).map((provider) => [
            provider,
            Object.fromEntries(
                getExposedModelsForProvider(provider, availability).map((entry) => [
                    entry.value,
                    buildParameterDefinitionsForModel(provider, entry.value)
                ])
            )
        ])
    );
}

export function sanitizeLlmModelParameters(parameters = {}, availability = getProviderAvailabilityFlags()) {
    if (!parameters || typeof parameters !== 'object' || Array.isArray(parameters)) {
        return {};
    }

    const definitions = buildLlmParameterDefinitions(availability);
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

            const modelDefinitions = providerDefinitions[modelKey];
            if (!modelDefinitions) {
                continue;
            }

            const sanitizedParams = {};
            for (const [paramKey, definition] of Object.entries(modelDefinitions)) {
                if (!Object.prototype.hasOwnProperty.call(rawParams, paramKey)) {
                    continue;
                }

                const rawValue = rawParams[paramKey];
                if (definition.type === 'enum') {
                    const normalizedValue = String(rawValue || '').trim();
                    if (definition.options.some((option) => option.value === normalizedValue)) {
                        sanitizedParams[paramKey] = normalizedValue;
                    }
                    continue;
                }

                if (definition.type === 'string') {
                    const normalizedValue = String(rawValue || '').trim();
                    if (normalizedValue) {
                        sanitizedParams[paramKey] = normalizedValue;
                    }
                    continue;
                }

                const normalizedNumber = clampToRange(rawValue, definition);
                if (normalizedNumber !== undefined) {
                    sanitizedParams[paramKey] = normalizedNumber;
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
    const sanitized = sanitizeLlmModelParameters(settings.llmModelParameters, settings.llmAvailability || getProviderAvailabilityFlags());
    const modelKey = getModelKey(provider, model);

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

    if (provider === 'ollama') {
        return {
            modelKey,
            parameters: {
                num_ctx: pickDefinedProperty(overrides, ['num_ctx']) ?? persistedParameters.num_ctx ?? defaultParameters.num_ctx,
                keep_alive: pickDefinedProperty(overrides, ['keep_alive']) ?? persistedParameters.keep_alive ?? defaultParameters.keep_alive
            },
            defaults: defaultParameters,
            persisted: persistedParameters
        };
    }

    const capabilities = getModelCapabilities(provider, model);
    const tokenParameter = capabilities?.tokenParameter || 'max_tokens';
    const rawMaxTokens = pickDefinedProperty(overrides, ['max_tokens', 'max_completion_tokens', 'max_output_tokens'])
        ?? pickDefinedProperty(persistedParameters, ['max_tokens', 'max_completion_tokens', 'max_output_tokens'])
        ?? defaultParameters[tokenParameter];

    const normalized = normalizeGenerationOptions(provider, model, {
        maxTokens: rawMaxTokens,
        temperature: pickDefinedProperty(overrides, ['temperature']) ?? persistedParameters.temperature ?? defaultParameters.temperature,
        topP: pickDefinedProperty(overrides, ['top_p']) ?? persistedParameters.top_p ?? defaultParameters.top_p,
        responseFormat: pickDefinedProperty(overrides, ['response_format']),
        fallbackMaxTokens: defaultParameters[tokenParameter] || DEFAULT_MAX_OUTPUT_TOKENS
    });

    const parameters = {
        [normalized.tokenParameter]: normalized.effectiveMaxTokens
    };

    if (normalized.temperature !== undefined) {
        parameters.temperature = normalized.temperature;
    }

    if (normalized.topP !== undefined) {
        parameters.top_p = normalized.topP;
    }

    if (normalized.responseFormat) {
        parameters.response_format = normalized.responseFormat;
    }

    if (Array.isArray(capabilities?.reasoningEfforts) && capabilities.reasoningEfforts.length > 0) {
        const reasoningEffort = pickDefinedProperty(overrides, ['reasoning_effort'])
            ?? persistedParameters.reasoning_effort
            ?? defaultParameters.reasoning_effort;

        if (capabilities.reasoningEfforts.includes(reasoningEffort)) {
            parameters.reasoning_effort = reasoningEffort;
        }
    }

    return {
        modelKey,
        parameters,
        defaults: defaultParameters,
        persisted: persistedParameters
    };
}

export function buildLlmAdminMetadata(availability = getProviderAvailabilityFlags()) {
    return {
        llmModelCatalog: buildLlmModelCatalog(availability),
        llmParameterDefinitions: buildLlmParameterDefinitions(availability)
    };
}

export { OLLAMA_MODEL_KEY };
