import axios from 'axios';
import { OLLAMA_AUTO_PULL, OLLAMA_BASE_URL, OLLAMA_REQUEST_TIMEOUT_MS } from '../config/constants.js';
import { safeLog } from '../utils/logger.backend.js';
import { extractTextFromContentBlocks } from './llmContent.service.js';
import { stripLlmThinkingContent } from './openai/textUtils.js';

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

function normalizeBaseUrl(baseUrl = OLLAMA_BASE_URL) {
    const trimmed = String(baseUrl || OLLAMA_BASE_URL || '').trim();
    if (!trimmed) {
        throw new Error('Ollama base URL is required');
    }
    return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
}

function extractImageData(dataUrl) {
    const matches = String(dataUrl || '').match(/^data:([^;]+);base64,(.+)$/);
    if (!matches) {
        return null;
    }

    return {
        mediaType: matches[1],
        base64: matches[2]
    };
}

function buildOllamaOptions(_settings = {}, options = {}) {
    const ollamaOptions = {};

    if (typeof options.temperature === 'number') {
        ollamaOptions.temperature = options.temperature;
    }

    const explicitNumCtx = Number(options.num_ctx);
    if (Number.isFinite(explicitNumCtx) && explicitNumCtx > 0) {
        ollamaOptions.num_ctx = explicitNumCtx;
    }

    return ollamaOptions;
}

