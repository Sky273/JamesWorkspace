/**
 * Static provider/model capability registry for hosted LLM providers.
 * This module intentionally contains only declarative definitions.
 */

function createNumberDefinition({ key, label, min, max, maxInclusive, maxExclusive, step, defaultValue, helpText }) {
    return { key, type: 'number', label, min, max, maxInclusive, maxExclusive, step, defaultValue, helpText };
}

function createIntegerDefinition({ key, label, min, max, defaultValue, helpText }) {
    return { key, type: 'integer', label, min, max, defaultValue, helpText };
}

function createStringDefinition({ key, label, defaultValue, maxLength, helpText }) {
    return { key, type: 'string', label, defaultValue, maxLength, helpText };
}

function createBooleanDefinition({ key, label, defaultValue, helpText }) {
    return { key, type: 'boolean', label, defaultValue, helpText };
}

export function createEnumDefinition({ key, label, options, defaultValue, helpText }) {
    return {
        key,
        type: 'enum',
        label,
        options: options.map(value => ({ value, label: value })),
        defaultValue,
        helpText
    };
}

function createObjectDefinition({ key, label, defaultValue = null, helpText }) {
    return { key, type: 'object', label, defaultValue, helpText };
}

function createArrayDefinition({ key, label, itemType = 'string', defaultValue = null, helpText }) {
    return { key, type: 'array', label, itemType, defaultValue, helpText };
}

const SHARED_OPENAI_COMPATIBLE_PARAMETERS = Object.freeze({
    temperature: createNumberDefinition({ key: 'temperature', label: 'Temperature', min: 0, max: 2, defaultValue: 0 }),
    top_p: createNumberDefinition({ key: 'top_p', label: 'Top P', min: 0, maxInclusive: 1, defaultValue: 1 }),
    presence_penalty: createNumberDefinition({ key: 'presence_penalty', label: 'Presence penalty', min: -2, max: 2 }),
    frequency_penalty: createNumberDefinition({ key: 'frequency_penalty', label: 'Frequency penalty', min: -2, max: 2 }),
    stop: createArrayDefinition({ key: 'stop', label: 'Stop sequences', itemType: 'string' }),
    seed: createIntegerDefinition({ key: 'seed', label: 'Seed', min: 0 }),
    tools: createArrayDefinition({ key: 'tools', label: 'Tools', itemType: 'object' }),
    tool_choice: { key: 'tool_choice', type: 'union', label: 'Tool choice', variants: ['string', 'object'] },
    response_format: createObjectDefinition({ key: 'response_format', label: 'Response format' }),
    metadata: createObjectDefinition({ key: 'metadata', label: 'Metadata' }),
    store: createBooleanDefinition({ key: 'store', label: 'Store' }),
    stream: createBooleanDefinition({ key: 'stream', label: 'Stream' }),
    stream_options: createObjectDefinition({ key: 'stream_options', label: 'Stream options' }),
    include: createArrayDefinition({ key: 'include', label: 'Include', itemType: 'string' }),
    logprobs: createBooleanDefinition({ key: 'logprobs', label: 'Logprobs' }),
    top_logprobs: createIntegerDefinition({ key: 'top_logprobs', label: 'Top logprobs', min: 0, max: 20 }),
    user: createStringDefinition({ key: 'user', label: 'User', maxLength: 256 }),
    n: createIntegerDefinition({ key: 'n', label: 'Choices', min: 1 })
});

