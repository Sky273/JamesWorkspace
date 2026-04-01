import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../config/constants.js', () => ({
    GLM_API_KEY: 'test-key',
    GLM_BASE_URL: 'https://api.z.ai/api/paas/v4',
    MAX_PROMPT_LENGTH: 100000
}));

const mockPost = vi.fn();
vi.mock('axios', () => ({
    default: {
        post: (...args) => mockPost(...args)
    }
}));

vi.mock('../../services/llmPayloadCapabilities.service.js', () => ({
    buildCapabilityAwareOpenAICompatibleParams: vi.fn((_provider, _model, params) => ({
        requestParams: {
            model: params.additionalParams?.model,
            messages: params.additionalParams?.messages,
            max_tokens: params.maxTokens
        }
    }))
}));

vi.mock('../../services/llmContent.service.js', () => ({
    flattenLlmTextContent: (content) => String(content || ''),
    sanitizeOpenAICompatibleResponseBody: (body) => body
}));

vi.mock('../../services/metrics.service.js', () => ({
    buildLLMMetricLabel: vi.fn(() => 'glm:glm-5.1'),
    metrics: {
        trackLLMRequest: vi.fn()
    }
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
    withRetry: (fn) => fn(),
    getCircuitBreakerStates: () => ({})
}));

vi.mock('../../services/llmModelCapabilities.service.js', () => ({
    clampModelMaxOutputTokens: vi.fn((_provider, _model, maxTokens) => ({
        requestedMaxTokens: maxTokens,
        effectiveMaxTokens: maxTokens,
        providerCap: maxTokens
    }))
}));

const mockMarkModelUnavailable = vi.fn();
vi.mock('../../services/llmAvailability.service.js', () => ({
    markModelUnavailable: (...args) => mockMarkModelUnavailable(...args)
}));

import { callGLM } from '../../services/glm.service.js';

describe('glm.service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('marks glm-5.1 unavailable after a 403 permission denial', async () => {
        const error = new Error('You do not have permission to access glm-5.1');
        error.response = {
            status: 403,
            data: {
                error: {
                    message: 'You do not have permission to access glm-5.1'
                }
            }
        };
        mockPost.mockRejectedValueOnce(error);
        mockMarkModelUnavailable.mockResolvedValueOnce(undefined);

        await expect(callGLM({
            model: 'glm-5.1',
            messages: [{ role: 'user', content: 'Hello' }]
        })).rejects.toThrow('You do not have permission to access glm-5.1');

        expect(mockMarkModelUnavailable).toHaveBeenCalledWith('glm', 'glm-5.1', 'glm_model_access_denied', 'glm-5');
    });
});
