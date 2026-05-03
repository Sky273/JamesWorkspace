import { describe, expect, it, vi } from 'vitest';

vi.mock('../../services/llmAvailability.service.js', () => ({
    resolveAvailableModel: vi.fn((_provider, model) => ({ model }))
}));

import {
    getProviderDefaultModel,
    inferProviderFallbackModel,
    resolveLLMModel
} from '../../services/llmConfiguration.service.js';

describe('llmConfiguration.service', () => {
    it('uses DeepSeek v4 flash as the provider default model', () => {
        expect(getProviderDefaultModel('deepseek')).toBe('deepseek-v4-flash');
    });

    it('falls back from DeepSeek v4 pro to v4 flash and legacy reasoner to v4 flash', () => {
        expect(inferProviderFallbackModel('deepseek', 'deepseek-v4-pro')).toBe('deepseek-v4-flash');
        expect(inferProviderFallbackModel('deepseek', 'deepseek-reasoner')).toBe('deepseek-v4-flash');
    });

    it('resolves DeepSeek to the new default model when no explicit model is configured', () => {
        expect(resolveLLMModel({
            provider: 'deepseek',
            settings: { llmProvider: 'deepseek' }
        })).toBe('deepseek-v4-flash');
    });
});
