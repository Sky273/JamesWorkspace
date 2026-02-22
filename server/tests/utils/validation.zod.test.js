/**
 * Tests for Zod validation schemas
 */

import { describe, it, expect, vi } from 'vitest';
import {
    openaiRequestSchema,
    anthropicRequestSchema,
    chatbotRequestSchema,
    validateBody
} from '../../utils/validation.js';

// Mock logger
vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn(),
    createModuleLogger: () => ({
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn()
    })
}));

describe('Zod Validation Schemas', () => {
    describe('openaiRequestSchema', () => {
        it('should validate a valid OpenAI request', () => {
            const validRequest = {
                messages: [
                    { role: 'system', content: 'You are a helpful assistant' },
                    { role: 'user', content: 'Hello!' }
                ],
                model: 'gpt-4o',
                temperature: 0.7
            };

            const result = openaiRequestSchema.safeParse(validRequest);
            expect(result.success).toBe(true);
        });

        it('should reject request without messages', () => {
            const invalidRequest = {
                model: 'gpt-4o'
            };

            const result = openaiRequestSchema.safeParse(invalidRequest);
            expect(result.success).toBe(false);
        });

        it('should reject empty messages array', () => {
            const invalidRequest = {
                messages: []
            };

            const result = openaiRequestSchema.safeParse(invalidRequest);
            expect(result.success).toBe(false);
        });

        it('should reject invalid message role', () => {
            const invalidRequest = {
                messages: [
                    { role: 'invalid', content: 'Hello' }
                ]
            };

            const result = openaiRequestSchema.safeParse(invalidRequest);
            expect(result.success).toBe(false);
        });

        it('should reject temperature out of range', () => {
            const invalidRequest = {
                messages: [{ role: 'user', content: 'Hello' }],
                temperature: 3.0
            };

            const result = openaiRequestSchema.safeParse(invalidRequest);
            expect(result.success).toBe(false);
        });

        it('should accept valid temperature range', () => {
            const validRequest = {
                messages: [{ role: 'user', content: 'Hello' }],
                temperature: 0
            };

            const result = openaiRequestSchema.safeParse(validRequest);
            expect(result.success).toBe(true);

            const validRequest2 = {
                messages: [{ role: 'user', content: 'Hello' }],
                temperature: 2
            };

            const result2 = openaiRequestSchema.safeParse(validRequest2);
            expect(result2.success).toBe(true);
        });

        it('should reject negative max_tokens', () => {
            const invalidRequest = {
                messages: [{ role: 'user', content: 'Hello' }],
                max_tokens: -100
            };

            const result = openaiRequestSchema.safeParse(invalidRequest);
            expect(result.success).toBe(false);
        });

        it('should accept optional fields', () => {
            const minimalRequest = {
                messages: [{ role: 'user', content: 'Hello' }]
            };

            const result = openaiRequestSchema.safeParse(minimalRequest);
            expect(result.success).toBe(true);
        });
    });

    describe('anthropicRequestSchema', () => {
        it('should validate a valid Anthropic request', () => {
            const validRequest = {
                messages: [
                    { role: 'user', content: 'Hello!' }
                ],
                model: 'claude-3-5-sonnet-20241022',
                max_tokens: 1000
            };

            const result = anthropicRequestSchema.safeParse(validRequest);
            expect(result.success).toBe(true);
        });

        it('should reject request without messages', () => {
            const invalidRequest = {
                model: 'claude-3-5-sonnet-20241022'
            };

            const result = anthropicRequestSchema.safeParse(invalidRequest);
            expect(result.success).toBe(false);
        });

        it('should accept system message', () => {
            const validRequest = {
                messages: [{ role: 'user', content: 'Hello' }],
                system: 'You are a helpful assistant'
            };

            const result = anthropicRequestSchema.safeParse(validRequest);
            expect(result.success).toBe(true);
        });
    });

    describe('chatbotRequestSchema', () => {
        it('should validate a valid chatbot request', () => {
            const validRequest = {
                message: 'How do I analyze a resume?'
            };

            const result = chatbotRequestSchema.safeParse(validRequest);
            expect(result.success).toBe(true);
        });

        it('should reject empty message', () => {
            const invalidRequest = {
                message: ''
            };

            const result = chatbotRequestSchema.safeParse(invalidRequest);
            expect(result.success).toBe(false);
        });

        it('should reject message that is too long', () => {
            const invalidRequest = {
                message: 'a'.repeat(10001)
            };

            const result = chatbotRequestSchema.safeParse(invalidRequest);
            expect(result.success).toBe(false);
        });

        it('should accept conversation history', () => {
            const validRequest = {
                message: 'Follow up question',
                conversationHistory: [
                    { role: 'user', content: 'Previous question' },
                    { role: 'assistant', content: 'Previous answer' }
                ]
            };

            const result = chatbotRequestSchema.safeParse(validRequest);
            expect(result.success).toBe(true);
        });

        it('should reject invalid conversation history role', () => {
            const invalidRequest = {
                message: 'Question',
                conversationHistory: [
                    { role: 'system', content: 'Invalid role for history' }
                ]
            };

            const result = chatbotRequestSchema.safeParse(invalidRequest);
            expect(result.success).toBe(false);
        });

        it('should limit conversation history length', () => {
            const history = Array(51).fill({ role: 'user', content: 'Message' });
            const invalidRequest = {
                message: 'Question',
                conversationHistory: history
            };

            const result = chatbotRequestSchema.safeParse(invalidRequest);
            expect(result.success).toBe(false);
        });
    });

    describe('validateBody middleware', () => {
        it('should call next() for valid body', () => {
            const schema = chatbotRequestSchema;
            const middleware = validateBody(schema);
            
            const req = { body: { message: 'Valid message' } };
            const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
            const next = vi.fn();

            middleware(req, res, next);

            expect(next).toHaveBeenCalled();
            expect(res.status).not.toHaveBeenCalled();
        });

        it('should return 400 for invalid body', () => {
            const schema = chatbotRequestSchema;
            const middleware = validateBody(schema);
            
            const req = { body: { message: '' } };
            const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
            const next = vi.fn();

            middleware(req, res, next);

            expect(next).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                error: expect.any(String)
            }));
        });

        it('should include validation errors in response', () => {
            const schema = chatbotRequestSchema;
            const middleware = validateBody(schema);
            
            const req = { body: {} };
            const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
            const next = vi.fn();

            middleware(req, res, next);

            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                details: expect.any(Array)
            }));
        });
    });
});
