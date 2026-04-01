import { describe, expect, it, vi } from 'vitest';

vi.mock('../../services/llmAvailability.service.js', () => ({
    getProviderAvailabilityFlags: vi.fn(() => ({}))
}));

import {
    resolveEffectiveModelParameters,
    sanitizeLlmModelParameters
} from '../../services/llmAdminParameters.service.js';

describe('llmAdminParameters.service', () => {
    it('sanitizes and keeps JSON-compatible persisted parameters', () => {
        const sanitized = sanitizeLlmModelParameters({
            openai: {
                'gpt-4o': {
                    metadata: { domain: 'resume', revision: 2 },
                    stop: ['END'],
                    tools: [{ type: 'function', function: { name: 'score_resume' } }],
                    unsupported_key: 'drop-me'
                }
            }
        });

        expect(sanitized).toEqual({
            openai: {
                'gpt-4o': {
                    metadata: { domain: 'resume', revision: 2 },
                    stop: ['END'],
                    tools: [{ type: 'function', function: { name: 'score_resume' } }]
                }
            }
        });
    });

    it('merges persisted defaults and runtime overrides with canonical token normalization', () => {
        const resolved = resolveEffectiveModelParameters({
            settings: {
                llmModelParameters: {
                    openai: {
                        'gpt-5.4': {
                            reasoning_effort: 'high',
                            verbosity: 'low',
                            metadata: { feature: 'analysis' }
                        }
                    }
                }
            },
            provider: 'openai',
            model: 'gpt-5.4',
            overrides: {
                max_tokens: 999999,
                stop: ['END']
            }
        });

        expect(resolved.parameters.max_completion_tokens).toBe(128000);
        expect(resolved.parameters.reasoning_effort).toBe('high');
        expect(resolved.parameters.verbosity).toBe('low');
        expect(resolved.parameters.metadata).toEqual({ feature: 'analysis' });
        expect(resolved.parameters.stop).toEqual(['END']);
    });
});
