/**
 * Settings Service Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock postgresHelpers
vi.mock('../../utils/postgresHelpers.js', () => ({
    selectWithTimeout: vi.fn(),
    updateWithTimeout: vi.fn(),
    createWithTimeout: vi.fn()
}));

// Mock logger
vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn()
}));

const settingsCacheStore = new Map();
vi.mock('../../services/cache.service.js', () => ({
    CACHE_KEYS: {
        settings: {
            UI_SETTINGS: 'settings',
            LLM_SETTINGS: 'llm-settings'
        }
    },
    settingsCache: {
        get: vi.fn((key) => settingsCacheStore.has(key) ? settingsCacheStore.get(key) : null),
        set: vi.fn((key, value) => settingsCacheStore.set(key, value)),
        invalidate: vi.fn((key) => settingsCacheStore.delete(key)),
        size: vi.fn(() => settingsCacheStore.size),
        ttl: 60000,
        getStats: vi.fn(() => ({ name: 'settings', size: settingsCacheStore.size }))
    },
    invalidateSettingsCaches: vi.fn(() => {
        settingsCacheStore.delete('settings');
        settingsCacheStore.delete('llm-settings');
    })
}));

vi.mock('../../services/llmAvailability.service.js', () => ({
    resolveAvailableModel: vi.fn((_provider, model) => ({
        model,
        adjusted: false,
        reason: null,
        originalModel: model,
        fallbackModel: null
    })),
    getProviderAvailabilityFlags: vi.fn(() => ({
        minimax: { highspeedEnabled: false, runtimeUnavailableModels: [] }
    })),
    syncPersistedAvailabilityState: vi.fn()
}));

import { selectWithTimeout } from '../../utils/postgresHelpers.js';
import { resolveAvailableModel } from '../../services/llmAvailability.service.js';
import {
    getLLMSettings,
    getLLMModel,
    getLLMProvider,
    invalidateSettingsCache,
    getPrompts,
    calculateWeightedGlobalRating,
    getSettings,
    upsertSettings,
    createSettings
} from '../../services/settings.service.js';
import { updateWithTimeout, createWithTimeout } from '../../utils/postgresHelpers.js';

describe('Settings Service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        settingsCacheStore.clear();
        invalidateSettingsCache(); // Clear cache before each test
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('getLLMSettings', () => {
        it('should fetch settings from database', async () => {
            const dbSettings = {
                llm_model: 'gpt-4o',
                llm_provider: 'openai',
                cv_mode: 'nominative',
                analysis_prompt: 'Analyze this CV',
                improvement_prompt: 'Improve this CV',
                executive_summary_weight: 20,
                skills_weight: 20,
                experience_weight: 20,
                education_weight: 15,
                ats_weight: 15,
                hobbies_languages_weight: 10,
                profile_matching_local_skill_weight: 9
            };
            selectWithTimeout.mockResolvedValueOnce([dbSettings]);
            
            const result = await getLLMSettings();
            
            expect(result.llmModel).toBe('gpt-4o');
            expect(result.llmProvider).toBe('openai');
            expect(result['Profile Matching Local Skill Weight']).toBe(9);
            expect(selectWithTimeout).toHaveBeenCalledWith('llm_settings', expect.objectContaining({
                where: 'settings_key = $1',
                params: ['default'],
                limit: 1
            }));
        });

        it('should return empty object if no settings exist', async () => {
            selectWithTimeout
                .mockResolvedValueOnce([])
                .mockResolvedValueOnce([]);
            
            const result = await getLLMSettings();
            
            expect(result).toEqual({});
        });

        it('should auto-promote the latest legacy settings row to canonical when settings_key is missing', async () => {
            selectWithTimeout
                .mockResolvedValueOnce([])
                .mockResolvedValueOnce([{
                    id: 'legacy-1',
                    name: 'Legacy Settings',
                    status: 'inactive',
                    llm_model: 'gpt-4o'
                }]);
            updateWithTimeout.mockResolvedValueOnce({
                id: 'legacy-1',
                settings_key: 'default',
                name: 'Legacy Settings',
                status: 'inactive',
                llm_model: 'gpt-4o'
            });

            const result = await getLLMSettings();

            expect(updateWithTimeout).toHaveBeenCalledWith('llm_settings', 'legacy-1', expect.objectContaining({
                settings_key: 'default',
                name: 'Legacy Settings',
                status: 'inactive'
            }));
            expect(result.llmModel).toBe('gpt-4o');
        });

        it('should normalize configured models with the provider default fallback', async () => {
            selectWithTimeout.mockResolvedValueOnce([{
                llm_model: 'glm-5.1',
                llm_provider: 'glm'
            }]);

            await getLLMSettings();

            expect(resolveAvailableModel).toHaveBeenCalledWith('glm', 'glm-5.1', 'glm-5.1');
        });

        it('should use cache on subsequent calls', async () => {
            const dbSettings = {
                llm_model: 'gpt-4o',
                llm_provider: 'openai'
            };
            selectWithTimeout.mockResolvedValueOnce([dbSettings]);
            
            // First call - fetches from DB
            await getLLMSettings();
            // Second call - should use cache
            await getLLMSettings();
            
            // Should only call DB once
            expect(selectWithTimeout).toHaveBeenCalledTimes(1);
        });

        it('should return cached settings on database error', async () => {
            const dbSettings = { llm_model: 'gpt-4o' };
            selectWithTimeout.mockResolvedValueOnce([dbSettings]);
            
            // First call - populate cache
            await getLLMSettings();
            
            // Invalidate and cause error
            invalidateSettingsCache();
            selectWithTimeout.mockRejectedValueOnce(new Error('DB error'));
            
            // Should return empty object (no cache after invalidation)
            const result = await getLLMSettings();
            expect(result).toEqual({});
        });
    });

    describe('getLLMModel', () => {
        it('should return configured model', async () => {
            selectWithTimeout.mockResolvedValueOnce([{ llm_model: 'claude-3-5-sonnet' }]);
            
            const result = await getLLMModel();
            
            expect(result).toBe('claude-3-5-sonnet');
        });

        it('should return default model if not configured', async () => {
            selectWithTimeout.mockResolvedValueOnce([{}]);
            
            const result = await getLLMModel();
            
            expect(result).toBe('gpt-4o');
        });
    });

    describe('getLLMProvider', () => {
        it('should return configured provider', async () => {
            selectWithTimeout.mockResolvedValueOnce([{ llm_provider: 'anthropic' }]);
            
            const result = await getLLMProvider();
            
            expect(result).toBe('anthropic');
        });

        it('should return default provider if not configured', async () => {
            selectWithTimeout.mockResolvedValueOnce([{}]);
            
            const result = await getLLMProvider();
            
            expect(result).toBe('openai');
        });
    });

    describe('getPrompts', () => {
        it('should return all prompts', async () => {
            selectWithTimeout.mockResolvedValueOnce([{
                analysis_prompt: 'Analyze prompt',
                improvement_prompt: 'Improve prompt',
                match_analysis_prompt: 'Match prompt',
                adaptation_prompt: 'Adapt prompt'
            }]);
            
            const result = await getPrompts();
            
            expect(result.analysis).toBe('Analyze prompt');
            expect(result.improvement).toBe('Improve prompt');
            expect(result.matchAnalysis).toBe('Match prompt');
            expect(result.adaptation).toBe('Adapt prompt');
        });
    });

    describe('calculateWeightedGlobalRating', () => {
        it('should calculate weighted average of scores', async () => {
            selectWithTimeout.mockResolvedValueOnce([{
                executive_summary_weight: 20,
                skills_weight: 20,
                experience_weight: 20,
                education_weight: 15,
                ats_weight: 15,
                hobbies_languages_weight: 10
            }]);
            
            const analysis = {
                'Executive Summary Rating': 80,
                'Skills Rating': 90,
                'Experience Rating': 85,
                'Education Rating': 70,
                'ATS Rating': 88,
                'Hobbies Languages Rating': 60
            };
            
            const result = await calculateWeightedGlobalRating(analysis);
            
            expect(result.globalRating).toBeDefined();
        });

        it('should handle missing ratings', async () => {
            selectWithTimeout.mockResolvedValueOnce([{
                executive_summary_weight: 20,
                skills_weight: 20,
                experience_weight: 20,
                education_weight: 15,
                ats_weight: 15,
                hobbies_languages_weight: 10
            }]);
            
            const analysis = {
                'Executive Summary Rating': 80
                // Other ratings missing
            };
            
            const result = await calculateWeightedGlobalRating(analysis);
            
            expect(result.globalRating).toBeDefined();
        });
    });

    describe('invalidateSettingsCache', () => {
        it('should clear the cache', async () => {
            selectWithTimeout.mockResolvedValueOnce([{ llm_model: 'gpt-4o' }]);
            
            // Populate cache
            await getLLMSettings();
            
            // Invalidate
            invalidateSettingsCache();
            
            // Next call should fetch from DB again
            selectWithTimeout.mockResolvedValueOnce([{ llm_model: 'claude-3-5-sonnet' }]);
            const result = await getLLMSettings();
            
            expect(result.llmModel).toBe('claude-3-5-sonnet');
            expect(selectWithTimeout).toHaveBeenCalledTimes(2);
        });
    });

    describe('canonical persistence', () => {
        it('should return the canonical settings record', async () => {
            selectWithTimeout.mockResolvedValueOnce([{ id: 'set-1', settings_key: 'default' }]);

            const result = await getSettings();

            expect(result).toEqual({ id: 'set-1', settings_key: 'default' });
            expect(selectWithTimeout).toHaveBeenCalledWith('llm_settings', expect.objectContaining({
                where: 'settings_key = $1',
                params: ['default'],
                limit: 1
            }));
        });

        it('should upsert against the canonical settings record even if a stale id is provided', async () => {
            selectWithTimeout.mockResolvedValueOnce([{ id: 'canonical-1', settings_key: 'default' }]);
            updateWithTimeout.mockResolvedValueOnce([{ id: 'canonical-1', llm_model: 'gpt-4o' }]);

            const result = await upsertSettings('stale-id', { llm_model: 'gpt-4o' });

            expect(updateWithTimeout).toHaveBeenCalledWith('llm_settings', [{ id: 'canonical-1', fields: expect.objectContaining({
                settings_key: 'default',
                name: 'Default Settings',
                status: 'active',
                llm_model: 'gpt-4o'
            }) }]);
            expect(result).toEqual({ id: 'canonical-1', llm_model: 'gpt-4o' });
        });

        it('should create the canonical settings record when none exists', async () => {
            selectWithTimeout
                .mockResolvedValueOnce([])
                .mockResolvedValueOnce([]);
            createWithTimeout.mockResolvedValueOnce({ id: 'canonical-1', settings_key: 'default' });

            const result = await createSettings({ llm_model: 'gpt-4o' });

            expect(createWithTimeout).toHaveBeenCalledWith('llm_settings', {
                fields: expect.objectContaining({
                    settings_key: 'default',
                    name: 'Default Settings',
                    status: 'active',
                    llm_model: 'gpt-4o'
                })
            });
            expect(result).toEqual({ id: 'canonical-1', settings_key: 'default' });
        });
    });
});
