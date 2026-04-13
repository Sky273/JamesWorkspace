/**
 * Tests for Auth Service
 * Tests user lookup, login tracking, registration
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../config/database.js', () => ({
    query: vi.fn(),
    getClient: vi.fn()
}));

vi.mock('../../utils/postgresHelpers.js', () => ({
    selectWithTimeout: vi.fn(),
    selectRawWithTimeout: vi.fn(),
    createWithTimeout: vi.fn()
}));

vi.mock('../../services/settings.service.js', () => ({
    getLLMSettings: vi.fn()
}));

vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn()
}));

import { getClient, query } from '../../config/database.js';
import { selectRawWithTimeout, selectWithTimeout, createWithTimeout } from '../../utils/postgresHelpers.js';
import { getLLMSettings } from '../../services/settings.service.js';
import {
    findUserWithFirmByEmail,
    findUserWithFirmById,
    updateLastLogin,
    findExistingUserByEmail,
    createUser,
    registerGoogleUser,
    registerSelfServiceUser
} from '../../services/auth.service.js';

describe('Auth Service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        query.mockReset();
        getClient.mockReset();
        selectRawWithTimeout.mockReset();
        selectWithTimeout.mockReset();
        createWithTimeout.mockReset();
        getLLMSettings.mockReset();
        getLLMSettings.mockResolvedValue({});
    });

    describe('findUserWithFirmByEmail', () => {
        it('should return user with firm logo', async () => {
            selectRawWithTimeout.mockResolvedValueOnce([{ id: 'u1', email: 'test@test.com', firm_logo: '/logo.png' }]);

            const result = await findUserWithFirmByEmail('test@test.com');

            expect(result.firm_logo).toBe('/logo.png');
            expect(selectRawWithTimeout.mock.calls[0][0]).toContain('LEFT JOIN firms');
        });

        it('should return null if not found', async () => {
            selectRawWithTimeout.mockResolvedValueOnce([]);
            expect(await findUserWithFirmByEmail('missing@test.com')).toBeNull();
        });
    });

    describe('findUserWithFirmById', () => {
        it('should return user with firm logo by ID', async () => {
            selectRawWithTimeout.mockResolvedValueOnce([{ id: 'u1', firm_logo: '/logo.png' }]);

            const result = await findUserWithFirmById('u1');

            expect(result.id).toBe('u1');
        });

        it('should return null if not found', async () => {
            selectRawWithTimeout.mockResolvedValueOnce([]);
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
            query.mockResolvedValueOnce({ rows: [{ id: 'firm-1', name: 'Acme' }] });
            createWithTimeout.mockResolvedValueOnce([{ id: 'u1', email: 'new@test.com' }]);

            const result = await createUser({
                email: 'new@test.com',
                name: 'New',
                password: 'hash',
                firm_id: 'firm-1',
                firm_name: 'Acme'
            });

            expect(result.email).toBe('new@test.com');
            expect(createWithTimeout).toHaveBeenCalledWith('users', [{
                fields: {
                    email: 'new@test.com',
                    name: 'New',
                    password: 'hash',
                    firm_id: 'firm-1',
                    firm_name: 'Acme'
                }
            }]);
        });

        it('should auto-assign default firm when missing', async () => {
            query.mockResolvedValueOnce({ rows: [] });
            query.mockResolvedValueOnce({ rows: [{ id: 'firm-default', name: 'Public Registration' }] });
            createWithTimeout.mockResolvedValueOnce([{ id: 'u1', email: 'new@test.com' }]);

            await createUser({ email: 'new@test.com', name: 'New', password: 'hash' });

            expect(query).toHaveBeenCalledWith(expect.stringContaining('SELECT id, name'), ['Public Registration']);
            expect(query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO firms'), ['Public Registration']);
            expect(createWithTimeout).toHaveBeenCalledWith('users', [{
                fields: expect.objectContaining({
                    firm_id: 'firm-default',
                    firm_name: 'Public Registration'
                })
            }]);
        });
    });

    describe('registerGoogleUser', () => {
        it('should insert Google OAuth user with pending status', async () => {
            query.mockResolvedValueOnce({ rows: [{ id: 'u1', google_id: 'g123', role: 'user', status: 'pending' }] });

            const result = await registerGoogleUser({
                email: 'user@gmail.com',
                name: 'User',
                googleId: 'g123',
                googleEmail: 'user@gmail.com',
                firmId: 'firm-1',
                firmName: 'Acme'
            });

            expect(result.status).toBe('pending');
            expect(query.mock.calls[0][0]).toContain('INSERT INTO users');
            expect(query.mock.calls[0][1]).toContain('g123');
            expect(query.mock.calls[0][1]).toContain('firm-1');
        });

        it('should auto-assign default firm for Google registration when missing', async () => {
            query.mockResolvedValueOnce({ rows: [] });
            query.mockResolvedValueOnce({ rows: [{ id: 'firm-default', name: 'Public Registration' }] });
            query.mockResolvedValueOnce({ rows: [{ id: 'u1', google_id: 'g123', role: 'user', status: 'pending' }] });

            const result = await registerGoogleUser({
                email: 'user@gmail.com',
                name: 'User',
                googleId: 'g123',
                googleEmail: 'user@gmail.com'
            });

            expect(result.status).toBe('pending');
            expect(query.mock.calls[2][1]).toContain('firm-default');
        });
    });

    describe('registerSelfServiceUser', () => {
        it('should keep the pending workflow when auto-approval is disabled', async () => {
            getLLMSettings.mockResolvedValueOnce({
                allowUserRegistrationWithoutApproval: false
            });
            query.mockResolvedValueOnce({ rows: [] });
            query.mockResolvedValueOnce({ rows: [{ id: 'firm-default', name: 'Public Registration' }] });
            createWithTimeout.mockResolvedValueOnce([{ id: 'u1', email: 'new@test.com', status: 'pending' }]);

            const result = await registerSelfServiceUser({
                email: 'new@test.com',
                password: 'hash',
                name: 'New User'
            });

            expect(result.autoApproved).toBe(false);
            expect(result.user.status).toBe('pending');
            expect(createWithTimeout).toHaveBeenCalledWith('users', [{
                fields: expect.objectContaining({
                    email: 'new@test.com',
                    password: 'hash',
                    status: 'pending',
                    firm_name: 'Public Registration'
                })
            }]);
        });

        it('should create an active user in a dedicated test firm when auto-approval is enabled', async () => {
            const mockClient = {
                query: vi.fn(),
                release: vi.fn()
            };
            getLLMSettings.mockResolvedValueOnce({
                allowUserRegistrationWithoutApproval: true,
                firmInitialCredits: 1800
            });
            getClient.mockResolvedValueOnce(mockClient);
            mockClient.query
                .mockResolvedValueOnce(undefined)
                .mockResolvedValueOnce(undefined)
                .mockResolvedValueOnce({ rows: [{ id: 'firm-test-1', name: 'Cabinet test' }] })
                .mockResolvedValueOnce(undefined)
                .mockResolvedValueOnce({ rows: [{ id: 'u-auto', email: 'active@test.com', status: 'active', firm_name: 'Cabinet test' }] })
                .mockResolvedValueOnce(undefined);

            const result = await registerSelfServiceUser({
                email: 'active@test.com',
                password: 'hash',
                name: 'Active User'
            });

            expect(result.autoApproved).toBe(true);
            expect(result.user.status).toBe('active');
            expect(mockClient.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO firms'), ['Cabinet test', 1800]);
            expect(mockClient.query).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO users'),
                ['active@test.com', 'hash', 'Active User', null, null, null, 'firm-test-1', 'Cabinet test']
            );
            expect(mockClient.release).toHaveBeenCalled();
        });

        it('should retry with a suffixed dedicated test firm name when Cabinet test already exists', async () => {
            const duplicateFirmError = new Error('duplicate key value violates unique constraint "firms_name_key"');
            duplicateFirmError.code = '23505';

            const mockClient = {
                query: vi.fn(),
                release: vi.fn()
            };

            getLLMSettings.mockResolvedValueOnce({
                allowUserRegistrationWithoutApproval: true,
                firmInitialCredits: 1000
            });
            getClient.mockResolvedValueOnce(mockClient);
            mockClient.query
                .mockResolvedValueOnce(undefined)
                .mockResolvedValueOnce(undefined)
                .mockRejectedValueOnce(duplicateFirmError)
                .mockResolvedValueOnce(undefined)
                .mockResolvedValueOnce(undefined)
                .mockResolvedValueOnce({ rows: [{ id: 'firm-test-2', name: 'Cabinet test 2' }] })
                .mockResolvedValueOnce(undefined)
                .mockResolvedValueOnce({ rows: [{ id: 'u-auto-2', email: 'retry@test.com', status: 'active', firm_name: 'Cabinet test 2' }] })
                .mockResolvedValueOnce(undefined);

            const result = await registerSelfServiceUser({
                email: 'retry@test.com',
                password: 'hash',
                name: 'Retry User'
            });

            expect(result.autoApproved).toBe(true);
            expect(result.user.firm_name).toBe('Cabinet test 2');
            expect(mockClient.query).toHaveBeenCalledWith(expect.stringContaining('ROLLBACK TO SAVEPOINT auto_approved_firm_name_0'));
            expect(mockClient.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO firms'), ['Cabinet test', 1000]);
            expect(mockClient.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO firms'), ['Cabinet test 2', 1000]);
            expect(mockClient.query).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO users'),
                ['retry@test.com', 'hash', 'Retry User', null, null, null, 'firm-test-2', 'Cabinet test 2']
            );
            expect(mockClient.release).toHaveBeenCalled();
        });
    });
});
