import { MINIMAX_ENABLE_HIGHSPEED_MODELS } from '../config/constants.js';

export function isMiniMaxHighspeedModel(model = '') {
    return /^MiniMax-M2(?:\.7|\.5|\.1)?-highspeed$/i.test(String(model || '').trim());
}

export function getProviderAvailabilityFlags() {
    return {
        minimax: {
            highspeedEnabled: MINIMAX_ENABLE_HIGHSPEED_MODELS
        }
    };
}

export function getModelAvailability(provider, model) {
    const normalizedProvider = String(provider || '').trim().toLowerCase();
    const normalizedModel = String(model || '').trim();

    if (!normalizedModel) {
        return { available: true, reason: null, fallbackModel: null };
    }

    if (normalizedProvider === 'minimax' && isMiniMaxHighspeedModel(normalizedModel) && !MINIMAX_ENABLE_HIGHSPEED_MODELS) {
        return {
            available: false,
            reason: 'minimax_highspeed_plan_required',
            fallbackModel: normalizedModel.replace(/-highspeed$/i, '')
        };
    }

    return { available: true, reason: null, fallbackModel: null };
}

export function resolveAvailableModel(provider, model, fallbackModel = null) {
    const availability = getModelAvailability(provider, model);

    if (availability.available) {
        return {
            model,
            adjusted: false,
            reason: null,
            originalModel: model,
            fallbackModel: null
        };
    }

    const effectiveFallback = availability.fallbackModel || fallbackModel || null;

    return {
        model: effectiveFallback,
        adjusted: effectiveFallback !== model,
        reason: availability.reason,
        originalModel: model,
        fallbackModel: effectiveFallback
    };
}

export function filterUnavailableModels(provider, models = []) {
    return (models || []).filter(model => getModelAvailability(provider, model).available);
}
