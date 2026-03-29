/**
 * Tests for LLM Service facade.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../services/settings.service.js', () => ({
    getLLMSettings: vi.fn()
}));

vi.mock('../../services/llmGateway.service.js', () => ({
    callProviderChat: vi.fn(),
    callProviderVision: vi.fn(),
    logGatewayCall: vi.fn()
}));

vi.mock('../../services/llmConfiguration.service.js', () => ({
    resolveLLMRuntimeConfig: vi.fn()
}));

import { getLLMSettings } from '../../services/settings.service.js';
import { callProviderChat, callProviderVision, logGatewayCall } from '../../services/llmGateway.service.js';
import { resolveLLMRuntimeConfig } from '../../services/llmConfiguration.service.js';
import {
    getTokenParameter,
    supportsCustomTemperature,
    buildOpenAIParams,
    callLLM,
    callLLMWithVision
} from '../../services/llm.service.js';

describe('LLM Service', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    describe('getTokenParameter', () => {
        it('should return max_completion_tokens for GPT-5 models', () => {
            expect(getTokenParameter('gpt-5', 1000)).toEqual({ max_completion_tokens: 1000 });
            expect(getTokenParameter('gpt-5.1-pro', 2000)).toEqual({ max_completion_tokens: 2000 });
        });

        it('should return max_tokens for older models', () => {
            expect(getTokenParameter('gpt-4o', 1000)).toEqual({ max_tokens: 1000 });
        });
    });

    describe('supportsCustomTemperature', () => {
        it('should return false for GPT-5 models', () => {
            expect(supportsCustomTemperature('gpt-5')).toBe(false);
        });

        it('should return true for other models', () => {
            expect(supportsCustomTemperature('gpt-4o')).toBe(true);
        });
    });

    describe('buildOpenAIParams', () => {
        it('should build params with correct token parameter', () => {
            const params = buildOpenAIParams('gpt-4o', {
                maxTokens: 1000,
                temperature: 0.7,
                topP: 0.9,
                additionalParams: { messages: [{ role: 'user', content: 'hi' }] }
            });

            expect(params).toEqual(expect.objectContaining({
                model: 'gpt-4o',
                max_tokens: 1000,
                temperature: 0.7,
                top_p: 0.9,
                messages: [{ role: 'user', content: 'hi' }]
            }));
        });
    });

    describe('callLLM', () => {
        it('delegates to the provider gateway with resolved runtime config', async () => {
            getLLMSettings.mockResolvedValueOnce({ llmProvider: 'openai', llmModel: 'gpt-4o' });
            resolveLLMRuntimeConfig.mockReturnValueOnce({ provider: 'openai', model: 'gpt-4o' });
            callProviderChat.mockResolvedValueOnce({ content: 'response' });

            const messages = [{ role: 'user', content: 'hello' }];
            const options = { temperature: 0.2, max_tokens: 256 };
            const result = await callLLM(messages, options);

            expect(result).toEqual({ content: 'response' });
            expect(resolveLLMRuntimeConfig).toHaveBeenCalledWith({ llmProvider: 'openai', llmModel: 'gpt-4o' });
            expect(logGatewayCall).toHaveBeenCalledWith(expect.objectContaining({
                provider: 'openai',
                model: 'gpt-4o',
                messageCount: 1,
                temperature: 0.2,
                maxTokens: 256
            }));
            expect(callProviderChat).toHaveBeenCalledWith({
                provider: 'openai',
                model: 'gpt-4o',
                messages,
                settings: { llmProvider: 'openai', llmModel: 'gpt-4o' },
                options
            });
        });
    });

    describe('callLLMWithVision', () => {
        it('delegates vision requests to the provider gateway with resolved runtime config', async () => {
            getLLMSettings.mockResolvedValueOnce({ llmProvider: 'anthropic', llmModel: 'claude-3-5-sonnet-20241022' });
            resolveLLMRuntimeConfig.mockReturnValueOnce({ provider: 'anthropic', model: 'claude-3-5-sonnet-20241022' });
            callProviderVision.mockResolvedValueOnce({ content: 'vision response' });

            const userContent = [
                { type: 'image_url', image_url: { url: 'data:image/png;base64,abc123' } },
                { type: 'text', text: 'what?' }
            ];
            const result = await callLLMWithVision('Describe', userContent, { max_tokens: 512 });

            expect(result).toEqual({ content: 'vision response' });
            expect(logGatewayCall).toHaveBeenCalledWith(expect.objectContaining({
                provider: 'anthropic',
                model: 'claude-3-5-sonnet-20241022',
                messageCount: 2,
                hasImages: true,
                vision: true
            }));
            expect(callProviderVision).toHaveBeenCalledWith({
                provider: 'anthropic',
                model: 'claude-3-5-sonnet-20241022',
                systemPrompt: 'Describe',
                userContent,
                settings: { llmProvider: 'anthropic', llmModel: 'claude-3-5-sonnet-20241022' },
                options: { max_tokens: 512 }
            });
        });
    });
});
