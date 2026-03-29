import { describe, expect, it } from 'vitest';

import {
    buildCapabilityAwareAnthropicOptions,
    buildCapabilityAwareOpenAICompatibleParams
} from '../../services/llmPayloadCapabilities.service.js';

describe('llmPayloadCapabilities.service', () => {
    it('drops response_format for MiniMax M2.x models', () => {
        const normalized = buildCapabilityAwareOpenAICompatibleParams('minimax', 'MiniMax-M2.7-highspeed', {
            maxTokens: 200000,
            temperature: 0.3,
            topP: 1,
            responseFormat: { type: 'json_object' },
            additionalParams: { messages: [{ role: 'user', content: 'Hello' }] }
        });

        expect(normalized.requestParams).not.toHaveProperty('response_format');
        expect(normalized.requestParams.max_completion_tokens).toBe(128000);
        expect(normalized.requestParams).not.toHaveProperty('max_tokens');
        expect(normalized.droppedParams).toContain('response_format');
    });

    it('uses max_completion_tokens for GPT-5.4', () => {
        const normalized = buildCapabilityAwareOpenAICompatibleParams('openai', 'gpt-5.4', {
            maxTokens: 200000,
            additionalParams: { messages: [{ role: 'user', content: 'Hello' }] }
        });

        expect(normalized.requestParams.max_completion_tokens).toBe(128000);
        expect(normalized.requestParams).not.toHaveProperty('max_tokens');
        expect(normalized.providerCap).toBe(128000);
    });

    it('keeps response_format for GLM-5.1 and clamps max_tokens to its provider limit', () => {
        const normalized = buildCapabilityAwareOpenAICompatibleParams('glm', 'glm-5.1', {
            maxTokens: 100000,
            responseFormat: { type: 'json_object' },
            additionalParams: { messages: [{ role: 'user', content: 'Hello' }] }
        });

        expect(normalized.requestParams.response_format).toEqual({ type: 'json_object' });
        expect(normalized.requestParams.max_tokens).toBe(65536);
        expect(normalized.providerCap).toBe(65536);
    });

    it('drops unsupported temperature for Anthropic models that disallow it', () => {
        const normalized = buildCapabilityAwareAnthropicOptions('anthropic', 'claude-opus-4-1-20250805', {
            maxTokens: 4000,
            temperature: 0.5,
            topP: 0.9
        });

        expect(normalized.temperature).toBeUndefined();
        expect(normalized.topP).toBeUndefined();
        expect(normalized.droppedParams).toEqual(expect.arrayContaining(['temperature', 'top_p']));
    });
});