export const PROVIDER_DEFAULT_PARAMETERS = Object.freeze({
    openai: {
        ...SHARED_OPENAI_COMPATIBLE_PARAMETERS,
        logit_bias: createObjectDefinition({ key: 'logit_bias', label: 'Logit bias' }),
        parallel_tool_calls: createBooleanDefinition({ key: 'parallel_tool_calls', label: 'Parallel tool calls' }),
        truncation: createEnumDefinition({ key: 'truncation', label: 'Truncation', options: ['auto', 'disabled'] }),
        service_tier: createStringDefinition({ key: 'service_tier', label: 'Service tier', maxLength: 64 }),
        max_tool_calls: createIntegerDefinition({ key: 'max_tool_calls', label: 'Max tool calls', min: 1 }),
        background: createBooleanDefinition({ key: 'background', label: 'Background' })
    },
    anthropic: {
        temperature: createNumberDefinition({ key: 'temperature', label: 'Temperature', min: 0, maxInclusive: 1, defaultValue: 0 }),
        top_p: createNumberDefinition({ key: 'top_p', label: 'Top P', min: 0, maxInclusive: 1, defaultValue: 0.99 }),
        top_k: createIntegerDefinition({ key: 'top_k', label: 'Top K', min: 0 }),
        stop_sequences: createArrayDefinition({ key: 'stop_sequences', label: 'Stop sequences', itemType: 'string' }),
        metadata: createObjectDefinition({ key: 'metadata', label: 'Metadata' }),
        tools: createArrayDefinition({ key: 'tools', label: 'Tools', itemType: 'object' }),
        tool_choice: createObjectDefinition({ key: 'tool_choice', label: 'Tool choice' }),
        thinking: createObjectDefinition({ key: 'thinking', label: 'Thinking' }),
        container: createStringDefinition({ key: 'container', label: 'Container', maxLength: 128 }),
        context_management: createObjectDefinition({ key: 'context_management', label: 'Context management' }),
        mcp_servers: createArrayDefinition({ key: 'mcp_servers', label: 'MCP servers', itemType: 'object' }),
        service_tier: createStringDefinition({ key: 'service_tier', label: 'Service tier', maxLength: 64 }),
        stream: createBooleanDefinition({ key: 'stream', label: 'Stream' })
    },
    huggingface: {
        ...SHARED_OPENAI_COMPATIBLE_PARAMETERS
    },
    gemma: {
        ...SHARED_OPENAI_COMPATIBLE_PARAMETERS
    },
    deepseek: {
        ...SHARED_OPENAI_COMPATIBLE_PARAMETERS,
        thinking: createObjectDefinition({ key: 'thinking', label: 'Thinking' })
    },
    glm: {
        ...SHARED_OPENAI_COMPATIBLE_PARAMETERS,
        do_sample: createBooleanDefinition({ key: 'do_sample', label: 'Do sample' }),
        thinking: createObjectDefinition({ key: 'thinking', label: 'Thinking' })
    },
    minimax: {
        ...SHARED_OPENAI_COMPATIBLE_PARAMETERS,
        reasoning_split: createBooleanDefinition({ key: 'reasoning_split', label: 'Reasoning split' })
    },
    ollama: {
        tools: createArrayDefinition({ key: 'tools', label: 'Tools', itemType: 'object' }),
        format: { key: 'format', type: 'union', label: 'Format', variants: ['string', 'object'] },
        stream: createBooleanDefinition({ key: 'stream', label: 'Stream' }),
        think: { key: 'think', type: 'union', label: 'Think', variants: ['boolean', 'string'] },
        logprobs: createBooleanDefinition({ key: 'logprobs', label: 'Logprobs' }),
        top_logprobs: createIntegerDefinition({ key: 'top_logprobs', label: 'Top logprobs', min: 0 }),
        temperature: createNumberDefinition({ key: 'temperature', label: 'Temperature', min: 0, max: 2, defaultValue: 0.8 }),
        num_ctx: createIntegerDefinition({ key: 'num_ctx', label: 'Context window', min: 1024, max: 262144, defaultValue: 8192 }),
        repeat_last_n: createIntegerDefinition({ key: 'repeat_last_n', label: 'Repeat last N', min: -1 }),
        repeat_penalty: createNumberDefinition({ key: 'repeat_penalty', label: 'Repeat penalty', min: 0 }),
        seed: createIntegerDefinition({ key: 'seed', label: 'Seed', min: 0 }),
        stop: createArrayDefinition({ key: 'stop', label: 'Stop sequences', itemType: 'string' }),
        num_predict: createIntegerDefinition({ key: 'num_predict', label: 'Max predicted tokens', min: -1 }),
        top_k: createIntegerDefinition({ key: 'top_k', label: 'Top K', min: 0 }),
        top_p: createNumberDefinition({ key: 'top_p', label: 'Top P', min: 0, maxInclusive: 1 }),
        min_p: createNumberDefinition({ key: 'min_p', label: 'Min P', min: 0, maxInclusive: 1 }),
        keep_alive: createStringDefinition({ key: 'keep_alive', label: 'Keep alive', defaultValue: '5m', maxLength: 50 })
    }
});

