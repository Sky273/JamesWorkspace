import { EventEmitter } from 'node:events';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockQuery = vi.fn();
const mockGetClientWithRetry = vi.fn();
const mockSafeLog = vi.fn();

vi.mock('../../config/database.js', () => ({
    query: (...args) => mockQuery(...args),
    getClientWithRetry: (...args) => mockGetClientWithRetry(...args)
}));

vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: (...args) => mockSafeLog(...args)
}));

import {
    CACHE_INVALIDATION_CHANNEL,
    bumpCacheScopeVersion,
    getCacheScopeVersion,
    getCacheScopeVersions,
    publishCacheInvalidation,
    subscribeToCacheInvalidations,
    unsubscribeFromCacheInvalidations
} from '../../services/cacheVersion.service.js';

describe('Cache Version Service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should read a cache scope version and create the row on first access', async () => {
        mockQuery
            .mockResolvedValueOnce({ rowCount: 1, rows: [] })
            .mockResolvedValueOnce({ rows: [{ scope: 'settings', version: 1, updated_at: '2026-04-12T00:00:00.000Z' }] });

        await expect(getCacheScopeVersion('settings')).resolves.toBe(1);
        expect(mockQuery).toHaveBeenCalledTimes(2);
    });

    it('should read multiple cache scope versions', async () => {
        mockQuery.mockImplementation(async (sql, params) => {
            if (sql.includes('INSERT INTO public.cache_scope_versions')) {
                return { rowCount: 1, rows: [] };
            }

            return {
                rows: [{ scope: params[0], version: params[0] === 'settings' ? 1 : 3 }]
            };
        });

        await expect(getCacheScopeVersions(['settings', 'templates'])).resolves.toEqual({
            settings: 1,
            templates: 3
        });
    });

    it('should bump a cache scope version', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [{ scope: 'settings', version: 2, updated_at: '2026-04-12T00:00:00.000Z' }] });

        await expect(bumpCacheScopeVersion('settings')).resolves.toBe(2);
        expect(mockQuery).toHaveBeenCalledWith(
            expect.stringContaining('INSERT INTO public.cache_scope_versions'),
            ['settings', 2]
        );
    });

    it('should publish a cache invalidation notification', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [] });

        await expect(
            publishCacheInvalidation('settings', 4, { reason: 'settings_saved', source: 'settings.service' })
        ).resolves.toMatchObject({
            scope: 'settings',
            version: 4,
            reason: 'settings_saved',
            source: 'settings.service'
        });

        expect(mockQuery).toHaveBeenCalledWith(
            'SELECT pg_notify($1, $2)',
            [
                CACHE_INVALIDATION_CHANNEL,
                expect.stringContaining('"scope":"settings"')
            ]
        );
    });

    it('should subscribe to cache invalidations and forward notifications', async () => {
        const client = new EventEmitter();
        client.query = vi.fn(async () => ({ rows: [] }));
        client.release = vi.fn();

        mockGetClientWithRetry.mockResolvedValueOnce(client);

        const handler = vi.fn();
        await subscribeToCacheInvalidations(handler);

        expect(client.query).toHaveBeenCalledWith(`LISTEN ${CACHE_INVALIDATION_CHANNEL}`);

        client.emit('notification', {
            channel: CACHE_INVALIDATION_CHANNEL,
            payload: JSON.stringify({ scope: 'templates', version: 7 })
        });

        expect(handler).toHaveBeenCalledWith({
            scope: 'templates',
            version: 7
        });

        await unsubscribeFromCacheInvalidations();

        expect(client.query).toHaveBeenCalledWith(`UNLISTEN ${CACHE_INVALIDATION_CHANNEL}`);
        expect(client.release).toHaveBeenCalled();
    });
});
