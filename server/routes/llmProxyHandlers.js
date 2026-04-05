import axios from 'axios';
import {
    ANTHROPIC_API_KEY,
    DEEPSEEK_API_KEY,
    GLM_API_KEY,
    MAX_PROMPT_LENGTH,
    OPENAI_API_KEY
} from '../config/constants.js';
import { buildLLMMetricLabel, metrics } from '../services/metrics.service.js';
import { securityLog, getRequestMetadata, LOG_LEVELS, SECURITY_EVENTS } from '../services/security.service.js';
import { safeLog } from '../utils/logger.backend.js';
import { getLLMSettings } from '../services/settings.service.js';
import { withRetry } from '../services/retry.service.js';
import { callOllama } from '../services/ollama.service.js';
import { callDeepSeekWithCircuitBreaker } from '../services/deepseek.service.js';
import { callGLMWithCircuitBreaker } from '../services/glm.service.js';
import { callMiniMaxOpenAICompatible, callMiniMaxAnthropicCompatible } from '../services/minimax.service.js';
import {
    extractOpenAIResponsesText,
    flattenLlmTextContent,
    sanitizeOpenAICompatibleResponseBody
} from '../services/llmContent.service.js';
import {
    normalizeAnthropicRequestBody,
    toAnthropicCompatibleResponse,
    toOpenAICompatibleResponse
} from '../services/llmProviderCommon.service.js';
import { resolveCompatibleProviderRuntimeConfig } from '../services/llmConfiguration.service.js';
import { resolveEffectiveModelParameters } from '../services/llmAdminParameters.service.js';
import {
    buildOpenAIProxyRequest,
    extractUsageTokens,
    getRequestedMaxTokens,
    validateMessageLengths
} from './llmRouteHelpers.js';

function buildSanitizedProxyErrorResponse(provider, fallbackMessage, error) {
    const providerName = String(provider || 'llm').toLowerCase();
    const statusCode = error?.response?.status || 500;
    const statusText = typeof error?.response?.statusText === 'string'
        ? error.response.statusText.trim()
        : '';
    const stableMessage = statusCode >= 500
        ? fallbackMessage
        : `${providerName.toUpperCase()} provider request failed${statusText ? ` (${statusText})` : ''}.`;

    return {
        statusCode,
        body: { error: stableMessage }
    };
}

function applyResolvedModelParameters(req, settings, provider, model) {
    const { parameters } = resolveEffectiveModelParameters({
        settings,
        provider,
        model,
        overrides: req.body
    });
    const structuralFields = {
        ...(req.body.model !== undefined ? { model: req.body.model } : {}),
        ...(req.body.messages !== undefined ? { messages: req.body.messages } : {}),
        ...(req.body.input !== undefined ? { input: req.body.input } : {}),
        ...(req.body.system !== undefined ? { system: req.body.system } : {})
    };

    req.body = {
        ...structuralFields,
        ...parameters
    };
}

async function handleOllamaRequest(req, res, settings, responseShape, model) {
    const result = await callOllama(req.body.messages || [], model, settings, {
        ...req.body,
        max_tokens: getRequestedMaxTokens(req.body)
    });

    metrics.trackLLMRequest(
        buildLLMMetricLabel('ollama', result.actualModel || model),
        result.usage?.total_tokens || 0,
        true,
        result.usage?.prompt_tokens || 0,
        result.usage?.completion_tokens || 0
    );
    return res.json(
        responseShape === 'anthropic'
            ? toAnthropicCompatibleResponse(result, 'ollama')
            : toOpenAICompatibleResponse(result, 'ollama')
    );
}

async function handleMiniMaxRequest(req, res, responseShape, model) {
    const requestFactory = async () => {
        if (responseShape === 'anthropic') {
            return callMiniMaxAnthropicCompatible({
                model,
                messages: req.body.messages || [],
                ...req.body,
                maxTokens: getRequestedMaxTokens(req.body),
                timeout: 120000,
                operationType: `MiniMax ${model} anthropic-compatible request`,
                useRetry: false
            });
        }

        return callMiniMaxOpenAICompatible({
            model,
            messages: req.body.messages || [],
            ...req.body,
            maxTokens: getRequestedMaxTokens(req.body),
            timeout: 120000,
            operationType: `MiniMax ${model} openai-compatible request`,
            useRetry: false
        });
    };

    const result = await withRetry(requestFactory, {
        serviceName: 'minimax',
        operationName: `MiniMax ${model} ${responseShape}-compatible request`,
        retryConfig: {
            maxRetries: 3,
            initialDelayMs: 2000,
            maxDelayMs: 60000
        }
    });

    if (responseShape === 'anthropic') {
        return res.json(toAnthropicCompatibleResponse(result, 'minimax'));
    }

    return res.json(toOpenAICompatibleResponse(result, 'minimax'));
}

