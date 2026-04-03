import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../services/llmGateway.service.js', () => ({
    callProviderChat: vi.fn()
}));

vi.mock('../../services/llmConfiguration.service.js', () => ({
    getProviderDefaultModel: vi.fn((provider) => ({
        openai: 'gpt-4o',
        anthropic: 'claude-3-5-sonnet-20241022',
        deepseek: 'deepseek-chat',
        glm: 'glm-5.1',
        minimax: 'MiniMax-M2.7',
        ollama: null
    }[provider] ?? 'gpt-4o'))
}));

vi.mock('../../services/llmAdminParameters.service.js', () => ({
    resolveEffectiveModelParameters: vi.fn(({ provider, model }) => ({
        parameters: provider === 'ollama'
            ? { num_ctx: 8192, keep_alive: '5m' }
            : { temperature: 0, max_tokens: 4096 },
        provider,
        model
    })),
    OLLAMA_GLOBAL_KEY: '__global__',
    OLLAMA_GENERIC_MODEL_KEY: '__model__'
}));

import { callProviderChat } from '../../services/llmGateway.service.js';
import { validatePersistedLlmSettings } from '../../services/llmSettingsValidation.service.js';

describe('llmSettingsValidation.service', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        callProviderChat.mockResolvedValue({ content: 'OK' });
    });

    it('validates the selected configured model with its resolved parameters', async () => {
        await validatePersistedLlmSettings({
            llmProvider: 'deepseek',
            llmModel: 'deepseek-reasoner'
        }, {
            email: 'admin@test.local'
        });

        expect(callProviderChat).toHaveBeenCalledWith(expect.objectContaining({
            provider: 'deepseek',
            model: 'deepseek-reasoner',
            options: expect.objectContaining({
                temperature: 0,
                max_tokens: 4096,
                operationType: 'LLM settings validation'
            })
        }));
    });

    it('validates explicit persisted model entries and skips ollama pseudo-keys', async () => {
        await validatePersistedLlmSettings({
            llmProvider: 'ollama',
            llmModel: 'llama3.2:latest',
            ollamaBaseUrl: 'http://ollama.local:11434',
            llmModelParameters: {
                ollama: {
                    '__global__': { keep_alive: '5m' },
                    '__model__': { num_ctx: 8192 },
                    'llama3.2:latest': { num_ctx: 16384 }
                }
            }
        });

        expect(callProviderChat).toHaveBeenCalledTimes(1);
        expect(callProviderChat).toHaveBeenCalledWith(expect.objectContaining({
            provider: 'ollama',
            model: 'llama3.2:latest',
            settings: expect.objectContaining({
                ollamaBaseUrl: 'http://ollama.local:11434'
            })
        }));
    });

    it('raises a 400 error when the validation call fails', async () => {
        callProviderChat.mockRejectedValueOnce(new Error('upstream validation failed'));

        await expect(validatePersistedLlmSettings({
            llmProvider: 'openai',
            llmModel: 'gpt-4o'
        })).rejects.toMatchObject({
            statusCode: 400,
            message: expect.stringContaining('Saved parameters are invalid for openai/gpt-4o')
        });
    });

    it('does not block persistence when ollama validation fails', async () => {
        callProviderChat.mockRejectedValueOnce(new Error('ollama unavailable'));

        await expect(validatePersistedLlmSettings({
            llmProvider: 'ollama',
            llmModel: 'llama3.2:latest',
            ollamaBaseUrl: 'http://ollama.local:11434'
        })).resolves.toBeUndefined();

        expect(callProviderChat).toHaveBeenCalledWith(expect.objectContaining({
            provider: 'ollama',
            model: 'llama3.2:latest'
        }));
    });
});