export const PROVIDER_CAPABILITIES = {
    openai: [
        { match: /^gpt-5.4-pro(?:$|-)/i, maxOutputTokens: 128000, tokenParameter: 'max_completion_tokens', defaultReasoningEffort: 'medium', reasoningEfforts: ['medium', 'high', 'xhigh'], supportedParameters: ['verbosity'], conditionalSamplingMode: 'gpt5_2_style', responsesPreferred: true, responsesOnly: true },
        { match: /^gpt-5.4(?:$|-)/i, maxOutputTokens: 128000, tokenParameter: 'max_completion_tokens', defaultReasoningEffort: 'none', reasoningEfforts: ['none', 'low', 'medium', 'high', 'xhigh'], supportedParameters: ['verbosity'], conditionalSamplingMode: 'gpt5_2_style', responsesPreferred: true },
        { match: /^gpt-5.2-pro(?:$|-)/i, maxOutputTokens: 128000, tokenParameter: 'max_completion_tokens', defaultReasoningEffort: 'medium', reasoningEfforts: ['medium', 'high', 'xhigh'], supportedParameters: ['verbosity'], conditionalSamplingMode: 'gpt5_2_style', responsesPreferred: true, responsesOnly: true },
        { match: /^gpt-5.2(?:$|-)/i, maxOutputTokens: 128000, tokenParameter: 'max_completion_tokens', defaultReasoningEffort: 'none', reasoningEfforts: ['none', 'low', 'medium', 'high', 'xhigh'], supportedParameters: ['verbosity'], conditionalSamplingMode: 'gpt5_2_style', responsesPreferred: true },
        { match: /^gpt-5.1(?:$|-)/i, maxOutputTokens: 128000, tokenParameter: 'max_completion_tokens', defaultReasoningEffort: 'none', reasoningEfforts: ['none', 'low', 'medium', 'high'], supportedParameters: ['verbosity'], conditionalSamplingMode: 'gpt5_1_style', responsesPreferred: true },
        { match: /^gpt-5(?:$|-)/i, maxOutputTokens: 128000, tokenParameter: 'max_completion_tokens', defaultReasoningEffort: 'medium', reasoningEfforts: ['minimal', 'low', 'medium', 'high'], supportedParameters: ['verbosity'], unsupportedParameters: ['temperature', 'top_p', 'logprobs', 'top_logprobs'], responsesPreferred: true },
        { match: /^gpt-4.1(?:$|-)/i, maxOutputTokens: 32768, tokenParameter: 'max_completion_tokens' },
        { match: /^gpt-4o(?:$|-)/i, maxOutputTokens: 16384, tokenParameter: 'max_tokens' }
    ],
    anthropic: [
        { match: /^claude-opus-4-1-20250805$/i, maxOutputTokens: 32000, tokenParameter: 'max_tokens', disallowTemperatureAndTopP: true },
        { match: /^claude-opus-4-20250514$/i, maxOutputTokens: 32000, tokenParameter: 'max_tokens' },
        { match: /^claude-sonnet-4-20250514$/i, maxOutputTokens: 64000, tokenParameter: 'max_tokens' },
        { match: /^claude-3-7-sonnet-20250219$/i, maxOutputTokens: 64000, tokenParameter: 'max_tokens', maxOutputTokensWithBeta: 128000, betaHeader: 'output-128k-2025-02-19' },
        { match: /^claude-3-5-sonnet-20241022$/i, maxOutputTokens: 8192, tokenParameter: 'max_tokens', unsupportedParameters: ['thinking'] },
        { match: /^claude-3-5-haiku-20241022$/i, maxOutputTokens: 8192, tokenParameter: 'max_tokens', unsupportedParameters: ['thinking'] },
        { match: /^claude-3-haiku-20240307$/i, maxOutputTokens: 4096, tokenParameter: 'max_tokens', unsupportedParameters: ['thinking'] }
    ],
    huggingface: [
        { match: /^(?:MiniMaxAI\/MiniMax-M2\.7|minimax-m2\.7:cloud)$/i, maxOutputTokens: 4096, tokenParameter: 'max_tokens', supportsResponseFormat: false, temperatureRange: { min: 0, maxExclusive: 1 }, topPRange: { min: 0, maxInclusive: 1 }, unsupportedParameters: ['presence_penalty', 'frequency_penalty', 'logit_bias', 'n'] }
    ],
    deepseek: [
        { match: /^deepseek-chat$/i, maxOutputTokens: 8192, tokenParameter: 'max_tokens' },
        { match: /^deepseek-reasoner$/i, maxOutputTokens: 64000, tokenParameter: 'max_tokens', unsupportedParameters: ['temperature', 'top_p', 'presence_penalty', 'frequency_penalty', 'logprobs', 'top_logprobs'] }
    ],
    gemma: [
        { match: /^gemma-4-31b-it$/i, maxOutputTokens: 8192, tokenParameter: 'max_tokens' },
        { match: /^gemma-4-26b-a4b-it$/i, maxOutputTokens: 8192, tokenParameter: 'max_tokens' },
        { match: /^gemma-3-270m-it$/i, maxOutputTokens: 8192, tokenParameter: 'max_tokens' },
        { match: /^gemma-3-1b-it$/i, maxOutputTokens: 8192, tokenParameter: 'max_tokens' },
        { match: /^gemma-3-4b-it$/i, maxOutputTokens: 8192, tokenParameter: 'max_tokens' },
        { match: /^gemma-3-12b-it$/i, maxOutputTokens: 8192, tokenParameter: 'max_tokens' },
        { match: /^gemma-3-27b-it$/i, maxOutputTokens: 8192, tokenParameter: 'max_tokens' },
        { match: /^gemma-3n-e2b-it$/i, maxOutputTokens: 8192, tokenParameter: 'max_tokens' },
        { match: /^gemma-3n-e4b-it$/i, maxOutputTokens: 8192, tokenParameter: 'max_tokens' }
    ],
    glm: [
        { match: /^glm-5\.1(?:$|-)/i, maxOutputTokens: 131072, tokenParameter: 'max_tokens', supportsResponseFormat: true, temperatureRange: { min: 0, maxInclusive: 1 }, topPRange: { min: 0, maxInclusive: 1 }, supportedParameters: ['thinking'] },
        { match: /^glm-5(?:$|-)/i, maxOutputTokens: 131072, tokenParameter: 'max_tokens', supportsResponseFormat: true, temperatureRange: { min: 0, maxInclusive: 1 }, topPRange: { min: 0, maxInclusive: 1 }, supportedParameters: ['thinking'] }
    ],
    minimax: [
        { match: /^MiniMax-M2$/i, tokenParameter: 'max_completion_tokens', supportsResponseFormat: false, temperatureRange: { min: 0, maxExclusive: 1 }, topPRange: { min: 0, maxInclusive: 1 }, unsupportedParameters: ['presence_penalty', 'frequency_penalty', 'logit_bias', 'n'] },
        { match: /^MiniMax-M2.7(?:-highspeed)?$/i, tokenParameter: 'max_completion_tokens', supportsResponseFormat: false, temperatureRange: { min: 0, maxExclusive: 1 }, topPRange: { min: 0, maxInclusive: 1 }, unsupportedParameters: ['presence_penalty', 'frequency_penalty', 'logit_bias', 'n'] },
        { match: /^MiniMax-M2.5(?:-highspeed)?$/i, tokenParameter: 'max_completion_tokens', supportsResponseFormat: false, temperatureRange: { min: 0, maxExclusive: 1 }, topPRange: { min: 0, maxInclusive: 1 }, unsupportedParameters: ['presence_penalty', 'frequency_penalty', 'logit_bias', 'n'] },
        { match: /^MiniMax-M2.1(?:-highspeed)?$/i, tokenParameter: 'max_completion_tokens', supportsResponseFormat: false, temperatureRange: { min: 0, maxExclusive: 1 }, topPRange: { min: 0, maxInclusive: 1 }, unsupportedParameters: ['presence_penalty', 'frequency_penalty', 'logit_bias', 'n'] },
        { match: /^M2-her$/i, tokenParameter: 'max_completion_tokens', supportsResponseFormat: false, temperatureRange: { min: 0, maxExclusive: 1 }, topPRange: { min: 0, maxInclusive: 1 }, unsupportedParameters: ['presence_penalty', 'frequency_penalty', 'logit_bias', 'n'] }
    ],
    ollama: [
        { match: /.+/i, supportedParameters: Object.keys(PROVIDER_DEFAULT_PARAMETERS.ollama) }
    ]
};

export function cloneDefinition(definition) {
    return definition ? JSON.parse(JSON.stringify(definition)) : definition;
}

export function createTokenDefinition(tokenParameter, providerCap) {
    return createIntegerDefinition({
        key: tokenParameter,
        label: tokenParameter === 'max_completion_tokens' ? 'Max completion tokens' : 'Max tokens',
        min: 1,
        ...(typeof providerCap === 'number' ? { max: providerCap } : {}),
        defaultValue: typeof providerCap === 'number' ? Math.min(4096, providerCap) : 4096
    });
}