function resolveOllamaKeepAlive(settings = {}, options = {}) {
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

function resolveOllamaTimeoutMs(options = {}) {
    const operationTimeout = OLLAMA_OPERATION_TIMEOUTS_MS[options.operationType];
    const requestedTimeout = Number(options.timeout);
    const baselineTimeout = Math.max(OLLAMA_REQUEST_TIMEOUT_MS, operationTimeout || 0);

    if (Number.isFinite(requestedTimeout) && requestedTimeout > 0) {
        return Math.max(baselineTimeout, requestedTimeout);
    }

    return baselineTimeout;
}

function resolveOllamaControlPlaneTimeoutMs(options = {}) {
    return Math.max(60000, Math.min(resolveOllamaTimeoutMs(options), 5 * 60 * 1000));
}

function resolveOllamaSettings(settings = {}) {
    if (typeof settings === 'string') {
        return { ollamaBaseUrl: settings };
    }

    return settings || {};
}

function ensureModelName(model) {
    if (!model || !String(model).trim()) {
        throw new Error('Ollama model is required');
    }

    return String(model).trim();
}

function extractOllamaContent(payload = {}) {
    const responseCandidates = [
        payload?.message?.content,
        payload?.message?.text,
        payload?.response,
        payload?.content,
        payload?.output
    ];

    for (const candidate of responseCandidates) {
        const text = stripLlmThinkingContent(extractTextFromContentBlocks(candidate));
        if (text) {
            return text;
        }
    }

    return '';
}

async function pullModelIfNeeded(baseUrl, model, options = {}) {
    if (!OLLAMA_AUTO_PULL) {
        throw new Error(`Ollama model "${model}" is not available and automatic pull is disabled`);
    }

    safeLog('warn', 'Ollama model missing, pulling automatically', { model, baseUrl });

    await axios.post(
        `${baseUrl}/api/pull`,
        { model, stream: false },
        {
            timeout: Math.max(resolveOllamaTimeoutMs(options), 15 * 60 * 1000)
        }
    );
}

async function ensureModelAvailable(baseUrl, model, options = {}) {
    const response = await axios.get(`${baseUrl}/api/tags`, {
        timeout: resolveOllamaControlPlaneTimeoutMs(options)
    });

    const models = response.data?.models || [];
    const exists = models.some(entry => entry?.name === model || entry?.model === model);

    if (!exists) {
        await pullModelIfNeeded(baseUrl, model, options);
    }
}

async function resolveModelName(baseUrl, model, options = {}) {
    const requestedModel = typeof model === 'string' ? model.trim() : '';
    if (requestedModel) {
        return requestedModel;
    }

    const runtimeStatus = await getOllamaRuntimeStatus(baseUrl, options);
    if (runtimeStatus.activeModel) {
        return runtimeStatus.activeModel;
    }

    const availableModels = await listOllamaModels(baseUrl, options);
    if (availableModels.length > 0 && availableModels[0]?.name) {
        return availableModels[0].name;
    }

    throw new Error('No Ollama model is active or installed on the configured host');
}

export async function listOllamaModels(baseUrl = OLLAMA_BASE_URL, options = {}) {
    const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
    const response = await axios.get(`${normalizedBaseUrl}/api/tags`, {
        timeout: resolveOllamaControlPlaneTimeoutMs(options)
    });

    return (response.data?.models || []).map(model => ({
        name: model.name || model.model,
        size: model.size || null,
        modifiedAt: model.modified_at || null
    }));
}

export async function getOllamaRuntimeStatus(baseUrl = OLLAMA_BASE_URL, options = {}) {
    const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
    const response = await axios.get(`${normalizedBaseUrl}/api/ps`, {
        timeout: resolveOllamaControlPlaneTimeoutMs(options)
    });

    const runningModels = (response.data?.models || []).map(model => ({
        name: model.name || model.model,
        size: model.size || null,
        digest: model.digest || null,
        expiresAt: model.expires_at || null,
        sizeVram: model.size_vram || null
    }));

    return {
        running: runningModels.length > 0,
        activeModel: runningModels[0]?.name || null,
        runningModels
    };
}

export async function pullOllamaModel(model, settings = {}) {
    const normalizedModel = ensureModelName(model);
    const resolvedSettings = resolveOllamaSettings(settings);
    const baseUrl = normalizeBaseUrl(resolvedSettings.ollamaBaseUrl);

    const response = await axios.post(
        `${baseUrl}/api/pull`,
        { model: normalizedModel, stream: false },
        {
            timeout: Math.max(resolveOllamaTimeoutMs(resolvedSettings), 15 * 60 * 1000)
        }
    );

    return {
        model: normalizedModel,
        status: response.data?.status || 'success'
    };
}

export async function runOllamaModel(model, settings = {}) {
    const normalizedModel = ensureModelName(model);
    const resolvedSettings = resolveOllamaSettings(settings);
    const baseUrl = normalizeBaseUrl(resolvedSettings.ollamaBaseUrl);

    await ensureModelAvailable(baseUrl, normalizedModel, resolvedSettings);

    await axios.post(
        `${baseUrl}/api/generate`,
        {
            model: normalizedModel,
            prompt: '',
            stream: false
        },
        {
            timeout: Math.max(resolveOllamaTimeoutMs(resolvedSettings), 2 * 60 * 1000)
        }
    );

    return {
        model: normalizedModel,
        status: 'running'
    };
}

export async function stopOllamaModel(model, settings = {}) {
    const normalizedModel = ensureModelName(model);
    const resolvedSettings = resolveOllamaSettings(settings);
    const baseUrl = normalizeBaseUrl(resolvedSettings.ollamaBaseUrl);

    await axios.post(
        `${baseUrl}/api/generate`,
        {
            model: normalizedModel,
            prompt: '',
            stream: false,
            keep_alive: 0
        },
        {
            timeout: Math.max(resolveOllamaControlPlaneTimeoutMs(resolvedSettings), 30000)
        }
    );

    return {
        model: normalizedModel,
        status: 'stopped'
    };
}

export async function callOllama(messages, model, settings = {}, options = {}) {
    const resolvedSettings = resolveOllamaSettings(settings);
    const baseUrl = normalizeBaseUrl(resolvedSettings.ollamaBaseUrl);
    const requestOptions = { ...resolvedSettings, ...options };
    const resolvedModel = await resolveModelName(baseUrl, model, requestOptions);
    await ensureModelAvailable(baseUrl, resolvedModel, requestOptions);

    const requestBody = {
        model: resolvedModel,
        messages,
        stream: false,
        options: buildOllamaOptions(resolvedSettings, options)
    };

    const keepAlive = resolveOllamaKeepAlive(resolvedSettings, options);
    if (keepAlive !== undefined) {
        requestBody.keep_alive = keepAlive;
    }

    const response = await axios.post(
        `${baseUrl}/api/chat`,
        requestBody,
        {
            timeout: resolveOllamaTimeoutMs(requestOptions)
        }
    );

    const content = extractOllamaContent(response.data);
    if (!content) {
        safeLog('error', 'Ollama response contained no usable text', {
            model: resolvedModel,
            baseUrl,
            done: response.data?.done,
            doneReason: response.data?.done_reason,
            messageKeys: response.data?.message ? Object.keys(response.data.message) : [],
            topLevelKeys: response.data ? Object.keys(response.data) : []
        });
        throw new Error('Ollama returned empty content');
    }

    return {
        content,
        model: resolvedModel,
        actualModel: response.data?.model || resolvedModel,
        usage: {
            prompt_tokens: response.data?.prompt_eval_count || 0,
            completion_tokens: response.data?.eval_count || 0,
            total_tokens: (response.data?.prompt_eval_count || 0) + (response.data?.eval_count || 0)
        }
    };
}

export async function callOllamaWithVision(systemPrompt, userContent, model, settings = {}, options = {}) {
    const resolvedSettings = resolveOllamaSettings(settings);
    const baseUrl = normalizeBaseUrl(resolvedSettings.ollamaBaseUrl);
    const requestOptions = { ...resolvedSettings, ...options };
    const resolvedModel = await resolveModelName(baseUrl, model, requestOptions);
    await ensureModelAvailable(baseUrl, resolvedModel, requestOptions);

    const textChunks = [];
    const images = [];

    for (const item of userContent || []) {
        if (item.type === 'image_url' && item.image_url?.url) {
            const imageData = extractImageData(item.image_url.url);
            if (imageData?.base64) {
                images.push(imageData.base64);
            }
        } else if (item.type === 'text' && item.text) {
            textChunks.push(item.text);
        } else if (item.content) {
            textChunks.push(item.content);
        }
    }

    const messages = [];
    if (systemPrompt) {
        messages.push({ role: 'system', content: systemPrompt });
    }

    messages.push({
        role: 'user',
        content: textChunks.join('\n\n').trim(),
        images
    });

    const requestBody = {
        model: resolvedModel,
        messages,
        stream: false,
        options: buildOllamaOptions(resolvedSettings, options)
    };

    const keepAlive = resolveOllamaKeepAlive(resolvedSettings, options);
    if (keepAlive !== undefined) {
        requestBody.keep_alive = keepAlive;
    }

    const response = await axios.post(
        `${baseUrl}/api/chat`,
        requestBody,
        {
            timeout: Math.max(resolveOllamaTimeoutMs(requestOptions), 10 * 60 * 1000)
        }
    );

    const content = extractOllamaContent(response.data);
    if (!content) {
        safeLog('error', 'Ollama vision response contained no usable text', {
            model: resolvedModel,
            baseUrl,
            done: response.data?.done,
            doneReason: response.data?.done_reason,
            messageKeys: response.data?.message ? Object.keys(response.data.message) : [],
            topLevelKeys: response.data ? Object.keys(response.data) : []
        });
        throw new Error('Ollama vision returned empty content');
    }

    return {
        content,
        model: resolvedModel,
        actualModel: response.data?.model || resolvedModel,
        usage: {
            prompt_tokens: response.data?.prompt_eval_count || 0,
            completion_tokens: response.data?.eval_count || 0,
            total_tokens: (response.data?.prompt_eval_count || 0) + (response.data?.eval_count || 0)
        }
    };
}
