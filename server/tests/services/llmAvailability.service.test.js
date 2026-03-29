import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../config/constants.js', () => ({
    MINIMAX_ENABLE_HIGHSPEED_MODELS: false
}));

import {
    getModelAvailability,
    getProviderAvailabilityFlags,
    resolveAvailableModel
} from '../../services/llmAvailability.service.js';

describe('llmAvailability.service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
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
                highspeedEnabled: false
            }
        });
    });
});
