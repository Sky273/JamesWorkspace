import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../config/constants.js', () => ({
    MINIMAX_ENABLE_HIGHSPEED_MODELS: false
}));

const mockSelectWithTimeout = vi.fn();
const mockUpdateWithTimeout = vi.fn();
const mockCreateWithTimeout = vi.fn();
const mockInvalidateSettingsCache = vi.fn();
const mockSettingsCacheInvalidate = vi.fn();
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
    settingsCache: {
        invalidate: (...args) => mockSettingsCacheInvalidate(...args)
    }
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
        expect(getProviderAvailabilityFlags()).toEqual({
            minimax: {
                highspeedEnabled: false,
                runtimeUnavailableModels: []
            }
        });
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

        expect(getProviderAvailabilityFlags()).toEqual({
            minimax: {
                highspeedEnabled: false,
                runtimeUnavailableModels: ['MiniMax-M2.7-highspeed']
            }
        });
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
        expect(getProviderAvailabilityFlags()).toEqual({
            minimax: {
                highspeedEnabled: false,
                runtimeUnavailableModels: []
            }
        });

        await initializeLLMAvailabilityState();
        expect(getProviderAvailabilityFlags()).toEqual({
            minimax: {
                highspeedEnabled: false,
                runtimeUnavailableModels: ['MiniMax-M2.7-highspeed']
            }
        });
    });

    it('persists runtime-unavailable models after marking them', async () => {
        mockSelectWithTimeout
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([{ id: 'settings-1' }]);
        mockCreateWithTimeout.mockResolvedValueOnce([{ id: 'settings-1' }]);

        await markModelUnavailable('minimax', 'MiniMax-M2.7-highspeed', 'minimax_highspeed_runtime_unavailable', 'MiniMax-M2.7');

        expect(mockCreateWithTimeout).toHaveBeenCalledWith('llm_settings', {
            fields: expect.objectContaining({
                name: 'Default Settings',
                status: 'active',
                llm_availability_state: {
                    minimax: {
                        runtimeUnavailableModels: [{
                            model: 'MiniMax-M2.7-highspeed',
                            reason: 'minimax_highspeed_runtime_unavailable',
                            fallbackModel: 'MiniMax-M2.7'
                        }]
                    }
                }
            })
        });
        expect(mockInvalidateSettingsCache).toHaveBeenCalled();
        expect(mockSettingsCacheInvalidate).toHaveBeenCalledWith('settings');
    });
});