async function handleDeepSeekRequest(req, res, model, metadata) {
    if (!DEEPSEEK_API_KEY) {
        return res.status(500).json({ error: 'DeepSeek API key not configured on server.' });
    }

    securityLog(LOG_LEVELS.INFO, SECURITY_EVENTS.LLM_REQUEST, {
        ...metadata,
        message: 'DeepSeek API request',
        metadata: {
            model,
            messageCount: req.body.messages?.length || 0
        }
    });

    const response = await callDeepSeekWithCircuitBreaker({
        model,
        messages: req.body.messages || [],
        ...req.body,
        maxTokens: getRequestedMaxTokens(req.body),
        timeout: 120000,
        operationType: `DeepSeek ${model} request`
    });

    return res.json(sanitizeOpenAICompatibleResponseBody(response));
}

async function handleGLMRequest(req, res, model, metadata) {
    if (!GLM_API_KEY) {
        return res.status(500).json({ error: 'GLM API key not configured on server.' });
    }

    securityLog(LOG_LEVELS.INFO, SECURITY_EVENTS.LLM_REQUEST, {
        ...metadata,
        message: 'GLM API request',
        metadata: {
            model,
            messageCount: req.body.messages?.length || 0
        }
    });

    const response = await callGLMWithCircuitBreaker({
        model,
        messages: req.body.messages || [],
        ...req.body,
        maxTokens: getRequestedMaxTokens(req.body),
        timeout: 120000,
        operationType: `GLM ${model} request`
    });

    return res.json(sanitizeOpenAICompatibleResponseBody(response));
}

async function maybeHandleCompatibleProviderRequest(req, res, settings, responseShape, model, metadata) {
    const { provider } = resolveCompatibleProviderRuntimeConfig({
        settings,
        requestedModel: model,
        responseShape
    });

    if (provider === 'ollama') {
        safeLog('info', `Routing ${responseShape}-compatible request through Ollama`, { model, provider });
        return handleOllamaRequest(req, res, settings, responseShape, model);
    }

    if (provider === 'minimax') {
        safeLog('info', `Routing ${responseShape}-compatible request through MiniMax`, { model, provider });
        return handleMiniMaxRequest(req, res, responseShape, model);
    }

    if (provider === 'deepseek' && responseShape === 'openai') {
        safeLog('info', 'Routing openai-compatible request through DeepSeek', { model, provider });
        return handleDeepSeekRequest(req, res, model, metadata);
    }

    if (provider === 'glm' && responseShape === 'openai') {
        safeLog('info', 'Routing openai-compatible request through GLM', { model, provider });
        return handleGLMRequest(req, res, model, metadata);
    }

    return null;
}

