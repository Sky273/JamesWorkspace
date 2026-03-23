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

// Mock constants
vi.mock('../../config/constants.js', () => ({
    OPENAI_API_KEY: 'test-openai-key',
    ANTHROPIC_API_KEY: 'test-anthropic-key',
    MAX_PROMPT_LENGTH: 10000
}));

// Mock axios
const mockAxiosPost = vi.fn();
vi.mock('axios', () => ({
    default: { post: (...args) => mockAxiosPost(...args) }
}));

// Mock metrics
vi.mock('../../services/metrics.service.js', () => ({
    metrics: {
        trackLLMRequest: vi.fn(),
        trackRequest: vi.fn(),
        trackResponse: vi.fn()
    }
}));

// Mock security
vi.mock('../../services/security.service.js', () => ({
    securityLog: vi.fn(),
    getRequestMetadata: () => ({ ip: '127.0.0.1', email: 'user@test.com' }),
    LOG_LEVELS: { INFO: 'info', WARNING: 'warning', SECURITY: 'security' },
    SECURITY_EVENTS: { LLM_REQUEST: 'llm_request' }
}));

// Mock logger
vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn()
}));

// Mock settings
vi.mock('../../services/settings.service.js', () => ({
    getLLMSettings: vi.fn().mockResolvedValue({ llmModel: 'gpt-4o' })
}));

// Mock retry service
vi.mock('../../services/retry.service.js', () => ({
    withRetry: (fn) => fn(),
    getCircuitBreakerStates: vi.fn().mockReturnValue({ openai: 'closed', anthropic: 'closed' })
}));

// Mock validation
vi.mock('../../utils/validation.js', () => ({
    validateBody: () => (req, res, next) => next(),
    openaiRequestSchema: {},
    anthropicRequestSchema: {}
}));

// Mock rate limit
vi.mock('../../middleware/rateLimit.middleware.js', () => ({
    llmLimiter: (...args) => rateLimitMocks.mockLlmLimiter(...args),
    combinedRateLimit: (...args) => rateLimitMocks.mockCombinedRateLimit(...args)
}));

// Mock auth middleware
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

    // ==========================================
    // POST /openai
    // ==========================================
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

        it('should return 400 for message exceeding max length', async () => {
            const longContent = 'x'.repeat(10001);
            const res = await request(app)
                .post('/api/llm/openai')
                .set(AUTH)
                .send({ messages: [{ role: 'user', content: longContent }] });

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('maximum length');
        });

        it('should handle OpenAI API errors', async () => {
            mockAxiosPost.mockRejectedValueOnce({
                response: { status: 429, data: { error: 'Rate limited' } }
            });

            const res = await request(app)
                .post('/api/llm/openai')
                .set(AUTH)
                .send({ messages: [{ role: 'user', content: 'Hello' }] });

            expect(res.status).toBe(429);
        });

        it('should return 500 on network error', async () => {
            mockAxiosPost.mockRejectedValueOnce(new Error('Network error'));

            const res = await request(app)
                .post('/api/llm/openai')
                .set(AUTH)
                .send({ messages: [{ role: 'user', content: 'Hello' }] });

            expect(res.status).toBe(500);
        });

        it('should forward 4xx errors from OpenAI', async () => {
            mockAxiosPost.mockResolvedValueOnce({
                status: 400,
                data: { error: { message: 'Bad request' } }
            });

            const res = await request(app)
                .post('/api/llm/openai')
                .set(AUTH)
                .send({ messages: [{ role: 'user', content: 'Hello' }] });

            expect(res.status).toBe(400);
        });
    });

    // ==========================================
    // POST /anthropic
    // ==========================================
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

        it('should return 400 for message exceeding max length', async () => {
            const longContent = 'x'.repeat(10001);
            const res = await request(app)
                .post('/api/llm/anthropic')
                .set(AUTH)
                .send({ messages: [{ role: 'user', content: longContent }] });

            expect(res.status).toBe(400);
        });

        it('should handle Anthropic errors', async () => {
            mockAxiosPost.mockRejectedValueOnce({
                response: { status: 500, data: { error: 'Internal error' } }
            });

            const res = await request(app)
                .post('/api/llm/anthropic')
                .set(AUTH)
                .send({ messages: [{ role: 'user', content: 'Hello' }] });

            expect(res.status).toBe(500);
        });
    });

    // ==========================================
    // POST /chat/completions
    // ==========================================
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

        it('should handle errors', async () => {
            mockAxiosPost.mockRejectedValueOnce(new Error('Network fail'));

            const res = await request(app)
                .post('/api/llm/chat/completions')
                .set(AUTH)
                .send({ messages: [{ role: 'user', content: 'Hi' }] });

            expect(res.status).toBe(500);
        });
    });

    // ==========================================
    // POST /messages
    // ==========================================
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
        });

        it('should handle errors', async () => {
            mockAxiosPost.mockRejectedValueOnce(new Error('fail'));

            const res = await request(app)
                .post('/api/llm/messages')
                .set(AUTH)
                .send({ messages: [{ role: 'user', content: 'Hi' }] });

            expect(res.status).toBe(500);
        });
    });

    // ==========================================
    // GET /circuit-breakers
    // ==========================================
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
            expect(res.body).toEqual({ openai: 'closed', anthropic: 'closed' });
        });
    });
});







