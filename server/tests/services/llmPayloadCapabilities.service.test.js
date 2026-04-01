import { describe, expect, it } from 'vitest';

import {
    buildCapabilityAwareAnthropicOptions,
    buildCapabilityAwareOpenAICompatibleParams,
    normalizeGenerationOptions
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
        expect(normalized.requestParams.max_completion_tokens).toBe(200000);
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
            maxTokens: 200000,
            responseFormat: { type: 'json_object' },
            additionalParams: { messages: [{ role: 'user', content: 'Hello' }] }
        });

        expect(normalized.requestParams.response_format).toEqual({ type: 'json_object' });
        expect(normalized.requestParams.max_tokens).toBe(131072);
        expect(normalized.providerCap).toBe(131072);
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

    it('drops sampling controls for GPT-5.1 when reasoning effort is enabled', () => {
        const normalized = buildCapabilityAwareOpenAICompatibleParams('openai', 'gpt-5.1', {
            parameters: {
                reasoning_effort: 'medium',
                temperature: 0.4,
                top_p: 0.8,
                logprobs: true
            },
            additionalParams: { messages: [{ role: 'user', content: 'Hello' }] }
        });

        expect(normalized.requestParams.reasoning_effort).toBe('medium');
        expect(normalized.requestParams).not.toHaveProperty('temperature');
        expect(normalized.requestParams).not.toHaveProperty('top_p');
        expect(normalized.requestParams).not.toHaveProperty('logprobs');
        expect(normalized.droppedParams).toEqual(expect.arrayContaining(['temperature', 'top_p', 'logprobs']));
    });

    it('drops unsupported controls for DeepSeek reasoner', () => {
        const normalized = buildCapabilityAwareOpenAICompatibleParams('deepseek', 'deepseek-reasoner', {
            parameters: {
                temperature: 0.2,
                top_p: 0.8,
                presence_penalty: 1,
                response_format: { type: 'json_object' }
            },
            additionalParams: { messages: [{ role: 'user', content: 'Hello' }] }
        });

        expect(normalized.requestParams).not.toHaveProperty('temperature');
        expect(normalized.requestParams).not.toHaveProperty('top_p');
        expect(normalized.requestParams).not.toHaveProperty('presence_penalty');
        expect(normalized.requestParams.response_format).toEqual({ type: 'json_object' });
    });

    it('keeps structured JSON-compatible parameters for OpenAI-compatible providers', () => {
        const normalized = buildCapabilityAwareOpenAICompatibleParams('openai', 'gpt-4o', {
            parameters: {
                metadata: { feature: 'resume-analysis', revision: 3 },
                stop: ['END', 'STOP'],
                tools: [{ type: 'function', function: { name: 'score_resume' } }],
                tool_choice: 'auto',
                parallel_tool_calls: false
            },
            additionalParams: { messages: [{ role: 'user', content: 'Hello' }] }
        });

        expect(normalized.requestParams.metadata).toEqual({ feature: 'resume-analysis', revision: 3 });
        expect(normalized.requestParams.stop).toEqual(['END', 'STOP']);
        expect(normalized.requestParams.tools).toEqual([{ type: 'function', function: { name: 'score_resume' } }]);
        expect(normalized.requestParams.tool_choice).toBe('auto');
        expect(normalized.requestParams.parallel_tool_calls).toBe(false);
    });

    it('normalizes Ollama parameters and keeps only supported runtime options', () => {
        const normalized = normalizeGenerationOptions('ollama', '__default__', {
            parameters: {
                temperature: 0.6,
                top_k: 20,
                stop: 'END',
                num_ctx: 8192,
                metadata: { shouldBeDropped: true }
            }
        });

        expect(normalized.parameters).toEqual({
            temperature: 0.6,
            top_k: 20,
            stop: ['END'],
            num_ctx: 8192
        });
        expect(normalized.droppedParams).toContain('metadata');
    });

    it('restricts GLM tool_choice to auto', () => {
        const normalized = buildCapabilityAwareOpenAICompatibleParams('glm', 'glm-5', {
            parameters: {
                tool_choice: { type: 'function', function: { name: 'score_resume' } }
            },
            additionalParams: { messages: [{ role: 'user', content: 'Hello' }] }
        });

        expect(normalized.requestParams).not.toHaveProperty('tool_choice');
        expect(normalized.droppedParams).toContain('tool_choice');
    });
});
