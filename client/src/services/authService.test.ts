/**
 * Tests for authService
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock apiInterceptor
vi.mock('../utils/apiInterceptor', () => ({
    clearCsrfToken: vi.fn(),
    resetSessionState: vi.fn(),
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

describe('authService', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        authService.setCurrentUser(null);
    });

    describe('getCsrfToken', () => {
        it('should fetch CSRF token from API', async () => {
            (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ csrfToken: 'test-csrf-token' }),
            });

            const token = await authService.getCsrfToken();
            expect(token).toBe('test-csrf-token');
            expect(global.fetch).toHaveBeenCalledWith('/api/csrf-token', {
                method: 'GET',
                credentials: 'include',
            });
        });

        it('should throw on failed CSRF fetch', async () => {
            (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
                ok: false,
            });

            await expect(authService.getCsrfToken()).rejects.toThrow('Failed to fetch CSRF token');
        });
    });

    describe('signIn', () => {
        it('should sign in successfully and return user', async () => {
            const mockUser = { id: '1', name: 'Test User', email: 'test@test.com', role: 'user', status: 'Active' };

            (global.fetch as ReturnType<typeof vi.fn>)
                // getCsrfToken call
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve({ csrfToken: 'csrf-123' }),
                })
                // signIn call
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve({ user: mockUser }),
                });

            const result = await authService.signIn('test@test.com', 'password123');
            expect(result).toEqual(mockUser);
            expect(authService.getCurrentUser()).toEqual(mockUser);
        });

        it('should return 2FA response when required', async () => {
            (global.fetch as ReturnType<typeof vi.fn>)
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve({ csrfToken: 'csrf-123' }),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve({
                        requires2FA: true,
                        userId: 'user-1',
                        message: 'Enter TOTP code',
                    }),
                });

            const result = await authService.signIn('test@test.com', 'password123');
            expect(result).toHaveProperty('requires2FA', true);
            expect(result).toHaveProperty('userId', 'user-1');
        });

        it('should throw on failed sign in', async () => {
            (global.fetch as ReturnType<typeof vi.fn>)
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve({ csrfToken: 'csrf-123' }),
                })
                .mockResolvedValueOnce({
                    ok: false,
                    json: () => Promise.resolve({ error: 'Invalid credentials' }),
                });

            await expect(authService.signIn('test@test.com', 'wrong')).rejects.toThrow('Invalid credentials');
        });
    });

    describe('register', () => {
        it('should register successfully', async () => {
            (global.fetch as ReturnType<typeof vi.fn>)
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve({ csrfToken: 'csrf-123' }),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve({ message: 'Registration successful' }),
                });

            const result = await authService.register({
                email: 'new@test.com',
                password: 'password123',
                name: 'New User',
            });

            expect(result.success).toBe(true);
            expect(result.message).toContain('Registration successful');
        });

        it('should throw on registration failure', async () => {
            (global.fetch as ReturnType<typeof vi.fn>)
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve({ csrfToken: 'csrf-123' }),
                })
                .mockResolvedValueOnce({
                    ok: false,
                    json: () => Promise.resolve({ error: 'Email already exists' }),
                });

            await expect(
                authService.register({ email: 'dup@test.com', password: 'pass', name: 'Dup' })
            ).rejects.toThrow('Email already exists');
        });
    });

    describe('signOut', () => {
        it('should clear cached user on sign out', async () => {
            authService.setCurrentUser({ id: '1', name: 'Test', email: 'test@test.com', role: 'user', status: 'Active' });
            expect(authService.getCurrentUser()).not.toBeNull();

            (global.fetch as ReturnType<typeof vi.fn>)
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve({ csrfToken: 'csrf-123' }),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve({}),
                });

            await authService.signOut();
            expect(authService.getCurrentUser()).toBeNull();
        });

        it('should clear user even if logout API fails', async () => {
            authService.setCurrentUser({ id: '1', name: 'Test', email: 'test@test.com', role: 'user', status: 'Active' });

            (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Network error'));

            await authService.signOut();
            expect(authService.getCurrentUser()).toBeNull();
        });
    });

    describe('refreshToken', () => {
        it('should refresh token and update user', async () => {
            const updatedUser = { id: '1', name: 'Test', email: 'test@test.com', role: 'user', status: 'Active' };

            (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ user: updatedUser }),
            });

            const result = await authService.refreshToken();
            expect(result).toBe(true);
            expect(authService.getCurrentUser()).toEqual(updatedUser);
        });

        it('should throw and sign out on refresh failure', async () => {
            (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
                ok: false,
                json: () => Promise.resolve({ error: 'Refresh failed' }),
            });

            await expect(authService.refreshToken()).rejects.toThrow();
        });
    });

    describe('getCurrentUser / setCurrentUser / isAuthenticated', () => {
        it('should return null when no user is set', () => {
            expect(authService.getCurrentUser()).toBeNull();
        });

        it('should set and get current user', () => {
            const user = { id: '1', name: 'Test', email: 'test@test.com', role: 'user' as const, status: 'Active' as const };
            authService.setCurrentUser(user);
            expect(authService.getCurrentUser()).toEqual(user);
        });

        it('should report authenticated when user is set', () => {
            authService.setCurrentUser({ id: '1', name: 'Test', email: 'test@test.com', role: 'user', status: 'Active' });
            expect(authService.isAuthenticated()).toBe(true);
        });

        it('should report not authenticated when no user', () => {
            expect(authService.isAuthenticated()).toBe(false);
        });
    });

    describe('getAuthHeader', () => {
        it('should return empty object (cookie-based auth)', () => {
            expect(authService.getAuthHeader()).toEqual({});
        });
    });

    describe('createUser', () => {
        it('should create user via API', async () => {
            const newUser = { id: '2', name: 'Created', email: 'created@test.com', role: 'user', status: 'Active' };

            (global.fetch as ReturnType<typeof vi.fn>)
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve({ csrfToken: 'csrf-123' }),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve(newUser),
                });

            const result = await authService.createUser({
                email: 'created@test.com',
                password: 'pass123',
                name: 'Created',
            });

            expect(result.email).toBe('created@test.com');
        });

        it('should throw on create failure', async () => {
            (global.fetch as ReturnType<typeof vi.fn>)
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve({ csrfToken: 'csrf-123' }),
                })
                .mockResolvedValueOnce({
                    ok: false,
                    json: () => Promise.resolve({ error: 'Forbidden' }),
                });

            await expect(
                authService.createUser({ email: 'x@x.com', password: 'p', name: 'X' })
            ).rejects.toThrow('Forbidden');
        });
    });

    describe('updateUser', () => {
        it('should update user via API', async () => {
            const updated = { id: '1', name: 'Updated', email: 'test@test.com', role: 'user', status: 'Active' };

            (global.fetch as ReturnType<typeof vi.fn>)
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve({ csrfToken: 'csrf-123' }),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve(updated),
                });

            const result = await authService.updateUser('1', { name: 'Updated' });
            expect(result.name).toBe('Updated');
        });
    });

    describe('deleteUser', () => {
        it('should delete user via API', async () => {
            (global.fetch as ReturnType<typeof vi.fn>)
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve({ csrfToken: 'csrf-123' }),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve({ message: 'User deleted' }),
                });

            const result = await authService.deleteUser('user-123');
            expect(result.message).toBe('User deleted');
        });

        it('should throw on delete failure', async () => {
            (global.fetch as ReturnType<typeof vi.fn>)
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve({ csrfToken: 'csrf-123' }),
                })
                .mockResolvedValueOnce({
                    ok: false,
                    json: () => Promise.resolve({ error: 'Not found' }),
                });

            await expect(authService.deleteUser('bad-id')).rejects.toThrow('Not found');
        });
    });
});
