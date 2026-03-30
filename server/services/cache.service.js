import { CACHE_BACKEND, CACHE_KEY_PREFIX, CACHE_REDIS_URL, CACHE_TTL } from '../config/constants.js';
import { safeLog } from '../utils/logger.backend.js';

const DEFAULT_CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
const DEFAULT_MAX_SIZE = 1000;

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
        invalidations: 0
    };
}

class MemoryCacheNamespace {
    constructor(name, ttl = 600000, maxSize = DEFAULT_MAX_SIZE) {
        this.name = name;
        this.backend = 'memory';
        this.cache = new Map();
        this.ttl = ttl;
        this.maxSize = maxSize;
        this.stats = createStats(name, this.backend, ttl);
        this.cleanupInterval = setInterval(() => {
            this.cleanup();
        }, DEFAULT_CLEANUP_INTERVAL_MS);
    }

    async set(key, value) {
        this.stats.sets++;
        this.cache.set(key, {
            value,
            timestamp: Date.now()
        });
        return value;
    }

    async get(key) {
        const item = this.cache.get(key);
        if (!item) {
            this.stats.misses++;
            return null;
        }

        const age = Date.now() - item.timestamp;
        if (age > this.ttl) {
            this.cache.delete(key);
            this.stats.misses++;
            return null;
        }

        this.stats.hits++;
        return item.value;
    }

    async invalidate(key) {
        this.stats.invalidations++;
        this.cache.delete(key);
    }

    async clear() {
        this.cache.clear();
    }

    async size() {
        return this.cache.size;
    }

    async getStats() {
        return {
            ...this.stats,
            size: this.cache.size,
            maxSize: this.maxSize
        };
    }

    cleanup() {
        const now = Date.now();
        let cleaned = 0;

        for (const [key, item] of this.cache.entries()) {
            if (now - item.timestamp > this.ttl) {
                this.cache.delete(key);
                cleaned++;
            }
        }

        if (this.cache.size > this.maxSize) {
            const entries = Array.from(this.cache.entries());
            entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
            const toRemove = entries.slice(0, this.cache.size - this.maxSize);
            toRemove.forEach(([key]) => this.cache.delete(key));
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

class RedisCacheNamespace {
    constructor(name, ttl = 600000, maxSize = DEFAULT_MAX_SIZE) {
        this.name = name;
        this.backend = 'redis';
        this.ttl = ttl;
        this.maxSize = maxSize;
        this.stats = createStats(name, this.backend, ttl);
        this.memoryFallback = new MemoryCacheNamespace(`${name}:fallback`, ttl, maxSize);
    }

    buildKey(key) {
        return `${CACHE_KEY_PREFIX}:${this.name}:${key}`;
    }

    getMatchPattern() {
        return `${CACHE_KEY_PREFIX}:${this.name}:*`;
    }

    async getClient() {
        return ensureRedisClient();
    }

    async set(key, value) {
        this.stats.sets++;
        const client = await this.getClient();
        if (!client) {
            return this.memoryFallback.set(key, value);
        }

        await client.set(this.buildKey(key), JSON.stringify(value), { PX: this.ttl });
        return value;
    }

    async get(key) {
        const client = await this.getClient();
        if (!client) {
            return this.memoryFallback.get(key);
        }

        const raw = await client.get(this.buildKey(key));
        if (raw === null) {
            this.stats.misses++;
            return null;
        }

        this.stats.hits++;
        try {
            return JSON.parse(raw);
        } catch {
            return raw;
        }
    }

    async invalidate(key) {
        this.stats.invalidations++;
        const client = await this.getClient();
        if (!client) {
            return this.memoryFallback.invalidate(key);
        }
        await client.del(this.buildKey(key));
    }

    async clear() {
        const client = await this.getClient();
        if (!client) {
            return this.memoryFallback.clear();
        }

        const keys = [];
        for await (const key of client.scanIterator({ MATCH: this.getMatchPattern(), COUNT: 100 })) {
            keys.push(key);
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

    async getStats() {
        const size = await this.size();
        return {
            ...this.stats,
            size,
            maxSize: this.maxSize,
            connected: !!redisState.client && redisState.available,
            disabledReason: redisState.disabledReason || null,
            effectiveBackend: (!!redisState.client && redisState.available) ? 'redis' : 'memory-fallback'
        };
    }

    async destroy() {
        await this.memoryFallback.destroy();
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
    }
};

export const settingsCache = createCacheNamespace('settings', CACHE_TTL.SETTINGS);
export const templatesCache = createCacheNamespace('templates', CACHE_TTL.TEMPLATES);
export const firmsCache = createCacheNamespace('firms', CACHE_TTL.FIRMS);

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

export default MemoryCacheNamespace;
