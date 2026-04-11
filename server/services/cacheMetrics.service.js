import { CACHE_BACKEND } from '../config/constants.js';

const REDIS_URL_CONFIGURED_BY_ENV = Boolean(process.env.CACHE_REDIS_URL);

export function buildApplicationCacheMetrics({
    size = 0,
    maxSize = null,
    ttlMs = null,
    ageMs = null,
    supportsRedis = false,
    extra = {}
} = {}) {
    let message = 'Application cache active in memory mode.';

    if (CACHE_BACKEND === 'redis' && !supportsRedis) {
        message = 'Application cache active in memory mode. This cache remains process-local and does not use Redis.';
    } else if (CACHE_BACKEND !== 'redis' && REDIS_URL_CONFIGURED_BY_ENV) {
        message = 'Application cache active in memory mode. Redis URL is configured but not selected because CACHE_BACKEND=memory.';
    }

    return {
        size,
        maxSize,
        ageMs,
        configuredBackend: CACHE_BACKEND,
        effectiveBackend: 'memory',
        cacheLayer: 'application',
        applicationCacheActive: true,
        storageBackend: 'memory',
        mode: 'application-memory',
        connected: null,
        disabledReason: null,
        message,
        ...(ttlMs !== null ? {
            ttlMs,
            ttlSeconds: ttlMs / 1000,
            ttlMinutes: ttlMs / (60 * 1000),
            ttlHours: ttlMs / (60 * 60 * 1000)
        } : {}),
        ...extra
    };
}
