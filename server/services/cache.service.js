import { CACHE_BACKEND, CACHE_KEY_PREFIX, CACHE_REDIS_URL, CACHE_TTL } from '../config/constants.js';
import { safeLog } from '../utils/logger.backend.js';
import {
    bumpCacheScopeVersion,
    getCacheScopeVersion,
    publishCacheInvalidation
} from './cacheVersion.service.js';

const DEFAULT_CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
const DEFAULT_MAX_SIZE = 1000;
const DEFAULT_SCOPE_VERSION_REFRESH_MS = 60 * 1000;
const REDIS_URL_CONFIGURED_BY_ENV = Boolean(process.env.CACHE_REDIS_URL);

const cacheRegistry = new Map();

const redisState = {
    initPromise: null,
    client: null,
    available: false,
    disabledReason: null
};

function createStats(name, backend, ttl) {
    return {
        name,
        backend,
        ttl,
        hits: 0,
        misses: 0,
        sets: 0,
        invalidations: 0,
        loads: 0
    };
}

function buildCacheUsageMode({
    configuredBackend,
    effectiveBackend,
    connected = null,
    disabledReason = null
}) {
    const applicationCacheLayer = 'application';

    if (configuredBackend === 'redis' && effectiveBackend === 'redis') {
        return {
            cacheLayer: applicationCacheLayer,
            applicationCacheActive: true,
            storageBackend: 'redis',
            mode: 'application-redis',
            message: 'Application cache active with Redis as storage backend.',
            connected,
            disabledReason
        };
    }

    if (configuredBackend === 'redis' && effectiveBackend !== 'redis') {
        return {
            cacheLayer: applicationCacheLayer,
            applicationCacheActive: true,
            storageBackend: 'memory',
            mode: 'application-memory-fallback',
            message: `Application cache active in memory fallback mode because Redis is configured but not currently used${disabledReason ? ` (${disabledReason})` : ''}.`,
            connected,
            disabledReason
        };
    }

    if (REDIS_URL_CONFIGURED_BY_ENV) {
        return {
            cacheLayer: applicationCacheLayer,
            applicationCacheActive: true,
            storageBackend: 'memory',
            mode: 'application-memory',
            message: 'Application cache active in memory mode. Redis URL is configured but not selected because CACHE_BACKEND=memory.',
            connected,
            disabledReason
        };
    }

    return {
        cacheLayer: applicationCacheLayer,
        applicationCacheActive: true,
        storageBackend: 'memory',
        mode: 'application-memory',
        message: 'Application cache active in memory mode.',
        connected,
        disabledReason
    };
}

function normalizeCacheKeyPart(value) {
    if (typeof value === 'string') {
        return value;
    }

    if (value === null || value === undefined) {
        return '';
    }

    return JSON.stringify(value);
}

class VersionedCacheNamespace {
    constructor(name, backend, ttl = 600000, maxSize = DEFAULT_MAX_SIZE) {
        this.name = name;
        this.backend = backend;
        this.ttl = ttl;
        this.maxSize = maxSize;
        this.stats = createStats(name, backend, ttl);
        this.scopeVersions = new Map();
        this.pendingLoads = new Map();
        this.scopeEntries = new Map();
    }

    resolveLogicalKey(key) {
        const normalizedKey = normalizeCacheKeyPart(key);
        if (!normalizedKey) {
            throw new Error(`Cache key is required for namespace "${this.name}"`);
        }
        return normalizedKey;
    }

    resolveScopeName(key, options = {}) {
        const providedScope = options.scope ?? key;
        const normalizedScope = normalizeCacheKeyPart(providedScope);
        if (!normalizedScope) {
            throw new Error(`Cache scope is required for namespace "${this.name}"`);
        }
        return `${this.name}:${normalizedScope}`;
    }

    buildVersionedKey(scope, key, version) {
        return `${scope}:v${version}:${key}`;
    }

    rememberVersion(scope, version) {
        this.scopeVersions.set(scope, {
            version: Number(version),
            timestamp: Date.now()
        });
    }

    async resolveScopeVersion(scope, { forceRefresh = false } = {}) {
        const cached = this.scopeVersions.get(scope);
        const isFresh = cached && (Date.now() - cached.timestamp) < DEFAULT_SCOPE_VERSION_REFRESH_MS;
        if (!forceRefresh && isFresh) {
            return cached.version;
        }

        const version = await getCacheScopeVersion(scope, { createIfMissing: true });
        const normalizedVersion = Number.isFinite(Number(version)) ? Number(version) : 1;
        this.rememberVersion(scope, normalizedVersion);
        return normalizedVersion;
    }

