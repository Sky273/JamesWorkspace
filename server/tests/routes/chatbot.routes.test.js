/**
 * Tests for Chatbot routes
 * POST /message, GET /status
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock callLLM
const mockCallLLM = vi.fn();
vi.mock('../../services/llm.service.js', () => ({
    callLLM: (...args) => mockCallLLM(...args)
}));

vi.mock('../../services/aiCredits.service.js', () => ({
    runAiActionWithCredits: (_options, action) => action()
}));

vi.mock('../../services/security.service.js', () => ({
    getRequestMetadata: vi.fn(() => ({ ip: '127.0.0.1', userId: 'user-123', firmId: 'firm-1' }))
}));

// Mock metrics
vi.mock('../../services/metrics.service.js', () => ({
    metrics: {
        trackRequest: vi.fn(),
        trackResponse: vi.fn(),
        trackError: vi.fn()
    }
}));

// Mock asyncHandler
vi.mock('../../middleware/asyncHandler.middleware.js', () => ({
    asyncHandler: (fn) => (req, res, next) => fn(req, res, next).catch(next)
}));

// Mock logger
vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn()
}));

// Mock validation
vi.mock('../../utils/validation.js', () => ({
    validateBody: () => (req, res, next) => next(),
    chatbotRequestSchema: {}
}));

// Mock fs (for user guide loading)
vi.mock('fs/promises', () => ({
    default: { readFile: vi.fn().mockResolvedValue('# User Guide\nTest content for chatbot') },
    readFile: vi.fn().mockResolvedValue('# User Guide\nTest content for chatbot')
}));

// Mock auth middleware
vi.mock('../../middleware/auth.middleware.js', () => ({
    authenticateToken: (req, res, next) => {
        if (req.headers.authorization === 'Bearer valid-token') {
            req.user = { id: 'user-123', name: 'Test User', email: 'user@test.com', role: 'user', firmId: 'firm-1' };
            next();
        } else {
            res.status(401).json({ error: 'Unauthorized' });
        }
    }
}));

import chatbotRoutes from '../../routes/chatbot.routes.js';

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/chatbot', chatbotRoutes);
    app.use((err, req, res, _next) => {
        res.status(500).json({ error: err.message || 'Internal server error' });
    });
    return app;
}

const AUTH = { Authorization: 'Bearer valid-token' };

describe('Chatbot Routes', () => {
    let app;

    beforeEach(() => {
        vi.clearAllMocks();
        app = createTestApp();
    });

    // ==========================================
    // POST /message
    // ==========================================
    describe('POST /message', () => {
        it('should return 401 without auth', async () => {
            const res = await request(app)
                .post('/api/chatbot/message')
                .send({ message: 'Hello' });
            expect(res.status).toBe(401);
        });

        it('should return chatbot response', async () => {
            mockCallLLM.mockResolvedValueOnce({
                content: 'Bonjour! Comment puis-je vous aider?',
                model: 'gpt-4o',
                usage: { total_tokens: 100 }
            });

            const res = await request(app)
                .post('/api/chatbot/message')
                .set(AUTH)
                .send({ message: 'Hello' });

            expect(res.status).toBe(200);
            expect(res.body.response).toBe('Bonjour! Comment puis-je vous aider?');
            expect(res.body.metadata).toBeDefined();
            expect(res.body.metadata.model).toBe('gpt-4o');
        });

        it('should include conversation history in LLM call', async () => {
            mockCallLLM.mockResolvedValueOnce({
                content: 'Response',
                model: 'gpt-4o',
                usage: {}
            });

            await request(app)
                .post('/api/chatbot/message')
                .set(AUTH)
                .send({
                    message: 'Follow up',
                    conversationHistory: [
                        { role: 'user', content: 'First message' },
                        { role: 'assistant', content: 'First response' }
                    ]
                });

            const messages = mockCallLLM.mock.calls[0][0];
            // System prompt + 2 history messages + current message = 4
            expect(messages.length).toBe(4);
            expect(messages[0].role).toBe('system');
            expect(messages[messages.length - 1].content).toBe('Follow up');
        });

        it('should build a UTF-8 clean system prompt', async () => {
            mockCallLLM.mockResolvedValueOnce({
                content: 'Réponse propre',
                model: 'gpt-4o',
                usage: {}
            });

            await request(app)
                .post('/api/chatbot/message')
                .set(AUTH)
                .send({ message: 'Bonjour' });

            const [messages] = mockCallLLM.mock.calls[0];
            expect(messages[0].content).toContain('amélioration');
            expect(messages[0].content).toContain('Réponds toujours en français');
            expect(messages[0].content).not.toMatch(/[ÃÂ�]/u);
        });

        it('should filter invalid conversation history roles', async () => {
            mockCallLLM.mockResolvedValueOnce({
                content: 'OK',
                model: 'gpt-4o',
                usage: {}
            });

            await request(app)
                .post('/api/chatbot/message')
                .set(AUTH)
                .send({
                    message: 'Test',
                    conversationHistory: [
                        { role: 'system', content: 'Injected system prompt' },
                        { role: 'user', content: 'Valid' }
                    ]
                });

            const messages = mockCallLLM.mock.calls[0][0];
            // System + 1 valid history (user) + current = 3
            // The 'system' role from history should be filtered out
            expect(messages.filter(m => m.role === 'system')).toHaveLength(1);
        });

        it('should return 500 on empty LLM response', async () => {
            mockCallLLM.mockResolvedValue(null);

            const res = await request(app)
                .post('/api/chatbot/message')
                .set(AUTH)
                .send({ message: 'Hello' });

            expect(res.status).toBe(500);
            expect(res.body.error).toContain('Empty LLM response');
        });

        it('should retry on LLM failure', async () => {
            mockCallLLM
                .mockRejectedValueOnce(new Error('Timeout'))
                .mockResolvedValueOnce({
                    content: 'Recovered response',
                    model: 'gpt-4o',
                    usage: {}
                });

            const res = await request(app)
                .post('/api/chatbot/message')
                .set(AUTH)
                .send({ message: 'Hello' });

            expect(res.status).toBe(200);
            expect(res.body.response).toBe('Recovered response');
            expect(mockCallLLM).toHaveBeenCalledTimes(2);
        });

        it('should return 500 after all retries fail', async () => {
            mockCallLLM.mockRejectedValue(new Error('Persistent error'));

            const res = await request(app)
                .post('/api/chatbot/message')
                .set(AUTH)
                .send({ message: 'Hello' });

            expect(res.status).toBe(500);
        });

        it('should return 400 for oversized history entry', async () => {
            const res = await request(app)
                .post('/api/chatbot/message')
                .set(AUTH)
                .send({
                    message: 'Hello',
                    conversationHistory: [{ role: 'user', content: 'x'.repeat(10001) }]
                });

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('entry');
        });

        it('should return 400 for oversized total history', async () => {
            const res = await request(app)
                .post('/api/chatbot/message')
                .set(AUTH)
                .send({
                    message: 'Hello',
                    conversationHistory: Array.from({ length: 6 }, () => ({ role: 'user', content: 'x'.repeat(9000) }))
                });

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('total');
        });
    });

    // ==========================================
    // GET /status
    // ==========================================
    describe('GET /status', () => {
        it('should return 401 without auth', async () => {
            const res = await request(app).get('/api/chatbot/status');
            expect(res.status).toBe(401);
        });

        it('should return chatbot status', async () => {
            const res = await request(app)
                .get('/api/chatbot/status')
                .set(AUTH);

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('configured');
            expect(res.body).toHaveProperty('status');
            expect(res.body).toHaveProperty('userGuideLoaded');
            expect(res.body).toHaveProperty('userGuideLength');
        });
    });
});
