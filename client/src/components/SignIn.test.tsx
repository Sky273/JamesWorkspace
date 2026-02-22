/**
 * Tests for SignIn component
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import SignIn from './SignIn';

// Mock the auth context
const mockSignIn = vi.fn();
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    signIn: mockSignIn,
  }),
}));

// Mock the API interceptor
vi.mock('../utils/apiInterceptor', () => ({
  resetSessionState: vi.fn(),
  fetchWithCsrfRetry: vi.fn().mockResolvedValue({
    json: () => Promise.resolve({ authUrl: 'https://accounts.google.com/oauth' }),
  }),
}));

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
  default: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

// Mock logger
vi.mock('../utils/logger.frontend', () => ({
  default: {
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

const renderSignIn = () => {
  return render(
    <BrowserRouter>
      <SignIn />
    </BrowserRouter>
  );
};

describe('SignIn Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render the sign in form', () => {
      const { getByPlaceholderText, getByRole } = renderSignIn();
      
      expect(getByPlaceholderText('auth.signIn.emailPlaceholder')).toBeDefined();
      expect(getByPlaceholderText('auth.signIn.passwordPlaceholder')).toBeDefined();
      expect(getByRole('button', { name: 'auth.signIn.signInButton' })).toBeDefined();
    });

    it('should render Google sign in button', () => {
      const { getByRole } = renderSignIn();
      
      expect(getByRole('button', { name: 'auth.signIn.signInWithGoogle' })).toBeDefined();
    });

    it('should render "or continue with" separator', () => {
      const { getByText } = renderSignIn();
      
      expect(getByText('auth.signIn.orContinueWith')).toBeDefined();
    });

    it('should render register link', () => {
      const { getByText } = renderSignIn();
      
      expect(getByText('common.register')).toBeDefined();
    });
  });
});