    trackScopeEntry(scope, versionedKey) {
        const keys = this.scopeEntries.get(scope) || new Set();
        keys.add(versionedKey);
        this.scopeEntries.set(scope, keys);
    }

    forgetScopeEntry(scope, versionedKey) {
        const keys = this.scopeEntries.get(scope);
        if (!keys) {
            return;
        }

        keys.delete(versionedKey);
        if (keys.size === 0) {
            this.scopeEntries.delete(scope);
        }
    }

    async getOrLoad(key, loader, options = {}) {
        const logicalKey = this.resolveLogicalKey(key);
        const scope = this.resolveScopeName(logicalKey, options);
        const version = await this.resolveScopeVersion(scope);
        const versionedKey = this.buildVersionedKey(scope, logicalKey, version);
        const cached = await this.get(logicalKey, { ...options, scope });
        if (cached !== null) {
            return cached;
        }

        if (this.pendingLoads.has(versionedKey)) {
            return this.pendingLoads.get(versionedKey);
        }

        this.stats.loads++;
        const pendingLoad = (async () => {
            const loaded = await loader();
            await this.set(logicalKey, loaded, { ...options, scope });
            return loaded;
        })().finally(() => {
            this.pendingLoads.delete(versionedKey);
        });

        this.pendingLoads.set(versionedKey, pendingLoad);
        return pendingLoad;
    }

    async invalidate(key, options = {}) {
        const logicalKey = this.resolveLogicalKey(key);
        const scope = this.resolveScopeName(logicalKey, options);
        this.stats.invalidations++;

        const version = await bumpCacheScopeVersion(scope);
        this.applyInvalidationPayload({ scope, version });
        await publishCacheInvalidation(scope, version, {
            source: 'app',
            reason: options.reason || 'mutation'
        });
    }

    applyInvalidationPayload(payload = {}) {
        const scope = String(payload.scope || '').trim();
        if (!scope || !scope.startsWith(`${this.name}:`)) {
            return false;
        }

        const nextVersion = Number.isFinite(Number(payload.version)) ? Number(payload.version) : null;
        if (nextVersion !== null) {
            this.rememberVersion(scope, nextVersion);
        } else {
            this.scopeVersions.delete(scope);
        }

        const keys = this.scopeEntries.get(scope);
        if (keys) {
            for (const versionedKey of keys) {
                this.deleteStoredValue(versionedKey);
            }
            this.scopeEntries.delete(scope);
        }

        return true;
    }

    cleanupScopeMetadataForKey(versionedKey) {
        for (const [scope, keys] of this.scopeEntries.entries()) {
            if (!keys.has(versionedKey)) {
                continue;
            }

            keys.delete(versionedKey);
            if (keys.size === 0) {
                this.scopeEntries.delete(scope);
            }
            return;
        }
    }

    async clear() {
        this.scopeVersions.clear();
        this.pendingLoads.clear();
        this.scopeEntries.clear();
    }

    async getStats() {
        return {
            ...this.stats,
            configuredBackend: CACHE_BACKEND,
            effectiveBackend: this.backend,
            size: await this.size(),
            maxSize: this.maxSize,
            trackedScopes: this.scopeVersions.size,
            ...buildCacheUsageMode({
                configuredBackend: CACHE_BACKEND,
                effectiveBackend: this.backend
            })
        };
    }

    async destroy() {
        this.pendingLoads.clear();
        this.scopeVersions.clear();
        this.scopeEntries.clear();
    }
}

class MemoryCacheNamespace extends VersionedCacheNamespace {
    constructor(name, ttl = 600000, maxSize = DEFAULT_MAX_SIZE) {
        super(name, 'memory', ttl, maxSize);
        this.cache = new Map();
        this.cleanupInterval = setInterval(() => {
            this.cleanup();
        }, DEFAULT_CLEANUP_INTERVAL_MS);
        this.cleanupInterval.unref?.();
    }

    async set(key, value, options = {}) {
        const logicalKey = this.resolveLogicalKey(key);
        const scope = this.resolveScopeName(logicalKey, options);
        const version = await this.resolveScopeVersion(scope);
        const versionedKey = this.buildVersionedKey(scope, logicalKey, version);

        this.stats.sets++;
        this.cache.set(versionedKey, {
            value,
            timestamp: Date.now(),
            scope
        });
        this.trackScopeEntry(scope, versionedKey);
        return value;
    }

