/**
 * Tests for LLM routes
 * POST /openai, POST /anthropic, POST /chat/completions,
 * POST /messages, GET /circuit-breakers
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const rateLimitMocks = vi.hoisted(() => {
    const mockCombinedMiddleware = vi.fn((req, res, next) => next());
    return {
        mockLlmLimiter: vi.fn((req, res, next) => next()),
        mockCombinedMiddleware,
        mockCombinedRateLimit: vi.fn(() => mockCombinedMiddleware)
    };
});

vi.mock('../../config/constants.js', () => ({
    OPENAI_API_KEY: 'test-openai-key',
    ANTHROPIC_API_KEY: 'test-anthropic-key',
    HUGGINGFACE_API_KEY: 'test-huggingface-key',
    GEMINI_API_KEY: 'test-gemini-key',
    DEEPSEEK_API_KEY: 'test-deepseek-key',
    GLM_API_KEY: 'test-glm-key',
    MAX_PROMPT_LENGTH: 10000,
    MINIMAX_API_KEY: 'test-minimax-key',
    LLM_OPERATION_TIMEOUT_MS: 15 * 60 * 1000
}));

const mockAxiosPost = vi.fn();
vi.mock('axios', () => ({
    default: { post: (...args) => mockAxiosPost(...args) }
}));

vi.mock('../../services/metrics.service.js', () => ({
    buildLLMMetricLabel: (provider, model = '') => (model ? provider + ':' + model : provider),
    metrics: {
        trackLLMRequest: vi.fn(),
        trackRequest: vi.fn(),
        trackResponse: vi.fn()
    }
}));

vi.mock('../../services/security.service.js', () => ({
    securityLog: vi.fn(),
    getRequestMetadata: () => ({ ip: '127.0.0.1', email: 'user@test.com' }),
    LOG_LEVELS: { INFO: 'info', WARNING: 'warning', SECURITY: 'security' },
    SECURITY_EVENTS: { LLM_REQUEST: 'llm_request' }
}));

vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn()
}));

const mockGetLLMSettings = vi.fn().mockResolvedValue({ llmModel: 'gpt-4o' });
vi.mock('../../services/settings.service.js', () => ({
    getLLMSettings: (...args) => mockGetLLMSettings(...args)
}));

vi.mock('../../services/llmAvailability.service.js', () => ({
    getProviderAvailabilityFlags: vi.fn(() => ({})),
    resolveAvailableModel: vi.fn((provider, model, fallbackModel) => ({
        model: provider === 'ollama' ? (model ?? null) : (model || fallbackModel || null),
        adjusted: false,
        reason: null,
        originalModel: provider === 'ollama' ? (model ?? null) : (model || fallbackModel || null),
        fallbackModel: fallbackModel || null
    }))
}));
vi.mock('../../services/llmConfiguration.service.js', () => ({
    resolveCompatibleProviderRuntimeConfig: vi.fn(({ settings = {}, requestedModel, responseShape = 'openai' }) => ({
        provider: settings.llmProvider || (responseShape === 'anthropic' ? 'anthropic' : 'openai'),
        model: requestedModel || settings.llmModel || null
    }))
}));
vi.mock('../../services/llmContent.service.js', () => ({
    extractOpenAIResponsesText: vi.fn((output = []) => output
        .flatMap((item) => item?.content || [])
        .filter((item) => item?.type === 'output_text')
        .map((item) => item.text)
        .join('')),
    flattenLlmTextContent: vi.fn((value) => typeof value === 'string' ? value : JSON.stringify(value)),
    sanitizeOpenAICompatibleResponseBody: vi.fn((body) => ({
        ...body,
        choices: Array.isArray(body?.choices)
            ? body.choices.map((choice) => ({
                ...choice,
                message: choice?.message
                    ? {
                        ...choice.message,
                        content: String(choice.message.content || '').replace(/<think>[\s\S]*?<\/think>/gi, ''),
                        reasoning_content: undefined
                    }
                    : choice?.message
            }))
            : body?.choices
    }))
}));
vi.mock('../../services/llmProviderCommon.service.js', () => ({
    normalizeAnthropicRequestBody: vi.fn((body = {}, model) => {
        const messages = Array.isArray(body.messages) ? body.messages : [];
        const system = messages
            .filter((message) => message.role === 'system')
            .flatMap((message) => typeof message.content === 'string'
                ? [{ type: 'text', text: message.content }]
                : message.content || []);

        return {
            ...body,
            model,
            messages: messages
                .filter((message) => message.role !== 'system')
                .map((message) => ({
                    role: message.role,
                    content: typeof message.content === 'string'
                        ? [{ type: 'text', text: message.content }]
                        : message.content
                })),
            ...(system.length > 0 ? { system } : {})
        };
    }),
    toAnthropicCompatibleResponse: vi.fn((result, provider) => ({
        id: result.id || 'msg-1',
        type: 'message',
        role: 'assistant',
        model: result.actualModel || result.model,
        provider,
        content: typeof result.content === 'string'
            ? [{ type: 'text', text: result.content }]
            : (result.content || [{ type: 'text', text: result.choices?.[0]?.message?.content || '' }]),
        usage: result.usage
    })),
    toOpenAICompatibleResponse: vi.fn((result, provider) => ({
        id: result.id || 'chatcmpl-1',
        object: 'chat.completion',
        provider,
        model: result.actualModel || result.model,
        choices: result.choices || [{
            index: 0,
            message: {
                role: 'assistant',
                content: result.content?.[0]?.text || result.content || ''
            },
            finish_reason: 'stop'
        }],
        usage: result.usage
    }))
}));

vi.mock('../../services/llmAdminParameters.service.js', () => ({
    resolveEffectiveModelParameters: vi.fn(({ overrides = {} }) => ({
        parameters: {
            ...(overrides.max_tokens !== undefined ? { max_tokens: overrides.max_tokens } : {}),
            ...(overrides.max_completion_tokens !== undefined ? { max_completion_tokens: overrides.max_completion_tokens } : {}),
            ...(overrides.max_output_tokens !== undefined ? { max_output_tokens: overrides.max_output_tokens } : {}),
            ...(overrides.temperature !== undefined ? { temperature: overrides.temperature } : {}),
            ...(overrides.top_p !== undefined ? { top_p: overrides.top_p } : {}),
            ...(overrides.reasoning_effort !== undefined ? { reasoning_effort: overrides.reasoning_effort } : {}),
            ...(overrides.response_format !== undefined ? { response_format: overrides.response_format } : {})
        }
    }))
}));

const mockWithRetry = vi.fn(async (fn) => fn());
vi.mock('../../services/retry.service.js', () => ({
    withRetry: (...args) => mockWithRetry(...args),
    getCircuitBreakerStates: vi.fn().mockReturnValue({
        openai: { state: 'CLOSED', failures: 0, lastFailureTime: null },
        anthropic: { state: 'CLOSED', failures: 0, lastFailureTime: null },
        deepseek: { state: 'CLOSED', failures: 1, lastFailureTime: 12345 },
        glm: { state: 'CLOSED', failures: 0, lastFailureTime: null },
        minimax: { state: 'HALF_OPEN', failures: 2, lastFailureTime: 67890 }
    })
}));

vi.mock('../../utils/validation.js', () => ({
    validateBody: () => (req, res, next) => next(),
    openaiRequestSchema: {},
    anthropicRequestSchema: {}
}));

vi.mock('../../middleware/rateLimit.middleware.js', () => ({
    llmLimiter: (...args) => rateLimitMocks.mockLlmLimiter(...args),
    combinedRateLimit: (...args) => rateLimitMocks.mockCombinedRateLimit(...args)
}));

vi.mock('../../middleware/auth.middleware.js', () => ({
    authenticateToken: (req, res, next) => {
        if (req.headers.authorization === 'Bearer valid-token') {
            req.user = {
                id: 'user-123',
                role: req.headers['x-test-role'] || 'user'
            };
            next();
        } else {
            res.status(401).json({ error: 'Unauthorized' });
        }
    },
    requireAdmin: (req, res, next) => {
        if (req.user?.role === 'admin') next();
        else res.status(403).json({ error: 'Admin access required' });
    }
}));

const mockCallOllama = vi.fn();
vi.mock('../../services/ollama.service.js', () => ({
    callOllama: (...args) => mockCallOllama(...args)
}));

const mockCallDeepSeekWithCircuitBreaker = vi.fn();
vi.mock('../../services/deepseek.service.js', () => ({
    callDeepSeekWithCircuitBreaker: (...args) => mockCallDeepSeekWithCircuitBreaker(...args)
}));

const mockCallHuggingFaceWithCircuitBreaker = vi.fn();
vi.mock('../../services/huggingface.service.js', () => ({
    callHuggingFaceWithCircuitBreaker: (...args) => mockCallHuggingFaceWithCircuitBreaker(...args)
}));

const mockCallGemmaChat = vi.fn();
vi.mock('../../services/gemma.service.js', () => ({
    callGemmaChat: (...args) => mockCallGemmaChat(...args)
}));

const mockCallGLMWithCircuitBreaker = vi.fn();
vi.mock('../../services/glm.service.js', () => ({
    callGLMWithCircuitBreaker: (...args) => mockCallGLMWithCircuitBreaker(...args)
}));

const mockCallMiniMaxOpenAICompatible = vi.fn();
const mockCallMiniMaxAnthropicCompatible = vi.fn();
vi.mock('../../services/minimax.service.js', () => ({
    callMiniMaxOpenAICompatible: (...args) => mockCallMiniMaxOpenAICompatible(...args),
    callMiniMaxAnthropicCompatible: (...args) => mockCallMiniMaxAnthropicCompatible(...args)
}));

import llmRoutes from '../../routes/llm.routes.js';

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/llm', llmRoutes);
    return app;
}

const AUTH = { Authorization: 'Bearer valid-token' };

describe('LLM Routes', () => {
    let app;

    beforeEach(() => {
        vi.clearAllMocks();
        mockGetLLMSettings.mockResolvedValue({ llmModel: 'gpt-4o' });
        mockWithRetry.mockImplementation(async (fn) => fn());
        app = createTestApp();
    });

    it('wires LLM-specific rate limiters on protected routes', async () => {
        mockAxiosPost.mockResolvedValueOnce({
            status: 200,
            data: {
                choices: [{ message: { content: 'Hi!' } }],
                usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 }
            }
        });

        const res = await request(app)
            .post('/api/llm/openai')
            .set(AUTH)
            .send({ messages: [{ role: 'user', content: 'Hello' }] });

        expect(res.status).toBe(200);
        expect(rateLimitMocks.mockLlmLimiter).toHaveBeenCalled();
        expect(rateLimitMocks.mockCombinedMiddleware).toHaveBeenCalled();
    });

    describe('POST /openai', () => {
        it('should return 401 without auth', async () => {
            const res = await request(app)
                .post('/api/llm/openai')
                .send({ messages: [{ role: 'user', content: 'Hello' }] });
            expect(res.status).toBe(401);
        });

        it('should proxy to OpenAI and return response', async () => {
            mockAxiosPost.mockResolvedValueOnce({
                status: 200,
                data: {
                    choices: [{ message: { content: 'Hi!' } }],
                    usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
                }
            });

            const res = await request(app)
                .post('/api/llm/openai')
                .set(AUTH)
                .send({ messages: [{ role: 'user', content: 'Hello' }] });

            expect(res.status).toBe(200);
            expect(res.body.choices).toBeDefined();
        });

        it('routes through Ollama when configured', async () => {
            mockGetLLMSettings.mockResolvedValueOnce({ llmProvider: 'ollama', llmModel: 'qwen3:14b' });
            mockCallOllama.mockResolvedValueOnce({ content: 'Hi from Ollama', model: 'qwen3:14b', actualModel: 'qwen3:14b', usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } });

            const res = await request(app)
                .post('/api/llm/openai')
                .set(AUTH)
                .send({ messages: [{ role: 'user', content: 'Hello' }] });

            expect(res.status).toBe(200);
            expect(res.body.choices[0].message.content).toBe('Hi from Ollama');
        });

    it('routes through DeepSeek when configured', async () => {
            mockGetLLMSettings.mockResolvedValueOnce({ llmProvider: 'deepseek', llmModel: 'deepseek-chat' });
            mockCallDeepSeekWithCircuitBreaker.mockResolvedValueOnce({
                model: 'deepseek-chat',
                choices: [{ message: { content: 'Hi from DeepSeek' } }],
                usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 }
            });

            const res = await request(app)
                .post('/api/llm/openai')
                .set(AUTH)
                .send({ messages: [{ role: 'user', content: 'Hello' }] });

            expect(res.status).toBe(200);
            expect(res.body.choices[0].message.content).toBe('Hi from DeepSeek');
            expect(mockCallDeepSeekWithCircuitBreaker).toHaveBeenCalledWith(expect.objectContaining({
                model: 'deepseek-chat',
                messages: [{ role: 'user', content: 'Hello' }]
            }));
        });

        it('routes through Gemma when configured', async () => {
            mockGetLLMSettings.mockResolvedValueOnce({ llmProvider: 'gemma', llmModel: 'gemma-4-31b-it' });
            mockCallGemmaChat.mockResolvedValueOnce({
                model: 'gemma-4-31b-it',
                choices: [{ message: { content: 'Hi from Gemma' } }],
                usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 }
            });

            const res = await request(app)
                .post('/api/llm/openai')
                .set(AUTH)
                .send({ messages: [{ role: 'user', content: 'Hello' }] });

            expect(res.status).toBe(200);
            expect(res.body.choices[0].message.content).toBe('Hi from Gemma');
            expect(mockCallGemmaChat).toHaveBeenCalledWith(expect.objectContaining({
                model: 'gemma-4-31b-it',
                messages: [{ role: 'user', content: 'Hello' }]
            }));
        });

        it('surfaces sanitized Gemma provider error details and request id', async () => {
            mockGetLLMSettings.mockResolvedValueOnce({ llmProvider: 'gemma', llmModel: 'gemma-4-31b-it' });
            mockCallGemmaChat.mockRejectedValueOnce({
                response: {
                    status: 400,
                    statusText: 'Bad Request',
                    data: {
                        error: {
                            message: 'Request contains an invalid argument.',
                            status: 'INVALID_ARGUMENT',
                            code: 400,
                            details: [
                                { message: 'Model gemma-4-31b-it does not support response_format=json_schema.' }
                            ]
                        }
                    }
                }
            });

            const res = await request(app)
                .post('/api/llm/openai')
                .set({ ...AUTH, 'x-request-id': 'req-123' })
                .send({ messages: [{ role: 'user', content: 'Hello' }] });

            expect(res.status).toBe(400);
            expect(res.headers['x-request-id']).toBe('req-123');
            expect(res.body).toEqual({
                error: 'Request contains an invalid argument.',
                requestId: 'req-123',
                providerError: 'Request contains an invalid argument.',
                providerDetails: 'Model gemma-4-31b-it does not support response_format=json_schema.',
                providerPayload: '{"error":{"message":"Request contains an invalid argument.","status":"INVALID_ARGUMENT","code":400,"details":[{"message":"Model gemma-4-31b-it does not support response_format=json_schema."}]}}',
                debug: {
                    provider: 'gemma',
                    statusCode: 400,
                    statusText: 'Bad Request',
                    providerStatus: 'INVALID_ARGUMENT',
                    providerCode: 400,
                    providerError: 'Request contains an invalid argument.',
                    providerDetails: 'Model gemma-4-31b-it does not support response_format=json_schema.',
                    providerPayload: '{"error":{"message":"Request contains an invalid argument.","status":"INVALID_ARGUMENT","code":400,"details":[{"message":"Model gemma-4-31b-it does not support response_format=json_schema."}]}}'
                }
            });
        });

        it('routes through MiniMax when configured', async () => {
            mockGetLLMSettings.mockResolvedValueOnce({ llmProvider: 'minimax', llmModel: 'MiniMax-M2.7' });
            mockCallMiniMaxOpenAICompatible.mockResolvedValueOnce({ content: 'Hi from MiniMax', model: 'MiniMax-M2.7', actualModel: 'MiniMax-M2.7', usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } });

            const res = await request(app)
                .post('/api/llm/openai')
                .set(AUTH)
                .send({ messages: [{ role: 'user', content: 'Hello' }] });

            expect(res.status).toBe(200);
            expect(res.body.choices[0].message.content).toBe('Hi from MiniMax');
            expect(mockWithRetry).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({
                serviceName: 'minimax',
                operationName: 'MiniMax MiniMax-M2.7 openai-compatible request'
            }));
            expect(mockCallMiniMaxOpenAICompatible).toHaveBeenCalledWith(expect.objectContaining({
                useRetry: false
            }));
        });

        it('routes through GLM when configured', async () => {
            mockGetLLMSettings.mockResolvedValueOnce({ llmProvider: 'glm', llmModel: 'glm-5.1' });
            mockCallGLMWithCircuitBreaker.mockResolvedValueOnce({
                model: 'glm-5.1',
                choices: [{ message: { content: 'Hi from GLM' } }],
                usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 }
            });

            const res = await request(app)
                .post('/api/llm/openai')
                .set(AUTH)
                .send({ messages: [{ role: 'user', content: 'Hello' }] });

            expect(res.status).toBe(200);
            expect(res.body.choices[0].message.content).toBe('Hi from GLM');
            expect(mockCallGLMWithCircuitBreaker).toHaveBeenCalledWith(expect.objectContaining({
                model: 'glm-5.1',
                messages: [{ role: 'user', content: 'Hello' }]
            }));
        });

        it('should return 400 for message exceeding max length', async () => {
            const longContent = 'x'.repeat(10001);
            const res = await request(app)
                .post('/api/llm/openai')
                .set(AUTH)
                .send({ messages: [{ role: 'user', content: longContent }] });

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('maximum length');
        });
    });

    it('routes through Hugging Face when configured', async () => {
        mockGetLLMSettings.mockResolvedValueOnce({ llmProvider: 'huggingface', llmModel: 'MiniMaxAI/MiniMax-M2.7' });
        mockCallHuggingFaceWithCircuitBreaker.mockResolvedValueOnce({
            model: 'MiniMaxAI/MiniMax-M2.7',
            choices: [{ message: { content: 'Hi from Hugging Face' } }],
            usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 }
        });

        const res = await request(app)
            .post('/api/llm/openai')
            .set(AUTH)
            .send({ messages: [{ role: 'user', content: 'Hello' }] });

        expect(res.status).toBe(200);
        expect(res.body.choices[0].message.content).toBe('Hi from Hugging Face');
        expect(mockCallHuggingFaceWithCircuitBreaker).toHaveBeenCalledWith(expect.objectContaining({
            model: 'MiniMaxAI/MiniMax-M2.7',
            messages: [{ role: 'user', content: 'Hello' }]
        }));
    });

    describe('POST /anthropic', () => {
        it('should proxy to Anthropic and return response', async () => {
            mockAxiosPost.mockResolvedValueOnce({
                data: {
                    content: [{ text: 'Hi from Claude' }],
                    usage: { input_tokens: 10, output_tokens: 5 }
                }
            });

            const res = await request(app)
                .post('/api/llm/anthropic')
                .set(AUTH)
                .send({ messages: [{ role: 'user', content: 'Hello' }] });

            expect(res.status).toBe(200);
            expect(res.body.content).toBeDefined();
        });

        it('normalizes system messages and structured blocks for Anthropic proxying', async () => {
            mockAxiosPost.mockResolvedValueOnce({
                data: {
                    content: [{ type: 'text', text: 'Hi from Claude' }],
                    usage: { input_tokens: 10, output_tokens: 5 }
                }
            });

            const res = await request(app)
                .post('/api/llm/anthropic')
                .set(AUTH)
                .send({
                    messages: [
                        { role: 'system', content: 'You are helpful' },
                        { role: 'user', content: [{ type: 'text', text: 'Hello' }] }
                    ]
                });

            expect(res.status).toBe(200);
            const forwardedBody = mockAxiosPost.mock.calls[0][1];
            expect(forwardedBody.system).toEqual([{ type: 'text', text: 'You are helpful' }]);
            expect(forwardedBody.messages).toEqual([{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }]);
        });

        it('routes Anthropic-compatible requests through MiniMax when configured', async () => {
            mockGetLLMSettings.mockResolvedValueOnce({ llmProvider: 'minimax', llmModel: 'MiniMax-M2.7' });
            mockCallMiniMaxAnthropicCompatible.mockResolvedValueOnce({ content: 'Hi from MiniMax', model: 'MiniMax-M2.7', actualModel: 'MiniMax-M2.7', usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 } });

            const res = await request(app)
                .post('/api/llm/anthropic')
                .set(AUTH)
                .send({ model: 'MiniMax-M2.7', messages: [{ role: 'user', content: 'Hello' }] });

            expect(res.status).toBe(200);
            expect(res.body.content[0].text).toBe('Hi from MiniMax');
            expect(mockWithRetry).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({
                serviceName: 'minimax',
                operationName: 'MiniMax MiniMax-M2.7 anthropic-compatible request'
            }));
            expect(mockCallMiniMaxAnthropicCompatible).toHaveBeenCalledWith(expect.objectContaining({
                useRetry: false
            }));
        });

        it('sanitizes upstream Anthropic provider errors', async () => {
            mockAxiosPost.mockRejectedValueOnce({
                response: {
                    status: 400,
                    statusText: 'Bad Request',
                    data: { error: { message: 'raw anthropic validation detail' } }
                }
            });

            const res = await request(app)
                .post('/api/llm/anthropic')
                .set(AUTH)
                .send({ messages: [{ role: 'user', content: 'Hello' }] });

            expect(res.status).toBe(400);
            expect(res.body).toEqual({ error: 'ANTHROPIC provider request failed (Bad Request).' });
        });
    });

    describe('POST /chat/completions', () => {
        it('should proxy to OpenAI chat completions', async () => {
            mockAxiosPost.mockResolvedValueOnce({
                data: {
                    choices: [{ message: { content: 'Response' } }],
                    usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 }
                }
            });

            const res = await request(app)
                .post('/api/llm/chat/completions')
                .set(AUTH)
                .send({ messages: [{ role: 'user', content: 'Hi' }], model: 'gpt-4o' });

            expect(res.status).toBe(200);
            expect(res.body.choices).toBeDefined();
        });

        it('sanitizes OpenAI 4xx proxy responses returned without exception', async () => {
            mockAxiosPost.mockResolvedValueOnce({
                status: 429,
                statusText: 'Too Many Requests',
                data: {
                    error: {
                        message: 'raw upstream detail'
                    }
                }
            });

            const res = await request(app)
                .post('/api/llm/chat/completions')
                .set(AUTH)
                .send({ messages: [{ role: 'user', content: 'Hi' }], model: 'gpt-4o' });

            expect(res.status).toBe(429);
            expect(res.body).toEqual({ error: 'OPENAI provider request failed (Too Many Requests).' });
        });

        it('should strip reasoning content from DeepSeek-compatible proxy responses', async () => {
            mockGetLLMSettings.mockResolvedValueOnce({ llmProvider: 'deepseek', llmModel: 'deepseek-reasoner' });
            mockCallDeepSeekWithCircuitBreaker.mockResolvedValueOnce({
                model: 'deepseek-reasoner',
                choices: [{ message: { content: 'Answer', reasoning_content: 'internal' } }],
                usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 }
            });

            const res = await request(app)
                .post('/api/llm/chat/completions')
                .set(AUTH)
                .send({ messages: [{ role: 'user', content: 'Hi' }], model: 'deepseek-reasoner' });

            expect(res.status).toBe(200);
            expect(res.body.choices[0].message.content).toBe('Answer');
            expect(res.body.choices[0].message.reasoning_content).toBeUndefined();
        });

        it('should strip think markup from OpenAI chat completions proxy responses', async () => {
            mockAxiosPost.mockResolvedValueOnce({
                data: {
                    choices: [{ message: { content: '<think>draft</think>Response' } }],
                    usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 }
                }
            });

            const res = await request(app)
                .post('/api/llm/chat/completions')
                .set(AUTH)
                .send({ messages: [{ role: 'user', content: 'Hi' }], model: 'gpt-4o' });

            expect(res.status).toBe(200);
            expect(res.body.choices[0].message.content).toBe('Response');
        });

        it('should return 400 for oversized chat completion messages', async () => {
            const res = await request(app)
                .post('/api/llm/chat/completions')
                .set(AUTH)
                .send({ model: 'gpt-4o', messages: [{ role: 'user', content: 'x'.repeat(10001) }] });

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('maximum length');
        });

        it('sanitizes upstream OpenAI provider errors', async () => {
            mockAxiosPost.mockRejectedValueOnce({
                response: {
                    status: 429,
                    statusText: 'Too Many Requests',
                    data: { error: { message: 'raw upstream quota detail' } }
                }
            });

            const res = await request(app)
                .post('/api/llm/openai')
                .set(AUTH)
                .send({ messages: [{ role: 'user', content: 'Hello' }] });

            expect(res.status).toBe(429);
            expect(res.body).toEqual({ error: 'OPENAI provider request failed (Too Many Requests).' });
        });
    });

    describe('POST /messages', () => {
        it('should proxy to Anthropic messages', async () => {
            mockAxiosPost.mockResolvedValueOnce({
                data: {
                    content: [{ text: 'Response' }],
                    usage: { input_tokens: 5, output_tokens: 3 }
                }
            });

            const res = await request(app)
                .post('/api/llm/messages')
                .set(AUTH)
                .send({ messages: [{ role: 'user', content: 'Hi' }] });

            expect(res.status).toBe(200);
            expect(mockWithRetry).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({
                serviceName: 'anthropic'
            }));
        });

        it('should return 400 for oversized anthropic-compatible messages', async () => {
            const res = await request(app)
                .post('/api/llm/messages')
                .set(AUTH)
                .send({ messages: [{ role: 'user', content: 'x'.repeat(10001) }] });

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('maximum length');
        });
    });

    describe('GET /circuit-breakers', () => {
        it('should return 403 for non-admin', async () => {
            const res = await request(app)
                .get('/api/llm/circuit-breakers')
                .set(AUTH);
            expect(res.status).toBe(403);
        });

        it('should return circuit breaker states for admin', async () => {
            const res = await request(app)
                .get('/api/llm/circuit-breakers')
                .set({ ...AUTH, 'x-test-role': 'admin' });

            expect(res.status).toBe(200);
            expect(res.body).toEqual({
                openai: { provider: 'openai', supported: true, configured: true, state: 'CLOSED', failures: 0, lastFailureTime: null },
                anthropic: { provider: 'anthropic', supported: true, configured: true, state: 'CLOSED', failures: 0, lastFailureTime: null },
                huggingface: { provider: 'huggingface', supported: true, configured: true, state: 'UNKNOWN', failures: 0, lastFailureTime: null },
                gemma: { provider: 'gemma', supported: true, configured: true, state: 'UNKNOWN', failures: 0, lastFailureTime: null },
                deepseek: { provider: 'deepseek', supported: true, configured: true, state: 'CLOSED', failures: 1, lastFailureTime: 12345 },
                glm: { provider: 'glm', supported: true, configured: true, state: 'CLOSED', failures: 0, lastFailureTime: null },
                minimax: { provider: 'minimax', supported: true, configured: true, state: 'HALF_OPEN', failures: 2, lastFailureTime: 67890 },
                ollama: { provider: 'ollama', supported: false, configured: true, state: 'NOT_APPLICABLE', failures: 0, lastFailureTime: null }
            });
        });
    });
});

