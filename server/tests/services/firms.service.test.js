/**
 * Tests for Firms Service
 * Tests CRUD operations, logo management, and user association checks
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../config/database.js', () => ({
    query: vi.fn()
}));

vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn()
}));

const { mockFirmsCache, mockInvalidateFirmsCaches, mockInvalidateClientsCaches, mockInvalidateDealsCaches, mockInvalidateMissionsCaches } = vi.hoisted(() => ({
    mockFirmsCache: {
        getOrLoad: vi.fn(async (_key, loader) => loader())
    },
    mockInvalidateFirmsCaches: vi.fn(async () => undefined),
    mockInvalidateClientsCaches: vi.fn(async () => undefined),
    mockInvalidateDealsCaches: vi.fn(async () => undefined),
    mockInvalidateMissionsCaches: vi.fn(async () => undefined)
}));

vi.mock('../../services/cache.service.js', () => ({
    firmsCache: mockFirmsCache,
    CACHE_KEYS: {
        firms: {
            ALL_FIRMS: 'all'
        }
    },
    invalidateFirmsCaches: (...args) => mockInvalidateFirmsCaches(...args),
    invalidateClientsCaches: (...args) => mockInvalidateClientsCaches(...args),
    invalidateDealsCaches: (...args) => mockInvalidateDealsCaches(...args),
    invalidateMissionsCaches: (...args) => mockInvalidateMissionsCaches(...args)
}));

import { query } from '../../config/database.js';
import {
    listFirms,
    getFirmById,
    createFirm,
    updateFirm,
    getAssociatedUsersCount,
    deleteFirm,
    uploadFirmLogo,
    getFirmLogo,
    deleteFirmLogo
} from '../../services/firms.service.js';

describe('Firms Service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockFirmsCache.getOrLoad.mockImplementation(async (_key, loader) => loader());
    });

    describe('listFirms', () => {
        it('should return paginated firms', async () => {
            query
                .mockResolvedValueOnce({ rows: [{ id: 'f1' }, { id: 'f2' }] })
                .mockResolvedValueOnce({ rows: [{ count: '2' }] });

            const result = await listFirms({ page: 1, limit: 100 });

            expect(result.firms).toHaveLength(2);
            expect(result.hasMore).toBe(false);
            expect(result.totalCount).toBe(2);
        });

        it('should detect hasMore', async () => {
            const firms = Array(101).fill(null).map((_, i) => ({ id: `f${i}` }));
            query
                .mockResolvedValueOnce({ rows: firms })
                .mockResolvedValueOnce({ rows: [{ count: '200' }] });

            const result = await listFirms({ page: 1, limit: 100 });

            expect(result.firms).toHaveLength(100);
            expect(result.hasMore).toBe(true);
        });

        it('should apply search filter', async () => {
            query
                .mockResolvedValueOnce({ rows: [] })
                .mockResolvedValueOnce({ rows: [{ count: '0' }] });

            await listFirms({ search: 'acme' });

            expect(query.mock.calls[0][0]).toContain('LOWER(name) LIKE');
        });

        it('should skip count on pages > 1', async () => {
            query.mockResolvedValueOnce({ rows: [] });

            const result = await listFirms({ page: 2 });

            expect(query).toHaveBeenCalledTimes(1);
            expect(result.totalCount).toBeNull();
        });

        it('should bypass cache when requested', async () => {
            query
                .mockResolvedValueOnce({ rows: [] })
                .mockResolvedValueOnce({ rows: [{ count: '0' }] });

            await listFirms({ bypassCache: true });

            expect(mockFirmsCache.getOrLoad).not.toHaveBeenCalled();
        });
    });

    describe('getFirmById', () => {
        it('should return firm', async () => {
            query.mockResolvedValueOnce({ rows: [{ id: 'f1', name: 'Acme' }] });
            expect(await getFirmById('f1')).toEqual({ id: 'f1', name: 'Acme' });
        });

        it('should throw 404 if not found', async () => {
            query.mockResolvedValueOnce({ rows: [] });
            try {
                await getFirmById('missing');
                expect.fail('Should have thrown');
            } catch (err) {
                expect(err.statusCode).toBe(404);
            }
        });

        it('should bypass cache when requested', async () => {
            query.mockResolvedValueOnce({ rows: [{ id: 'f1', name: 'Acme' }] });

            await getFirmById('f1', { bypassCache: true });

            expect(mockFirmsCache.getOrLoad).not.toHaveBeenCalled();
        });
    });

    describe('createFirm', () => {
        it('should create and return firm', async () => {
            query.mockResolvedValueOnce({ rows: [{ id: 'f1', name: 'New' }] });

            const result = await createFirm({ name: 'New', status: 'active' });

            expect(result.name).toBe('New');
            expect(query.mock.calls[0][0]).toContain('INSERT INTO firms');
        });

        it('should skip undefined values', async () => {
            query.mockResolvedValueOnce({ rows: [{ id: 'f1' }] });

            await createFirm({ name: 'X', status: undefined });

            expect(query.mock.calls[0][1]).toHaveLength(1); // only name
        });
    });

    describe('updateFirm', () => {
        it('should update and return firm', async () => {
            query.mockResolvedValueOnce({ rows: [{ id: 'f1', name: 'Updated' }] });

            const result = await updateFirm('f1', { name: 'Updated' });

            expect(result.name).toBe('Updated');
        });

        it('should return existing firm if no fields to update', async () => {
            query.mockResolvedValueOnce({ rows: [{ id: 'f1', name: 'Same' }] });

            const result = await updateFirm('f1', {});

            expect(result.name).toBe('Same');
        });

        it('should throw 404 if not found on update', async () => {
            query.mockResolvedValueOnce({ rows: [] });
            try {
                await updateFirm('missing', { name: 'X' });
                expect.fail('Should have thrown');
            } catch (err) {
                expect(err.statusCode).toBe(404);
            }
        });
    });

    describe('getAssociatedUsersCount', () => {
        it('should return user count', async () => {
            query.mockResolvedValueOnce({ rows: [{ count: '5' }] });
            expect(await getAssociatedUsersCount('f1')).toBe(5);
        });
    });

    describe('deleteFirm', () => {
        it('should return true when deleted', async () => {
            query.mockResolvedValueOnce({ rows: [{ id: 'f1' }] });
            expect(await deleteFirm('f1')).toBe(true);
        });

        it('should throw 404 if not found', async () => {
            query.mockResolvedValueOnce({ rows: [] });
            try {
                await deleteFirm('missing');
                expect.fail('Should have thrown');
            } catch (err) {
                expect(err.statusCode).toBe(404);
            }
        });
    });

    describe('uploadFirmLogo', () => {
        it('should update logo and return URL', async () => {
            query.mockResolvedValueOnce({ rows: [] });

            const url = await uploadFirmLogo('f1', Buffer.from('img'), 'image/png');

            expect(url).toBe('/api/firms/f1/logo/image');
            expect(query.mock.calls[0][1][0]).toEqual(Buffer.from('img'));
        });
    });

    describe('getFirmLogo', () => {
        it('should return logo data', async () => {
            query.mockResolvedValueOnce({ rows: [{ logo_data: Buffer.from('img'), logo_mime_type: 'image/png' }] });

            const result = await getFirmLogo('f1');

            expect(result.logo_mime_type).toBe('image/png');
        });

        it('should return null if no logo', async () => {
            query.mockResolvedValueOnce({ rows: [{ logo_data: null }] });
            expect(await getFirmLogo('f1')).toBeNull();
        });

        it('should return null if firm not found', async () => {
            query.mockResolvedValueOnce({ rows: [] });
            expect(await getFirmLogo('missing')).toBeNull();
        });
    });

    describe('deleteFirmLogo', () => {
        it('should set logo fields to NULL', async () => {
            query.mockResolvedValueOnce({ rows: [] });

            await deleteFirmLogo('f1');

            expect(query.mock.calls[0][0]).toContain('logo_data = NULL');
        });
    });
});