    async get(key, options = {}) {
        const logicalKey = this.resolveLogicalKey(key);
        const scope = this.resolveScopeName(logicalKey, options);
        const version = await this.resolveScopeVersion(scope);
        const versionedKey = this.buildVersionedKey(scope, logicalKey, version);
        const item = this.cache.get(versionedKey);
        if (!item) {
            this.stats.misses++;
            return null;
        }

        const age = Date.now() - item.timestamp;
        if (age > this.ttl) {
            this.cache.delete(versionedKey);
            this.forgetScopeEntry(scope, versionedKey);
            this.stats.misses++;
            return null;
        }

        this.stats.hits++;
        return item.value;
    }

    deleteStoredValue(versionedKey) {
        this.cache.delete(versionedKey);
    }

    async clear() {
        await super.clear();
        this.cache.clear();
    }

    async size() {
        return this.cache.size;
    }

    cleanup() {
        const now = Date.now();
        let cleaned = 0;

        for (const [versionedKey, item] of this.cache.entries()) {
            if (now - item.timestamp > this.ttl) {
                this.cache.delete(versionedKey);
                this.forgetScopeEntry(item.scope, versionedKey);
                cleaned++;
            }
        }

        if (this.cache.size > this.maxSize) {
            const entries = Array.from(this.cache.entries());
            entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
            const toRemove = entries.slice(0, this.cache.size - this.maxSize);
            for (const [versionedKey, item] of toRemove) {
                this.cache.delete(versionedKey);
                this.forgetScopeEntry(item.scope, versionedKey);
            }
            cleaned += toRemove.length;
        }

        if (cleaned > 0) {
            safeLog('debug', 'Cache cleanup completed', {
                cacheName: this.name,
                entriesRemoved: cleaned,
                cacheSize: this.cache.size,
                backend: this.backend
            });
        }
    }

    async destroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
        await super.destroy();
        this.cache.clear();
    }
}

async function ensureRedisClient() {
    if (CACHE_BACKEND !== 'redis') {
        return null;
    }

    if (redisState.client && redisState.available) {
        return redisState.client;
    }

    if (redisState.disabledReason) {
        return null;
    }

    if (redisState.initPromise) {
        return redisState.initPromise;
    }

    redisState.initPromise = (async () => {
        try {
            const redisModule = await import('redis').catch(() => null);
            if (!redisModule?.createClient) {
                redisState.disabledReason = 'redis_package_missing';
                safeLog('warn', 'Redis cache backend requested but redis package is not installed. Falling back to memory cache.', {
                    cacheBackend: CACHE_BACKEND
                });
                return null;
            }

            const client = redisModule.createClient({ url: CACHE_REDIS_URL });
            client.on('error', (error) => {
                safeLog('warn', 'Redis cache client error', { error: error.message });
            });

            await client.connect();
            redisState.client = client;
            redisState.available = true;
            safeLog('info', 'Redis cache backend connected', {
                redisUrl: CACHE_REDIS_URL
            });
            return client;
        } catch (error) {
            redisState.disabledReason = error.message;
            safeLog('warn', 'Redis cache backend unavailable. Falling back to memory cache.', {
                error: error.message,
                redisUrl: CACHE_REDIS_URL
            });
            return null;
        } finally {
            redisState.initPromise = null;
        }
    })();

    return redisState.initPromise;
}

class RedisCacheNamespace extends VersionedCacheNamespace {
    constructor(name, ttl = 600000, maxSize = DEFAULT_MAX_SIZE) {
        super(name, 'redis', ttl, maxSize);
        this.memoryFallback = new MemoryCacheNamespace(`${name}:fallback`, ttl, maxSize);
    }

    buildRedisKey(versionedKey) {
        return `${CACHE_KEY_PREFIX}:${this.name}:${versionedKey}`;
    }

    getMatchPattern() {
        return `${CACHE_KEY_PREFIX}:${this.name}:*`;
    }

    async getClient() {
        return ensureRedisClient();
    }

    async set(key, value, options = {}) {
        const logicalKey = this.resolveLogicalKey(key);
        const scope = this.resolveScopeName(logicalKey, options);
        const version = await this.resolveScopeVersion(scope);
        const versionedKey = this.buildVersionedKey(scope, logicalKey, version);

        this.stats.sets++;
        const client = await this.getClient();
        if (!client) {
            return this.memoryFallback.set(logicalKey, value, { ...options, scope });
        }

        await client.set(this.buildRedisKey(versionedKey), JSON.stringify(value), { PX: this.ttl });
        this.trackScopeEntry(scope, versionedKey);
        return value;
    }

