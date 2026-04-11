import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockTagsCache, mockInvalidateTagsCaches, mockGetNamedCacheStats } = vi.hoisted(() => ({
    mockTagsCache: {
        get: vi.fn(async () => null),
        set: vi.fn(async (_key, value) => value)
    },
    mockInvalidateTagsCaches: vi.fn(async () => {}),
    mockGetNamedCacheStats: vi.fn(async () => ({ name: 'tags', trackedScopes: 2 }))
}));

vi.mock('../../services/cache.service.js', () => ({
    CACHE_KEYS: {
        tags: {
            RAW: 'raw',
            CLEANED: 'cleaned',
            ESCO: 'esco'
        }
    },
    tagsCache: mockTagsCache,
    invalidateTagsCaches: (...args) => mockInvalidateTagsCaches(...args),
    getNamedCacheStats: (...args) => mockGetNamedCacheStats(...args)
}));

import {
    getCachedRawTags,
    setCachedRawTags,
    getCachedCleanedTags,
    setCachedCleanedTags,
    getCachedEscoTags,
    setCachedEscoTags,
    getTagsCacheStats,
    invalidateTagsCache
} from '../../services/tagsCache.service.js';

describe('tagsCache.service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockTagsCache.get.mockResolvedValue(null);
        mockTagsCache.set.mockImplementation(async (_key, value) => value);
    });

    it('stores and reads raw tags via the shared tags namespace', async () => {
        mockTagsCache.get.mockResolvedValueOnce({ Skills: ['JS'] });

        await setCachedRawTags('admin', { Skills: ['JS'] });
        const result = await getCachedRawTags('admin');

        expect(result).toEqual({ Skills: ['JS'] });
        expect(mockTagsCache.set).toHaveBeenCalledWith('admin', { Skills: ['JS'] }, { scope: 'raw' });
        expect(mockTagsCache.get).toHaveBeenCalledWith('admin', { scope: 'raw' });
    });

    it('stores and reads cleaned tags via the shared tags namespace', async () => {
        mockTagsCache.get.mockResolvedValueOnce({ Skills: ['JS'] });

        await setCachedCleanedTags('firm_1_default', { Skills: ['JS'] });
        const result = await getCachedCleanedTags('firm_1_default');

        expect(result).toEqual({ Skills: ['JS'] });
        expect(mockTagsCache.set).toHaveBeenCalledWith('firm_1_default', { Skills: ['JS'] }, { scope: 'cleaned' });
        expect(mockTagsCache.get).toHaveBeenCalledWith('firm_1_default', { scope: 'cleaned' });
    });

    it('stores and reads ESCO tags via the shared tags namespace', async () => {
        mockTagsCache.get.mockResolvedValueOnce({ skills: ['ESCO'] });

        await setCachedEscoTags({ skills: ['ESCO'] });
        const result = await getCachedEscoTags();

        expect(result).toEqual({ skills: ['ESCO'] });
        expect(mockTagsCache.set).toHaveBeenCalledWith('admin', { skills: ['ESCO'] }, { scope: 'esco' });
        expect(mockTagsCache.get).toHaveBeenCalledWith('admin', { scope: 'esco' });
    });

    it('invalidates all tag scopes together', async () => {
        await invalidateTagsCache();
        expect(mockInvalidateTagsCaches).toHaveBeenCalled();
    });

    it('returns tags cache stats including tracked cleaned keys', async () => {
        await setCachedCleanedTags('firm_1_default', { Skills: ['JS'] });

        const stats = await getTagsCacheStats();

        expect(stats.cleanedTags.size).toBe(1);
        expect(stats.cleanedTags.keys).toEqual(['firm_1_default']);
        expect(stats.cache).toEqual({ name: 'tags', trackedScopes: 2 });
    });
});
