import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockAxiosGet = vi.fn();
const mockAxiosPost = vi.fn();

vi.mock('axios', () => ({
    default: {
        get: (...args) => mockAxiosGet(...args),
        post: (...args) => mockAxiosPost(...args)
    }
}));

vi.mock('../../config/constants.js', () => ({
    OLLAMA_AUTO_PULL: false,
    OLLAMA_BASE_URL: 'http://ollama.test:11434',
    OLLAMA_REQUEST_TIMEOUT_MS: 30000
}));

vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn()
}));

import { callOllama } from '../../services/ollama.service.js';

describe('ollama.service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockAxiosGet.mockResolvedValue({
            data: {
                models: [{ name: 'qwen3:14b' }]
            }
        });
    });

    it('strips think blocks from Ollama chat responses', async () => {
        mockAxiosPost.mockResolvedValueOnce({
            data: {
                model: 'qwen3:14b',
                message: {
                    content: '<think>internal reasoning</think>{\"ok\":true,\"name\":\"Julien\"}'
                },
                prompt_eval_count: 10,
                eval_count: 5
            }
        });

        const result = await callOllama(
            [{ role: 'user', content: 'Analyse ce CV' }],
            'qwen3:14b',
            { ollamaBaseUrl: 'http://ollama.test:11434' },
            { operationType: 'Resume Analysis' }
        );

        expect(result.content).toBe('{\"ok\":true,\"name\":\"Julien\"}');
    });

    it('falls back to reasoning fields only when no assistant content exists', async () => {
        mockAxiosPost.mockResolvedValueOnce({
            data: {
                model: 'qwen3:14b',
                message: {
                    thinking: '<think>internal reasoning</think>Final answer'
                },
                prompt_eval_count: 10,
                eval_count: 5
            }
        });

        const result = await callOllama(
            [{ role: 'user', content: 'Analyse ce CV' }],
            'qwen3:14b',
            { ollamaBaseUrl: 'http://ollama.test:11434' },
            { operationType: 'Resume Analysis' }
        );

        expect(result.content).toBe('Final answer');
    });
});
