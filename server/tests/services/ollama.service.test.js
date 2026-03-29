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

import { callOllama, callOllamaWithVision, listOllamaModels, getOllamaRuntimeStatus, pullOllamaModel, runOllamaModel, stopOllamaModel } from '../../services/ollama.service.js';

describe('ollama.service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockAxiosGet.mockResolvedValue({
            data: {
                models: [{ name: 'qwen3:14b' }]
            }
        });
    });

    it('retries transient network errors on list models requests', async () => {
        const timeoutError = new Error('request timeout');
        timeoutError.code = 'ETIMEDOUT';

        mockAxiosGet
            .mockRejectedValueOnce(timeoutError)
            .mockResolvedValueOnce({
                data: {
                    models: [{ name: 'qwen3:14b' }]
                }
            });

        const result = await listOllamaModels('http://ollama.test:11434');

        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('qwen3:14b');
        expect(mockAxiosGet).toHaveBeenCalledTimes(2);
    });

    it('retries transient network errors on runtime status requests', async () => {
        const resetError = new Error('socket hang up');
        resetError.code = 'ECONNRESET';

        mockAxiosGet
            .mockRejectedValueOnce(resetError)
            .mockResolvedValueOnce({
                data: {
                    models: [{ name: 'qwen3:14b' }]
                }
            });

        const result = await getOllamaRuntimeStatus('http://ollama.test:11434');

        expect(result.running).toBe(true);
        expect(result.activeModel).toBe('qwen3:14b');
        expect(mockAxiosGet).toHaveBeenCalledTimes(2);
    });

    it('strips think blocks from Ollama chat responses', async () => {
        mockAxiosPost.mockResolvedValueOnce({
            data: {
                model: 'qwen3:14b',
                message: {
                    content: '<think>internal reasoning</think>{"ok":true,"name":"Julien"}'
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

        expect(result.content).toBe('{"ok":true,"name":"Julien"}');
    });

    it('applies keep_alive from Ollama settings on chat requests', async () => {
        mockAxiosPost.mockResolvedValueOnce({
            data: {
                model: 'qwen3:14b',
                message: { content: 'Final answer' },
                prompt_eval_count: 10,
                eval_count: 5
            }
        });

        await callOllama(
            [{ role: 'user', content: 'Analyse ce CV' }],
            'qwen3:14b',
            { ollamaBaseUrl: 'http://ollama.test:11434', ollamaKeepAlive: '30s' },
            { operationType: 'Resume Analysis' }
        );

        expect(mockAxiosPost).toHaveBeenCalledWith(
            'http://ollama.test:11434/api/chat',
            expect.objectContaining({ keep_alive: '30s' }),
            expect.any(Object)
        );
    });

    it('applies keep_alive on vision requests and allows overrides', async () => {
        mockAxiosPost.mockResolvedValueOnce({
            data: {
                model: 'qwen3:14b',
                message: { content: 'Vision answer' },
                prompt_eval_count: 10,
                eval_count: 5
            }
        });

        await callOllamaWithVision(
            'System prompt',
            [{ type: 'text', text: 'Describe this image' }],
            'qwen3:14b',
            { ollamaBaseUrl: 'http://ollama.test:11434', ollamaKeepAlive: '30s' },
            { operationType: 'Resume Analysis', keep_alive: 0 }
        );

        expect(mockAxiosPost).toHaveBeenCalledWith(
            'http://ollama.test:11434/api/chat',
            expect.objectContaining({ keep_alive: 0 }),
            expect.any(Object)
        );
    });

    it('retries transient network errors on chat requests', async () => {
        const timeoutError = new Error('socket hang up');
        timeoutError.code = 'ECONNRESET';

        mockAxiosPost
            .mockRejectedValueOnce(timeoutError)
            .mockResolvedValueOnce({
                data: {
                    model: 'qwen3:14b',
                    message: { content: 'Recovered answer' },
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

        expect(result.content).toBe('Recovered answer');
        expect(mockAxiosPost).toHaveBeenCalledTimes(2);
    });

    it('retries transient network errors on vision requests', async () => {
        const timeoutError = new Error('request timeout');
        timeoutError.code = 'ETIMEDOUT';

        mockAxiosPost
            .mockRejectedValueOnce(timeoutError)
            .mockResolvedValueOnce({
                data: {
                    model: 'qwen3:14b',
                    message: { content: 'Recovered vision answer' },
                    prompt_eval_count: 10,
                    eval_count: 5
                }
            });

        const result = await callOllamaWithVision(
            'System prompt',
            [{ type: 'text', text: 'Describe this image' }],
            'qwen3:14b',
            { ollamaBaseUrl: 'http://ollama.test:11434' },
            { operationType: 'Resume Analysis' }
        );

        expect(result.content).toBe('Recovered vision answer');
        expect(mockAxiosPost).toHaveBeenCalledTimes(2);
    });

    it('retries transient network errors on pull model requests', async () => {
        const resetError = new Error('socket hang up');
        resetError.code = 'ECONNRESET';

        mockAxiosPost
            .mockRejectedValueOnce(resetError)
            .mockResolvedValueOnce({ data: { status: 'success' } });

        const result = await pullOllamaModel('qwen3:14b', { ollamaBaseUrl: 'http://ollama.test:11434' });

        expect(result.status).toBe('success');
        expect(mockAxiosPost).toHaveBeenCalledTimes(2);
    });

    it('retries transient network errors on run and stop requests', async () => {
        const timeoutError = new Error('request timeout');
        timeoutError.code = 'ETIMEDOUT';

        mockAxiosGet.mockResolvedValue({
            data: {
                models: [{ name: 'qwen3:14b' }]
            }
        });

        mockAxiosPost
            .mockRejectedValueOnce(timeoutError)
            .mockResolvedValueOnce({ data: {} })
            .mockRejectedValueOnce(timeoutError)
            .mockResolvedValueOnce({ data: {} });

        const runResult = await runOllamaModel('qwen3:14b', { ollamaBaseUrl: 'http://ollama.test:11434' });
        const stopResult = await stopOllamaModel('qwen3:14b', { ollamaBaseUrl: 'http://ollama.test:11434' });

        expect(runResult.status).toBe('running');
        expect(stopResult.status).toBe('stopped');
        expect(mockAxiosPost).toHaveBeenCalledTimes(4);
    });

    it('rejects responses that only contain reasoning fields', async () => {
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

        await expect(callOllama(
            [{ role: 'user', content: 'Analyse ce CV' }],
            'qwen3:14b',
            { ollamaBaseUrl: 'http://ollama.test:11434' },
            { operationType: 'Resume Analysis' }
        )).rejects.toThrow('Ollama returned empty content');
    });
});
