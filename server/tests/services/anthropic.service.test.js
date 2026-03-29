import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('axios');
vi.mock('../../config/constants.js', () => ({
    ANTHROPIC_API_KEY: 'anthropic-test-key'
}));
vi.mock('../../services/metrics.service.js', () => ({
    buildLLMMetricLabel: vi.fn((provider, model) => `${provider}:${model}`),
    metrics: { trackLLMRequest: vi.fn() }
}));
vi.mock('../../services/llmContent.service.js', () => ({
    extractTextFromContentBlocks: vi.fn(() => 'ok')
}));
vi.mock('../../services/llmProviderCommon.service.js', () => ({
    normalizeAnthropicContent: vi.fn((content) => [{ type: 'text', text: String(content) }])
}));
vi.mock('../../services/llmPayloadCapabilities.service.js', () => ({
    buildCapabilityAwareAnthropicOptions: vi.fn((_provider, _model, options) => ({
        effectiveMaxTokens: options.maxTokens || options.fallbackMaxTokens || 1000
    }))
}));

const mockMarkModelUnavailable = vi.fn();
vi.mock('../../services/llmAvailability.service.js', () => ({
    markModelUnavailable: (...args) => mockMarkModelUnavailable(...args)
}));

import axios from 'axios';
import { callAnthropicChat } from '../../services/anthropic.service.js';

describe('anthropic.service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('marks an Anthropic model unavailable on permission denial', async () => {
        axios.post.mockRejectedValueOnce({
            response: {
                status: 403,
                data: {
                    error: {
                        message: 'Model access denied'
                    }
                }
            },
            message: 'Model access denied'
        });

        await expect(callAnthropicChat(
            [{ role: 'user', content: 'hello' }],
            'claude-sonnet-4-20250514'
        )).rejects.toThrow('Model access denied');

        expect(mockMarkModelUnavailable).toHaveBeenCalledWith('anthropic', 'claude-sonnet-4-20250514', 'provider_model_access_denied', null);
    });
});
