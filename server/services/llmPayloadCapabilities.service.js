import { clampModelMaxOutputTokens, getModelCapabilities, getPersistableParameterDefinitions, getSupportedParameterDefinitions } from './llmModelCapabilities.service.js';

function isFiniteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
}

function isPlainObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isJsonCompatible(value) {
    if (value === null) {
        return true;
    }

    if (typeof value === 'string' || typeof value === 'boolean') {
        return true;
    }

    if (typeof value === 'number') {
        return Number.isFinite(value);
    }

    if (Array.isArray(value)) {
        return value.every(isJsonCompatible);
    }

    if (isPlainObject(value)) {
        return Object.values(value).every(isJsonCompatible);
    }

    return false;
}

function isWithinRange(value, range = {}) {
    if (!isFiniteNumber(value)) return false;
    if (range.min !== undefined && value < range.min) return false;
    if (range.max !== undefined && value > range.max) return false;
    if (range.maxInclusive !== undefined && value > range.maxInclusive) return false;
    if (range.maxExclusive !== undefined && value >= range.maxExclusive) return false;
    return true;
}

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

function normalizeArrayValue(value, definition = {}) {
    if (typeof value === 'string' && definition.itemType === 'string') {
        const normalized = value.trim();
        return normalized ? [normalized] : undefined;
    }

    if (!Array.isArray(value)) {
        return undefined;
    }

    const normalized = value.filter(item => {
        if (definition.itemType === 'object') {
            return isPlainObject(item) && isJsonCompatible(item);
        }

        if (definition.itemType === 'string') {
            return typeof item === 'string' && item.trim();
        }

        return isJsonCompatible(item);
    }).map(item => {
        if (typeof item === 'string') {
            return item.trim();
        }
        return item;
    });

    return normalized.length > 0 ? normalized : undefined;
}

function normalizeValueByDefinition(definition, value) {
    if (!definition) {
        return undefined;
    }

    if (definition.type === 'integer' || definition.type === 'number') {
        const parsed = toFiniteNumber(value);
        if (parsed === null || !isWithinRange(parsed, definition)) {
            return undefined;
        }

        return definition.type === 'integer' ? Math.floor(parsed) : parsed;
    }

    if (definition.type === 'string') {
        const normalized = String(value ?? '').trim();
        if (!normalized) {
            return undefined;
        }
        if (definition.maxLength && normalized.length > definition.maxLength) {
            return undefined;
        }
        return normalized;
    }

    if (definition.type === 'boolean') {
        return typeof value === 'boolean' ? value : undefined;
    }

    if (definition.type === 'enum') {
        const normalized = String(value ?? '').trim();
        return definition.options.some(option => option.value === normalized) ? normalized : undefined;
    }

    if (definition.type === 'object') {
        return isPlainObject(value) && isJsonCompatible(value) ? value : undefined;
    }

    if (definition.type === 'array') {
        return normalizeArrayValue(value, definition);
    }

    if (definition.type === 'union') {
        for (const variant of definition.variants || []) {
            const normalized = normalizeValueByDefinition({ ...definition, type: variant }, value);
            if (normalized !== undefined) {
                return normalized;
            }
        }
    }

    return undefined;
}

export function getEffectiveTokenParameter(provider, model, fallbackParameter = 'max_tokens') {
    const capabilities = getModelCapabilities(provider, model);
    return capabilities?.tokenParameter || fallbackParameter;
}

function buildInputParameterBag(options = {}) {
    const parameters = isPlainObject(options.parameters) ? { ...options.parameters } : {};

    if (options.maxTokens !== undefined) {
        parameters.max_tokens = options.maxTokens;
    }

    if (options.temperature !== undefined) {
        parameters.temperature = options.temperature;
    }

    if (options.topP !== undefined) {
        parameters.top_p = options.topP;
    }

    if (options.responseFormat !== undefined) {
        parameters.response_format = options.responseFormat;
    }

    return parameters;
}

function getRequestedMaxTokensFromParameters(parameters = {}, fallbackMaxTokens = 4096) {
    const maxTokens = parameters.max_output_tokens
        ?? parameters.max_completion_tokens
        ?? parameters.max_tokens;

    return Number.isFinite(maxTokens) ? maxTokens : fallbackMaxTokens;
}

function applyConditionalParameterRules(provider, model, capabilities, normalizedParameters, droppedParams) {
    const providerKey = String(provider || '').trim().toLowerCase();
    const normalizedModel = String(model || '').trim().toLowerCase();

    if (providerKey === 'openai') {
        const reasoningEffort = normalizedParameters.reasoning_effort || capabilities?.defaultReasoningEffort;
        const restrictedWhenReasoning = ['temperature', 'top_p', 'logprobs', 'top_logprobs'];
        const isGpt51Style = capabilities?.conditionalSamplingMode === 'gpt5_1_style';
        const isGpt52Style = capabilities?.conditionalSamplingMode === 'gpt5_2_style';

        if ((isGpt51Style || isGpt52Style) && reasoningEffort && reasoningEffort !== 'none') {
            for (const key of restrictedWhenReasoning) {
                if (Object.prototype.hasOwnProperty.call(normalizedParameters, key)) {
                    delete normalizedParameters[key];
                    droppedParams.push(key);
                }
            }
        }

        if (/^gpt-5(?:$|-|mini|nano)/i.test(normalizedModel) && !isGpt51Style && !isGpt52Style) {
            for (const key of restrictedWhenReasoning) {
                if (Object.prototype.hasOwnProperty.call(normalizedParameters, key)) {
                    delete normalizedParameters[key];
                    droppedParams.push(key);
                }
            }
        }
    }
}

