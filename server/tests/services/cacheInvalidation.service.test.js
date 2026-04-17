import { describe, expect, it, vi } from 'vitest';

import {
    buildInvalidationKeySet,
    invalidateCacheKeys,
    invalidateGroupedViewNamespace,
    invalidateNamespaceEntries
} from '../../services/cacheInvalidation.service.js';

describe('cacheInvalidation.service', () => {
    it('builds a deduplicated invalidation key set from defaults and extra scopes', () => {
        const keys = buildInvalidationKeySet('logs', ['stats', 'logs', null, undefined, 'exports']);

        expect(Array.from(keys)).toEqual(['logs', 'stats', 'exports']);
    });

    it('invalidates a namespace default key plus an optional scope key', async () => {
        const cacheNamespace = {
            invalidate: vi.fn(async () => undefined)
        };

        await invalidateNamespaceEntries(cacheNamespace, 'all', 'firm:firm-1');

        expect(cacheNamespace.invalidate).toHaveBeenCalledTimes(2);
        expect(cacheNamespace.invalidate).toHaveBeenCalledWith('all');
        expect(cacheNamespace.invalidate).toHaveBeenCalledWith('firm:firm-1');
    });

    it('always includes the admin grouped-view scope when invalidating grouped views', async () => {
        const cacheNamespace = {
            invalidate: vi.fn(async () => undefined)
        };

        await invalidateGroupedViewNamespace(cacheNamespace, 'admin', 'firm:firm-1');

        expect(cacheNamespace.invalidate).toHaveBeenCalledTimes(2);
        expect(cacheNamespace.invalidate).toHaveBeenCalledWith('admin');
        expect(cacheNamespace.invalidate).toHaveBeenCalledWith('firm:firm-1');
    });

    it('invalidates each provided key exactly once', async () => {
        const cacheNamespace = {
            invalidate: vi.fn(async () => undefined)
        };

        await invalidateCacheKeys(cacheNamespace, new Set(['logs', 'stats', 'firms']));

        expect(cacheNamespace.invalidate).toHaveBeenCalledTimes(3);
        expect(cacheNamespace.invalidate).toHaveBeenCalledWith('logs');
        expect(cacheNamespace.invalidate).toHaveBeenCalledWith('stats');
        expect(cacheNamespace.invalidate).toHaveBeenCalledWith('firms');
    });
});
