import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn()
}));

import {
    destroyTagsCache,
    getCachedCleanedTags,
    getCachedEscoTags,
    getTagsCacheStats,
    invalidateTagsCache,
    setCachedCleanedTags,
    setCachedEscoTags,
    startTagsCacheCleanup
} from '../../services/tagsCache.service.js';

describe('Tags Cache Service', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-04-05T10:00:00.000Z'));
        invalidateTagsCache();
    });

    afterEach(() => {
        destroyTagsCache();
        vi.clearAllTimers();
        vi.useRealTimers();
    });

    it('returns fresh cleaned tags and expires stale entries', () => {
        setCachedCleanedTags('firm_1_default', { Skills: ['JS'] });

        expect(getCachedCleanedTags('firm_1_default')).toEqual({ Skills: ['JS'] });

        vi.advanceTimersByTime(10 * 60 * 1000 + 1);

        expect(getCachedCleanedTags('firm_1_default')).toBeNull();
    });

    it('evicts the oldest cleaned entry when capacity is exceeded', () => {
        for (let index = 0; index < 101; index += 1) {
            setCachedCleanedTags(`key_${index}`, { index });
        }

        expect(getCachedCleanedTags('key_0')).toBeNull();
        expect(getCachedCleanedTags('key_100')).toEqual({ index: 100 });
    });

    it('tracks ESCO tags and resets them on invalidation', () => {
        setCachedEscoTags({ skills: ['ESCO'] });

        expect(getCachedEscoTags()).toEqual({ skills: ['ESCO'] });

        invalidateTagsCache();

        expect(getCachedEscoTags()).toBeNull();
    });

    it('returns cache stats with current keys', () => {
        setCachedCleanedTags('firm_1_default', { Skills: ['JS'] });
        setCachedEscoTags({ skills: ['ESCO'] });

        const stats = getTagsCacheStats();

        expect(stats.cleanedTags.size).toBe(1);
        expect(stats.cleanedTags.keys).toEqual(['firm_1_default']);
        expect(stats.escoTags.hasData).toBe(true);
        expect(stats.ttlMinutes).toBe(10);
    });

    it('keeps a single cleanup interval when started twice', () => {
        const first = startTagsCacheCleanup(60_000);
        const second = startTagsCacheCleanup(60_000);

        expect(second).toBe(first);
    });
});
