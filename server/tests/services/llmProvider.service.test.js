import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../services/settings.service.js', () => ({
    getLLMSettings: vi.fn()
}));

vi.mock('../../services/openai/apiClient.js', () => ({
    callOpenAI: vi.fn()
}));

vi.mock('../../services/ollama.service.js', () => ({
    callOllama: vi.fn()
}));

vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn()
}));

import { getLLMSettings } from '../../services/settings.service.js';
import { callOpenAI } from '../../services/openai/apiClient.js';
import { callOllama } from '../../services/ollama.service.js';
import { callBusinessChatCompletion } from '../../services/llmProvider.service.js';

describe('llmProvider.service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
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
                timeout: 20 * 60 * 1000
            })
        );
        expect(callOpenAI).not.toHaveBeenCalled();
        expect(result.choices[0].message.content).toBe('ok');
        expect(result.model).toBe('qwen3:14b');
    });

    it('still requires a model for non-Ollama providers', async () => {
        getLLMSettings.mockResolvedValueOnce({
            llmProvider: 'openai',
            llmModel: ''
        });

        await expect(callBusinessChatCompletion({
            messages: [{ role: 'user', content: 'Analyse ce CV' }]
        })).rejects.toThrow('Model is required');
    });
});
