import { clampModelMaxOutputTokens, getModelCapabilities } from './llmModelCapabilities.service.js';

function isFiniteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
}

function isWithinRange(value, range = {}) {
    if (!isFiniteNumber(value)) return false;
    if (range.min !== undefined && value < range.min) return false;
    if (range.max !== undefined && value > range.max) return false;
    if (range.maxInclusive !== undefined && value > range.maxInclusive) return false;
    if (range.maxExclusive !== undefined && value >= range.maxExclusive) return false;
    return true;
}

export function getEffectiveTokenParameter(provider, model, fallbackParameter = 'max_tokens') {
    const capabilities = getModelCapabilities(provider, model);
    return capabilities?.tokenParameter || fallbackParameter;
}

export function normalizeGenerationOptions(provider, model, {
    maxTokens,
    temperature,
    topP,
    responseFormat,
    fallbackMaxTokens = 4096,
    supportsResponseFormatByDefault = true,
    supportsTemperatureByDefault = true,
    supportsTopPByDefault = true
} = {}) {
    const { requestedMaxTokens, effectiveMaxTokens, providerCap, capabilities } = clampModelMaxOutputTokens(
        provider,
        model,
        maxTokens,
        fallbackMaxTokens
    );

    const droppedParams = [];

    const supportsResponseFormat = capabilities?.supportsResponseFormat ?? supportsResponseFormatByDefault;
    const normalizedResponseFormat = responseFormat && supportsResponseFormat ? responseFormat : null;
    if (responseFormat && !supportsResponseFormat) {
        droppedParams.push('response_format');
    }

    const supportsTemperature = capabilities?.supportsTemperature ?? (!capabilities?.disallowTemperatureAndTopP && supportsTemperatureByDefault);
    let normalizedTemperature;
    if (temperature !== undefined && supportsTemperature) {
        if (!capabilities?.temperatureRange || isWithinRange(temperature, capabilities.temperatureRange)) {
            normalizedTemperature = temperature;
        } else {
            droppedParams.push('temperature');
        }
    } else if (temperature !== undefined) {
        droppedParams.push('temperature');
    }

    const supportsTopP = capabilities?.supportsTopP ?? (!capabilities?.disallowTemperatureAndTopP && supportsTopPByDefault);
    let normalizedTopP;
    if (topP !== undefined && supportsTopP) {
        if (!capabilities?.topPRange || isWithinRange(topP, capabilities.topPRange)) {
            normalizedTopP = topP;
        } else {
            droppedParams.push('top_p');
        }
    } else if (topP !== undefined) {
        droppedParams.push('top_p');
    }

    return {
        requestedMaxTokens,
        effectiveMaxTokens,
        providerCap,
        capabilities,
        droppedParams,
        temperature: normalizedTemperature,
        topP: normalizedTopP,
        responseFormat: normalizedResponseFormat,
        tokenParameter: getEffectiveTokenParameter(provider, model)
    };
}

export function buildCapabilityAwareOpenAICompatibleParams(provider, model, {
    maxTokens,
    temperature,
    topP,
    responseFormat,
    additionalParams = {},
    fallbackMaxTokens = 4096,
    supportsResponseFormatByDefault = true,
    supportsTemperatureByDefault = true,
    supportsTopPByDefault = true
} = {}) {
    const normalized = normalizeGenerationOptions(provider, model, {
        maxTokens,
        temperature,
        topP,
        responseFormat,
        fallbackMaxTokens,
        supportsResponseFormatByDefault,
        supportsTemperatureByDefault,
        supportsTopPByDefault
    });

    const params = {
        model,
        [normalized.tokenParameter]: normalized.effectiveMaxTokens,
        ...additionalParams
    };

    if (normalized.temperature !== undefined) {
        params.temperature = normalized.temperature;
    }

    if (normalized.topP !== undefined) {
        params.top_p = normalized.topP;
    }

    if (normalized.responseFormat) {
        params.response_format = normalized.responseFormat;
    }

    return {
        requestParams: params,
        ...normalized
    };
}

export function buildCapabilityAwareAnthropicOptions(provider, model, {
    maxTokens,
    temperature,
    topP,
    fallbackMaxTokens = 4096,
    supportsTemperatureByDefault = true,
    supportsTopPByDefault = true
} = {}) {
    return normalizeGenerationOptions(provider, model, {
        maxTokens,
        temperature,
        topP,
        fallbackMaxTokens,
        supportsResponseFormatByDefault: false,
        supportsTemperatureByDefault,
        supportsTopPByDefault
    });
}
