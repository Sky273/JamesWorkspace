import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const scopeVersions = new Map();
const bumpCacheScopeVersion = vi.fn(async (scope) => {
    const nextVersion = (scopeVersions.get(scope) || 1) + 1;
    scopeVersions.set(scope, nextVersion);
    return nextVersion;
});
const getCacheScopeVersion = vi.fn(async (scope) => {
    if (!scopeVersions.has(scope)) {
        scopeVersions.set(scope, 1);
    }
    return scopeVersions.get(scope);
});
const publishCacheInvalidation = vi.fn(async () => ({}));

vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn()
}));

vi.mock('../../config/constants.js', () => ({
    CACHE_TTL: {
        SETTINGS: 60000,
        TEMPLATES: 60000,
        FIRMS: 60000,
        JOBS: 60000,
        GDPR_AUDIT: 60000
    },
    CACHE_BACKEND: 'memory',
    CACHE_REDIS_URL: 'redis://127.0.0.1:6379',
    CACHE_KEY_PREFIX: 'resumeconverter'
}));

vi.mock('../../services/cacheVersion.service.js', () => ({
    bumpCacheScopeVersion: (...args) => bumpCacheScopeVersion(...args),
    getCacheScopeVersion: (...args) => getCacheScopeVersion(...args),
    publishCacheInvalidation: (...args) => publishCacheInvalidation(...args)
}));

import {
    CACHE_KEYS,
    cleanupAllCaches,
    handleCacheInvalidationNotification,
    settingsCache,
    templatesCache
} from '../../services/cache.service.js';

describe('cache.service', () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        scopeVersions.clear();
        await settingsCache.clear();
        await templatesCache.clear();
    });

    afterAll(async () => {
        await cleanupAllCaches();
    });

    it('stores and reads values using the current scope version', async () => {
        await settingsCache.set(CACHE_KEYS.settings.LLM_SETTINGS, { model: 'gpt-4o' });

        await expect(settingsCache.get(CACHE_KEYS.settings.LLM_SETTINGS)).resolves.toEqual({ model: 'gpt-4o' });
        expect(getCacheScopeVersion).toHaveBeenCalledWith('settings:llm', { createIfMissing: true });
    });

    it('invalidates locally when receiving a notification for the tracked scope', async () => {
        await settingsCache.set(CACHE_KEYS.settings.LLM_SETTINGS, { model: 'gpt-4o' });

        handleCacheInvalidationNotification({
            scope: 'settings:llm',
            version: 2
        });

        await expect(settingsCache.get(CACHE_KEYS.settings.LLM_SETTINGS)).resolves.toBeNull();
    });

    it('uses single-flight loading for concurrent misses on the same versioned key', async () => {
        const loader = vi.fn(async () => ({ templates: [] }));

        const [first, second] = await Promise.all([
            templatesCache.getOrLoad('page:1', loader, { scope: CACHE_KEYS.templates.ALL_TEMPLATES }),
            templatesCache.getOrLoad('page:1', loader, { scope: CACHE_KEYS.templates.ALL_TEMPLATES })
        ]);

        expect(first).toEqual({ templates: [] });
        expect(second).toEqual({ templates: [] });
        expect(loader).toHaveBeenCalledTimes(1);
    });

    it('bumps the backing scope version and publishes invalidation on explicit invalidate', async () => {
        await templatesCache.invalidate(CACHE_KEYS.templates.ALL_TEMPLATES);

        expect(bumpCacheScopeVersion).toHaveBeenCalledWith('templates:all');
        expect(publishCacheInvalidation).toHaveBeenCalledWith(
            'templates:all',
            expect.any(Number),
            expect.objectContaining({ source: 'app', reason: 'mutation' })
        );
    });

    it('reports application cache usage clearly when Redis is configured but memory backend is selected', async () => {
        await cleanupAllCaches();
        vi.resetModules();
        process.env.CACHE_REDIS_URL = 'redis://configured.example:6379';

        const configuredCacheModule = await import('../../services/cache.service.js');
        const stats = await configuredCacheModule.getNamedCacheStats('settings');

        expect(stats).toMatchObject({
            configuredBackend: 'memory',
            effectiveBackend: 'memory',
            cacheLayer: 'application',
            applicationCacheActive: true,
            storageBackend: 'memory',
            mode: 'application-memory',
            message: 'Application cache active in memory mode. Redis URL is configured but not selected because CACHE_BACKEND=memory.'
        });

        await configuredCacheModule.cleanupAllCaches();
        delete process.env.CACHE_REDIS_URL;
    });
});
