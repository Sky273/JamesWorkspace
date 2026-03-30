import { LLM_RUNTIME_UNAVAILABLE_TTL_MS, MINIMAX_ENABLE_HIGHSPEED_MODELS } from '../config/constants.js';
import { createWithTimeout, selectWithTimeout, updateWithTimeout } from '../utils/postgresHelpers.js';
import { safeLog } from '../utils/logger.backend.js';

const runtimeUnavailableModels = new Map();
let availabilityStateInitialized = false;
let availabilityStateInitializationPromise = null;
const PROVIDERS_WITH_RUNTIME_AVAILABILITY = ['minimax', 'glm', 'deepseek', 'openai', 'anthropic', 'ollama'];
const CANONICAL_LLM_SETTINGS_KEY = 'default';

function buildAvailabilityKey(provider, model) {
    return `${String(provider || '').trim().toLowerCase()}::${String(model || '').trim()}`;
}

async function findCanonicalOrLatestSettingsRecord(columns = ['id']) {
    const canonicalRecords = await selectWithTimeout('llm_settings', {
        columns,
        where: 'settings_key = $1',
        params: [CANONICAL_LLM_SETTINGS_KEY],
        limit: 1
    });

    if (canonicalRecords.length > 0) {
        return canonicalRecords[0];
    }

    const legacyRecords = await selectWithTimeout('llm_settings', {
        columns,
        limit: 1,
        orderBy: "CASE WHEN status = 'active' THEN 0 ELSE 1 END, updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC"
    });

    return legacyRecords[0] || null;
}

