import axios from 'axios';
import { OLLAMA_AUTO_PULL, OLLAMA_BASE_URL } from '../config/constants.js';
import { safeLog } from '../utils/logger.backend.js';
import { extractTextFromContentBlocks } from './llmContent.service.js';
import {
    buildOllamaChatRequest,
    ensureModelName,
    normalizeBaseUrl,
    resolveOllamaControlPlaneTimeoutMs,
    resolveOllamaSettings,
    resolveOllamaTimeoutMs
} from './ollama.request.js';
import { stripLlmThinkingContent } from './openai/textUtils.js';
import { withRetry } from './retry.service.js';

const OLLAMA_NETWORK_RETRY_CONFIG = {
    maxRetries: 1,
    initialDelayMs: 500,
    maxDelayMs: 2000
};

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

async function postToOllamaChat(baseUrl, requestBody, timeout, operationName) {
    return withRetry(
        () => axios.post(`${baseUrl}/api/chat`, requestBody, { timeout }),
        {
            operationName,
            retryConfig: OLLAMA_NETWORK_RETRY_CONFIG
        }
    );
}

async function getFromOllama(baseUrl, pathName, timeout, operationName) {
    return withRetry(
        () => axios.get(`${baseUrl}${pathName}`, { timeout }),
        {
            operationName,
            retryConfig: OLLAMA_NETWORK_RETRY_CONFIG
        }
    );
}

async function postToOllama(baseUrl, pathName, body, timeout, operationName) {
    return withRetry(
        () => axios.post(`${baseUrl}${pathName}`, body, { timeout }),
        {
            operationName,
            retryConfig: OLLAMA_NETWORK_RETRY_CONFIG
        }
    );
}

async function pullModelIfNeeded(baseUrl, model, options = {}) {
    if (!OLLAMA_AUTO_PULL) {
        throw new Error(`Ollama model "${model}" is not available and automatic pull is disabled`);
    }

    safeLog('warn', 'Ollama model missing, pulling automatically', { model, baseUrl });

    await postToOllama(
        baseUrl,
        '/api/pull',
        { model, stream: false },
        Math.max(resolveOllamaTimeoutMs(options), 15 * 60 * 1000),
        `Ollama ${model} pull request`
    );
}

async function ensureModelAvailable(baseUrl, model, options = {}) {
    const response = await getFromOllama(
        baseUrl,
        '/api/tags',
        resolveOllamaControlPlaneTimeoutMs(options),
        `Ollama ${model} tags request`
    );

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
    const response = await getFromOllama(
        normalizedBaseUrl,
        '/api/tags',
        resolveOllamaControlPlaneTimeoutMs(options),
        'Ollama list models request'
    );

    return (response.data?.models || []).map(model => ({
        name: model.name || model.model,
        size: model.size || null,
        modifiedAt: model.modified_at || null,
        digest: model.digest || null,
        details: model.details || null
    }));
}

export async function showOllamaModelDetails(model, baseUrl = OLLAMA_BASE_URL, options = {}) {
    const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
    const normalizedModel = ensureModelName(model);
    const response = await postToOllama(
        normalizedBaseUrl,
        '/api/show',
        { model: normalizedModel },
        resolveOllamaControlPlaneTimeoutMs(options),
        `Ollama ${normalizedModel} show request`
    );

    return response.data || {};
}

export async function getOllamaRuntimeStatus(baseUrl = OLLAMA_BASE_URL, options = {}) {
    const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
    const response = await getFromOllama(
        normalizedBaseUrl,
        '/api/ps',
        resolveOllamaControlPlaneTimeoutMs(options),
        'Ollama runtime status request'
    );

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

    const response = await postToOllama(
        baseUrl,
        '/api/pull',
        { model: normalizedModel, stream: false },
        Math.max(resolveOllamaTimeoutMs(resolvedSettings), 15 * 60 * 1000),
        `Ollama ${normalizedModel} pull model request`
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

    await postToOllama(
        baseUrl,
        '/api/generate',
        {
            model: normalizedModel,
            prompt: '',
            stream: false
        },
        Math.max(resolveOllamaTimeoutMs(resolvedSettings), 2 * 60 * 1000),
        `Ollama ${normalizedModel} run request`
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

    await postToOllama(
        baseUrl,
        '/api/generate',
        {
            model: normalizedModel,
            prompt: '',
            stream: false,
            keep_alive: 0
        },
        Math.max(resolveOllamaControlPlaneTimeoutMs(resolvedSettings), 30000),
        `Ollama ${normalizedModel} stop request`
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

    const requestBody = buildOllamaChatRequest({
        model: resolvedModel,
        messages,
        settings: resolvedSettings,
        options: requestOptions
    });

    const response = await postToOllamaChat(
        baseUrl,
        requestBody,
        resolveOllamaTimeoutMs(requestOptions),
        `Ollama ${resolvedModel} chat request`
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

    const requestBody = buildOllamaChatRequest({
        model: resolvedModel,
        messages,
        settings: resolvedSettings,
        options: requestOptions
    });

    const response = await postToOllamaChat(
        baseUrl,
        requestBody,
        Math.max(resolveOllamaTimeoutMs(requestOptions), 10 * 60 * 1000),
        `Ollama ${resolvedModel} vision request`
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