async function proxyOpenAIRequest(req, res, model, metadata, { allowResponsesApi = true } = {}) {
    if (!OPENAI_API_KEY) {
        return res.status(500).json({ error: 'OpenAI API key not configured on server.' });
    }

    safeLog('info', 'LLM request', { model, user: metadata.email, messageCount: req.body.messages?.length || 0 });

    securityLog(LOG_LEVELS.INFO, SECURITY_EVENTS.LLM_REQUEST, {
        ...metadata,
        message: 'OpenAI API request',
        metadata: {
            model,
            messageCount: req.body.messages?.length || 0
        }
    });

    const { openAiUrl, requestBody, usesResponsesApi } = buildOpenAIProxyRequest({
        model,
        body: req.body,
        allowResponsesApi
    });

    const response = await withRetry(
        () => axios.post(openAiUrl, requestBody, {
            headers: {
                Authorization: `Bearer ${OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            },
            timeout: 120000,
            validateStatus: status => status < 500
        }),
        {
            serviceName: 'openai',
            operationName: `OpenAI ${model} request`,
            retryConfig: {
                maxRetries: 3,
                initialDelayMs: 2000,
                maxDelayMs: 60000
            }
        }
    );

    if (response.status >= 400) {
        const sanitized = buildSanitizedProxyErrorResponse('openai', 'Failed to proxy request to OpenAI.', {
            response: {
                status: response.status,
                statusText: response.statusText
            }
        });
        return res.status(sanitized.statusCode).json(sanitized.body);
    }

    const usage = response.data?.usage || {};
    const { inputTokens, outputTokens, totalTokens } = extractUsageTokens(usage);
    metrics.trackLLMRequest(buildLLMMetricLabel('openai', model), totalTokens, true, inputTokens, outputTokens);

    if (usesResponsesApi && response.data?.output) {
        const textContent = extractOpenAIResponsesText(response.data.output || []);

        return res.json({
            id: response.data.id,
            object: 'chat.completion',
            created: Date.now(),
            model,
            choices: [{
                index: 0,
                message: {
                    role: 'assistant',
                    content: textContent
                },
                finish_reason: response.data.status === 'completed' ? 'stop' : response.data.status
            }],
            usage: response.data.usage
        });
    }

    return res.json(sanitizeOpenAICompatibleResponseBody(response.data));
}

async function proxyAnthropicRequest(req, res, model, metadata, { useRetry = true } = {}) {
    if (!ANTHROPIC_API_KEY) {
        return res.status(500).json({ error: 'Anthropic API key not configured on server.' });
    }

    safeLog('info', 'LLM request', { model, user: metadata.email, messageCount: req.body.messages?.length || 0 });

    securityLog(LOG_LEVELS.INFO, SECURITY_EVENTS.LLM_REQUEST, {
        ...metadata,
        message: 'Anthropic API request',
        metadata: {
            model,
            messageCount: req.body.messages?.length || 0
        }
    });

    const requestBody = normalizeAnthropicRequestBody(req.body, model);
    const requestFactory = () => axios.post('https://api.anthropic.com/v1/messages', requestBody, {
        headers: {
            'x-api-key': ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json'
        },
        timeout: 90000
    });

    const response = useRetry
        ? await withRetry(requestFactory, {
            serviceName: 'anthropic',
            operationName: `Anthropic ${model} request`,
            retryConfig: {
                maxRetries: 3,
                initialDelayMs: 2000,
                maxDelayMs: 60000
            }
        })
        : await requestFactory();

    const usage = response.data?.usage || {};
    const inputTokens = usage.input_tokens || 0;
    const outputTokens = usage.output_tokens || 0;
    const totalTokens = inputTokens + outputTokens;
    metrics.trackLLMRequest(buildLLMMetricLabel('anthropic', model), totalTokens, true, inputTokens, outputTokens);

    return res.json(response.data);
}

export function createCompatibleProxyHandler({
    responseShape,
    proxyProvider,
    fallbackErrorMessage,
    allowResponsesApi,
    useRetry
}) {
    return async (req, res) => {
        const metadata = getRequestMetadata(req);
        let model = req.body.model;

        try {
            const settings = await getLLMSettings();
            const validationError = validateMessageLengths(req.body.messages, flattenLlmTextContent, MAX_PROMPT_LENGTH);
            if (validationError) {
                return res.status(400).json({ error: validationError });
            }

            const runtimeConfig = resolveCompatibleProviderRuntimeConfig({
                settings,
                requestedModel: req.body.model || model,
                responseShape
            });
            model = runtimeConfig.model;
            applyResolvedModelParameters(req, settings, runtimeConfig.provider, model);

            const compatibleResponse = await maybeHandleCompatibleProviderRequest(
                req,
                res,
                settings,
                responseShape,
                model,
                metadata
            );
            if (compatibleResponse) {
                return compatibleResponse;
            }

            if (responseShape === 'anthropic') {
                return await proxyAnthropicRequest(req, res, model, metadata, { useRetry });
            }

            return await proxyOpenAIRequest(req, res, model, metadata, { allowResponsesApi });
        } catch (error) {
            metrics.trackLLMRequest(
                buildLLMMetricLabel(proxyProvider, req.body.model || model || proxyProvider),
                0,
                false,
                0,
                0
            );
            const sanitized = buildSanitizedProxyErrorResponse(proxyProvider, fallbackErrorMessage, error);
            return res.status(sanitized.statusCode).json(sanitized.body);
        }
    };
}