function toIsoStringOrNull(value) {
    if (!value) {
        return null;
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function computeExpiresAt(markedAt) {
    return new Date(new Date(markedAt).getTime() + LLM_RUNTIME_UNAVAILABLE_TTL_MS).toISOString();
}

function isExpiredAvailabilityEntry(entry) {
    if (!entry?.expiresAt) {
        return false;
    }

    const expiresAtMs = new Date(entry.expiresAt).getTime();
    return Number.isNaN(expiresAtMs) || expiresAtMs <= Date.now();
}

function pruneExpiredRuntimeUnavailableEntries(entries = []) {
    return entries.filter(entry => !isExpiredAvailabilityEntry(entry));
}

function normalizePersistedAvailabilityState(rawState = {}) {
    return PROVIDERS_WITH_RUNTIME_AVAILABILITY.reduce((state, provider) => {
        const entries = Array.isArray(rawState?.[provider]?.runtimeUnavailableModels)
            ? rawState[provider].runtimeUnavailableModels
            : [];

        state[provider] = {
            runtimeUnavailableModels: pruneExpiredRuntimeUnavailableEntries(entries
                .map(entry => {
                    const markedAt = toIsoStringOrNull(entry?.markedAt) || new Date().toISOString();
                    return {
                    model: String(entry?.model || '').trim(),
                    reason: String(entry?.reason || 'runtime_unavailable').trim(),
                    fallbackModel: entry?.fallbackModel ? String(entry.fallbackModel).trim() : null,
                    markedAt,
                    expiresAt: toIsoStringOrNull(entry?.expiresAt) || computeExpiresAt(markedAt)
                };
                })
                .filter(entry => entry.model))
        };

        return state;
    }, {});
}

function buildPersistedAvailabilityState() {
    return PROVIDERS_WITH_RUNTIME_AVAILABILITY.reduce((state, provider) => {
        state[provider] = {
            runtimeUnavailableModels: Array.from(runtimeUnavailableModels.entries())
                .filter(([key]) => key.startsWith(`${provider}::`))
                .map(([, value]) => ({
                    model: value.model,
                    reason: value.reason,
                    fallbackModel: value.fallbackModel || null,
                    markedAt: value.markedAt || null,
                    expiresAt: value.expiresAt || null
                }))
        };
        return state;
    }, {});
}

function applyPersistedAvailabilityState(rawState = {}) {
    const normalizedState = normalizePersistedAvailabilityState(rawState);
    runtimeUnavailableModels.clear();

    for (const provider of PROVIDERS_WITH_RUNTIME_AVAILABILITY) {
        for (const entry of normalizedState[provider].runtimeUnavailableModels) {
            runtimeUnavailableModels.set(buildAvailabilityKey(provider, entry.model), {
                provider,
                model: entry.model,
                reason: entry.reason,
                fallbackModel: entry.fallbackModel,
                markedAt: entry.markedAt,
                expiresAt: entry.expiresAt
            });
        }
    }

    return normalizedState;
}

async function invalidateAvailabilityCaches() {
    try {
        const [{ invalidateSettingsCache }, { invalidateSettingsCaches }] = await Promise.all([
            import('./settings.service.js'),
            import('./cache.service.js')
        ]);

        await invalidateSettingsCache();
        await invalidateSettingsCaches();
    } catch (error) {
        safeLog('warn', 'Failed to invalidate settings caches after updating LLM availability state', {
            error: error.message
        });
    }
}

async function persistAvailabilityState() {
    const persistedState = buildPersistedAvailabilityState();
    const settingsRecord = await findCanonicalOrLatestSettingsRecord(['id']);

    if (settingsRecord) {
        await updateWithTimeout('llm_settings', settingsRecord.id, {
            settings_key: CANONICAL_LLM_SETTINGS_KEY,
            name: 'Default Settings',
            status: 'active',
            llm_availability_state: persistedState
        });
    } else {
        await createWithTimeout('llm_settings', {
            fields: {
                settings_key: CANONICAL_LLM_SETTINGS_KEY,
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
            const settingsRecord = await findCanonicalOrLatestSettingsRecord(['llm_availability_state']);

            const persistedState = settingsRecord?.llm_availability_state || {};
            const normalizedState = applyPersistedAvailabilityState(persistedState);
            availabilityStateInitialized = true;

            safeLog('info', 'Loaded persisted LLM availability state', {
                runtimeUnavailableCounts: Object.fromEntries(
                    PROVIDERS_WITH_RUNTIME_AVAILABILITY.map(provider => [provider, normalizedState[provider].runtimeUnavailableModels.length])
                )
            });

            return normalizedState;
        } catch (error) {
            availabilityStateInitialized = false;
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
    const flags = {};

    for (const provider of PROVIDERS_WITH_RUNTIME_AVAILABILITY) {
        flags[provider] = {
            runtimeUnavailableModels: Array.from(runtimeUnavailableModels.entries())
                .filter(([key]) => key.startsWith(`${provider}::`))
                .filter(([, value]) => {
                    if (!isExpiredAvailabilityEntry(value)) {
                        return true;
                    }

                    runtimeUnavailableModels.delete(buildAvailabilityKey(provider, value.model));
                    return false;
                })
                .map(([, value]) => value.model)
        };
    }

    flags.minimax.highspeedEnabled = MINIMAX_ENABLE_HIGHSPEED_MODELS;
    return flags;
}

export function getModelAvailability(provider, model) {
    const normalizedProvider = String(provider || '').trim().toLowerCase();
    const normalizedModel = String(model || '').trim();

    if (!normalizedModel) {
        return { available: true, reason: null, fallbackModel: null };
    }

    const runtimeAvailability = runtimeUnavailableModels.get(buildAvailabilityKey(normalizedProvider, normalizedModel));
    if (runtimeAvailability) {
        if (isExpiredAvailabilityEntry(runtimeAvailability)) {
            runtimeUnavailableModels.delete(buildAvailabilityKey(normalizedProvider, normalizedModel));
            return { available: true, reason: null, fallbackModel: null };
        }

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

    const markedAt = new Date().toISOString();
    runtimeUnavailableModels.set(buildAvailabilityKey(normalizedProvider, normalizedModel), {
        provider: normalizedProvider,
        model: normalizedModel,
        reason: reason || 'runtime_unavailable',
        fallbackModel,
        markedAt,
        expiresAt: computeExpiresAt(markedAt)
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
