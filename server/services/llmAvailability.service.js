import { MINIMAX_ENABLE_HIGHSPEED_MODELS } from '../config/constants.js';
import { createWithTimeout, selectWithTimeout, updateWithTimeout } from '../utils/postgresHelpers.js';
import { safeLog } from '../utils/logger.backend.js';

const runtimeUnavailableModels = new Map();
let availabilityStateInitialized = false;
let availabilityStateInitializationPromise = null;

function buildAvailabilityKey(provider, model) {
    return `${String(provider || '').trim().toLowerCase()}::${String(model || '').trim()}`;
}

function normalizePersistedAvailabilityState(rawState = {}) {
    const minimaxEntries = Array.isArray(rawState?.minimax?.runtimeUnavailableModels)
        ? rawState.minimax.runtimeUnavailableModels
        : [];

    return {
        minimax: {
            runtimeUnavailableModels: minimaxEntries
                .map(entry => ({
                    model: String(entry?.model || '').trim(),
                    reason: String(entry?.reason || 'runtime_unavailable').trim(),
                    fallbackModel: entry?.fallbackModel ? String(entry.fallbackModel).trim() : null
                }))
                .filter(entry => entry.model)
        }
    };
}

function buildPersistedAvailabilityState() {
    return {
        minimax: {
            runtimeUnavailableModels: Array.from(runtimeUnavailableModels.entries())
                .filter(([key]) => key.startsWith('minimax::'))
                .map(([, value]) => ({
                    model: value.model,
                    reason: value.reason,
                    fallbackModel: value.fallbackModel || null
                }))
        }
    };
}

function applyPersistedAvailabilityState(rawState = {}) {
    const normalizedState = normalizePersistedAvailabilityState(rawState);
    runtimeUnavailableModels.clear();

    for (const entry of normalizedState.minimax.runtimeUnavailableModels) {
        runtimeUnavailableModels.set(buildAvailabilityKey('minimax', entry.model), {
            provider: 'minimax',
            model: entry.model,
            reason: entry.reason,
            fallbackModel: entry.fallbackModel
        });
    }

    return normalizedState;
}

async function invalidateAvailabilityCaches() {
    try {
        const [{ invalidateSettingsCache }, { settingsCache }] = await Promise.all([
            import('./settings.service.js'),
            import('./cache.service.js')
        ]);

        invalidateSettingsCache();
        settingsCache.invalidate('settings');
    } catch (error) {
        safeLog('warn', 'Failed to invalidate settings caches after updating LLM availability state', {
            error: error.message
        });
    }
}

async function persistAvailabilityState() {
    const persistedState = buildPersistedAvailabilityState();
    const settingsRecords = await selectWithTimeout('llm_settings', {
        columns: ['id'],
        limit: 1,
        orderBy: 'created_at DESC'
    });

    if (settingsRecords.length > 0) {
        await updateWithTimeout('llm_settings', settingsRecords[0].id, {
            llm_availability_state: persistedState
        });
    } else {
        await createWithTimeout('llm_settings', {
            fields: {
                name: 'Default Settings',
                status: 'active',
                llm_availability_state: persistedState
            }
        });
    }

    await invalidateAvailabilityCaches();
}

export function isMiniMaxHighspeedModel(model = '') {
    return /^MiniMax-M2(?:\.7|\.5|\.1)?-highspeed$/i.test(String(model || '').trim());
}

export async function initializeLLMAvailabilityState({ forceRefresh = false } = {}) {
    if (availabilityStateInitialized && !forceRefresh) {
        return buildPersistedAvailabilityState();
    }

    if (availabilityStateInitializationPromise && !forceRefresh) {
        return availabilityStateInitializationPromise;
    }

    availabilityStateInitializationPromise = (async () => {
        try {
            const settingsRecords = await selectWithTimeout('llm_settings', {
                columns: ['llm_availability_state'],
                limit: 1,
                orderBy: 'created_at DESC'
            });

            const persistedState = settingsRecords[0]?.llm_availability_state || {};
            const normalizedState = applyPersistedAvailabilityState(persistedState);
            availabilityStateInitialized = true;

            safeLog('info', 'Loaded persisted LLM availability state', {
                minimaxRuntimeUnavailableCount: normalizedState.minimax.runtimeUnavailableModels.length
            });

            return normalizedState;
        } catch (error) {
            availabilityStateInitialized = true;
            runtimeUnavailableModels.clear();
            safeLog('error', 'Failed to load persisted LLM availability state', {
                error: error.message
            });
            return buildPersistedAvailabilityState();
        } finally {
            availabilityStateInitializationPromise = null;
        }
    })();

    return availabilityStateInitializationPromise;
}

export function syncPersistedAvailabilityState(rawState = {}) {
    availabilityStateInitialized = true;
    return applyPersistedAvailabilityState(rawState);
}

export function getProviderAvailabilityFlags() {
    const minimaxRuntimeUnavailableModels = Array.from(runtimeUnavailableModels.entries())
        .filter(([key]) => key.startsWith('minimax::'))
        .map(([, value]) => value.model);

    return {
        minimax: {
            highspeedEnabled: MINIMAX_ENABLE_HIGHSPEED_MODELS,
            runtimeUnavailableModels: minimaxRuntimeUnavailableModels
        }
    };
}

export function getModelAvailability(provider, model) {
    const normalizedProvider = String(provider || '').trim().toLowerCase();
    const normalizedModel = String(model || '').trim();

    if (!normalizedModel) {
        return { available: true, reason: null, fallbackModel: null };
    }

    const runtimeAvailability = runtimeUnavailableModels.get(buildAvailabilityKey(normalizedProvider, normalizedModel));
    if (runtimeAvailability) {
        return {
            available: false,
            reason: runtimeAvailability.reason,
            fallbackModel: runtimeAvailability.fallbackModel
        };
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

export async function markModelUnavailable(provider, model, reason, fallbackModel = null) {
    const normalizedProvider = String(provider || '').trim().toLowerCase();
    const normalizedModel = String(model || '').trim();

    if (!normalizedProvider || !normalizedModel) {
        return;
    }

    runtimeUnavailableModels.set(buildAvailabilityKey(normalizedProvider, normalizedModel), {
        provider: normalizedProvider,
        model: normalizedModel,
        reason: reason || 'runtime_unavailable',
        fallbackModel
    });

    availabilityStateInitialized = true;
    try {
        await persistAvailabilityState();
    } catch (error) {
        safeLog('error', 'Failed to persist LLM availability state after marking model unavailable', {
            provider: normalizedProvider,
            model: normalizedModel,
            error: error.message
        });
    }
}

export function resetModelAvailabilityState() {
    runtimeUnavailableModels.clear();
    availabilityStateInitialized = false;
    availabilityStateInitializationPromise = null;
}
