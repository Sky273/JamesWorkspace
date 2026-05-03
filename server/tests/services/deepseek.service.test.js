import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('axios');
vi.mock('../../config/constants.js', () => ({
    DEEPSEEK_API_KEY: 'deepseek-test-key',
    DEEPSEEK_BASE_URL: 'https://api.deepseek.com/v1',
    MAX_PROMPT_LENGTH: 50000,
    LLM_OPERATION_TIMEOUT_MS: 15 * 60 * 1000
}));
vi.mock('../../services/llmPayloadCapabilities.service.js', () => ({
    buildCapabilityAwareOpenAICompatibleParams: vi.fn((_provider, _model, options) => ({
        requestParams: {
            model: _model,
            messages: options.additionalParams.messages,
            max_tokens: options.maxTokens
        }
    }))
}));
vi.mock('../../services/llmContent.service.js', () => ({
    extractDeepSeekContent: vi.fn(() => 'ok'),
    flattenLlmTextContent: vi.fn((value) => typeof value === 'string' ? value : JSON.stringify(value)),
    sanitizeOpenAICompatibleResponseBody: vi.fn((data) => data)
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
    getCircuitBreakerStates: vi.fn(() => ({ deepseek: { state: 'CLOSED', failures: 0 } }))
}));
vi.mock('../../services/llmModelCapabilities.service.js', () => ({
    clampModelMaxOutputTokens: vi.fn((_provider, _model, requested, fallbackCap) => ({
        requestedMaxTokens: requested,
        effectiveMaxTokens: requested,
        providerCap: fallbackCap
    }))
}));

const mockMarkModelUnavailable = vi.fn();
vi.mock('../../services/llmAvailability.service.js', () => ({
    markModelUnavailable: (...args) => mockMarkModelUnavailable(...args)
}));

import axios from 'axios';
import { callDeepSeek } from '../../services/deepseek.service.js';

describe('deepseek.service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('marks a DeepSeek model unavailable on permission denial', async () => {
        axios.post.mockResolvedValueOnce({
            status: 403,
            data: { error: { message: 'You do not have permission to access this model' } }
        });

        await expect(callDeepSeek({
            model: 'deepseek-reasoner',
            messages: [{ role: 'user', content: 'hello' }]
        })).rejects.toThrow('You do not have permission to access this model');

        expect(mockMarkModelUnavailable).toHaveBeenCalledWith('deepseek', 'deepseek-reasoner', 'provider_model_access_denied', 'deepseek-v4-flash');
    });
});