    async get(key, options = {}) {
        const logicalKey = this.resolveLogicalKey(key);
        const scope = this.resolveScopeName(logicalKey, options);
        const version = await this.resolveScopeVersion(scope);
        const versionedKey = this.buildVersionedKey(scope, logicalKey, version);
        const client = await this.getClient();
        if (!client) {
            return this.memoryFallback.get(logicalKey, { ...options, scope });
        }

        const raw = await client.get(this.buildRedisKey(versionedKey));
        if (raw === null) {
            this.stats.misses++;
            return null;
        }

        this.trackScopeEntry(scope, versionedKey);
        this.stats.hits++;
        try {
            return JSON.parse(raw);
        } catch {
            return raw;
        }
    }

    async clear() {
        await super.clear();
        const client = await this.getClient();
        if (!client) {
            return this.memoryFallback.clear();
        }

        const keys = [];
        for await (const redisKey of client.scanIterator({ MATCH: this.getMatchPattern(), COUNT: 100 })) {
            keys.push(redisKey);
        }
        if (keys.length > 0) {
            await client.del(keys);
        }
    }

    async size() {
        const client = await this.getClient();
        if (!client) {
            return this.memoryFallback.size();
        }

        let count = 0;
        for await (const _key of client.scanIterator({ MATCH: this.getMatchPattern(), COUNT: 100 })) {
            count++;
        }
        return count;
    }

    deleteStoredValue(versionedKey) {
        const clientPromise = this.getClient();
        clientPromise.then((client) => {
            if (!client) {
                this.memoryFallback.deleteStoredValue?.(versionedKey);
                return;
            }

            client.del(this.buildRedisKey(versionedKey)).catch((error) => {
                safeLog('warn', 'Failed to delete invalidated redis cache key', {
                    cacheName: this.name,
                    error: error.message
                });
            });
        }).catch((error) => {
            safeLog('warn', 'Failed to resolve redis client during cache invalidation', {
                cacheName: this.name,
                error: error.message
            });
        });
    }

    async getStats() {
        const size = await this.size();
        const effectiveBackend = (!!redisState.client && redisState.available) ? 'redis' : 'memory';
        return {
            ...this.stats,
            size,
            maxSize: this.maxSize,
            trackedScopes: this.scopeVersions.size,
            configuredBackend: CACHE_BACKEND,
            connected: !!redisState.client && redisState.available,
            disabledReason: redisState.disabledReason || null,
            effectiveBackend,
            ...buildCacheUsageMode({
                configuredBackend: CACHE_BACKEND,
                effectiveBackend,
                connected: !!redisState.client && redisState.available,
                disabledReason: redisState.disabledReason || null
            })
        };
    }

    async destroy() {
        await this.memoryFallback.destroy();
        await super.destroy();
    }
}

export function handleCacheInvalidationNotification(payload) {
    let invalidatedNamespaces = 0;

    for (const cache of cacheRegistry.values()) {
        if (typeof cache.applyInvalidationPayload === 'function' && cache.applyInvalidationPayload(payload)) {
            invalidatedNamespaces++;
        }
    }

    if (invalidatedNamespaces > 0) {
        safeLog('debug', 'Applied cache invalidation notification locally', {
            scope: payload?.scope || null,
            version: payload?.version ?? null,
            invalidatedNamespaces
        });
    }
}

function createCacheNamespace(name, ttl, maxSize = DEFAULT_MAX_SIZE) {
    const cache = CACHE_BACKEND === 'redis'
        ? new RedisCacheNamespace(name, ttl, maxSize)
        : new MemoryCacheNamespace(name, ttl, maxSize);

    cacheRegistry.set(name, cache);
    return cache;
}

export const CACHE_KEYS = {
    settings: {
        UI_SETTINGS: 'ui',
        LLM_SETTINGS: 'llm'
    },
    templates: {
        ALL_TEMPLATES: 'all'
    },
    firms: {
        ALL_FIRMS: 'all'
    },
    clients: {
        ALL_CLIENTS: 'all',
        INDUSTRIES: 'industries'
    },
    deals: {
        ALL_DEALS: 'all'
    },
    users: {
        ALL_USERS: 'all'
    },
    missions: {
        ALL_MISSIONS: 'all'
    },
    tags: {
        RAW: 'raw',
        CLEANED: 'cleaned',
        ESCO: 'esco'
    },
    groupedViews: {
        ADMIN: 'admin'
    }
};

