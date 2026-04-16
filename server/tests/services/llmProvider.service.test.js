import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../services/settings.service.js', () => ({
    getLLMSettings: vi.fn()
}));

vi.mock('../../services/llmConfiguration.service.js', () => ({
    resolveLLMRuntimeConfig: vi.fn((settings, model) => ({
        provider: settings?.llmProvider || 'openai',
        model: model || settings?.llmModel || null
    }))
}));

const callProviderChatMock = vi.fn();
vi.mock('../../services/llmGateway.service.js', () => ({
    callProviderChat: (...args) => callProviderChatMock(...args)
}));

vi.mock('../../services/llmProviderCommon.service.js', () => ({
    toOpenAICompatibleResponse: vi.fn((result) => result)
}));

vi.mock('../../services/openai/textUtils.js', () => ({
    normalizeUtf8Text: vi.fn((value) => value)
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

vi.mock('../../services/llmAdminParameters.service.js', () => ({
    resolveEffectiveModelParameters: vi.fn(({ overrides = {} }) => ({
        parameters: {
            max_tokens: overrides.max_tokens ?? 4096,
            temperature: overrides.temperature ?? 0,
            ...(overrides.top_p !== undefined ? { top_p: overrides.top_p } : {}),
            reasoning_effort: 'high',
            metadata: { source: 'admin-settings' },
            keep_alive: '15m',
            num_ctx: 16384,
            stop: ['END']
        }
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
        callProviderChatMock.mockResolvedValueOnce({
            choices: [{ message: { content: 'ok' } }],
            model: 'qwen3:14b',
            usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 }
        });

        const result = await callBusinessChatCompletion({
            messages: [{ role: 'user', content: 'Analyse ce CV' }],
            operationType: 'Resume Analysis'
        });

        expect(callProviderChatMock).toHaveBeenCalledWith(expect.objectContaining({
            provider: 'ollama',
            model: null,
            messages: [{ role: 'user', content: 'Analyse ce CV' }],
            settings: expect.objectContaining({
                llmProvider: 'ollama',
                ollamaBaseUrl: 'http://192.168.1.10:11434'
            }),
            options: expect.objectContaining({
                max_tokens: 4096,
                temperature: 0,
                keep_alive: '15m',
                num_ctx: 16384,
                stop: ['END'],
                timeout: 15 * 60 * 1000,
                operationType: 'Resume Analysis'
            })
        }));
        expect(result.choices[0].message.content).toBe('ok');
        expect(result.model).toBe('qwen3:14b');
    });

    it('routes DeepSeek business calls through the DeepSeek service', async () => {
        getLLMSettings.mockResolvedValueOnce({
            llmProvider: 'deepseek',
            llmModel: 'deepseek-reasoner'
        });
        callProviderChatMock.mockResolvedValueOnce({
            model: 'deepseek-reasoner',
            choices: [{ message: { content: 'ok deepseek' } }],
            usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 }
        });

        const result = await callBusinessChatCompletion({
            messages: [{ role: 'user', content: 'Analyse ce CV' }],
            operationType: 'Resume Analysis'
        });

        expect(callProviderChatMock).toHaveBeenCalledWith(expect.objectContaining({
            provider: 'deepseek',
            model: 'deepseek-reasoner',
            messages: [{ role: 'user', content: 'Analyse ce CV' }],
            options: expect.objectContaining({
                max_tokens: 4096,
                temperature: 0,
                metadata: { source: 'admin-settings' },
                stop: ['END'],
                timeout: 15 * 60 * 1000,
                operationType: 'Resume Analysis'
            })
        }));
        expect(result.choices[0].message.content).toBe('ok deepseek');
        expect(result.model).toBe('deepseek-reasoner');
    });

    it('routes MiniMax business calls through the MiniMax service', async () => {
        getLLMSettings.mockResolvedValueOnce({
            llmProvider: 'minimax',
            llmModel: 'MiniMax-M2.7'
        });
        callProviderChatMock.mockResolvedValueOnce({
            choices: [{ message: { content: 'ok minimax' } }],
            model: 'MiniMax-M2.7',
            usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 }
        });

        const result = await callBusinessChatCompletion({
            messages: [{ role: 'user', content: 'Analyse ce CV' }],
            operationType: 'Resume Analysis'
        });

        expect(callProviderChatMock).toHaveBeenCalledWith(expect.objectContaining({
            provider: 'minimax',
            model: 'MiniMax-M2.7',
            options: expect.objectContaining({
                metadata: { source: 'admin-settings' },
                stop: ['END'],
                operationType: 'Resume Analysis',
                timeout: 15 * 60 * 1000
            })
        }));
        expect(result.choices[0].message.content).toBe('ok minimax');
    });

    it('routes GLM business calls through the GLM service', async () => {
        getLLMSettings.mockResolvedValueOnce({
            llmProvider: 'glm',
            llmModel: 'glm-5.1'
        });
        callProviderChatMock.mockResolvedValueOnce({
            model: 'glm-5.1',
            choices: [{ message: { content: 'ok glm' } }],
            usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 }
        });

        const result = await callBusinessChatCompletion({
            messages: [{ role: 'user', content: 'Analyse ce CV' }],
            operationType: 'Resume Analysis'
        });

        expect(callProviderChatMock).toHaveBeenCalledWith(expect.objectContaining({
            provider: 'glm',
            model: 'glm-5.1',
            messages: [{ role: 'user', content: 'Analyse ce CV' }],
            options: expect.objectContaining({
                max_tokens: 4096,
                temperature: 0,
                metadata: { source: 'admin-settings' },
                stop: ['END'],
                timeout: 15 * 60 * 1000,
                operationType: 'Resume Analysis'
            })
        }));
        expect(result.choices[0].message.content).toBe('ok glm');
        expect(result.model).toBe('glm-5.1');
    });

    it('uses the configured default OpenAI model when none is passed explicitly', async () => {
        getLLMSettings.mockResolvedValueOnce({
            llmProvider: 'openai',
            llmModel: 'gpt-4o'
        });
        callProviderChatMock.mockResolvedValueOnce({
            model: 'gpt-4o',
            choices: [{ message: { content: 'openai ok' } }],
            usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 }
        });

        const result = await callBusinessChatCompletion({
            messages: [{ role: 'user', content: 'Analyse ce CV' }]
        });

        expect(callProviderChatMock).toHaveBeenCalledWith(expect.objectContaining({
            provider: 'openai',
            model: 'gpt-4o',
            options: expect.objectContaining({
                reasoning_effort: 'high',
                metadata: { source: 'admin-settings' },
                stop: ['END'],
                operationType: 'LLM business operation'
            })
        }));
        expect(result.choices[0].message.content).toBe('openai ok');
        expect(result.model).toBe('gpt-4o');
    });

    it('keeps per-request max_tokens overrides ahead of persisted model parameters', async () => {
        getLLMSettings.mockResolvedValueOnce({
            llmProvider: 'openai',
            llmModel: 'gpt-4o'
        });
        callProviderChatMock.mockResolvedValueOnce({
            model: 'gpt-4o',
            choices: [{ message: { content: 'openai ok' } }],
            usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 }
        });

        await callBusinessChatCompletion({
            messages: [{ role: 'user', content: 'Analyse ce CV' }],
            maxTokens: 2222,
            operationType: 'Resume Analysis'
        });

        expect(callProviderChatMock).toHaveBeenCalledWith(expect.objectContaining({
            options: expect.objectContaining({
                max_tokens: 2222
            })
        }));
    });
});
