/**
 * Tests for LLM Service
 * Pure helper functions + callLLM with mocked axios
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('axios');
vi.mock('../../config/constants.js', () => ({
    OPENAI_API_KEY: 'test-openai-key',
    ANTHROPIC_API_KEY: 'test-anthropic-key'
}));
vi.mock('../../services/settings.service.js', () => ({
    getLLMSettings: vi.fn()
}));
vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn(),
    createModuleLogger: () => ({
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn()
    })
}));
vi.mock('../../services/metrics.service.js', () => ({
    metrics: { trackLLMRequest: vi.fn() }
}));
vi.mock('../../services/ollama.service.js', () => ({
    callOllama: vi.fn(),
    callOllamaWithVision: vi.fn()
}));
vi.mock('../../services/minimax.service.js', () => ({
    callMiniMaxOpenAICompatible: vi.fn()
}));

import axios from 'axios';
import { getLLMSettings } from '../../services/settings.service.js';
import {
    getTokenParameter,
    supportsCustomTemperature,
    buildOpenAIParams,
    callLLM,
    callLLMWithVision
} from '../../services/llm.service.js';

describe('LLM Service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getTokenParameter', () => {
        it('should return max_completion_tokens for GPT-5 models', () => {
            expect(getTokenParameter('gpt-5', 1000)).toEqual({ max_completion_tokens: 1000 });
            expect(getTokenParameter('gpt-5.1-pro', 2000)).toEqual({ max_completion_tokens: 2000 });
        });

        it('should return max_completion_tokens for gpt-4.1', () => {
            expect(getTokenParameter('gpt-4.1', 1000)).toEqual({ max_completion_tokens: 1000 });
        });

        it('should return max_completion_tokens for gpt-4o dated models', () => {
            expect(getTokenParameter('gpt-4o-2024-08-06', 1000)).toEqual({ max_completion_tokens: 1000 });
        });

        it('should return max_tokens for older models', () => {
            expect(getTokenParameter('gpt-4o', 1000)).toEqual({ max_tokens: 1000 });
            expect(getTokenParameter('gpt-3.5-turbo', 500)).toEqual({ max_tokens: 500 });
            expect(getTokenParameter('gpt-4-turbo', 2000)).toEqual({ max_tokens: 2000 });
        });
    });

    describe('supportsCustomTemperature', () => {
        it('should return false for GPT-5 models', () => {
            expect(supportsCustomTemperature('gpt-5')).toBe(false);
            expect(supportsCustomTemperature('gpt-5.1-pro')).toBe(false);
            expect(supportsCustomTemperature('chatgpt-5')).toBe(false);
        });

        it('should return true for other models', () => {
            expect(supportsCustomTemperature('gpt-4o')).toBe(true);
            expect(supportsCustomTemperature('gpt-3.5-turbo')).toBe(true);
            expect(supportsCustomTemperature('claude-3')).toBe(true);
        });
    });

    describe('buildOpenAIParams', () => {
        it('should build params with correct token parameter', () => {
            const params = buildOpenAIParams('gpt-4o', {
                maxTokens: 1000,
                temperature: 0.7,
                topP: 0.9,
                additionalParams: { messages: [{ role: 'user', content: 'hi' }] }
            });

            expect(params.model).toBe('gpt-4o');
            expect(params.max_tokens).toBe(1000);
            expect(params.temperature).toBe(0.7);
            expect(params.top_p).toBe(0.9);
            expect(params.messages).toBeDefined();
        });

        it('should omit temperature for GPT-5 models', () => {
            const params = buildOpenAIParams('gpt-5', {
                maxTokens: 1000,
                temperature: 0.7,
                additionalParams: {}
            });

            expect(params.temperature).toBeUndefined();
            expect(params.max_completion_tokens).toBe(1000);
        });
    });

    describe('callLLM', () => {
        it('should call OpenAI when provider is openai', async () => {
            getLLMSettings.mockResolvedValueOnce({ llmModel: 'gpt-4o', llmProvider: 'openai' });
            axios.post.mockResolvedValueOnce({
                data: {
                    choices: [{ message: { content: 'response' }, finish_reason: 'stop' }],
                    model: 'gpt-4o-2024-05-13',
                    usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 }
                }
            });

            const result = await callLLM([{ role: 'user', content: 'hello' }]);

            expect(result.content).toBe('response');
            expect(axios.post).toHaveBeenCalledWith(
                'https://api.openai.com/v1/chat/completions',
                expect.any(Object),
                expect.any(Object)
            );
        });

        it('should call Anthropic when provider is anthropic', async () => {
            getLLMSettings.mockResolvedValueOnce({ llmModel: 'claude-3-sonnet', llmProvider: 'anthropic' });
            axios.post.mockResolvedValueOnce({
                data: {
                    content: [{ text: 'anthropic response' }],
                    model: 'claude-3-sonnet',
                    usage: { input_tokens: 10, output_tokens: 20 }
                }
            });

            const result = await callLLM([{ role: 'user', content: 'hello' }]);

            expect(result.content).toBe('anthropic response');
            expect(axios.post).toHaveBeenCalledWith(
                'https://api.anthropic.com/v1/messages',
                expect.any(Object),
                expect.any(Object)
            );
        });

        it('should throw on OpenAI empty choices', async () => {
            getLLMSettings.mockResolvedValueOnce({ llmModel: 'gpt-4o', llmProvider: 'openai' });
            axios.post.mockResolvedValueOnce({
                data: { choices: [], usage: {} }
            });

            await expect(callLLM([{ role: 'user', content: 'hello' }])).rejects.toThrow('no choices');
        });

        it('should handle system messages for Anthropic', async () => {
            getLLMSettings.mockResolvedValueOnce({ llmModel: 'claude-3-sonnet', llmProvider: 'anthropic' });
            axios.post.mockResolvedValueOnce({
                data: {
                    content: [{ text: 'ok' }],
                    model: 'claude-3-sonnet',
                    usage: {}
                }
            });

            await callLLM([
                { role: 'system', content: 'You are helpful' },
                { role: 'user', content: 'hello' }
            ]);

            const callBody = axios.post.mock.calls[0][1];
            expect(callBody.system).toEqual([{ type: 'text', text: 'You are helpful' }]);
            expect(callBody.messages).toHaveLength(1);
            expect(callBody.messages[0].content).toEqual([{ type: 'text', text: 'hello' }]);
        });

        it('should extract text from Anthropic structured responses', async () => {
            getLLMSettings.mockResolvedValueOnce({ llmModel: 'claude-3-sonnet', llmProvider: 'anthropic' });
            axios.post.mockResolvedValueOnce({
                data: {
                    content: [
                        { type: 'thinking', thinking: 'Reasoning' },
                        { type: 'text', text: 'Final answer' }
                    ],
                    model: 'claude-3-sonnet',
                    usage: { input_tokens: 10, output_tokens: 20 }
                }
            });

            const result = await callLLM([{ role: 'user', content: 'hello' }]);
            expect(result.content).toBe('Reasoning\nFinal answer');
        });
    });

    describe('callLLMWithVision', () => {
        it('should call OpenAI vision endpoint', async () => {
            getLLMSettings.mockResolvedValueOnce({ llmModel: 'gpt-4o', llmProvider: 'openai' });
            axios.post.mockResolvedValueOnce({
                data: {
                    choices: [{ message: { content: 'I see an image' } }],
                    model: 'gpt-4o',
                    usage: { total_tokens: 100, prompt_tokens: 80, completion_tokens: 20 }
                }
            });

            const result = await callLLMWithVision('Describe', [{ type: 'text', text: 'what is this?' }]);

            expect(result.content).toBe('I see an image');
        });

        it('should convert image format for Anthropic vision', async () => {
            getLLMSettings.mockResolvedValueOnce({ llmModel: 'claude-3-sonnet', llmProvider: 'anthropic' });
            axios.post.mockResolvedValueOnce({
                data: {
                    content: [{ text: 'I see it' }],
                    model: 'claude-3-sonnet',
                    usage: { input_tokens: 50, output_tokens: 10 }
                }
            });

            const result = await callLLMWithVision('Describe', [
                { type: 'image_url', image_url: { url: 'data:image/png;base64,abc123' } },
                { type: 'text', text: 'what?' }
            ]);

            expect(result.content).toBe('I see it');
            const body = axios.post.mock.calls[0][1];
            expect(body.system).toEqual([{ type: 'text', text: 'Describe' }]);
            expect(body.messages[0].content[0].type).toBe('image');
            expect(body.messages[0].content[0].source.data).toBe('abc123');
        });
    });
});

