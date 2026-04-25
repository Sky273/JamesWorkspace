import { describe, expect, it, vi } from 'vitest';

vi.mock('../../services/llmAvailability.service.js', () => ({
    getProviderAvailabilityFlags: vi.fn(() => ({}))
}));

import {
    buildLlmAdminMetadata,
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

    it('keeps valid persisted sampling parameters even when runtime rules may later ignore them', () => {
        const sanitized = sanitizeLlmModelParameters({
            deepseek: {
                'deepseek-reasoner': {
                    temperature: 0,
                    top_p: 1,
                    max_tokens: 4096
                }
            }
        });

        expect(sanitized).toEqual({
            deepseek: {
                'deepseek-reasoner': {
                    temperature: 0,
                    top_p: 1,
                    max_tokens: 4096
                }
            }
        });
    });

    it('normalizes persisted token aliases without dropping sibling parameters', () => {
        const sanitized = sanitizeLlmModelParameters({
            openai: {
                'gpt-5.4': {
                    temperature: 0,
                    top_p: 1,
                    max_tokens: 2048
                }
            }
        });

        expect(sanitized).toEqual({
            openai: {
                'gpt-5.4': {
                    temperature: 0,
                    top_p: 1,
                    max_completion_tokens: 2048
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

    it('preserves saved parameters after reload while still applying runtime model rules', () => {
        const resolved = resolveEffectiveModelParameters({
            settings: {
                llmModelParameters: {
                    deepseek: {
                        'deepseek-reasoner': {
                            temperature: 0,
                            top_p: 1,
                            max_tokens: 4096
                        }
                    }
                }
            },
            provider: 'deepseek',
            model: 'deepseek-reasoner',
            overrides: {}
        });

        expect(resolved.persisted).toEqual({
            temperature: 0,
            top_p: 1,
            max_tokens: 4096
        });
        expect(resolved.parameters.max_tokens).toBe(4096);
    });

    it('exposes gpt-5.4-mini in the OpenAI model catalog', () => {
        const metadata = buildLlmAdminMetadata();

        expect(metadata.llmModelCatalog.openai).toEqual(
            expect.arrayContaining([
                { value: 'gpt-5.4-mini', label: 'gpt-5.4-mini' }
            ])
        );
    });

    it('exposes GPT-5.5 with reasoning controls in the OpenAI model catalog', () => {
        const metadata = buildLlmAdminMetadata();

        expect(metadata.llmModelCatalog.openai).toEqual(
            expect.arrayContaining([
                { value: 'gpt-5.5', label: 'gpt-5.5' }
            ])
        );
        expect(metadata.llmParameterDefinitions.openai['gpt-5.5']).toEqual(expect.objectContaining({
            reasoning_effort: expect.objectContaining({
                options: expect.arrayContaining([
                    { value: 'none', label: 'none' },
                    { value: 'xhigh', label: 'xhigh' }
                ]),
                defaultValue: 'none'
            }),
            max_completion_tokens: expect.objectContaining({
                max: 128000
            })
        }));
    });
});
