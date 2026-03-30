import express from 'express';
import axios from 'axios';
import { OPENAI_API_KEY, ANTHROPIC_API_KEY, DEEPSEEK_API_KEY, GLM_API_KEY, MAX_PROMPT_LENGTH, MINIMAX_API_KEY } from '../config/constants.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.middleware.js';
import { llmLimiter, combinedRateLimit } from '../middleware/rateLimit.middleware.js';
import { buildLLMMetricLabel, metrics } from '../services/metrics.service.js';
import { securityLog, getRequestMetadata, LOG_LEVELS, SECURITY_EVENTS } from '../services/security.service.js';
import { safeLog } from '../utils/logger.backend.js';
import { getLLMSettings } from '../services/settings.service.js';
import { withRetry, getCircuitBreakerStates } from '../services/retry.service.js';
import { validateBody, openaiRequestSchema, anthropicRequestSchema } from '../utils/validation.js';
import { callOllama } from '../services/ollama.service.js';
import { callDeepSeek } from '../services/deepseek.service.js';
import { callGLMWithCircuitBreaker } from '../services/glm.service.js';
import { callMiniMaxOpenAICompatible, callMiniMaxAnthropicCompatible } from '../services/minimax.service.js';
import { extractOpenAIResponsesText, flattenLlmTextContent, sanitizeOpenAICompatibleResponseBody } from '../services/llmContent.service.js';
import { normalizeAnthropicRequestBody, toAnthropicCompatibleResponse, toOpenAICompatibleResponse } from '../services/llmProviderCommon.service.js';
import { resolveCompatibleProviderRuntimeConfig } from '../services/llmConfiguration.service.js';

const router = express.Router();

const LLM_FAMILY_INDICATORS = ['openai', 'anthropic', 'deepseek', 'glm', 'minimax', 'ollama'];

function normalizeCircuitBreakerIndicator(provider, indicator) {
    if (indicator && typeof indicator === 'object' && !Array.isArray(indicator)) {
        return {
            provider,
            supported: provider !== 'ollama',
            state: indicator.state || 'UNKNOWN',
            failures: indicator.failures || 0,
            lastFailureTime: indicator.lastFailureTime || null
        };
    }

    if (typeof indicator === 'string') {
        return {
            provider,
            supported: provider !== 'ollama',
            state: indicator.toUpperCase(),
            failures: 0,
            lastFailureTime: null
        };
    }

    if (provider === 'ollama') {
        return {
            provider,
            supported: false,
            state: 'NOT_APPLICABLE',
            failures: 0,
            lastFailureTime: null
        };
    }

    return {
        provider,
        supported: true,
        state: 'UNKNOWN',
        failures: 0,
        lastFailureTime: null
    };
}

function buildCircuitBreakerIndicators(states = {}) {
    return Object.fromEntries(LLM_FAMILY_INDICATORS.map(provider => [
        provider,
        normalizeCircuitBreakerIndicator(provider, states[provider])
    ]));
}

function validateMessageLengths(messages) {
    if (!messages || !Array.isArray(messages)) {
        return null;
    }

    for (const message of messages) {
        const content = flattenLlmTextContent(message.content);
        if (content && content.length > MAX_PROMPT_LENGTH) {
            return `Message content exceeds maximum length of ${MAX_PROMPT_LENGTH}`;
        }
    }

    return null;
}

function getRequestedMaxTokens(body = {}) {
    return body.max_tokens || body.max_completion_tokens || body.max_output_tokens || 4096;
}

async function handleOllamaRequest(req, res, settings, responseShape, model) {
    const result = await callOllama(req.body.messages || [], model, settings, {
        temperature: req.body.temperature,
        max_tokens: getRequestedMaxTokens(req.body)
    });

    metrics.trackLLMRequest(buildLLMMetricLabel('ollama', result.actualModel || model), result.usage?.total_tokens || 0, true, result.usage?.prompt_tokens || 0, result.usage?.completion_tokens || 0);
    return res.json(responseShape === 'anthropic' ? toAnthropicCompatibleResponse(result, 'ollama') : toOpenAICompatibleResponse(result, 'ollama'));
}

