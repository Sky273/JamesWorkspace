import express from 'express';
import axios from 'axios';
import { OPENAI_API_KEY, ANTHROPIC_API_KEY, MAX_PROMPT_LENGTH, MINIMAX_API_KEY } from '../config/constants.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.middleware.js';
import { llmLimiter, combinedRateLimit } from '../middleware/rateLimit.middleware.js';
import { metrics } from '../services/metrics.service.js';
import { securityLog, getRequestMetadata, LOG_LEVELS, SECURITY_EVENTS } from '../services/security.service.js';
import { safeLog } from '../utils/logger.backend.js';
import { getLLMSettings } from '../services/settings.service.js';
import { withRetry, getCircuitBreakerStates } from '../services/retry.service.js';
import { validateBody, openaiRequestSchema, anthropicRequestSchema } from '../utils/validation.js';
import { callOllama } from '../services/ollama.service.js';
import { callMiniMaxOpenAICompatible, callMiniMaxAnthropicCompatible } from '../services/minimax.service.js';

const router = express.Router();

function flattenMessageTextContent(content) {
    if (typeof content === 'string') {
        return content;
    }

    if (!Array.isArray(content)) {
        return '';
    }

    return content
        .map(block => {
            if (typeof block === 'string') {
                return block;
            }
            if (typeof block?.text === 'string') {
                return block.text;
            }
            if (typeof block?.thinking === 'string') {
                return block.thinking;
            }
            return '';
        })
        .filter(Boolean)
        .join('\n');
}

function normalizeAnthropicContent(content) {
    if (typeof content === 'string') {
        return [{ type: 'text', text: content }];
    }

    if (!Array.isArray(content)) {
        return [];
    }

    return content.map(block => typeof block === 'string' ? { type: 'text', text: block } : block);
}

function normalizeAnthropicRequestBody(body = {}, model) {
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const systemMessages = messages.filter(message => message.role === 'system');
    const conversationMessages = messages
        .filter(message => message.role !== 'system')
        .map(message => ({
            role: message.role,
            content: normalizeAnthropicContent(message.content)
        }));

    const requestBody = {
        ...body,
        model,
        messages: conversationMessages
    };

    if (systemMessages.length > 0 && requestBody.system === undefined) {
        requestBody.system = systemMessages
            .flatMap(message => normalizeAnthropicContent(message.content))
            .filter(Boolean);
    } else if (requestBody.system !== undefined) {
        requestBody.system = normalizeAnthropicContent(requestBody.system);
    }

    return requestBody;
}

function validateMessageLengths(messages) {
    if (!messages || !Array.isArray(messages)) {
        return null;
    }

    for (const message of messages) {
        const content = flattenMessageTextContent(message.content);
        if (content && content.length > MAX_PROMPT_LENGTH) {
            return `Message content exceeds maximum length of ${MAX_PROMPT_LENGTH}`;
        }
    }

    return null;
}

