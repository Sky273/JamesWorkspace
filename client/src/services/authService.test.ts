/**
 * Tests for authService
 * After refactoring: authService uses apiInterceptor functions (fetchWithAuth,
 * fetchWithCsrfRetry, getCsrfToken, createAuthOptionsWithCsrf) instead of raw fetch.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Create mock functions
const mockFetchWithAuth = vi.fn();
const mockFetchWithCsrfRetry = vi.fn();
const mockGetCsrfToken = vi.fn();
const mockCreateAuthOptionsWithCsrf = vi.fn();
const mockClearCsrfToken = vi.fn();
const mockResetSessionState = vi.fn();
const mockIsSessionRedirectError = vi.fn((_err: unknown) => false);

// Mock apiInterceptor
vi.mock('../utils/apiInterceptor', () => ({
    fetchWithAuth: (url: string, opts?: unknown, timeout?: number) => mockFetchWithAuth(url, opts, timeout),
    fetchWithCsrfRetry: (url: string, opts?: unknown, timeout?: number) => mockFetchWithCsrfRetry(url, opts, timeout),
    getCsrfToken: (force?: boolean) => mockGetCsrfToken(force),
    createAuthOptionsWithCsrf: (opts?: unknown, force?: boolean) => mockCreateAuthOptionsWithCsrf(opts, force),
    clearCsrfToken: () => mockClearCsrfToken(),
    resetSessionState: () => mockResetSessionState(),
    isSessionRedirectError: (err: unknown) => mockIsSessionRedirectError(err),
}));

// Mock logger
vi.mock('../utils/logger.frontend', () => ({
    default: {
        log: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
    },
}));

import { authService } from './authService';

// Helper to create a mock Response
const mockResponse = (ok: boolean, data: unknown, status = ok ? 200 : 400): Response => ({
    ok,
    status,
    json: () => Promise.resolve(data),
    clone: () => mockResponse(ok, data, status),
} as unknown as Response);

describe('authService', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        authService.setCurrentUser(null);
        mockGetCsrfToken.mockResolvedValue('csrf-123');
        mockCreateAuthOptionsWithCsrf.mockImplementation(async (opts) => ({
            ...opts,
            headers: { ...opts?.headers, 'x-csrf-token': 'csrf-123' },
            credentials: 'include',
        }));
    });

    describe('signIn', () => {
        it('should sign in successfully and return user', async () => {
            const mockUser = { id: '1', name: 'Test User', email: 'test@test.com', role: 'user', status: 'active' };

            mockFetchWithAuth.mockResolvedValueOnce(
                mockResponse(true, { user: mockUser })
            );

            const result = await authService.signIn('test@test.com', 'password123');
            expect(result).toEqual(mockUser);
            expect(authService.getCurrentUser()).toEqual(mockUser);
            expect(mockGetCsrfToken).toHaveBeenCalled();
            expect(mockResetSessionState).toHaveBeenCalled();
        });

        it('should return 2FA response when required', async () => {
            mockFetchWithAuth.mockResolvedValueOnce(
                mockResponse(true, {
                    requires2FA: true,
                    userId: 'user-1',
                    message: 'Enter TOTP code',
                })
            );

            const result = await authService.signIn('test@test.com', 'password123');
            expect(result).toHaveProperty('requires2FA', true);
            expect(result).toHaveProperty('userId', 'user-1');
            // User should NOT be cached for 2FA response
            expect(authService.getCurrentUser()).toBeNull();
        });

        it('should throw on failed sign in', async () => {
            mockFetchWithAuth.mockResolvedValueOnce(
                mockResponse(false, { error: 'Invalid credentials' })
            );

            await expect(authService.signIn('test@test.com', 'wrong')).rejects.toThrow('Invalid credentials');
        });

        it('should check !response.ok before requires2FA', async () => {
            // Even if requires2FA is present, a non-ok response should throw
            mockFetchWithAuth.mockResolvedValueOnce(
                mockResponse(false, { requires2FA: true, error: 'Rate limited' }, 429)
            );

            await expect(authService.signIn('test@test.com', 'pass')).rejects.toThrow('Rate limited');
        });
    });

    describe('register', () => {
        it('should register successfully', async () => {
            mockFetchWithAuth.mockResolvedValueOnce(
                mockResponse(true, { message: 'Registration successful' })
            );

            const result = await authService.register({
                email: 'new@test.com',
                password: 'password123',
                name: 'New User',
            });

            expect(result.success).toBe(true);
            expect(result.message).toContain('Registration successful');
        });

        it('should throw on registration failure', async () => {
            mockFetchWithAuth.mockResolvedValueOnce(
                mockResponse(false, { error: 'Email already exists' })
            );

            await expect(
                authService.register({ email: 'dup@test.com', password: 'pass', name: 'Dup' })
            ).rejects.toThrow('Email already exists');
        });
    });

    describe('signOut', () => {
        it('should clear cached user on sign out', async () => {
            authService.setCurrentUser({ id: '1', name: 'Test', email: 'test@test.com', role: 'user', status: 'active' });
            expect(authService.getCurrentUser()).not.toBeNull();

            mockFetchWithCsrfRetry.mockResolvedValueOnce(mockResponse(true, {}));

            await authService.signOut();
            expect(authService.getCurrentUser()).toBeNull();
            expect(mockClearCsrfToken).toHaveBeenCalled();
        });

        it('should clear user even if logout API fails', async () => {
            authService.setCurrentUser({ id: '1', name: 'Test', email: 'test@test.com', role: 'user', status: 'active' });

            mockFetchWithCsrfRetry.mockRejectedValueOnce(new Error('Network error'));

            await authService.signOut();
            expect(authService.getCurrentUser()).toBeNull();
            expect(mockClearCsrfToken).toHaveBeenCalled();
        });
    });

    describe('refreshToken', () => {
        it('should refresh token and update user', async () => {
            const updatedUser = { id: '1', name: 'Test', email: 'test@test.com', role: 'user', status: 'active' };

            mockFetchWithAuth.mockResolvedValueOnce(
                mockResponse(true, { user: updatedUser })
            );

            const result = await authService.refreshToken();
            expect(result).toBe(true);
            expect(authService.getCurrentUser()).toEqual(updatedUser);
        });

        it('should throw and sign out on refresh failure', async () => {
            mockFetchWithAuth.mockResolvedValueOnce(
                mockResponse(false, { error: 'Refresh failed' })
            );
            // signOut will also call fetchWithCsrfRetry
            mockFetchWithCsrfRetry.mockResolvedValueOnce(mockResponse(true, {}));

            await expect(authService.refreshToken()).rejects.toThrow();
        });
    });

    describe('getCurrentUser / setCurrentUser / isAuthenticated', () => {
        it('should return null when no user is set', () => {
            expect(authService.getCurrentUser()).toBeNull();
        });

        it('should set and get current user', () => {
            const user = { id: '1', name: 'Test', email: 'test@test.com', role: 'user' as const, status: 'active' as const };
            authService.setCurrentUser(user);
            expect(authService.getCurrentUser()).toEqual(user);
        });

        it('should report authenticated when user is set', () => {
            authService.setCurrentUser({ id: '1', name: 'Test', email: 'test@test.com', role: 'user', status: 'active' });
            expect(authService.isAuthenticated()).toBe(true);
        });

        it('should report not authenticated when no user', () => {
            expect(authService.isAuthenticated()).toBe(false);
        });
    });

    describe('createUser', () => {
        it('should create user via API', async () => {
            const newUser = { id: '2', name: 'Created', email: 'created@test.com', role: 'user', status: 'active' };

            mockFetchWithCsrfRetry.mockResolvedValueOnce(
                mockResponse(true, newUser)
            );

            const result = await authService.createUser({
                email: 'created@test.com',
                password: 'pass123',
                name: 'Created',
            });

            expect(result.email).toBe('created@test.com');
            expect(mockCreateAuthOptionsWithCsrf).toHaveBeenCalled();
        });

        it('should throw on create failure', async () => {
            mockFetchWithCsrfRetry.mockResolvedValueOnce(
                mockResponse(false, { error: 'Forbidden' })
            );

            await expect(
                authService.createUser({ email: 'x@x.com', password: 'p', name: 'X' })
            ).rejects.toThrow('Forbidden');
        });
    });

    describe('updateUser', () => {
        it('should update user via API', async () => {
            const updated = { id: '1', name: 'Updated', email: 'test@test.com', role: 'user', status: 'active' };

            mockFetchWithCsrfRetry.mockResolvedValueOnce(
                mockResponse(true, updated)
            );

            const result = await authService.updateUser('1', { name: 'Updated' });
            expect(result.name).toBe('Updated');
        });
    });

    describe('deleteUser', () => {
        it('should delete user via API', async () => {
            mockFetchWithCsrfRetry.mockResolvedValueOnce(
                mockResponse(true, { message: 'User deleted' })
            );

            const result = await authService.deleteUser('user-123');
            expect(result.message).toBe('User deleted');
        });

        it('should throw on delete failure', async () => {
            mockFetchWithCsrfRetry.mockResolvedValueOnce(
                mockResponse(false, { error: 'Not found' })
            );

            await expect(authService.deleteUser('bad-id')).rejects.toThrow('Not found');
        });
    });
});
