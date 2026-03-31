import { describe, it, expect } from 'vitest';

import {
    buildCircuitBreakerIndicators,
    buildOpenAIProxyRequest,
    extractUsageTokens,
    getRequestedMaxTokens,
    normalizeCircuitBreakerIndicator,
    validateMessageLengths
} from '../../routes/llmRouteHelpers.js';

describe('llmRouteHelpers', () => {
    it('normalizes circuit breaker indicators across providers', () => {
        expect(normalizeCircuitBreakerIndicator('openai', { state: 'CLOSED', failures: 2, lastFailureTime: 123 }))
            .toEqual({
                provider: 'openai',
                supported: true,
                state: 'CLOSED',
                failures: 2,
                lastFailureTime: 123
            });

        expect(normalizeCircuitBreakerIndicator('ollama')).toEqual({
            provider: 'ollama',
            supported: false,
            state: 'NOT_APPLICABLE',
            failures: 0,
            lastFailureTime: null
        });
    });

    it('builds circuit breaker indicator map with defaults', () => {
        const indicators = buildCircuitBreakerIndicators({
            openai: { state: 'OPEN', failures: 1, lastFailureTime: 42 },
            minimax: 'half_open'
        });

        expect(indicators.openai.state).toBe('OPEN');
        expect(indicators.minimax.state).toBe('HALF_OPEN');
        expect(indicators.deepseek.state).toBe('UNKNOWN');
        expect(indicators.ollama.state).toBe('NOT_APPLICABLE');
    });

    it('validates message lengths with injected flattener', () => {
        const flatten = (content) => Array.isArray(content) ? content.map((entry) => entry.text).join('') : content;

        expect(validateMessageLengths([{ content: 'short' }], flatten, 10)).toBeNull();
        expect(validateMessageLengths([{ content: 'too long here' }], flatten, 5))
            .toBe('Message content exceeds maximum length of 5');
    });

    it('returns requested max tokens with fallback priority', () => {
        expect(getRequestedMaxTokens({ max_tokens: 123 })).toBe(123);
        expect(getRequestedMaxTokens({ max_completion_tokens: 456 })).toBe(456);
        expect(getRequestedMaxTokens({ max_output_tokens: 789 })).toBe(789);
        expect(getRequestedMaxTokens({})).toBe(4096);
    });

    it('builds OpenAI chat completions request for non GPT-5 models', () => {
        const result = buildOpenAIProxyRequest({
            model: 'gpt-4o',
            body: { messages: [{ role: 'user', content: 'Hello' }], temperature: 0.2 },
            allowResponsesApi: true
        });

        expect(result).toEqual({
            openAiUrl: 'https://api.openai.com/v1/chat/completions',
            requestBody: {
                messages: [{ role: 'user', content: 'Hello' }],
                temperature: 0.2,
                model: 'gpt-4o'
            },
            usesResponsesApi: false
        });
    });

    it('builds OpenAI responses request for GPT-5 models', () => {
        const result = buildOpenAIProxyRequest({
            model: 'gpt-5.4',
            body: {
                messages: [{ role: 'user', content: 'Hello' }],
                response_format: { type: 'json_schema' },
                max_tokens: 300,
                temperature: 0.5
            },
            allowResponsesApi: true
        });

        expect(result.openAiUrl).toBe('https://api.openai.com/v1/responses');
        expect(result.usesResponsesApi).toBe(true);
        expect(result.requestBody).toMatchObject({
            model: 'gpt-5.4',
            input: [{ role: 'user', content: 'Hello' }],
            text: { format: { type: 'json_schema' } },
            max_output_tokens: 300,
            reasoning: { effort: 'none' },
            temperature: 0.5
        });
    });

    it('extracts usage tokens from both Responses and Chat usage formats', () => {
        expect(extractUsageTokens({
            input_tokens: 10,
            output_tokens: 3,
            total_tokens: 13
        })).toEqual({
            inputTokens: 10,
            outputTokens: 3,
            totalTokens: 13
        });

        expect(extractUsageTokens({
            prompt_tokens: 7,
            completion_tokens: 2
        })).toEqual({
            inputTokens: 7,
            outputTokens: 2,
            totalTokens: 9
        });
    });
});
