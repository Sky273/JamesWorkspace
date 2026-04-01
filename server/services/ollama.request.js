import { OLLAMA_BASE_URL, OLLAMA_REQUEST_TIMEOUT_MS } from '../config/constants.js';

const OLLAMA_OPERATION_TIMEOUTS_MS = {
    'Resume Analysis': 20 * 60 * 1000,
    'Improved Resume Analysis': 20 * 60 * 1000,
    'Resume Improvement': 25 * 60 * 1000,
    'Resume Adaptation': 20 * 60 * 1000,
    'Resume-Mission Matching': 10 * 60 * 1000,
    'Mission Keywords Extraction': 5 * 60 * 1000,
    'Batch Profile Scoring': 10 * 60 * 1000,
    'Detailed Profile Analysis': 10 * 60 * 1000,
    'Resume AI Modification': 10 * 60 * 1000
};

const OLLAMA_RUNTIME_OPTION_KEYS = [
    'temperature',
    'num_ctx',
    'repeat_last_n',
    'repeat_penalty',
    'seed',
    'stop',
    'num_predict',
    'top_k',
    'top_p',
    'min_p'
];

const OLLAMA_TOP_LEVEL_PARAMETER_KEYS = ['tools', 'format', 'stream', 'think', 'logprobs', 'top_logprobs'];

export function normalizeBaseUrl(baseUrl = OLLAMA_BASE_URL) {
    const trimmed = String(baseUrl || OLLAMA_BASE_URL || '').trim();
    if (!trimmed) {
        throw new Error('Ollama base URL is required');
    }
    return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
}

export function resolveOllamaSettings(settings = {}) {
    if (typeof settings === 'string') {
        return { ollamaBaseUrl: settings };
    }

    return settings || {};
}

export function ensureModelName(model) {
    if (!model || !String(model).trim()) {
        throw new Error('Ollama model is required');
    }

    return String(model).trim();
}

export function resolveOllamaTimeoutMs(options = {}) {
    const operationTimeout = OLLAMA_OPERATION_TIMEOUTS_MS[options.operationType];
    const requestedTimeout = Number(options.timeout);
    const baselineTimeout = Math.max(OLLAMA_REQUEST_TIMEOUT_MS, operationTimeout || 0);

    if (Number.isFinite(requestedTimeout) && requestedTimeout > 0) {
        return Math.max(baselineTimeout, requestedTimeout);
    }

    return baselineTimeout;
}

export function resolveOllamaControlPlaneTimeoutMs(options = {}) {
    return Math.max(60000, Math.min(resolveOllamaTimeoutMs(options), 5 * 60 * 1000));
}

export function resolveOllamaKeepAlive(settings = {}, options = {}) {
    const configuredKeepAlive = options.keep_alive ?? settings.ollamaKeepAlive;

    if (typeof configuredKeepAlive === 'number' && Number.isFinite(configuredKeepAlive) && configuredKeepAlive >= 0) {
        return configuredKeepAlive;
    }

    if (typeof configuredKeepAlive === 'string') {
        const normalizedKeepAlive = configuredKeepAlive.trim();
        if (normalizedKeepAlive) {
            return normalizedKeepAlive;
        }
    }

    return undefined;
}

export function buildOllamaRuntimeOptions(options = {}) {
    const ollamaOptions = {};

    for (const key of OLLAMA_RUNTIME_OPTION_KEYS) {
        if (options[key] !== undefined) {
            ollamaOptions[key] = options[key];
        }
    }

    return ollamaOptions;
}

export function applyOllamaTopLevelParameters(requestBody, options = {}) {
    for (const key of OLLAMA_TOP_LEVEL_PARAMETER_KEYS) {
        if (options[key] !== undefined) {
            requestBody[key] = options[key];
        }
    }
}

export function buildOllamaChatRequest({ model, messages, settings = {}, options = {} }) {
    const requestBody = {
        model,
        messages,
        stream: false,
        options: buildOllamaRuntimeOptions(options)
    };
    applyOllamaTopLevelParameters(requestBody, options);

    const keepAlive = resolveOllamaKeepAlive(settings, options);
    if (keepAlive !== undefined) {
        requestBody.keep_alive = keepAlive;
    }

    return requestBody;
}
