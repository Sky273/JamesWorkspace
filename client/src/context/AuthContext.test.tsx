import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const restoreSessionMock = vi.fn();
const signInMock = vi.fn();
const signOutMock = vi.fn();
const registerMock = vi.fn();
const clearCurrentUserMock = vi.fn();
const resetSessionStateMock = vi.fn();
const redirectToExpiredSessionMock = vi.fn();
const setSessionExpiredHandlerMock = vi.fn();
const toastSuccessMock = vi.fn();

vi.mock('../services/authService', () => ({
  authService: {
    restoreSession: (...args: unknown[]) => restoreSessionMock(...args),
    signIn: (...args: unknown[]) => signInMock(...args),
    signOut: (...args: unknown[]) => signOutMock(...args),
    register: (...args: unknown[]) => registerMock(...args),
    clearCurrentUser: (...args: unknown[]) => clearCurrentUserMock(...args),
  },
}));

vi.mock('../utils/apiInterceptor', () => ({
  resetSessionState: (...args: unknown[]) => resetSessionStateMock(...args),
}));

vi.mock('../utils/sessionRedirect', () => ({
  redirectToExpiredSession: (...args: unknown[]) => redirectToExpiredSessionMock(...args),
  setSessionExpiredHandler: (...args: unknown[]) => setSessionExpiredHandlerMock(...args),
}));

vi.mock('react-hot-toast', () => ({
  default: {
    success: (...args: unknown[]) => toastSuccessMock(...args),
  },
}));

vi.mock('../utils/logger.frontend', () => ({
  default: {
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

import { AuthProvider, useAuth } from './AuthContext';

function AuthConsumer() {
  const { user, loading, isAuthenticated, signIn, signOut, register } = useAuth();

  return (
    <div>
      <div>loading:{String(loading)}</div>
      <div>authenticated:{String(isAuthenticated)}</div>
      <div>user:{user?.name || 'none'}</div>
      <button onClick={() => void signIn('luc@example.com', 'secret')}>sign-in</button>
      <button onClick={() => void signOut()}>sign-out</button>
      <button onClick={() => void register({ name: 'Ada', email: 'ada@example.com', password: 'pwd' } as never)}>register</button>
    </div>
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    restoreSessionMock.mockResolvedValue({ name: 'Luc', status: 'active' });
    signOutMock.mockResolvedValue(undefined);
    registerMock.mockResolvedValue({ message: 'User created' });
  });

  it('restores the session and exposes authentication state', async () => {
    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('loading:false')).toBeInTheDocument();
    });

    expect(restoreSessionMock).toHaveBeenCalled();
    expect(screen.getByText('authenticated:true')).toBeInTheDocument();
    expect(screen.getByText('user:Luc')).toBeInTheDocument();
    expect(setSessionExpiredHandlerMock).toHaveBeenCalled();
  });

  it('supports sign-in, sign-out, and register flows', async () => {
    signInMock.mockResolvedValue({ name: 'Ada', status: 'active' });

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('loading:false')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('sign-in'));
    await waitFor(() => {
      expect(signInMock).toHaveBeenCalledWith('luc@example.com', 'secret');
    });

    fireEvent.click(screen.getByText('register'));
    await waitFor(() => {
      expect(registerMock).toHaveBeenCalled();
    });
    expect(toastSuccessMock).toHaveBeenCalledWith('User created', { duration: 6000 });

    fireEvent.click(screen.getByText('sign-out'));
    await waitFor(() => {
      expect(signOutMock).toHaveBeenCalled();
    });
  });
});
