import axios from 'axios';
import { OLLAMA_AUTO_PULL, OLLAMA_BASE_URL, OLLAMA_REQUEST_TIMEOUT_MS } from '../config/constants.js';
import { safeLog } from '../utils/logger.backend.js';

function normalizeBaseUrl(baseUrl = OLLAMA_BASE_URL) {
    const trimmed = (baseUrl || OLLAMA_BASE_URL || 'http://127.0.0.1:11434').trim();
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

function buildOllamaOptions(settings = {}, options = {}) {
    const ollamaOptions = {};

    if (typeof options.temperature === 'number') {
        ollamaOptions.temperature = options.temperature;
    }

    const numCtx = Number(settings.ollamaNumCtx);
    if (Number.isFinite(numCtx) && numCtx > 0) {
        ollamaOptions.num_ctx = numCtx;
    }

    return ollamaOptions;
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

async function pullModelIfNeeded(baseUrl, model) {
    if (!OLLAMA_AUTO_PULL) {
        throw new Error(`Ollama model "${model}" is not available and automatic pull is disabled`);
    }

    safeLog('warn', 'Ollama model missing, pulling automatically', { model, baseUrl });

    await axios.post(
        `${baseUrl}/api/pull`,
        { model, stream: false },
        {
            timeout: Math.max(OLLAMA_REQUEST_TIMEOUT_MS, 15 * 60 * 1000)
        }
    );
}

async function ensureModelAvailable(baseUrl, model) {
    const response = await axios.get(`${baseUrl}/api/tags`, {
        timeout: 15000
    });

    const models = response.data?.models || [];
    const exists = models.some(entry => entry?.name === model || entry?.model === model);

    if (!exists) {
        await pullModelIfNeeded(baseUrl, model);
    }
}

export async function listOllamaModels(baseUrl = OLLAMA_BASE_URL) {
    const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
    const response = await axios.get(`${normalizedBaseUrl}/api/tags`, {
        timeout: 15000
    });

    return (response.data?.models || []).map(model => ({
        name: model.name || model.model,
        size: model.size || null,
        modifiedAt: model.modified_at || null
    }));
}

export async function getOllamaRuntimeStatus(baseUrl = OLLAMA_BASE_URL) {
    const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
    const response = await axios.get(`${normalizedBaseUrl}/api/ps`, {
        timeout: 15000
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
            timeout: Math.max(OLLAMA_REQUEST_TIMEOUT_MS, 15 * 60 * 1000)
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

    await ensureModelAvailable(baseUrl, normalizedModel);

    await axios.post(
        `${baseUrl}/api/generate`,
        {
            model: normalizedModel,
            prompt: '',
            stream: false,
            keep_alive: resolvedSettings.ollamaKeepAlive || '5m',
            options: buildOllamaOptions(resolvedSettings)
        },
        {
            timeout: Math.max(OLLAMA_REQUEST_TIMEOUT_MS, 2 * 60 * 1000)
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
            timeout: 30000
        }
    );

    return {
        model: normalizedModel,
        status: 'stopped'
    };
}

export async function callOllama(messages, model, settings = {}, options = {}) {
    if (!model) {
        throw new Error('Ollama model not configured');
    }

    const resolvedSettings = resolveOllamaSettings(settings);
    const baseUrl = normalizeBaseUrl(resolvedSettings.ollamaBaseUrl);
    await ensureModelAvailable(baseUrl, model);

    const requestBody = {
        model,
        messages,
        stream: false,
        options: buildOllamaOptions(resolvedSettings, options)
    };

    if (resolvedSettings.ollamaKeepAlive) {
        requestBody.keep_alive = resolvedSettings.ollamaKeepAlive;
    }

    const response = await axios.post(
        `${baseUrl}/api/chat`,
        requestBody,
        {
            timeout: OLLAMA_REQUEST_TIMEOUT_MS
        }
    );

    const content = response.data?.message?.content;
    if (!content) {
        throw new Error('Ollama returned empty content');
    }

    return {
        content,
        model,
        actualModel: response.data?.model || model,
        usage: {
            prompt_tokens: response.data?.prompt_eval_count || 0,
            completion_tokens: response.data?.eval_count || 0,
            total_tokens: (response.data?.prompt_eval_count || 0) + (response.data?.eval_count || 0)
        }
    };
}

export async function callOllamaWithVision(systemPrompt, userContent, model, settings = {}, options = {}) {
    const resolvedSettings = resolveOllamaSettings(settings);
    const visionModel = resolvedSettings.ollamaVisionModel || model;
    if (!visionModel) {
        throw new Error('Ollama vision model not configured');
    }

    const baseUrl = normalizeBaseUrl(resolvedSettings.ollamaBaseUrl);
    await ensureModelAvailable(baseUrl, visionModel);

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
        model: visionModel,
        messages,
        stream: false,
        options: buildOllamaOptions(resolvedSettings, options)
    };

    if (resolvedSettings.ollamaKeepAlive) {
        requestBody.keep_alive = resolvedSettings.ollamaKeepAlive;
    }

    const response = await axios.post(
        `${baseUrl}/api/chat`,
        requestBody,
        {
            timeout: Math.max(OLLAMA_REQUEST_TIMEOUT_MS, 10 * 60 * 1000)
        }
    );

    const content = response.data?.message?.content;
    if (!content) {
        throw new Error('Ollama vision returned empty content');
    }

    return {
        content,
        model: visionModel,
        actualModel: response.data?.model || visionModel,
        usage: {
            prompt_tokens: response.data?.prompt_eval_count || 0,
            completion_tokens: response.data?.eval_count || 0,
            total_tokens: (response.data?.prompt_eval_count || 0) + (response.data?.eval_count || 0)
        }
    };
}