async function handleMiniMaxRequest(req, res, responseShape, model) {
    const requestFactory = async () => {
        if (responseShape === 'anthropic') {
            return callMiniMaxAnthropicCompatible({
                model,
                messages: req.body.messages || [],
                maxTokens: getRequestedMaxTokens(req.body),
                temperature: req.body.temperature,
                topP: req.body.top_p,
                timeout: 120000,
                operationType: `MiniMax ${model} anthropic-compatible request`,
                useRetry: false
            });
        }

        return callMiniMaxOpenAICompatible({
            model,
            messages: req.body.messages || [],
            maxTokens: getRequestedMaxTokens(req.body),
            temperature: req.body.temperature,
            topP: req.body.top_p,
            responseFormat: req.body.response_format,
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

    const response = await callDeepSeek({
        model,
        messages: req.body.messages || [],
        maxTokens: getRequestedMaxTokens(req.body),
        temperature: req.body.temperature,
        topP: req.body.top_p,
        responseFormat: req.body.response_format,
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
        maxTokens: getRequestedMaxTokens(req.body),
        temperature: req.body.temperature,
        topP: req.body.top_p,
        responseFormat: req.body.response_format,
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

    const isGPT5Model = allowResponsesApi && model.match(/^gpt-5/i);
    let openAiUrl;
    let requestBody;

    if (isGPT5Model) {
        openAiUrl = 'https://api.openai.com/v1/responses';
        requestBody = {
            model,
            input: req.body.messages || req.body.input
        };
        const isProModel = model.match(/gpt-5\.\d+-pro/i);
        requestBody.reasoning = { effort: isProModel ? 'medium' : 'none' };
        if (req.body.response_format) {
            requestBody.text = { format: req.body.response_format };
        }
        if (req.body.max_tokens) {
            requestBody.max_output_tokens = req.body.max_tokens;
        } else if (req.body.max_completion_tokens) {
            requestBody.max_output_tokens = req.body.max_completion_tokens;
        } else if (req.body.max_output_tokens) {
            requestBody.max_output_tokens = req.body.max_output_tokens;
        }
        if (!isProModel && req.body.temperature !== undefined) {
            requestBody.temperature = req.body.temperature;
        }
    } else {
        openAiUrl = 'https://api.openai.com/v1/chat/completions';
        requestBody = {
            ...req.body,
            model
        };
    }

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
        return res.status(response.status).json(response.data);
    }

    const usage = response.data?.usage || {};
    const inputTokens = usage.input_tokens || usage.prompt_tokens || 0;
    const outputTokens = usage.output_tokens || usage.completion_tokens || 0;
    const totalTokens = usage.total_tokens || (inputTokens + outputTokens);
    metrics.trackLLMRequest(buildLLMMetricLabel('openai', model), totalTokens, true, inputTokens, outputTokens);

    if (isGPT5Model && response.data?.output) {
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

router.post('/openai', authenticateToken, llmLimiter, combinedRateLimit(30, 60 * 60 * 1000), validateBody(openaiRequestSchema), async (req, res) => {
    const metadata = getRequestMetadata(req);
    let model = req.body.model;

    try {
        const settings = await getLLMSettings();
        const validationError = validateMessageLengths(req.body.messages);
        if (validationError) {
            return res.status(400).json({ error: validationError });
        }

        ({ model } = resolveCompatibleProviderRuntimeConfig({ settings, requestedModel: model, responseShape: 'openai' }));

        const compatibleResponse = await maybeHandleCompatibleProviderRequest(req, res, settings, 'openai', model, metadata);
        if (compatibleResponse) {
            return compatibleResponse;
        }

        return await proxyOpenAIRequest(req, res, model, metadata, { allowResponsesApi: true });
    } catch (error) {
        metrics.trackLLMRequest(buildLLMMetricLabel('openai', model || 'openai'), 0, false, 0, 0);
        const statusCode = error.response ? error.response.status : 500;
        const errorData = error.response ? error.response.data : { error: 'Failed to proxy request to OpenAI.' };
        return res.status(statusCode).json(errorData);
    }
});

router.post('/anthropic', authenticateToken, llmLimiter, combinedRateLimit(30, 60 * 60 * 1000), validateBody(anthropicRequestSchema), async (req, res) => {
    const metadata = getRequestMetadata(req);
    let model = process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022';

    try {
        const settings = await getLLMSettings();
        const validationError = validateMessageLengths(req.body.messages);
        if (validationError) {
            return res.status(400).json({ error: validationError });
        }

        ({ model } = resolveCompatibleProviderRuntimeConfig({ settings, requestedModel: req.body.model || model, responseShape: 'anthropic' }));

        const compatibleResponse = await maybeHandleCompatibleProviderRequest(req, res, settings, 'anthropic', model, metadata);
        if (compatibleResponse) {
            return compatibleResponse;
        }

        return await proxyAnthropicRequest(req, res, model, metadata, { useRetry: true });
    } catch (error) {
        metrics.trackLLMRequest(buildLLMMetricLabel('anthropic', model), 0, false, 0, 0);
        const statusCode = error.response ? error.response.status : 500;
        const errorData = error.response ? error.response.data : { error: `Failed to proxy request to Anthropic: ${error.message}` };
        return res.status(statusCode).json(errorData);
    }
});

router.post('/chat/completions', authenticateToken, llmLimiter, combinedRateLimit(30, 60 * 60 * 1000), validateBody(openaiRequestSchema), async (req, res) => {
    const metadata = getRequestMetadata(req);
    let model = req.body.model || 'openai';

    try {
        const settings = await getLLMSettings();
        ({ model } = resolveCompatibleProviderRuntimeConfig({ settings, requestedModel: req.body.model || model, responseShape: 'openai' }));

        const compatibleResponse = await maybeHandleCompatibleProviderRequest(req, res, settings, 'openai', model, metadata);
        if (compatibleResponse) {
            return compatibleResponse;
        }

        return await proxyOpenAIRequest(req, res, model, metadata, { allowResponsesApi: false });
    } catch (error) {
        metrics.trackLLMRequest(buildLLMMetricLabel('openai', req.body.model || model), 0, false, 0, 0);
        const statusCode = error.response ? error.response.status : 500;
        const errorData = error.response ? error.response.data : { error: 'Failed to call OpenAI API.' };
        return res.status(statusCode).json(errorData);
    }
});

router.post('/messages', authenticateToken, llmLimiter, combinedRateLimit(30, 60 * 60 * 1000), validateBody(anthropicRequestSchema), async (req, res) => {
    const metadata = getRequestMetadata(req);
    let model = process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022';

    try {
        const settings = await getLLMSettings();
        ({ model } = resolveCompatibleProviderRuntimeConfig({ settings, requestedModel: req.body.model || model, responseShape: 'anthropic' }));

        const compatibleResponse = await maybeHandleCompatibleProviderRequest(req, res, settings, 'anthropic', model, metadata);
        if (compatibleResponse) {
            return compatibleResponse;
        }

        return await proxyAnthropicRequest(req, res, model, metadata, { useRetry: true });
    } catch (error) {
        metrics.trackLLMRequest(buildLLMMetricLabel('anthropic', req.body.model || model), 0, false, 0, 0);
        const statusCode = error.response ? error.response.status : 500;
        const errorData = error.response ? error.response.data : { error: 'Failed to call Anthropic API.' };
        return res.status(statusCode).json(errorData);
    }
});

router.get('/circuit-breakers', authenticateToken, requireAdmin, (req, res) => {
    const states = getCircuitBreakerStates();
    const indicators = buildCircuitBreakerIndicators(states);

    indicators.openai.configured = Boolean(OPENAI_API_KEY);
    indicators.anthropic.configured = Boolean(ANTHROPIC_API_KEY);
    indicators.deepseek.configured = Boolean(DEEPSEEK_API_KEY);
    indicators.glm.configured = Boolean(GLM_API_KEY);
    indicators.minimax.configured = Boolean(MINIMAX_API_KEY);
    indicators.ollama.configured = true;

    res.json(indicators);
});

export default router;


