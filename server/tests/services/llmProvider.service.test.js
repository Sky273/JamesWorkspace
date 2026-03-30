import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../services/settings.service.js', () => ({
    getLLMSettings: vi.fn()
}));

vi.mock('../../services/llmAvailability.service.js', () => ({
    resolveAvailableModel: vi.fn((provider, model, fallbackModel) => ({
        model: provider === 'ollama' ? (model ?? null) : (model || fallbackModel || null),
        adjusted: false,
        reason: null,
        originalModel: provider === 'ollama' ? (model ?? null) : (model || fallbackModel || null),
        fallbackModel: fallbackModel || null
    }))
}));

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

vi.mock('../../services/ollama.service.js', () => ({
    callOllama: vi.fn(),
    callOllamaWithVision: vi.fn()
}));

vi.mock('../../services/minimax.service.js', () => ({
    callMiniMaxOpenAICompatible: vi.fn()
}));

vi.mock('../../services/metrics.service.js', () => ({
    buildLLMMetricLabel: vi.fn((provider, model) => `${provider}:${model}`),
    metrics: { trackLLMRequest: vi.fn() }
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

import { getLLMSettings } from '../../services/settings.service.js';
import { callOpenAI } from '../../services/openai/apiClient.js';
import { callDeepSeekWithCircuitBreaker } from '../../services/deepseek.service.js';
import { callGLMWithCircuitBreaker } from '../../services/glm.service.js';
import { callOllama } from '../../services/ollama.service.js';
import { callMiniMaxOpenAICompatible } from '../../services/minimax.service.js';
import { callBusinessChatCompletion } from '../../services/llmProvider.service.js';

describe('llmProvider.service', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    it('routes Ollama business calls without requiring an explicit model', async () => {
        getLLMSettings.mockResolvedValueOnce({
            llmProvider: 'ollama',
            llmModel: '',
            ollamaBaseUrl: 'http://192.168.1.10:11434'
        });
        callOllama.mockResolvedValueOnce({
            content: 'ok',
            model: 'qwen3:14b',
            actualModel: 'qwen3:14b',
            usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 }
        });

        const result = await callBusinessChatCompletion({
            messages: [{ role: 'user', content: 'Analyse ce CV' }],
            operationType: 'Resume Analysis'
        });

        expect(callOllama).toHaveBeenCalledWith(
            [{ role: 'user', content: 'Analyse ce CV' }],
            null,
            expect.objectContaining({
                llmProvider: 'ollama',
                ollamaBaseUrl: 'http://192.168.1.10:11434'
            }),
            expect.objectContaining({
                max_tokens: 4096,
                temperature: 0,
                timeout: 20 * 60 * 1000,
                operationType: 'Resume Analysis'
            })
        );
        expect(callOpenAI).not.toHaveBeenCalled();
        expect(result.choices[0].message.content).toBe('ok');
        expect(result.model).toBe('qwen3:14b');
    });

    it('routes DeepSeek business calls through the DeepSeek service', async () => {
        getLLMSettings.mockResolvedValueOnce({
            llmProvider: 'deepseek',
            llmModel: 'deepseek-reasoner'
        });
        callDeepSeekWithCircuitBreaker.mockResolvedValueOnce({
            model: 'deepseek-reasoner',
            choices: [{ message: { content: 'ok deepseek' } }],
            usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 }
        });

        const result = await callBusinessChatCompletion({
            messages: [{ role: 'user', content: 'Analyse ce CV' }],
            operationType: 'Resume Analysis'
        });

        expect(callDeepSeekWithCircuitBreaker).toHaveBeenCalledWith(expect.objectContaining({
            model: 'deepseek-reasoner',
            messages: [{ role: 'user', content: 'Analyse ce CV' }],
            maxTokens: 4096,
            temperature: 0,
            timeout: 20 * 60 * 1000,
            operationType: 'Resume Analysis'
        }));
        expect(result.choices[0].message.content).toBe('ok deepseek');
        expect(result.model).toBe('deepseek-reasoner');
    });

    it('routes MiniMax business calls through the MiniMax service', async () => {
        getLLMSettings.mockResolvedValueOnce({
            llmProvider: 'minimax',
            llmModel: 'MiniMax-M2.7'
        });
        callMiniMaxOpenAICompatible.mockResolvedValueOnce({
            content: 'ok minimax',
            model: 'MiniMax-M2.7',
            actualModel: 'MiniMax-M2.7',
            usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 }
        });

        const result = await callBusinessChatCompletion({
            messages: [{ role: 'user', content: 'Analyse ce CV' }],
            operationType: 'Resume Analysis'
        });

        expect(callMiniMaxOpenAICompatible).toHaveBeenCalledWith(expect.objectContaining({
            model: 'MiniMax-M2.7',
            operationType: 'Resume Analysis',
            timeout: 20 * 60 * 1000
        }));
        expect(result.choices[0].message.content).toBe('ok minimax');
    });

    it('routes GLM business calls through the GLM service', async () => {
        getLLMSettings.mockResolvedValueOnce({
            llmProvider: 'glm',
            llmModel: 'glm-5.1'
        });
        callGLMWithCircuitBreaker.mockResolvedValueOnce({
            model: 'glm-5.1',
            choices: [{ message: { content: 'ok glm' } }],
            usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 }
        });

        const result = await callBusinessChatCompletion({
            messages: [{ role: 'user', content: 'Analyse ce CV' }],
            operationType: 'Resume Analysis'
        });

        expect(callGLMWithCircuitBreaker).toHaveBeenCalledWith(expect.objectContaining({
            model: 'glm-5.1',
            messages: [{ role: 'user', content: 'Analyse ce CV' }],
            maxTokens: 4096,
            temperature: 0,
            timeout: 20 * 60 * 1000,
            operationType: 'Resume Analysis'
        }));
        expect(result.choices[0].message.content).toBe('ok glm');
        expect(result.model).toBe('glm-5.1');
    });

    it('uses the configured default OpenAI model when none is passed explicitly', async () => {
        getLLMSettings.mockResolvedValueOnce({
            llmProvider: 'openai',
            llmModel: ''
        });
        callOpenAI.mockResolvedValueOnce({
            model: 'gpt-4o',
            choices: [{ message: { content: 'openai ok' } }],
            usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 }
        });

        const result = await callBusinessChatCompletion({
            messages: [{ role: 'user', content: 'Analyse ce CV' }]
        });

        expect(callOpenAI).toHaveBeenCalledWith(expect.objectContaining({
            model: 'gpt-4o',
            operationType: 'LLM business operation'
        }));
        expect(result.choices[0].message.content).toBe('openai ok');
        expect(result.model).toBe('gpt-4o');
    });
});
