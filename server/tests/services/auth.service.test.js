/**
 * Tests for Auth Service
 * Tests user lookup, login tracking, registration
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../config/database.js', () => ({
    query: vi.fn()
}));

vi.mock('../../utils/postgresHelpers.js', () => ({
    selectWithTimeout: vi.fn(),
    createWithTimeout: vi.fn()
}));

import { query } from '../../config/database.js';
import { selectWithTimeout, createWithTimeout } from '../../utils/postgresHelpers.js';
import {
    findUserWithFirmByEmail,
    findUserWithFirmById,
    updateLastLogin,
    findExistingUserByEmail,
    createUser,
    registerGoogleUser
} from '../../services/auth.service.js';

describe('Auth Service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('findUserWithFirmByEmail', () => {
        it('should return user with firm logo', async () => {
            selectWithTimeout.mockResolvedValueOnce([{ id: 'u1', email: 'test@test.com', firm_logo: '/logo.png' }]);

            const result = await findUserWithFirmByEmail('test@test.com');

            expect(result.firm_logo).toBe('/logo.png');
            expect(selectWithTimeout.mock.calls[0][1].rawQuery).toContain('LEFT JOIN firms');
        });

        it('should return null if not found', async () => {
            selectWithTimeout.mockResolvedValueOnce([]);
            expect(await findUserWithFirmByEmail('missing@test.com')).toBeNull();
        });
    });

    describe('findUserWithFirmById', () => {
        it('should return user with firm logo by ID', async () => {
            selectWithTimeout.mockResolvedValueOnce([{ id: 'u1', firm_logo: '/logo.png' }]);

            const result = await findUserWithFirmById('u1');

            expect(result.id).toBe('u1');
        });

        it('should return null if not found', async () => {
            selectWithTimeout.mockResolvedValueOnce([]);
            expect(await findUserWithFirmById('missing')).toBeNull();
        });
    });

    describe('updateLastLogin', () => {
        it('should update last_login timestamp', async () => {
            query.mockResolvedValueOnce({ rows: [] });

            await updateLastLogin('u1');

            expect(query.mock.calls[0][0]).toContain('UPDATE users SET last_login');
            expect(query.mock.calls[0][1]).toEqual(['u1']);
        });
    });

    describe('findExistingUserByEmail', () => {
        it('should return existing user', async () => {
            selectWithTimeout.mockResolvedValueOnce([{ id: 'u1', email: 'test@test.com' }]);
            expect(await findExistingUserByEmail('test@test.com')).toEqual({ id: 'u1', email: 'test@test.com' });
        });

        it('should return null if not found', async () => {
            selectWithTimeout.mockResolvedValueOnce([]);
            expect(await findExistingUserByEmail('missing@test.com')).toBeNull();
        });
    });

    describe('createUser', () => {
        it('should create and return user', async () => {
            createWithTimeout.mockResolvedValueOnce([{ id: 'u1', email: 'new@test.com' }]);

            const result = await createUser({ email: 'new@test.com', name: 'New', password: 'hash' });

            expect(result.email).toBe('new@test.com');
            expect(createWithTimeout).toHaveBeenCalledWith('users', [{ fields: { email: 'new@test.com', name: 'New', password: 'hash' } }]);
        });
    });

    describe('registerGoogleUser', () => {
        it('should insert Google OAuth user with pending status', async () => {
            query.mockResolvedValueOnce({ rows: [{ id: 'u1', google_id: 'g123', role: 'user', status: 'pending' }] });

            const result = await registerGoogleUser({
                email: 'user@gmail.com', name: 'User', googleId: 'g123', googleEmail: 'user@gmail.com'
            });

            expect(result.status).toBe('pending');
            expect(query.mock.calls[0][0]).toContain('INSERT INTO users');
            expect(query.mock.calls[0][1]).toContain('g123');
        });
    });
});