export function normalizeGenerationOptions(provider, model, {
    parameters = {},
    maxTokens,
    temperature,
    topP,
    responseFormat,
    fallbackMaxTokens = 4096
} = {}) {
    const capabilities = getModelCapabilities(provider, model);
    const definitions = getSupportedParameterDefinitions(provider, model);
    const inputParameters = buildInputParameterBag({
        parameters,
        maxTokens,
        temperature,
        topP,
        responseFormat
    });

    const requestedMaxTokens = getRequestedMaxTokensFromParameters(inputParameters, fallbackMaxTokens);
    const tokenParameter = provider === 'ollama' ? null : (capabilities?.tokenParameter || 'max_tokens');
    const clamped = clampModelMaxOutputTokens(provider, model, requestedMaxTokens, fallbackMaxTokens);
    const droppedParams = [];
    const normalizedParameters = {};

    for (const [key, rawValue] of Object.entries(inputParameters)) {
        if (rawValue === undefined) {
            continue;
        }

        if (key === 'max_tokens' || key === 'max_completion_tokens' || key === 'max_output_tokens') {
            continue;
        }

        const definition = definitions[key];
        if (!definition) {
            droppedParams.push(key);
            continue;
        }

        if ((key === 'temperature' || key === 'top_p')
            && capabilities?.disallowTemperatureAndTopP) {
            droppedParams.push(key);
            continue;
        }

        if (key === 'response_format' && capabilities?.supportsResponseFormat === false) {
            droppedParams.push(key);
            continue;
        }

        if (key === 'temperature' && capabilities?.temperatureRange && !isWithinRange(toFiniteNumber(rawValue), capabilities.temperatureRange)) {
            droppedParams.push(key);
            continue;
        }

        if (key === 'top_p' && capabilities?.topPRange && !isWithinRange(toFiniteNumber(rawValue), capabilities.topPRange)) {
            droppedParams.push(key);
            continue;
        }

        const normalizedValue = normalizeValueByDefinition(definition, rawValue);
        if (normalizedValue === undefined) {
            droppedParams.push(key);
            continue;
        }

        normalizedParameters[key] = normalizedValue;
    }

    applyConditionalParameterRules(provider, model, capabilities, normalizedParameters, droppedParams);
    if (tokenParameter) {
        normalizedParameters[tokenParameter] = clamped.effectiveMaxTokens;
    }

    return {
        requestedMaxTokens: clamped.requestedMaxTokens,
        effectiveMaxTokens: clamped.effectiveMaxTokens,
        providerCap: clamped.providerCap,
        capabilities,
        droppedParams,
        tokenParameter,
        parameters: normalizedParameters,
        temperature: normalizedParameters.temperature,
        topP: normalizedParameters.top_p,
        responseFormat: normalizedParameters.response_format
    };
}

export function sanitizePersistedGenerationParameters(provider, model, {
    parameters = {},
    fallbackMaxTokens = 4096
} = {}) {
    const capabilities = getModelCapabilities(provider, model);
    const definitions = getPersistableParameterDefinitions(provider, model);
    const inputParameters = buildInputParameterBag({ parameters });
    const sanitizedParameters = {};
    const tokenAliases = ['max_tokens', 'max_completion_tokens', 'max_output_tokens'];
    const tokenParameter = provider === 'ollama' ? null : (capabilities?.tokenParameter || 'max_tokens');

    for (const [key, rawValue] of Object.entries(inputParameters)) {
        if (rawValue === undefined) {
            continue;
        }

        if (tokenAliases.includes(key)) {
            continue;
        }

        const definition = definitions[key];
        if (!definition) {
            continue;
        }

        const normalizedValue = normalizeValueByDefinition(definition, rawValue);
        if (normalizedValue !== undefined) {
            sanitizedParameters[key] = normalizedValue;
        }
    }

    const requestedMaxTokens = getRequestedMaxTokensFromParameters(inputParameters, fallbackMaxTokens);
    if (tokenParameter && Number.isFinite(requestedMaxTokens)) {
        const tokenDefinition = definitions[tokenParameter];
        const normalizedTokenValue = normalizeValueByDefinition(tokenDefinition, requestedMaxTokens);
        if (normalizedTokenValue !== undefined) {
            sanitizedParameters[tokenParameter] = normalizedTokenValue;
        }
    }

    return {
        capabilities,
        tokenParameter,
        parameters: sanitizedParameters
    };
}

export function buildCapabilityAwareOpenAICompatibleParams(provider, model, {
    parameters = {},
    maxTokens,
    temperature,
    topP,
    responseFormat,
    additionalParams = {},
    fallbackMaxTokens = 4096
} = {}) {
    const normalized = normalizeGenerationOptions(provider, model, {
        parameters,
        maxTokens,
        temperature,
        topP,
        responseFormat,
        fallbackMaxTokens
    });

    return {
        requestParams: {
            model,
            ...normalized.parameters,
            ...additionalParams
        },
        ...normalized
    };
}

export function buildCapabilityAwareAnthropicOptions(provider, model, {
    parameters = {},
    maxTokens,
    temperature,
    topP,
    fallbackMaxTokens = 4096
} = {}) {
    const normalized = normalizeGenerationOptions(provider, model, {
        parameters,
        maxTokens,
        temperature,
        topP,
        fallbackMaxTokens
    });

    return {
        requestParams: normalized.parameters,
        ...normalized
    };
}
