/**
 * Tests for Users Service
 * Tests listing, profile updates, and admin CRUD operations
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../config/database.js', () => ({
    query: vi.fn()
}));

vi.mock('../../utils/postgresHelpers.js', () => ({
    selectWithTimeout: vi.fn(),
    createWithTimeout: vi.fn(),
    updateWithTimeout: vi.fn(),
    destroyWithTimeout: vi.fn(),
    transaction: vi.fn(async (callback) => callback({ query: (...args) => query(...args) })),
    escapeLike: vi.fn((str) => str.replace(/[%_\\]/g, '\\$&'))
}));

const { mockUsersCache, mockInvalidateUsersCaches, mockInvalidateClientsCaches } = vi.hoisted(() => ({
    mockUsersCache: {
        getOrLoad: vi.fn(async (_key, loader) => loader())
    },
    mockInvalidateUsersCaches: vi.fn(async () => undefined),
    mockInvalidateClientsCaches: vi.fn(async () => undefined)
}));

vi.mock('../../services/cache.service.js', () => ({
    CACHE_KEYS: {
        users: {
            ALL_USERS: 'all'
        }
    },
    usersCache: mockUsersCache,
    invalidateUsersCaches: (...args) => mockInvalidateUsersCaches(...args),
    invalidateClientsCaches: (...args) => mockInvalidateClientsCaches(...args)
}));

import { query } from '../../config/database.js';
import { selectWithTimeout, createWithTimeout, updateWithTimeout, transaction } from '../../utils/postgresHelpers.js';
import {
    listUsers,
    updateUserProfile,
    findUserByEmail,
    createAdminUser,
    findUserById,
    updateAdminUser,
    deleteUser,
    listAllUsers
} from '../../services/users.service.js';

describe('Users Service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockUsersCache.getOrLoad.mockImplementation(async (_key, loader) => loader());
    });

    describe('listUsers', () => {
        it('should return users with hasMore flag', async () => {
            query.mockResolvedValueOnce({ rows: [{ total: 2 }] });
            selectWithTimeout.mockResolvedValueOnce([{ id: 'u1' }, { id: 'u2' }]);

            const result = await listUsers({ page: 1, limit: 100 });

            expect(result.users).toHaveLength(2);
            expect(result.hasMore).toBe(false);
            expect(result.totalCount).toBe(2);
        });

        it('should detect hasMore when results exceed limit', async () => {
            const users = Array(101).fill(null).map((_, i) => ({ id: `u${i}` }));
            query.mockResolvedValueOnce({ rows: [{ total: 101 }] });
            selectWithTimeout.mockResolvedValueOnce(users);

            const result = await listUsers({ page: 1, limit: 100 });

            expect(result.users).toHaveLength(100);
            expect(result.hasMore).toBe(true);
        });

        it('should apply search filter', async () => {
            query.mockResolvedValueOnce({ rows: [{ total: 0 }] });
            selectWithTimeout.mockResolvedValueOnce([]);

            await listUsers({ search: 'john' });

            const opts = selectWithTimeout.mock.calls[0][1];
            expect(opts.where).toContain('LOWER(name) LIKE');
        });

        it('should apply role filter', async () => {
            query.mockResolvedValueOnce({ rows: [{ total: 0 }] });
            selectWithTimeout.mockResolvedValueOnce([]);

            await listUsers({ role: 'admin' });

            const opts = selectWithTimeout.mock.calls[0][1];
            expect(opts.where).toContain('role = $');
        });

        it('should skip role filter for "all"', async () => {
            query.mockResolvedValueOnce({ rows: [{ total: 0 }] });
            selectWithTimeout.mockResolvedValueOnce([]);

            await listUsers({ role: 'all' });

            const opts = selectWithTimeout.mock.calls[0][1];
            expect(opts.where).toBe('');
        });

        it('should apply status filter', async () => {
            query.mockResolvedValueOnce({ rows: [{ total: 0 }] });
            selectWithTimeout.mockResolvedValueOnce([]);

            await listUsers({ status: 'active' });

            const opts = selectWithTimeout.mock.calls[0][1];
            expect(opts.where).toContain('status = $');
        });

        it('should clamp invalid pagination inputs', async () => {
            query.mockResolvedValueOnce({ rows: [{ total: 0 }] });
            selectWithTimeout.mockResolvedValueOnce([]);

            await listUsers({ page: -2, limit: 500 });

            const opts = selectWithTimeout.mock.calls[0][1];
            expect(opts.limit).toBe(101);
            expect(opts.offset).toBe(0);
        });
    });

    describe('updateUserProfile', () => {
        it('should update basic fields', async () => {
            query.mockResolvedValueOnce({ rows: [{ id: 'u1', name: 'Updated' }] });

            const result = await updateUserProfile('u1', { name: 'Updated', phone: '123' }, false);

            expect(result.name).toBe('Updated');
            expect(query.mock.calls[0][0]).toContain('UPDATE users SET');
        });

        it('should include admin-only fields when isAdmin', async () => {
            query.mockResolvedValueOnce({ rows: [{ id: 'u1', role: 'admin' }] });

            await updateUserProfile('u1', { role: 'admin', status: 'active', firm_id: 'f1' }, true);

            const sql = query.mock.calls[0][0];
            expect(sql).toContain('role = $');
            expect(sql).toContain('status = $');
            expect(sql).toContain('firm_id = $');
        });

        it('should ignore admin fields when not admin', async () => {
            query.mockResolvedValueOnce({ rows: [{ id: 'u1' }] });

            await updateUserProfile('u1', { name: 'X', role: 'admin' }, false);

            const sql = query.mock.calls[0][0];
            expect(sql).toContain('name = $');
            expect(sql).not.toContain('role = $');
        });

        it('should return noFields if nothing to update', async () => {
            const result = await updateUserProfile('u1', {}, false);
            expect(result.noFields).toBe(true);
        });

        it('should return null if user not found', async () => {
            query.mockResolvedValueOnce({ rows: [] });
            expect(await updateUserProfile('missing', { name: 'X' }, false)).toBeNull();
        });
    });

    describe('findUserByEmail', () => {
        it('should return user if found', async () => {
            selectWithTimeout.mockResolvedValueOnce([{ id: 'u1', email: 'test@test.com' }]);
            expect(await findUserByEmail('test@test.com')).toEqual({ id: 'u1', email: 'test@test.com' });
        });

        it('should return null if not found', async () => {
            selectWithTimeout.mockResolvedValueOnce([]);
            expect(await findUserByEmail('missing@test.com')).toBeNull();
        });
    });

    describe('createAdminUser', () => {
        it('should create user and return it', async () => {
            createWithTimeout.mockResolvedValueOnce([{ id: 'u1', email: 'new@test.com' }]);

            const result = await createAdminUser({ email: 'new@test.com', name: 'New' });

            expect(result).toEqual({ id: 'u1', email: 'new@test.com' });
            expect(createWithTimeout).toHaveBeenCalledWith('users', [{ fields: { email: 'new@test.com', name: 'New' } }]);
        });
    });

    describe('findUserById', () => {
        it('should return user if found', async () => {
            selectWithTimeout.mockResolvedValueOnce([{ id: 'u1' }]);
            expect(await findUserById('u1')).toEqual({ id: 'u1' });
        });

        it('should return null if not found', async () => {
            selectWithTimeout.mockResolvedValueOnce([]);
            expect(await findUserById('missing')).toBeNull();
        });

        it('should bypass cache when requested', async () => {
            selectWithTimeout.mockResolvedValueOnce([{ id: 'u1' }]);

            const result = await findUserById('u1', { useCache: false });

            expect(result).toEqual({ id: 'u1' });
            expect(mockUsersCache.getOrLoad).not.toHaveBeenCalled();
        });
    });

    describe('updateAdminUser', () => {
        it('should update and return user', async () => {
            updateWithTimeout.mockResolvedValueOnce([{ id: 'u1', name: 'Updated' }]);

            const result = await updateAdminUser('u1', { name: 'Updated' });

            expect(result).toEqual({ id: 'u1', name: 'Updated' });
        });
    });

    describe('deleteUser', () => {
        it('should clear blocking references then delete the user in one transaction', async () => {
            query
                .mockResolvedValueOnce({ rows: [{ id: 'u1' }] })
                .mockResolvedValueOnce({ rows: [] })
                .mockResolvedValueOnce({ rows: [] })
                .mockResolvedValueOnce({ rows: [{ id: 'u1' }] });

            const result = await deleteUser('u1');

            expect(transaction).toHaveBeenCalled();
            expect(query.mock.calls[0][0]).toContain('SELECT id FROM users WHERE id = $1 FOR UPDATE');
            expect(query.mock.calls[1][0]).toContain('UPDATE deals SET created_by = NULL');
            expect(query.mock.calls[2][0]).toContain('UPDATE deal_resumes SET added_by = NULL');
            expect(query.mock.calls[3][0]).toContain('DELETE FROM users');
            expect(result).toEqual(['u1']);
        });

        it('should throw 404 if the user does not exist', async () => {
            query
                .mockResolvedValueOnce({ rows: [] })

            await expect(deleteUser('missing')).rejects.toMatchObject({ statusCode: 404 });
        });
    });

    describe('listAllUsers', () => {
        it('should return all users', async () => {
            selectWithTimeout.mockResolvedValueOnce([{ id: 'u1' }, { id: 'u2' }]);

            const result = await listAllUsers();

            expect(result).toHaveLength(2);
            expect(selectWithTimeout).toHaveBeenCalledWith('users', {});
        });
    });
});