function toOpenAICompatibleResponse(result, prefix = 'provider') {
    return {
        id: `${prefix}-${Date.now()}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: result.actualModel || result.model,
        choices: [{
            index: 0,
            message: {
                role: 'assistant',
                content: result.content
            },
            finish_reason: 'stop'
        }],
        usage: result.usage || {
            prompt_tokens: 0,
            completion_tokens: 0,
            total_tokens: 0
        }
    };
}

function toAnthropicCompatibleResponse(result, prefix = 'provider') {
    return {
        id: `${prefix}-${Date.now()}`,
        type: 'message',
        role: 'assistant',
        model: result.actualModel || result.model,
        content: [{ type: 'text', text: result.content }],
        stop_reason: 'end_turn',
        usage: {
            input_tokens: result.usage?.input_tokens || result.usage?.prompt_tokens || 0,
            output_tokens: result.usage?.output_tokens || result.usage?.completion_tokens || 0
        }
    };
}

function isLikelyOpenAIModel(model = '') {
    return /^(gpt|chatgpt|o\d|text-embedding|whisper|davinci|babbage|omni)/i.test(String(model || '').trim());
}

function isLikelyAnthropicModel(model = '') {
    return /^claude/i.test(String(model || '').trim());
}

function isLikelyMiniMaxModel(model = '') {
    return /^minimax/i.test(String(model || '').trim());
}

function shouldRouteToMiniMax(settings, model) {
    const provider = settings?.llmProvider || 'openai';
    if (provider === 'minimax') {
        return true;
    }

    const candidateModel = String(model || settings?.llmModel || '').trim();
    return Boolean(candidateModel && isLikelyMiniMaxModel(candidateModel));
}

function shouldRouteToOllama(settings, model) {
    const provider = settings?.llmProvider || 'openai';
    if (provider === 'ollama') {
        return true;
    }

    const candidateModel = String(model || settings?.llmModel || '').trim();
    if (!candidateModel) {
        return false;
    }

    if (isLikelyOpenAIModel(candidateModel) || isLikelyAnthropicModel(candidateModel) || isLikelyMiniMaxModel(candidateModel)) {
        return false;
    }

    return Boolean(settings?.ollamaBaseUrl);
}

async function handleOllamaRequest(req, res, settings, responseShape) {
    const model = req.body.model || settings.llmModel || null;
    const result = await callOllama(req.body.messages || [], model, settings, {
        temperature: req.body.temperature,
        max_tokens: req.body.max_tokens || req.body.max_completion_tokens || req.body.max_output_tokens
    });

    metrics.trackLLMRequest(`ollama:${result.actualModel || model}`, result.usage?.total_tokens || 0, true, result.usage?.prompt_tokens || 0, result.usage?.completion_tokens || 0);
    return res.json(responseShape === 'anthropic' ? toAnthropicCompatibleResponse(result, 'ollama') : toOpenAICompatibleResponse(result, 'ollama'));
}

async function handleMiniMaxRequest(req, res, settings, responseShape) {
    const model = req.body.model || settings.llmModel || 'MiniMax-M2.7';
    let result;

    if (responseShape === 'anthropic') {
        result = await callMiniMaxAnthropicCompatible({
            model,
            messages: req.body.messages || [],
            maxTokens: req.body.max_tokens || req.body.max_completion_tokens || req.body.max_output_tokens || 4096,
            temperature: req.body.temperature,
            topP: req.body.top_p,
            timeout: 120000,
            operationType: `MiniMax ${model} anthropic-compatible request`
        });

        return res.json(toAnthropicCompatibleResponse(result, 'minimax'));
    }

    result = await callMiniMaxOpenAICompatible({
        model,
        messages: req.body.messages || [],
        maxTokens: req.body.max_tokens || req.body.max_completion_tokens || req.body.max_output_tokens || 4096,
        temperature: req.body.temperature,
        topP: req.body.top_p,
        responseFormat: req.body.response_format,
        timeout: 120000,
        operationType: `MiniMax ${model} openai-compatible request`
    });

    return res.json(toOpenAICompatibleResponse(result, 'minimax'));
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

        model = model || settings.llmModel || 'gpt-4o';

        if (shouldRouteToOllama(settings, model)) {
            safeLog('info', 'Routing OpenAI-compatible request through Ollama', { model, user: metadata.email });
            return await handleOllamaRequest(req, res, settings, 'openai');
        }

        if (shouldRouteToMiniMax(settings, model)) {
            safeLog('info', 'Routing OpenAI-compatible request through MiniMax', { model, user: metadata.email });
            return await handleMiniMaxRequest(req, res, settings, 'openai');
        }

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

        const isGPT5Model = model.match(/^gpt-5/i);
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
                    'Authorization': `Bearer ${OPENAI_API_KEY}`,
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
        metrics.trackLLMRequest(model, totalTokens, true, inputTokens, outputTokens);

        if (isGPT5Model && response.data?.output) {
            const outputItems = response.data.output || [];
            const messageItem = outputItems.find(item => item.type === 'message');
            const textContent = messageItem?.content?.find(c => c.type === 'output_text')?.text || messageItem?.content?.[0]?.text || (typeof messageItem?.content === 'string' ? messageItem.content : '');

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

        res.json(response.data);
    } catch (error) {
        metrics.trackLLMRequest(model || 'openai', 0, false, 0, 0);
        const statusCode = error.response ? error.response.status : 500;
        const errorData = error.response ? error.response.data : { error: 'Failed to proxy request to OpenAI.' };
        res.status(statusCode).json(errorData);
    }
});

router.post('/anthropic', authenticateToken, llmLimiter, combinedRateLimit(30, 60 * 60 * 1000), validateBody(anthropicRequestSchema), async (req, res) => {
    const metadata = getRequestMetadata(req);
    const anthropicUrl = 'https://api.anthropic.com/v1/messages';
    let model = process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022';

    try {
        const settings = await getLLMSettings();
        const validationError = validateMessageLengths(req.body.messages);
        if (validationError) {
            return res.status(400).json({ error: validationError });
        }

        model = req.body.model || settings.llmModel || model;

        if (shouldRouteToOllama(settings, model)) {
            return await handleOllamaRequest(req, res, settings, 'anthropic');
        }

        if (shouldRouteToMiniMax(settings, model)) {
            return await handleMiniMaxRequest(req, res, settings, 'anthropic');
        }

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

        const response = await withRetry(
            () => axios.post(anthropicUrl, requestBody, {
                headers: {
                    'x-api-key': ANTHROPIC_API_KEY,
                    'anthropic-version': '2023-06-01',
                    'Content-Type': 'application/json'
                },
                timeout: 90000
            }),
            {
                serviceName: 'anthropic',
                operationName: `Anthropic ${model} request`,
                retryConfig: {
                    maxRetries: 3,
                    initialDelayMs: 2000,
                    maxDelayMs: 60000
                }
            }
        );

        const usage = response.data?.usage || {};
        const inputTokens = usage.input_tokens || 0;
        const outputTokens = usage.output_tokens || 0;
        const totalTokens = inputTokens + outputTokens;
        metrics.trackLLMRequest(model, totalTokens, true, inputTokens, outputTokens);

        res.json(response.data);
    } catch (error) {
        metrics.trackLLMRequest(model, 0, false, 0, 0);
        const statusCode = error.response ? error.response.status : 500;
        const errorData = error.response ? error.response.data : { error: `Failed to proxy request to Anthropic: ${error.message}` };
        res.status(statusCode).json(errorData);
    }
});

router.post('/chat/completions', authenticateToken, llmLimiter, combinedRateLimit(30, 60 * 60 * 1000), validateBody(openaiRequestSchema), async (req, res) => {
    const metadata = getRequestMetadata(req);
    const openAiUrl = 'https://api.openai.com/v1/chat/completions';
    const model = req.body.model || 'openai';

    try {
        const settings = await getLLMSettings();
        if (shouldRouteToOllama(settings, req.body.model || settings.llmModel || model)) {
            return await handleOllamaRequest(req, res, settings, 'openai');
        }

        if (shouldRouteToMiniMax(settings, req.body.model || settings.llmModel || model)) {
            return await handleMiniMaxRequest(req, res, settings, 'openai');
        }

        if (!OPENAI_API_KEY) {
            return res.status(500).json({ error: 'OpenAI API key not configured on server.' });
        }

        safeLog('info', 'LLM request', { model, user: metadata.email, messageCount: req.body.messages?.length || 0 });

        securityLog(LOG_LEVELS.INFO, SECURITY_EVENTS.LLM_REQUEST, {
            ...metadata,
            message: 'OpenAI Chat Completions API request',
            metadata: {
                model,
                messageCount: req.body.messages?.length || 0
            }
        });

        const response = await axios.post(openAiUrl, req.body, {
            headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        const usage = response.data?.usage || {};
        metrics.trackLLMRequest(req.body.model || 'openai', usage.total_tokens || 0, true, usage.prompt_tokens || 0, usage.completion_tokens || 0);

        res.json(response.data);
    } catch (error) {
        metrics.trackLLMRequest(req.body.model || 'openai', 0, false, 0, 0);
        const statusCode = error.response ? error.response.status : 500;
        const errorData = error.response ? error.response.data : { error: 'Failed to call OpenAI API.' };
        res.status(statusCode).json(errorData);
    }
});

router.post('/messages', authenticateToken, llmLimiter, combinedRateLimit(30, 60 * 60 * 1000), validateBody(anthropicRequestSchema), async (req, res) => {
    const metadata = getRequestMetadata(req);
    const anthropicUrl = 'https://api.anthropic.com/v1/messages';
    const model = process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022';

    try {
        const settings = await getLLMSettings();
        if (shouldRouteToOllama(settings, req.body.model || settings.llmModel || model)) {
            return await handleOllamaRequest(req, res, settings, 'anthropic');
        }

        if (shouldRouteToMiniMax(settings, req.body.model || settings.llmModel || model)) {
            return await handleMiniMaxRequest(req, res, settings, 'anthropic');
        }

        if (!ANTHROPIC_API_KEY) {
            return res.status(500).json({ error: 'Anthropic API key not configured on server.' });
        }

        safeLog('info', 'LLM request', { model, user: metadata.email, messageCount: req.body.messages?.length || 0 });

        securityLog(LOG_LEVELS.INFO, SECURITY_EVENTS.LLM_REQUEST, {
            ...metadata,
            message: 'Anthropic Messages API request',
            metadata: {
                model,
                messageCount: req.body.messages?.length || 0
            }
        });

        const requestBody = normalizeAnthropicRequestBody(req.body, req.body.model || model);

        const response = await axios.post(anthropicUrl, requestBody, {
            headers: {
                'x-api-key': ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01',
                'Content-Type': 'application/json'
            },
            timeout: 90000
        });

        const usage = response.data?.usage || {};
        metrics.trackLLMRequest(requestBody.model, (usage.input_tokens || 0) + (usage.output_tokens || 0), true, usage.input_tokens || 0, usage.output_tokens || 0);

        res.json(response.data);
    } catch (error) {
        metrics.trackLLMRequest(req.body.model || 'anthropic', 0, false, 0, 0);
        const statusCode = error.response ? error.response.status : 500;
        const errorData = error.response ? error.response.data : { error: 'Failed to call Anthropic API.' };
        res.status(statusCode).json(errorData);
    }
});

router.get('/circuit-breakers', authenticateToken, requireAdmin, (req, res) => {
    const states = getCircuitBreakerStates();
    if (MINIMAX_API_KEY && !states.minimax) {
        states.minimax = { state: 'UNKNOWN', failures: 0 };
    }
    res.json(states);
});

export default router;
