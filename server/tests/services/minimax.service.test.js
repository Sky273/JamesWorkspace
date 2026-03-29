/**
 * Tests for MiniMax Service
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockAxiosPost = vi.fn();
const mockTrackLLMRequest = vi.fn();
const mockSafeLog = vi.fn();
const mockValidatePromptSize = vi.fn();
const mockWithRetry = vi.fn();
const mockMarkModelUnavailable = vi.fn();

vi.mock('axios', () => ({
    default: { post: (...args) => mockAxiosPost(...args) }
}));

vi.mock('../../config/constants.js', () => ({
    MAX_PROMPT_LENGTH: 1000,
    MINIMAX_API_KEY: 'test-minimax-key',
    MINIMAX_ANTHROPIC_BASE_URL: 'https://api.minimax.io/anthropic',
    MINIMAX_OPENAI_BASE_URL: 'https://api.minimax.io/v1'
}));

vi.mock('../../services/metrics.service.js', () => ({
    buildLLMMetricLabel: (...args) => args.filter(Boolean).join(':'),
    metrics: { trackLLMRequest: (...args) => mockTrackLLMRequest(...args) }
}));

vi.mock('../../services/retry.service.js', () => ({
    withRetry: (...args) => mockWithRetry(...args)
}));

vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: (...args) => mockSafeLog(...args)
}));

vi.mock('../../services/llmAvailability.service.js', () => ({
    isMiniMaxHighspeedModel: (model) => /-highspeed$/i.test(String(model || '')),
    markModelUnavailable: (...args) => mockMarkModelUnavailable(...args)
}));

vi.mock('../../utils/postgresHelpers.js', () => ({
    validatePromptSize: (...args) => mockValidatePromptSize(...args)
}));

import {
    callMiniMaxAnthropicCompatible,
    callMiniMaxOpenAICompatible
} from '../../services/minimax.service.js';

describe('MiniMax Service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockValidatePromptSize.mockReturnValue({ valid: true });
        mockWithRetry.mockImplementation(async (fn) => fn());
    });

    it('filters thinking blocks from Anthropic-compatible MiniMax responses', async () => {
        mockAxiosPost.mockResolvedValueOnce({
            data: {
                model: 'MiniMax-M2.7',
                content: [
                    { type: 'thinking', thinking: 'Internal reasoning' },
                    { type: 'text', text: 'Final answer' }
                ],
                usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 }
            }
        });

        const result = await callMiniMaxAnthropicCompatible({
            model: 'MiniMax-M2.7',
            messages: [{ role: 'user', content: 'Hello' }]
        });

        expect(result.content).toBe('Final answer');
    });

    it('validates structured message content using the flattened text payload', async () => {
        mockValidatePromptSize.mockImplementation((prompt) => ({
            valid: false,
            error: `Prompt too long: ${prompt}`,
            estimatedTokens: 9999
        }));

        await expect(callMiniMaxAnthropicCompatible({
            model: 'MiniMax-M2.7',
            messages: [{
                role: 'user',
                content: [
                    { type: 'text', text: 'Visible text' },
                    { type: 'thinking', thinking: 'Internal reasoning' }
                ]
            }],
            maxPromptLength: 10
        })).rejects.toThrow('Visible text\nInternal reasoning');

        expect(mockValidatePromptSize).toHaveBeenCalledWith('Visible text\nInternal reasoning', 10);
    });

    it('routes MiniMax calls through retry protection', async () => {
        mockAxiosPost.mockResolvedValueOnce({
            data: {
                model: 'MiniMax-M2.7',
                choices: [{ message: { content: 'OK' } }],
                usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 }
            }
        });

        await callMiniMaxOpenAICompatible({
            model: 'MiniMax-M2.7',
            messages: [{ role: 'user', content: 'Hello' }],
            operationType: 'MiniMax retry test'
        });

        expect(mockWithRetry).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({
            serviceName: 'minimax',
            operationName: 'MiniMax retry test'
        }));
    });

    it('falls back from highspeed to standard MiniMax model when upstream rejects it', async () => {
        mockAxiosPost
            .mockRejectedValueOnce({
                message: 'Request failed with status code 500',
                response: {
                    status: 500,
                    statusText: 'Internal Server Error',
                    headers: {},
                    data: null
                }
            })
            .mockResolvedValueOnce({
                data: {
                    model: 'MiniMax-M2.7',
                    choices: [{ message: { content: 'Recovered' } }],
                    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 }
                }
            });

        const result = await callMiniMaxOpenAICompatible({
            model: 'MiniMax-M2.7-highspeed',
            messages: [{ role: 'user', content: 'Hello' }],
            operationType: 'MiniMax highspeed fallback test'
        });

        expect(mockMarkModelUnavailable).toHaveBeenCalledWith(
            'minimax',
            'MiniMax-M2.7-highspeed',
            'minimax_highspeed_runtime_unavailable',
            'MiniMax-M2.7'
        );
        expect(result.model).toBe('MiniMax-M2.7');
        expect(result.actualModel).toBe('MiniMax-M2.7');
        expect(mockAxiosPost).toHaveBeenNthCalledWith(
            2,
            'https://api.minimax.io/v1/chat/completions',
            expect.objectContaining({ model: 'MiniMax-M2.7' }),
            expect.any(Object)
        );
    });
});
