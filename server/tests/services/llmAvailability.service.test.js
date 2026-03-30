import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../config/constants.js', () => ({
    MINIMAX_ENABLE_HIGHSPEED_MODELS: false,
    LLM_RUNTIME_UNAVAILABLE_TTL_MS: 21600000
}));

const mockSelectWithTimeout = vi.fn();
const mockUpdateWithTimeout = vi.fn();
const mockCreateWithTimeout = vi.fn();
const mockInvalidateSettingsCache = vi.fn();
const mockInvalidateSettingsCaches = vi.fn();
const mockSafeLog = vi.fn();

vi.mock('../../utils/postgresHelpers.js', () => ({
    selectWithTimeout: (...args) => mockSelectWithTimeout(...args),
    updateWithTimeout: (...args) => mockUpdateWithTimeout(...args),
    createWithTimeout: (...args) => mockCreateWithTimeout(...args)
}));

vi.mock('../../services/settings.service.js', () => ({
    invalidateSettingsCache: (...args) => mockInvalidateSettingsCache(...args)
}));

vi.mock('../../services/cache.service.js', () => ({
    invalidateSettingsCaches: (...args) => mockInvalidateSettingsCaches(...args)
}));

vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: (...args) => mockSafeLog(...args)
}));

import {
    getModelAvailability,
    getProviderAvailabilityFlags,
    initializeLLMAvailabilityState,
    markModelUnavailable,
    resetModelAvailabilityState,
    resolveAvailableModel,
    syncPersistedAvailabilityState
} from '../../services/llmAvailability.service.js';

