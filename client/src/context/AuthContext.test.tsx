/**
 * Tests for AuthContext
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';

// Mock authService
const mockSignIn = vi.fn();
const mockRegister = vi.fn();
const mockSignOut = vi.fn();
const mockSetCurrentUser = vi.fn();

vi.mock('../services/authService', () => ({
    authService: {
        signIn: (...args: unknown[]) => mockSignIn(...args),
        register: (...args: unknown[]) => mockRegister(...args),
        signOut: (...args: unknown[]) => mockSignOut(...args),
        setCurrentUser: (...args: unknown[]) => mockSetCurrentUser(...args),
        getCurrentUser: vi.fn(() => null),
    },
    default: {
        signIn: (...args: unknown[]) => mockSignIn(...args),
        register: (...args: unknown[]) => mockRegister(...args),
        signOut: (...args: unknown[]) => mockSignOut(...args),
        setCurrentUser: (...args: unknown[]) => mockSetCurrentUser(...args),
        getCurrentUser: vi.fn(() => null),
    },
}));

// Mock apiInterceptor
vi.mock('../utils/apiInterceptor', () => ({
    resetSessionState: vi.fn(),
    AUTH_ERROR_PATTERNS: ['jwt malformed', 'invalid token', 'jwt expired'],
}));

vi.mock('../utils/sessionRedirect', () => ({
    redirectToExpiredSession: vi.fn(),
    setSessionExpiredHandler: vi.fn(),
}));

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
    toast: { error: vi.fn(), success: vi.fn() },
    default: { error: vi.fn(), success: vi.fn() },
}));

// Mock logger
vi.mock('../utils/logger.frontend', () => ({
    default: { log: vi.fn(), error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

// Helper component to access auth context
const AuthConsumer = ({ onRender }: { onRender: (auth: ReturnType<typeof useAuth>) => void }) => {
    const auth = useAuth();
    onRender(auth);
    return <div data-testid="consumer">Authenticated: {String(auth.isAuthenticated)}</div>;
};

describe('AuthContext', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        // Mock fetch for /api/auth/me - return not authenticated
        (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
            ok: false,
            status: 401,
            clone: () => ({
                json: () => Promise.resolve({ error: 'No token' }),
            }),
            json: () => Promise.resolve({ error: 'No token' }),
        });
    });

    describe('useAuth', () => {
        it('should throw if used outside AuthProvider', () => {
            const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

            expect(() => {
                render(<AuthConsumer onRender={() => {}} />);
            }).toThrow('useAuth must be used within an AuthProvider');

            consoleError.mockRestore();
        });
    });

    describe('AuthProvider', () => {
        it('should render children after initialization', async () => {
            const { findByTestId } = render(
                <AuthProvider>
                    <div data-testid="child">Hello</div>
                </AuthProvider>
            );

            const child = await findByTestId('child');
            expect(child.textContent).toBe('Hello');
        });

        it('should start with loading state then finish', async () => {
            const states: boolean[] = [];

            render(
                <AuthProvider>
                    <AuthConsumer onRender={(auth) => { states.push(auth.loading); }} />
                </AuthProvider>
            );

            await waitFor(() => {
                // After initialization, loading should be false
                expect(states[states.length - 1]).toBe(false);
            });
        });

        it('should set user when /api/auth/me succeeds', async () => {
            const mockUser = { id: '1', name: 'Test', email: 'test@test.com', role: 'user', status: 'active' };

            (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ user: mockUser }),
            });

            let capturedAuth: ReturnType<typeof useAuth> | null = null;

            render(
                <AuthProvider>
                    <AuthConsumer onRender={(auth) => { capturedAuth = auth; }} />
                </AuthProvider>
            );

            await waitFor(() => {
                expect(capturedAuth?.user).toEqual(mockUser);
                expect(capturedAuth?.isAuthenticated).toBe(true);
            });
        });

        it('should have isAuthenticated false when no user', async () => {
            let capturedAuth: ReturnType<typeof useAuth> | null = null;

            render(
                <AuthProvider>
                    <AuthConsumer onRender={(auth) => { capturedAuth = auth; }} />
                </AuthProvider>
            );

            await waitFor(() => {
                expect(capturedAuth?.isAuthenticated).toBe(false);
            });
        });

        it('should expose signIn function that calls authService', async () => {
            const mockUser = { id: '1', name: 'Test', email: 'test@test.com', role: 'user', status: 'Active' };
            mockSignIn.mockResolvedValueOnce(mockUser);

            let capturedAuth: ReturnType<typeof useAuth> | null = null;

            render(
                <AuthProvider>
                    <AuthConsumer onRender={(auth) => { capturedAuth = auth; }} />
                </AuthProvider>
            );

            await waitFor(() => expect(capturedAuth?.loading).toBe(false));

            await act(async () => {
                await capturedAuth!.signIn('test@test.com', 'password');
            });

            expect(mockSignIn).toHaveBeenCalledWith('test@test.com', 'password');
        });

        it('should expose signOut function', async () => {
            mockSignOut.mockResolvedValueOnce(undefined);

            let capturedAuth: ReturnType<typeof useAuth> | null = null;

            render(
                <AuthProvider>
                    <AuthConsumer onRender={(auth) => { capturedAuth = auth; }} />
                </AuthProvider>
            );

            await waitFor(() => expect(capturedAuth?.loading).toBe(false));

            await act(async () => {
                await capturedAuth!.signOut();
            });

            expect(mockSignOut).toHaveBeenCalled();
        });

        it('should expose register function', async () => {
            mockRegister.mockResolvedValueOnce({ success: true, message: 'OK' });

            let capturedAuth: ReturnType<typeof useAuth> | null = null;

            render(
                <AuthProvider>
                    <AuthConsumer onRender={(auth) => { capturedAuth = auth; }} />
                </AuthProvider>
            );

            await waitFor(() => expect(capturedAuth?.loading).toBe(false));

            await act(async () => {
                await capturedAuth!.register({ email: 'new@test.com', password: 'pass123', name: 'New' });
            });

            expect(mockRegister).toHaveBeenCalled();
        });

        it('should handle signIn error and set error state', async () => {
            mockSignIn.mockRejectedValueOnce(new Error('Invalid credentials'));

            let capturedAuth: ReturnType<typeof useAuth> | null = null;

            render(
                <AuthProvider>
                    <AuthConsumer onRender={(auth) => { capturedAuth = auth; }} />
                </AuthProvider>
            );

            await waitFor(() => expect(capturedAuth?.loading).toBe(false));

            await act(async () => {
                try {
                    await capturedAuth!.signIn('bad@test.com', 'wrong');
                } catch {
                    // Expected
                }
            });

            expect((capturedAuth as ReturnType<typeof useAuth> | null)?.error).toBe('Invalid credentials');
        });

        it('should attempt token refresh when /api/auth/me returns 401', async () => {
            // First call: /api/auth/me returns 401
            (global.fetch as ReturnType<typeof vi.fn>)
                .mockResolvedValueOnce({
                    ok: false,
                    status: 401,
                    clone: () => ({ json: () => Promise.resolve({ error: 'Token expired' }) }),
                    json: () => Promise.resolve({ error: 'Token expired' }),
                })
                // Second call: /api/auth/refresh
                .mockResolvedValueOnce({
                    ok: false,
                    json: () => Promise.resolve({ error: 'Refresh failed' }),
                });

            let capturedAuth: ReturnType<typeof useAuth> | null = null;

            render(
                <AuthProvider>
                    <AuthConsumer onRender={(auth) => { capturedAuth = auth; }} />
                </AuthProvider>
            );

            await waitFor(() => {
                expect(capturedAuth?.loading).toBe(false);
                expect(capturedAuth?.user).toBeNull();
            });
        });
    });
});

