import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../services/openai/apiClient.js', () => ({
    callOpenAI: vi.fn()
}));

vi.mock('../../services/openaiChat.service.js', () => ({
    callOpenAIVisionChat: vi.fn()
}));

vi.mock('../../services/anthropic.service.js', () => ({
    callAnthropicChat: vi.fn(),
    callAnthropicVision: vi.fn()
}));

vi.mock('../../services/deepseek.service.js', () => ({
    callDeepSeekWithCircuitBreaker: vi.fn()
}));

vi.mock('../../services/glm.service.js', () => ({
    callGLMWithCircuitBreaker: vi.fn()
}));

vi.mock('../../services/minimax.service.js', () => ({
    callMiniMaxOpenAICompatible: vi.fn()
}));

vi.mock('../../services/ollama.service.js', () => ({
    callOllama: vi.fn(),
    callOllamaWithVision: vi.fn()
}));

vi.mock('../../services/metrics.service.js', () => ({
    buildLLMMetricLabel: vi.fn((provider, model) => `${provider}:${model}`),
    metrics: {
        trackLLMRequest: vi.fn()
    }
}));

vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn()
}));

import { callOpenAI } from '../../services/openai/apiClient.js';
import { callDeepSeekWithCircuitBreaker } from '../../services/deepseek.service.js';
import { callOllama } from '../../services/ollama.service.js';
import { callProviderChat } from '../../services/llmGateway.service.js';

describe('llmGateway.service', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    it('forwards persisted advanced OpenAI parameters to the provider client', async () => {
        callOpenAI.mockResolvedValueOnce({
            model: 'gpt-4o',
            choices: [{ message: { content: 'ok' } }],
            usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 }
        });

        await callProviderChat({
            provider: 'openai',
            model: 'gpt-4o',
            messages: [{ role: 'user', content: 'hello' }],
            options: {
                max_tokens: 777,
                temperature: 0.4,
                top_p: 0.8,
                reasoning_effort: 'high',
                metadata: { source: 'admin' },
                stop: ['END'],
                timeout: 1234,
                operationType: 'Gateway test'
            }
        });

        expect(callOpenAI).toHaveBeenCalledWith(expect.objectContaining({
            model: 'gpt-4o',
            maxTokens: 777,
            temperature: 0.4,
            topP: 0.8,
            reasoning_effort: 'high',
            metadata: { source: 'admin' },
            stop: ['END'],
            timeout: 1234,
            operationType: 'Gateway test'
        }));
    });

    it('forwards persisted advanced DeepSeek parameters to the provider client', async () => {
        callDeepSeekWithCircuitBreaker.mockResolvedValueOnce({
            model: 'deepseek-chat',
            choices: [{ message: { content: 'ok' } }],
            usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 }
        });

        await callProviderChat({
            provider: 'deepseek',
            model: 'deepseek-chat',
            messages: [{ role: 'user', content: 'hello' }],
            options: {
                max_tokens: 555,
                temperature: 0.3,
                top_p: 0.9,
                metadata: { source: 'admin' },
                stop: ['END'],
                timeout: 1234,
                operationType: 'Gateway test'
            }
        });

        expect(callDeepSeekWithCircuitBreaker).toHaveBeenCalledWith(expect.objectContaining({
            model: 'deepseek-chat',
            maxTokens: 555,
            metadata: { source: 'admin' },
            stop: ['END'],
            timeout: 1234,
            operationType: 'Gateway test'
        }));
    });

    it('forwards persisted advanced Ollama parameters to the provider client', async () => {
        callOllama.mockResolvedValueOnce({
            content: 'ok',
            model: 'llama3.2:latest',
            actualModel: 'llama3.2:latest',
            usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 }
        });

        await callProviderChat({
            provider: 'ollama',
            model: 'llama3.2:latest',
            messages: [{ role: 'user', content: 'hello' }],
            settings: { ollamaBaseUrl: 'http://127.0.0.1:11434' },
            options: {
                max_tokens: 444,
                temperature: 0.2,
                num_ctx: 16384,
                keep_alive: '10m',
                stop: ['END'],
                timeout: 1234,
                operationType: 'Gateway test'
            }
        });

        expect(callOllama).toHaveBeenCalledWith(
            [{ role: 'user', content: 'hello' }],
            'llama3.2:latest',
            { ollamaBaseUrl: 'http://127.0.0.1:11434' },
            expect.objectContaining({
                max_tokens: 444,
                temperature: 0.2,
                num_ctx: 16384,
                keep_alive: '10m',
                stop: ['END'],
                timeout: 1234,
                operationType: 'Gateway test'
            })
        );
    });
});
