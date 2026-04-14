/**
 * Tests for authService
 * Public auth endpoints use fetch + CSRF token, while authenticated mutations still
 * rely on the shared interceptor helpers.
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
const mockFetch = vi.fn();

// Mock apiInterceptor
vi.mock('../utils/apiInterceptor', () => ({
    fetchWithAuth: (url: string, opts?: unknown, timeout?: number) => mockFetchWithAuth(url, opts, timeout),
    fetchWithCsrfRetry: (url: string, opts?: unknown, timeout?: number) => mockFetchWithCsrfRetry(url, opts, timeout),
    getCsrfToken: (force?: boolean) => mockGetCsrfToken(force),
    createAuthOptionsWithCsrf: (opts?: unknown, force?: boolean) => mockCreateAuthOptionsWithCsrf(opts, force),
    clearCsrfToken: () => mockClearCsrfToken(),
    resetSessionState: () => mockResetSessionState(),
    isSessionRedirectError: (err: unknown) => mockIsSessionRedirectError(err),
    AUTH_ERROR_PATTERNS: ['jwt malformed', 'invalid token', 'jwt expired', 'token invalid'],
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
        vi.stubGlobal('fetch', mockFetch);
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

            mockFetch.mockResolvedValueOnce(
                mockResponse(true, { user: mockUser })
            );

            const result = await authService.signIn('test@test.com', 'password123');
            expect(result).toEqual(mockUser);
            expect(authService.getCurrentUser()).toEqual(mockUser);
            expect(mockGetCsrfToken).toHaveBeenCalled();
            expect(mockResetSessionState).toHaveBeenCalled();
        });

        it('should return 2FA response when required', async () => {
            mockFetch.mockResolvedValueOnce(
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
            mockFetch.mockResolvedValueOnce(
                mockResponse(false, { error: 'Invalid credentials' })
            );

            await expect(authService.signIn('test@test.com', 'wrong')).rejects.toThrow('Invalid credentials');
        });

        it('should check !response.ok before requires2FA', async () => {
            // Even if requires2FA is present, a non-ok response should throw
            mockFetch.mockResolvedValueOnce(
                mockResponse(false, { requires2FA: true, error: 'Rate limited' }, 429)
            );

            await expect(authService.signIn('test@test.com', 'pass')).rejects.toThrow('Rate limited');
        });

        it('should preserve backend auth codes on sign in failures', async () => {
            mockFetch.mockResolvedValueOnce(
                mockResponse(false, { error: 'Account is inactive. Please contact administrator.', code: 'account_inactive' }, 403)
            );

            await expect(authService.signIn('test@test.com', 'password123')).rejects.toMatchObject({
                message: 'Account is inactive. Please contact administrator.',
                code: 'account_inactive',
                status: 403,
            });
        });
    });

    describe('register', () => {
        it('should register successfully', async () => {
            mockFetch.mockResolvedValueOnce(
                mockResponse(true, { message: 'Registration successful' })
            );

            const result = await authService.register({
                email: 'new@test.com',
                password: 'password123',
                name: 'New User',
                website: '',
                formRenderedAt: 1710000000000,
            });

            expect(result.success).toBe(true);
            expect(result.message).toContain('Registration successful');
        });

        it('should preserve the registration mode returned by the backend', async () => {
            mockFetch.mockResolvedValueOnce(
                mockResponse(true, { message: 'Registration successful', registrationStatus: 'active', autoApproved: true })
            );

            const result = await authService.register({
                email: 'new@test.com',
                password: 'password123',
                name: 'New User',
                website: '',
                formRenderedAt: 1710000000000,
            });

            expect(result.registrationStatus).toBe('active');
            expect(result.autoApproved).toBe(true);
        });

        it('should throw on registration failure', async () => {
            mockFetch.mockResolvedValueOnce(
                mockResponse(false, { error: 'Email already exists' })
            );

            await expect(
                authService.register({ email: 'dup@test.com', password: 'pass', name: 'Dup', website: '', formRenderedAt: 1710000000000 })
            ).rejects.toThrow('Email already exists');
        });

        it('should include anti-bot registration metadata in the payload', async () => {
            mockFetch.mockResolvedValueOnce(
                mockResponse(true, { message: 'Registration successful' })
            );

            await authService.register({
                email: 'new@test.com',
                password: 'password123',
                name: 'New User',
                website: '',
                formRenderedAt: 1710000000000,
                captchaToken: 'token-123',
                captchaProvider: 'turnstile',
            });

            const [, options] = mockFetch.mock.calls[0];
            expect(JSON.parse((options as RequestInit).body as string)).toMatchObject({
                email: 'new@test.com',
                password: 'password123',
                name: 'New User',
                website: '',
                formRenderedAt: 1710000000000,
                captchaToken: 'token-123',
                captchaProvider: 'turnstile',
            });
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

    describe('restoreSession', () => {
        it('should restore the current user when /api/auth/me succeeds', async () => {
            const restoredUser = { id: '1', name: 'Restored', email: 'restored@test.com', role: 'user', status: 'active' };
            vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(mockResponse(true, { user: restoredUser })));

            const result = await authService.restoreSession();

            expect(result).toEqual(restoredUser);
            expect(authService.getCurrentUser()).toEqual(restoredUser);
        });

        it('should refresh and retry when /api/auth/me returns 401', async () => {
            const restoredUser = { id: '1', name: 'Restored', email: 'restored@test.com', role: 'user', status: 'active' };
            vi.stubGlobal('fetch', vi.fn()
                .mockResolvedValueOnce(mockResponse(false, { error: 'Session challenge required' }, 401))
                .mockResolvedValueOnce(mockResponse(true, {}, 200))
                .mockResolvedValueOnce(mockResponse(true, { user: restoredUser }, 200)));

            const result = await authService.restoreSession();

            expect(result).toEqual(restoredUser);
            expect(authService.getCurrentUser()).toEqual(restoredUser);
        });

        it('should clear user and reset session state on JWT errors', async () => {
            authService.setCurrentUser({ id: '1', name: 'Test', email: 'test@test.com', role: 'user', status: 'active' });
            vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(mockResponse(false, { error: 'jwt expired' }, 401)));

            const result = await authService.restoreSession();

            expect(result).toBeNull();
            expect(authService.getCurrentUser()).toBeNull();
            expect(mockResetSessionState).toHaveBeenCalled();
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

        it('should clear current user explicitly', () => {
            authService.setCurrentUser({ id: '1', name: 'Test', email: 'test@test.com', role: 'user', status: 'active' });
            authService.clearCurrentUser();
            expect(authService.getCurrentUser()).toBeNull();
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
                authService.createUser({ email: 'x@x.com', name: 'X' })
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