export const settingsCache = createCacheNamespace('settings', CACHE_TTL.SETTINGS);
export const templatesCache = createCacheNamespace('templates', CACHE_TTL.TEMPLATES);
export const firmsCache = createCacheNamespace('firms', CACHE_TTL.FIRMS);
export const clientsCache = createCacheNamespace('clients', CACHE_TTL.CLIENTS);
export const dealsCache = createCacheNamespace('deals', CACHE_TTL.DEALS);
export const usersCache = createCacheNamespace('users', CACHE_TTL.USERS);
export const missionsCache = createCacheNamespace('missions', CACHE_TTL.MISSIONS);
export const tagsCache = createCacheNamespace('tags', CACHE_TTL.TEMPLATES);
export const resumeGroupedViewCache = createCacheNamespace('resumeGroupedViews', CACHE_TTL.GROUPED_VIEWS);
export const missionGroupedViewCache = createCacheNamespace('missionGroupedViews', CACHE_TTL.GROUPED_VIEWS);
export const adaptationGroupedViewCache = createCacheNamespace('adaptationGroupedViews', CACHE_TTL.GROUPED_VIEWS);

export function buildGroupedViewScopeKey({ firmId = null, isAdmin = false } = {}) {
    return isAdmin ? CACHE_KEYS.groupedViews.ADMIN : `firm:${firmId}`;
}

async function invalidateGroupedViewNamespace(cacheNamespace, scopeKey = null) {
    const keys = new Set([CACHE_KEYS.groupedViews.ADMIN]);
    if (scopeKey) {
        keys.add(scopeKey);
    }

    await Promise.all(Array.from(keys).map((key) => cacheNamespace.invalidate(key)));
}

export async function invalidateSettingsCaches() {
    await Promise.all([
        settingsCache.invalidate(CACHE_KEYS.settings.UI_SETTINGS),
        settingsCache.invalidate(CACHE_KEYS.settings.LLM_SETTINGS)
    ]);
}

export async function invalidateTemplatesCaches() {
    await templatesCache.invalidate(CACHE_KEYS.templates.ALL_TEMPLATES);
}

export async function invalidateFirmsCaches() {
    await firmsCache.invalidate(CACHE_KEYS.firms.ALL_FIRMS);
}

export async function invalidateClientsCaches() {
    await Promise.all([
        clientsCache.invalidate(CACHE_KEYS.clients.ALL_CLIENTS),
        clientsCache.invalidate(CACHE_KEYS.clients.INDUSTRIES)
    ]);
}

export async function invalidateDealsCaches() {
    await dealsCache.invalidate(CACHE_KEYS.deals.ALL_DEALS);
}

export async function invalidateUsersCaches() {
    await usersCache.invalidate(CACHE_KEYS.users.ALL_USERS);
}

export async function invalidateMissionsCaches() {
    await missionsCache.invalidate(CACHE_KEYS.missions.ALL_MISSIONS);
}

export async function invalidateTagsCaches() {
    await Promise.all([
        tagsCache.invalidate(CACHE_KEYS.tags.RAW),
        tagsCache.invalidate(CACHE_KEYS.tags.CLEANED),
        tagsCache.invalidate(CACHE_KEYS.tags.ESCO)
    ]);
}

export async function invalidateResumeGroupedViewCaches(scopeKey = null) {
    await invalidateGroupedViewNamespace(resumeGroupedViewCache, scopeKey);
}

export async function invalidateMissionGroupedViewCaches(scopeKey = null) {
    await invalidateGroupedViewNamespace(missionGroupedViewCache, scopeKey);
}

export async function invalidateAdaptationGroupedViewCaches(scopeKey = null) {
    await invalidateGroupedViewNamespace(adaptationGroupedViewCache, scopeKey);
}

export async function getNamedCacheStats(cacheName) {
    const cache = cacheRegistry.get(cacheName);
    return cache ? cache.getStats() : null;
}

export async function getCacheRegistryStats() {
    const entries = await Promise.all(
        Array.from(cacheRegistry.entries()).map(async ([name, cache]) => [name, await cache.getStats()])
    );

    return Object.fromEntries(entries);
}

safeLog('info', 'Cache system initialized', {
    backend: CACHE_BACKEND,
    redisUrlConfigured: Boolean(CACHE_REDIS_URL),
    settingsTTL: `${CACHE_TTL.SETTINGS / 1000}s`,
    templatesTTL: `${CACHE_TTL.TEMPLATES / 1000}s`,
    firmsTTL: `${CACHE_TTL.FIRMS / 1000}s`
});

export const cleanupAllCaches = async () => {
    await Promise.all(Array.from(cacheRegistry.values()).map(cache => cache.destroy()));

    if (redisState.client) {
        try {
            await redisState.client.quit();
        } catch (error) {
            safeLog('warn', 'Failed to close Redis cache client cleanly', {
                error: error.message
            });
        } finally {
            redisState.client = null;
            redisState.available = false;
        }
    }

    safeLog('info', 'All caches destroyed');
};
