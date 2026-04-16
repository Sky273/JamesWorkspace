/**
 * Tests for OpenAI API Client
 * callOpenAI validation, GPT-5 handling, circuit breaker wrapper
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('axios');
vi.mock('../../config/constants.js', () => ({
    OPENAI_API_KEY: 'test-key',
    MAX_PROMPT_LENGTH: 50000,
    LLM_OPERATION_TIMEOUT_MS: 15 * 60 * 1000
}));
vi.mock('../../services/llm.service.js', () => ({
    buildOpenAIParams: vi.fn((model, opts) => ({
        model,
        messages: opts.additionalParams?.messages || [],
        max_tokens: opts.maxTokens
    }))
}));
vi.mock('../../services/metrics.service.js', () => ({
    buildLLMMetricLabel: vi.fn((provider, model) => `${provider}:${model}`),
    metrics: { trackLLMRequest: vi.fn() }
}));
vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn()
}));
vi.mock('../../utils/postgresHelpers.js', () => ({
    validatePromptSize: vi.fn(() => ({ valid: true }))
}));
vi.mock('../../services/security.service.js', () => ({
    securityLog: vi.fn(),
    LOG_LEVELS: { INFO: 'INFO' },
    SECURITY_EVENTS: { LLM_REQUEST: 'LLM_REQUEST' }
}));
vi.mock('../../services/retry.service.js', () => ({
    withRetry: vi.fn((fn) => fn()),
    getCircuitBreakerStates: vi.fn(() => ({ openai: { state: 'CLOSED', failures: 0 } }))
}));
vi.mock('../../services/llmPayloadCapabilities.service.js', () => ({
    buildCapabilityAwareOpenAICompatibleParams: vi.fn((_provider, model, options) => ({
        effectiveMaxTokens: options.maxTokens,
        requestParams: {
            model,
            messages: options.additionalParams?.messages || [],
            max_tokens: options.maxTokens
        },
        parameters: {
            ...(options.responseFormat ? { response_format: options.responseFormat } : {})
        }
    }))
}));
vi.mock('../../services/llmContent.service.js', () => ({
    extractOpenAIResponsesText: vi.fn((output = []) => output
        .flatMap((item) => item?.content || [])
        .filter((item) => item?.type === 'output_text')
        .map((item) => item.text)
        .join('')),
    flattenLlmTextContent: vi.fn((value) => {
        if (typeof value === 'string') return value;
        if (Array.isArray(value)) {
            return value.map((item) => item?.text || item?.content || '').filter(Boolean).join('\n');
        }
        return String(value || '');
    }),
    sanitizeOpenAICompatibleResponseBody: vi.fn((body) => ({
        ...body,
        choices: Array.isArray(body?.choices)
            ? body.choices.map((choice) => ({
                ...choice,
                message: choice?.message
                    ? {
                        ...choice.message,
                        content: String(choice.message.content || '').replace(/<think>[\s\S]*?<\/think>/gi, '')
                    }
                    : choice?.message
            }))
            : body?.choices
    }))
}));
vi.mock('../../services/llmModelCapabilities.service.js', () => ({
    clampModelMaxOutputTokens: vi.fn((_provider, _model, requested) => ({
        requestedMaxTokens: requested,
        effectiveMaxTokens: requested,
        providerCap: null,
        capabilities: {}
    }))
}));
const mockMarkModelUnavailable = vi.fn();
vi.mock('../../services/llmAvailability.service.js', () => ({
    markModelUnavailable: (...args) => mockMarkModelUnavailable(...args)
}));
vi.mock('../../services/llmConfiguration.service.js', () => ({
    inferProviderFallbackModel: vi.fn((_provider, model) => model === 'gpt-4o' ? 'gpt-4o-mini' : null)
}));

import axios from 'axios';
import { validatePromptSize } from '../../utils/postgresHelpers.js';
import { callOpenAI, callOpenAIWithCircuitBreaker, getOpenAICircuitBreakerStatus } from '../../services/openai/apiClient.js';

describe('OpenAI API Client', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('callOpenAI - validation', () => {
        it('should throw if model is missing', async () => {
            await expect(callOpenAI({
                messages: [{ role: 'user', content: 'hi' }]
            })).rejects.toThrow('Model is required');
        });

        it('should throw if messages is empty', async () => {
            await expect(callOpenAI({
                model: 'gpt-4o',
                messages: []
            })).rejects.toThrow('Messages array is required');
        });

        it('should throw if messages is not an array', async () => {
            await expect(callOpenAI({
                model: 'gpt-4o',
                messages: 'not array'
            })).rejects.toThrow('Messages array is required');
        });

        it('should throw if prompt is too large', async () => {
            validatePromptSize.mockReturnValueOnce({ valid: false, error: 'Too large', estimatedTokens: 999999 });

            await expect(callOpenAI({
                model: 'gpt-4o',
                messages: [{ role: 'user', content: 'hi' }]
            })).rejects.toThrow('Too large');
        });

        it('should validate structured prompt content using flattened text', async () => {
            validatePromptSize.mockReturnValueOnce({ valid: false, error: 'Visible\nNested', estimatedTokens: 42 });

            await expect(callOpenAI({
                model: 'gpt-4o',
                messages: [{ role: 'user', content: [{ type: 'text', text: 'Visible' }, { type: 'input_text', content: 'Nested' }] }]
            })).rejects.toThrow('Visible\nNested');

            expect(validatePromptSize).toHaveBeenCalledWith('Visible\nNested', 50000);
        });
    });

    describe('callOpenAI - standard models', () => {
        it('should call chat completions API for standard models', async () => {
            axios.post.mockResolvedValueOnce({
                status: 200,
                data: {
                    choices: [{ message: { role: 'assistant', content: 'hello' } }],
                    usage: { prompt_tokens: 5, completion_tokens: 10, total_tokens: 15 }
                }
            });

            const result = await callOpenAI({
                model: 'gpt-4o',
                messages: [{ role: 'user', content: 'hi' }]
            });

            expect(result.choices[0].message.content).toBe('hello');
            expect(axios.post).toHaveBeenCalledWith(
                expect.stringContaining('chat/completions'),
                expect.any(Object),
                expect.any(Object)
            );
        });

        it('should strip think markup from standard model responses', async () => {
            axios.post.mockResolvedValueOnce({
                status: 200,
                data: {
                    choices: [{ message: { role: 'assistant', content: '<think>draft</think>hello' } }],
                    usage: { prompt_tokens: 5, completion_tokens: 10, total_tokens: 15 }
                }
            });

            const result = await callOpenAI({
                model: 'gpt-4o',
                messages: [{ role: 'user', content: 'hi' }]
            });

            expect(result.choices[0].message.content).toBe('hello');
        });

        it('should throw on 4xx response', async () => {
            axios.post.mockResolvedValueOnce({
                status: 429,
                data: { error: { message: 'Rate limit exceeded' } }
            });

            await expect(callOpenAI({
                model: 'gpt-4o',
                messages: [{ role: 'user', content: 'hi' }]
            })).rejects.toThrow('Rate limit exceeded');
        });

        it('marks an OpenAI model unavailable on permission denial', async () => {
            axios.post.mockResolvedValueOnce({
                status: 403,
                data: { error: { message: 'You do not have access to this model' } }
            });

            await expect(callOpenAI({
                model: 'gpt-4o',
                messages: [{ role: 'user', content: 'hi' }]
            })).rejects.toThrow('You do not have access to this model');

            expect(mockMarkModelUnavailable).toHaveBeenCalledWith('openai', 'gpt-4o', 'provider_model_access_denied', 'gpt-4o-mini');
        });
    });

    describe('callOpenAI - GPT-5 models', () => {
        it('should use Responses API for GPT-5 models', async () => {
            axios.post.mockResolvedValueOnce({
                status: 200,
                data: {
                    id: 'resp-1',
                    status: 'completed',
                    output: [{
                        type: 'message',
                        content: [{ type: 'output_text', text: 'GPT-5 response' }]
                    }],
                    usage: { input_tokens: 5, output_tokens: 10, total_tokens: 15 }
                }
            });

            const result = await callOpenAI({
                model: 'gpt-5',
                messages: [{ role: 'user', content: 'hi' }]
            });

            expect(result.choices[0].message.content).toBe('GPT-5 response');
            expect(result.object).toBe('chat.completion');
            expect(axios.post).toHaveBeenCalledWith(
                expect.stringContaining('/responses'),
                expect.objectContaining({ model: 'gpt-5', input: expect.any(Array) }),
                expect.any(Object)
            );
        });

        it('should set reasoning effort to medium for GPT-5.4 pro models', async () => {
            axios.post.mockResolvedValueOnce({
                status: 200,
                data: {
                    id: 'resp-2',
                    status: 'completed',
                    output: [{ type: 'message', content: [{ type: 'output_text', text: 'ok' }] }],
                    usage: { input_tokens: 5, output_tokens: 10 }
                }
            });

            await callOpenAI({
                model: 'gpt-5.4-pro',
                messages: [{ role: 'user', content: 'hi' }]
            });

            const requestBody = axios.post.mock.calls[0][1];
            expect(requestBody.reasoning.effort).toBe('medium');
            expect(requestBody.temperature).toBeUndefined();
        });
    });

    describe('callOpenAIWithCircuitBreaker', () => {
        it('should wrap callOpenAI with retry', async () => {
            axios.post.mockResolvedValueOnce({
                status: 200,
                data: {
                    choices: [{ message: { content: 'ok' } }],
                    usage: { total_tokens: 10 }
                }
            });

            const result = await callOpenAIWithCircuitBreaker({
                model: 'gpt-4o',
                messages: [{ role: 'user', content: 'hi' }]
            });

            expect(result.choices[0].message.content).toBe('ok');
        });
    });

    describe('getOpenAICircuitBreakerStatus', () => {
        it('should return circuit breaker state', () => {
            const status = getOpenAICircuitBreakerStatus();
            expect(status.state).toBe('CLOSED');
        });
    });
});