describe('llmAvailability.service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        resetModelAvailabilityState();
    });

    it('marks MiniMax highspeed models unavailable by default', () => {
        expect(getModelAvailability('minimax', 'MiniMax-M2.7-highspeed')).toEqual({
            available: false,
            reason: 'minimax_highspeed_plan_required',
            fallbackModel: 'MiniMax-M2.7'
        });
    });

    it('resolves unavailable MiniMax highspeed models to their standard variant', () => {
        const result = resolveAvailableModel('minimax', 'MiniMax-M2.7-highspeed', 'MiniMax-M2.7');

        expect(result.model).toBe('MiniMax-M2.7');
        expect(result.adjusted).toBe(true);
        expect(result.reason).toBe('minimax_highspeed_plan_required');
    });

    it('exposes provider availability flags', () => {
        expect(getProviderAvailabilityFlags()).toEqual(expect.objectContaining({
            minimax: {
                highspeedEnabled: false,
                runtimeUnavailableModels: []
            },
            glm: {
                runtimeUnavailableModels: []
            }
        }));
    });

    it('marks runtime-unavailable MiniMax models as unavailable', () => {
        syncPersistedAvailabilityState({
            minimax: {
                runtimeUnavailableModels: [{
                    model: 'MiniMax-M2.7-highspeed',
                    reason: 'minimax_highspeed_runtime_unavailable',
                    fallbackModel: 'MiniMax-M2.7'
                }]
            }
        });

        expect(getModelAvailability('minimax', 'MiniMax-M2.7-highspeed')).toEqual({
            available: false,
            reason: 'minimax_highspeed_runtime_unavailable',
            fallbackModel: 'MiniMax-M2.7'
        });
    });

    it('loads persisted availability state from llm_settings', async () => {
        mockSelectWithTimeout.mockResolvedValueOnce([{
            llm_availability_state: {
                minimax: {
                    runtimeUnavailableModels: [{
                        model: 'MiniMax-M2.7-highspeed',
                        reason: 'minimax_highspeed_runtime_unavailable',
                        fallbackModel: 'MiniMax-M2.7'
                    }]
                }
            }
        }]);

        await initializeLLMAvailabilityState();

        expect(mockSelectWithTimeout).toHaveBeenCalledWith('llm_settings', expect.objectContaining({
            where: 'settings_key = $1',
            params: ['default'],
            limit: 1
        }));

        expect(getProviderAvailabilityFlags()).toEqual(expect.objectContaining({
            minimax: {
                highspeedEnabled: false,
                runtimeUnavailableModels: ['MiniMax-M2.7-highspeed']
            }
        }));
    });

    it('retries loading persisted availability state after a transient initialization failure', async () => {
        mockSelectWithTimeout
            .mockRejectedValueOnce(new Error('temporary db failure'))
            .mockResolvedValueOnce([{
                llm_availability_state: {
                    minimax: {
                        runtimeUnavailableModels: [{
                            model: 'MiniMax-M2.7-highspeed',
                            reason: 'minimax_highspeed_runtime_unavailable',
                            fallbackModel: 'MiniMax-M2.7'
                        }]
                    }
                }
            }]);

        await initializeLLMAvailabilityState();
        expect(getProviderAvailabilityFlags()).toEqual(expect.objectContaining({
            minimax: {
                highspeedEnabled: false,
                runtimeUnavailableModels: []
            }
        }));

        await initializeLLMAvailabilityState();
        expect(getProviderAvailabilityFlags()).toEqual(expect.objectContaining({
            minimax: {
                highspeedEnabled: false,
                runtimeUnavailableModels: ['MiniMax-M2.7-highspeed']
            }
        }));
    });

    it('persists runtime-unavailable models after marking them', async () => {
        mockSelectWithTimeout
            .mockResolvedValueOnce([{ id: 'settings-1' }]);
        mockUpdateWithTimeout.mockResolvedValueOnce({ id: 'settings-1' });

        await markModelUnavailable('minimax', 'MiniMax-M2.7-highspeed', 'minimax_highspeed_runtime_unavailable', 'MiniMax-M2.7');

        expect(mockUpdateWithTimeout).toHaveBeenCalledWith('llm_settings', 'settings-1', expect.objectContaining({
            settings_key: 'default',
            name: 'Default Settings',
            status: 'active',
            llm_availability_state: expect.objectContaining({
                minimax: {
                    runtimeUnavailableModels: [expect.objectContaining({
                        model: 'MiniMax-M2.7-highspeed',
                        reason: 'minimax_highspeed_runtime_unavailable',
                        fallbackModel: 'MiniMax-M2.7',
                        markedAt: expect.any(String),
                        expiresAt: expect.any(String)
                    })]
                }
            })
        }));
        expect(mockCreateWithTimeout).not.toHaveBeenCalled();
        expect(mockInvalidateSettingsCache).toHaveBeenCalled();
        expect(mockInvalidateSettingsCaches).toHaveBeenCalled();
    });

    it('promotes the latest legacy settings row when persisting availability state without a canonical key', async () => {
        mockSelectWithTimeout
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([{ id: 'legacy-1' }]);
        mockUpdateWithTimeout.mockResolvedValueOnce({ id: 'legacy-1' });

        await markModelUnavailable('glm', 'glm-5.1', 'glm_model_access_denied', 'glm-5');

        expect(mockUpdateWithTimeout).toHaveBeenCalledWith('llm_settings', 'legacy-1', expect.objectContaining({
            settings_key: 'default',
            name: 'Default Settings',
            status: 'active',
            llm_availability_state: expect.objectContaining({
                glm: {
                    runtimeUnavailableModels: [expect.objectContaining({
                        model: 'glm-5.1',
                        reason: 'glm_model_access_denied',
                        fallbackModel: 'glm-5'
                    })]
                }
            })
        }));
    });

    it('creates the canonical settings record when persisting availability state without any existing settings row', async () => {
        mockSelectWithTimeout
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([]);
        mockCreateWithTimeout.mockResolvedValueOnce({ id: 'settings-1' });

        await markModelUnavailable('minimax', 'MiniMax-M2.7-highspeed', 'minimax_highspeed_runtime_unavailable', 'MiniMax-M2.7');

        expect(mockCreateWithTimeout).toHaveBeenCalledWith('llm_settings', {
            fields: expect.objectContaining({
                settings_key: 'default',
                name: 'Default Settings',
                status: 'active',
                llm_availability_state: expect.objectContaining({
                    minimax: {
                        runtimeUnavailableModels: [expect.objectContaining({
                            model: 'MiniMax-M2.7-highspeed',
                            reason: 'minimax_highspeed_runtime_unavailable',
                            fallbackModel: 'MiniMax-M2.7',
                            markedAt: expect.any(String),
                            expiresAt: expect.any(String)
                        })]
                    }
                })
            })
        });
    });

    it('tracks runtime-unavailable GLM models generically', async () => {
        mockSelectWithTimeout
            .mockResolvedValueOnce([{ id: 'settings-1' }]);
        mockUpdateWithTimeout.mockResolvedValueOnce({ id: 'settings-1' });

        await markModelUnavailable('glm', 'glm-5.1', 'glm_model_access_denied', 'glm-5');

        expect(getModelAvailability('glm', 'glm-5.1')).toEqual({
            available: false,
            reason: 'glm_model_access_denied',
            fallbackModel: 'glm-5'
        });
        expect(getProviderAvailabilityFlags()).toEqual(expect.objectContaining({
            glm: {
                runtimeUnavailableModels: ['glm-5.1']
            }
        }));
    });

    it('ignores expired runtime-unavailable entries from persisted state', () => {
        syncPersistedAvailabilityState({
            glm: {
                runtimeUnavailableModels: [{
                    model: 'glm-5.1',
                    reason: 'glm_model_access_denied',
                    fallbackModel: 'glm-5',
                    markedAt: '2026-03-29T00:00:00.000Z',
                    expiresAt: '2026-03-29T01:00:00.000Z'
                }]
            }
        });

        expect(getModelAvailability('glm', 'glm-5.1')).toEqual({
            available: true,
            reason: null,
            fallbackModel: null
        });
    });
});
