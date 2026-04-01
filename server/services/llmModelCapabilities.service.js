import {
    cloneDefinition,
    createEnumDefinition,
    createTokenDefinition,
    PROVIDER_CAPABILITIES,
    PROVIDER_DEFAULT_PARAMETERS
} from './llmModelCapabilities.registry.js';

function buildParameterDefinitions(providerKey, model, { includeUnsupportedParameters = false } = {}) {
    const capability = getModelCapabilities(providerKey, model);
    const baseDefinitions = Object.fromEntries(
        Object.entries(PROVIDER_DEFAULT_PARAMETERS[providerKey] || {}).map(([key, definition]) => [key, cloneDefinition(definition)])
    );
    const supportedKeys = new Set(Object.keys(baseDefinitions));

    if (Array.isArray(capability?.supportedParameters)) {
        for (const key of capability.supportedParameters) {
            supportedKeys.add(key);
        }
    }

    if (!includeUnsupportedParameters && Array.isArray(capability?.unsupportedParameters)) {
        for (const key of capability.unsupportedParameters) {
            supportedKeys.delete(key);
        }
    }

    if (Array.isArray(capability?.reasoningEfforts) && capability.reasoningEfforts.length > 0) {
        baseDefinitions.reasoning_effort = createEnumDefinition({
            key: 'reasoning_effort',
            label: 'Reasoning effort',
            options: capability.reasoningEfforts,
            defaultValue: capability.defaultReasoningEffort || capability.reasoningEfforts[0]
        });
        supportedKeys.add('reasoning_effort');
    }

    if (supportedKeys.has('verbosity') && !baseDefinitions.verbosity) {
        baseDefinitions.verbosity = createEnumDefinition({
            key: 'verbosity',
            label: 'Verbosity',
            options: ['low', 'medium', 'high'],
            defaultValue: 'medium'
        });
        supportedKeys.add('verbosity');
    }

    if (providerKey === 'glm' && supportedKeys.has('tool_choice')) {
        baseDefinitions.tool_choice = createEnumDefinition({
            key: 'tool_choice',
            label: 'Tool choice',
            options: ['auto'],
            defaultValue: 'auto'
        });
        supportedKeys.add('tool_choice');
    }

    const tokenParameter = capability?.tokenParameter || (providerKey === 'ollama' ? null : 'max_tokens');
    if (tokenParameter) {
        baseDefinitions[tokenParameter] = createTokenDefinition(tokenParameter, capability?.maxOutputTokens);
        supportedKeys.add(tokenParameter);
    }

    return Object.fromEntries(
        Array.from(supportedKeys)
            .filter(key => Boolean(baseDefinitions[key]))
            .map(key => [key, cloneDefinition(baseDefinitions[key])])
    );
}

export function getModelCapabilities(provider, model) {
    const providerKey = String(provider || '').trim().toLowerCase();
    const normalizedModel = String(model || '').trim();
    const capabilities = PROVIDER_CAPABILITIES[providerKey] || [];
    return capabilities.find(entry => entry.match.test(normalizedModel)) || null;
}

export function getSupportedParameterDefinitions(provider, model) {
    return buildParameterDefinitions(String(provider || '').trim().toLowerCase(), model);
}

export function getPersistableParameterDefinitions(provider, model) {
    return buildParameterDefinitions(String(provider || '').trim().toLowerCase(), model, {
        includeUnsupportedParameters: true
    });
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
