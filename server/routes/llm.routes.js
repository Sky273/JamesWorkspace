import express from 'express';
import axios from 'axios';
import { OPENAI_API_KEY, ANTHROPIC_API_KEY, MAX_PROMPT_LENGTH } from '../config/constants.js';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { userRateLimit } from '../middleware/rateLimit.middleware.js';
import { metrics } from '../services/metrics.service.js';
import { securityLog, getRequestMetadata, LOG_LEVELS, SECURITY_EVENTS } from '../services/security.service.js';
import { safeLog } from '../utils/logger.backend.js';
import { getLLMSettings } from '../services/settings.service.js';
import { withRetry, getCircuitBreakerStates } from '../services/retry.service.js';
import { validateBody, openaiRequestSchema, anthropicRequestSchema } from '../utils/validation.js';

const router = express.Router();

// ============================================
// LLM PROXY ROUTES
// ============================================

// POST /api/llm/openai - OpenAI proxy
router.post('/openai', authenticateToken, validateBody(openaiRequestSchema), userRateLimit(20, 60 * 60 * 1000), async (req, res) => {
    const metadata = getRequestMetadata(req);

    if (!OPENAI_API_KEY) {
        return res.status(500).json({ error: 'OpenAI API key not configured on server.' });
    }

    try {
        if (req.body.messages && Array.isArray(req.body.messages)) {
            for (const message of req.body.messages) {
                if (message.content && typeof message.content === 'string') {
                    if (message.content.length > MAX_PROMPT_LENGTH) {
                        return res.status(400).json({ error: `Message content exceeds maximum length of ${MAX_PROMPT_LENGTH}` });
                    }
                }
            }
        }

        // Get configured model from Settings if not provided by frontend
        let model = req.body.model;
        if (!model) {
            const settings = await getLLMSettings();
            model = settings.llmModel || 'gpt-4o'; // Fallback to gpt-4o if not configured
        }

        safeLog('info', 'LLM request', { model, user: metadata.email, messageCount: req.body.messages?.length || 0 });

        securityLog(LOG_LEVELS.INFO, SECURITY_EVENTS.LLM_REQUEST, {
            ...metadata,
            message: 'OpenAI API request',
            metadata: { 
                model: model,
                messageCount: req.body.messages?.length || 0
            }
        });

        // Check if this is a GPT-5 model - they require the Responses API
        const isGPT5Model = model.match(/^gpt-5/i);
        
        let OPENAI_API_URL;
        let requestBody;
        
        if (isGPT5Model) {
            // GPT-5 models use the Responses API endpoint
            OPENAI_API_URL = 'https://api.openai.com/v1/responses';
            
            // Responses API uses 'input' instead of 'messages'
            // Input should be the messages array directly
            requestBody = {
                model: model,
                input: req.body.messages || req.body.input
            };
            
            // GPT-5 models require reasoning.effort parameter
            // gpt-5.2-pro only supports: 'medium', 'high', 'xhigh'
            // gpt-5.2 (non-pro) supports: 'none', 'low', 'medium', 'high', 'xhigh'
            const isProModel = model.match(/gpt-5\.\d+-pro/i);
            const reasoningEffort = isProModel ? "medium" : "none";
            
            requestBody.reasoning = {
                effort: reasoningEffort
            };
            
            // Add response_format if provided (for structured outputs)
            // In Responses API, response_format has moved to text.format
            if (req.body.response_format) {
                requestBody.text = {
                    format: req.body.response_format
                };
            }
            
            // GPT-5 models use max_output_tokens instead of max_tokens or max_completion_tokens
            if (req.body.max_tokens) {
                requestBody.max_output_tokens = req.body.max_tokens;
            } else if (req.body.max_completion_tokens) {
                requestBody.max_output_tokens = req.body.max_completion_tokens;
            } else if (req.body.max_output_tokens) {
                requestBody.max_output_tokens = req.body.max_output_tokens;
            }
            
            // Note: temperature, top_p, logprobs are only supported with reasoning.effort = "none"
            // For pro models (which use medium+), we cannot include temperature
            if (!isProModel && req.body.temperature !== undefined) {
                requestBody.temperature = req.body.temperature;
            }
            
            safeLog('info', 'Using Responses API for GPT-5 model', { reasoningEffort });
        } else {
            // Standard models use Chat Completions API
            OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
            
            requestBody = {
                ...req.body,
                model: model
            };
        }

        safeLog('debug', 'LLM Request body', {
            endpoint: OPENAI_API_URL,
            model: requestBody.model,
            max_tokens: requestBody.max_tokens,
            max_output_tokens: requestBody.max_output_tokens,
            reasoning: requestBody.reasoning,
            temperature: requestBody.temperature,
            messageCount: requestBody.messages?.length || requestBody.input?.length
        });

        // Use retry with exponential backoff for resilience
        const response = await withRetry(
            () => axios.post(OPENAI_API_URL, requestBody, {
                headers: {
                    'Authorization': `Bearer ${OPENAI_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                timeout: 120000, // 2 minutes timeout for GPT-5 models
                validateStatus: function (status) {
                    return status < 500; // Resolve for all non-5xx status codes to capture error details
                }
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
        
        // Check if response indicates an error (4xx status)
        if (response.status >= 400) {
            safeLog('error', 'OpenAI API returned error', {
                status: response.status,
                errorMessage: response.data?.error?.message || 'Unknown error'
            });
            return res.status(response.status).json(response.data);
        }
        
        const usage = response.data?.usage || {};
        // Responses API uses input_tokens/output_tokens, Chat Completions uses prompt_tokens/completion_tokens
        const inputTokens = usage.input_tokens || usage.prompt_tokens || 0;
        const outputTokens = usage.output_tokens || usage.completion_tokens || 0;
        const totalTokens = usage.total_tokens || (inputTokens + outputTokens);
        
        safeLog('info', 'LLM Token usage', { inputTokens, outputTokens, totalTokens });
        metrics.trackLLMRequest(model, totalTokens, true, inputTokens, outputTokens);
        
        // Transform Responses API format to Chat Completions API format for frontend compatibility
        if (isGPT5Model && response.data?.output) {
            // Responses API returns: { output: [{ type: "message", content: [{ type: "output_text", text: "..." }] }] }
            // Chat Completions API returns: { choices: [{ message: { content: "..." } }] }
            const outputItems = response.data.output || [];
            const messageItem = outputItems.find(item => item.type === 'message');
            const textContent = messageItem?.content?.find(c => c.type === 'output_text')?.text || 
                               messageItem?.content?.[0]?.text ||
                               (typeof messageItem?.content === 'string' ? messageItem.content : '');
            
            const transformedResponse = {
                id: response.data.id,
                object: 'chat.completion',
                created: Date.now(),
                model: model,
                choices: [{
                    index: 0,
                    message: {
                        role: 'assistant',
                        content: textContent
                    },
                    finish_reason: response.data.status === 'completed' ? 'stop' : response.data.status
                }],
                usage: response.data.usage
            };
            
            safeLog('debug', 'Transformed Responses API response to Chat Completions format');
            return res.json(transformedResponse);
        }
        
        res.json(response.data);
    } catch (error) {
        const errorModel = typeof model !== 'undefined' ? model : 'openai';
        metrics.trackLLMRequest(errorModel, 0, false, 0, 0);
        
        safeLog('error', 'OpenAI API error', {
            error: error.message,
            status: error.response?.status,
            model: errorModel
        });
        
        safeLog('error', 'Error proxying to OpenAI', { 
            error: error.message, 
            status: error.response?.status,
            data: error.response?.data 
        });
        
        const statusCode = error.response ? error.response.status : 500;
        const errorData = error.response ? error.response.data : { error: 'Failed to proxy request to OpenAI.' };
        res.status(statusCode).json(errorData);
    }
});

// POST /api/llm/anthropic - Anthropic proxy
router.post('/anthropic', authenticateToken, validateBody(anthropicRequestSchema), userRateLimit(20, 60 * 60 * 1000), async (req, res) => {
    const metadata = getRequestMetadata(req);
    const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
    const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022';

    if (!ANTHROPIC_API_KEY) {
        safeLog('error', 'Anthropic API key not configured');
        return res.status(500).json({ error: 'Anthropic API key not configured on server.' });
    }

    try {
        safeLog('info', 'LLM request', { model: ANTHROPIC_MODEL, user: metadata.email, messageCount: req.body.messages?.length || 0 });

        securityLog(LOG_LEVELS.INFO, SECURITY_EVENTS.LLM_REQUEST, {
            ...metadata,
            message: 'Anthropic API request',
            metadata: { 
                model: ANTHROPIC_MODEL,
                messageCount: req.body.messages?.length || 0
            }
        });
        if (req.body.messages && Array.isArray(req.body.messages)) {
            for (const message of req.body.messages) {
                if (message.content && typeof message.content === 'string') {
                    if (message.content.length > MAX_PROMPT_LENGTH) {
                        return res.status(400).json({ error: `Message content exceeds maximum length of ${MAX_PROMPT_LENGTH}` });
                    }
                }
            }
        }

        const requestBody = {
            ...req.body,
            model: ANTHROPIC_MODEL
        };
        
        // Use retry with exponential backoff for resilience
        const response = await withRetry(
            () => axios.post(ANTHROPIC_API_URL, requestBody, {
                headers: {
                    'x-api-key': ANTHROPIC_API_KEY,
                    'anthropic-version': '2023-06-01',
                    'Content-Type': 'application/json'
                },
                timeout: 90000
            }),
            {
                serviceName: 'anthropic',
                operationName: `Anthropic ${ANTHROPIC_MODEL} request`,
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
        
        metrics.trackLLMRequest(ANTHROPIC_MODEL, totalTokens, true, inputTokens, outputTokens);
        
        res.json(response.data);
    } catch (error) {
        metrics.trackLLMRequest(ANTHROPIC_MODEL, 0, false, 0, 0);
        safeLog('error', 'Error proxying to Anthropic', { error: error.message, status: error.response?.status });
        const statusCode = error.response ? error.response.status : 500;
        const errorData = error.response ? error.response.data : { error: 'Failed to proxy request to Anthropic: ' + error.message };
        res.status(statusCode).json(errorData);
    }
});

// POST /api/openai/chat/completions - OpenAI chat completions
router.post('/chat/completions', authenticateToken, userRateLimit(20, 60 * 60 * 1000), async (req, res) => {
    const metadata = getRequestMetadata(req);
    const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
    const model = req.body.model || 'openai';

    if (!OPENAI_API_KEY) {
        return res.status(500).json({ error: 'OpenAI API key not configured on server.' });
    }

    try {
        safeLog('info', 'LLM request', { model, user: metadata.email, messageCount: req.body.messages?.length || 0 });

        securityLog(LOG_LEVELS.INFO, SECURITY_EVENTS.LLM_REQUEST, {
            ...metadata,
            message: 'OpenAI Chat Completions API request',
            metadata: { 
                model: model,
                messageCount: req.body.messages?.length || 0
            }
        });
        const response = await axios.post(OPENAI_API_URL, req.body, {
            headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });
        
        const usage = response.data?.usage || {};
        const totalTokens = usage.total_tokens || 0;
        const inputTokens = usage.prompt_tokens || 0;
        const outputTokens = usage.completion_tokens || 0;
        
        metrics.trackLLMRequest(req.body.model || 'openai', totalTokens, true, inputTokens, outputTokens);
        
        res.json(response.data);
    } catch (error) {
        metrics.trackLLMRequest(req.body.model || 'openai', 0, false, 0, 0);
        safeLog('error', 'Error calling OpenAI', { error: error.message, status: error.response?.status });
        const statusCode = error.response ? error.response.status : 500;
        const errorData = error.response ? error.response.data : { error: 'Failed to call OpenAI API.' };
        res.status(statusCode).json(errorData);
    }
});

// POST /api/anthropic/messages - Anthropic messages
router.post('/messages', authenticateToken, userRateLimit(20, 60 * 60 * 1000), async (req, res) => {
    const metadata = getRequestMetadata(req);
    const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
    const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022';

    if (!ANTHROPIC_API_KEY) {
        return res.status(500).json({ error: 'Anthropic API key not configured on server.' });
    }

    try {
        safeLog('info', 'LLM request', { model: ANTHROPIC_MODEL, user: metadata.email, messageCount: req.body.messages?.length || 0 });

        securityLog(LOG_LEVELS.INFO, SECURITY_EVENTS.LLM_REQUEST, {
            ...metadata,
            message: 'Anthropic Messages API request',
            metadata: { 
                model: ANTHROPIC_MODEL,
                messageCount: req.body.messages?.length || 0
            }
        });
        const requestBody = {
            ...req.body,
            model: ANTHROPIC_MODEL
        };
        
        const response = await axios.post(ANTHROPIC_API_URL, requestBody, {
            headers: {
                'x-api-key': ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01',
                'Content-Type': 'application/json'
            },
            timeout: 90000
        });
        
        const usage = response.data?.usage || {};
        const inputTokens = usage.input_tokens || 0;
        const outputTokens = usage.output_tokens || 0;
        const totalTokens = inputTokens + outputTokens;
        
        metrics.trackLLMRequest(ANTHROPIC_MODEL, totalTokens, true, inputTokens, outputTokens);
        
        res.json(response.data);
    } catch (error) {
        metrics.trackLLMRequest(ANTHROPIC_MODEL, 0, false, 0, 0);
        safeLog('error', 'Error calling Anthropic', { error: error.message, status: error.response?.status });
        const statusCode = error.response ? error.response.status : 500;
        const errorData = error.response ? error.response.data : { error: 'Failed to call Anthropic API.' };
        res.status(statusCode).json(errorData);
    }
});

// GET /api/llm/circuit-breakers - Get circuit breaker states (admin only)
router.get('/circuit-breakers', authenticateToken, (req, res) => {
    const userRole = (req.user?.role || '').toLowerCase();
    if (userRole !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    
    res.json(getCircuitBreakerStates());
});

export default router;
