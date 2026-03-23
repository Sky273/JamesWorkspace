/* eslint-disable react-refresh/only-export-components */
/**
 * Authentication Context
 * TypeScript version with full type safety
 */

import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';
import { authService, User, RegisterData, RegisterResponse, SignInResponse } from '../services/authService';
import { resetSessionState, AUTH_ERROR_PATTERNS, attemptTokenRefresh } from '../utils/apiInterceptor';
import { redirectToExpiredSession, setSessionExpiredHandler } from '../utils/sessionRedirect';
import toast from 'react-hot-toast';
import logger from '../utils/logger.frontend';


// ============================================
// TYPES
// ============================================

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<User | SignInResponse>;
  signOut: () => Promise<void>;
  register: (userData: RegisterData) => Promise<RegisterResponse>;
  isAuthenticated: boolean;
}

interface AuthProviderProps {
  children: ReactNode;
}

// ============================================
// CONTEXT
// ============================================

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// ============================================
// PROVIDER
// ============================================

export const AuthProvider = ({ children }: AuthProviderProps): JSX.Element => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true); // Start with loading true
  const [error, setError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState<boolean>(false);
  const authCheckStartedRef = useRef<boolean>(false);

  // Fetch current user from server on mount (session restored via httpOnly cookies)
  useEffect(() => {
    const fetchCurrentUser = async () => {
      if (authCheckStartedRef.current) {
        return;
      }
      authCheckStartedRef.current = true;

      // Skip fetching user if we're on the signin page with expired flag
      // This prevents infinite loops when session has expired
      if (window.location.pathname === '/signin' && window.location.search.includes('expired=true')) {
        // Reset session state to clear isSessionExpiring flag and stale CSRF token
        // This ensures the first login attempt after expiration will work
        resetSessionState();
        setUser(null);
        authService.setCurrentUser(null);
        setLoading(false);
        setInitialized(true);
        return;
      }

      try {
        // First try to get user with current token
        const response = await fetch('/api/auth/me', {
          method: 'GET',
          credentials: 'include'
        });
        
        if (response.ok) {
          const data = await response.json();
          setUser(data.user);
          authService.setCurrentUser(data.user);
        } else if (response.status === 401 || response.status === 403) {
          // Check if it's a JWT error that shouldn't trigger refresh
          let errorData: { error?: string; message?: string; code?: string } = {};
          try {
            errorData = await response.clone().json();
          } catch {
            // Ignore JSON parse errors
          }
          
          const errorMessage = (errorData.error || errorData.message || '').toLowerCase();
          const isJwtError = AUTH_ERROR_PATTERNS
            .some(pattern => errorMessage.includes(pattern.toLowerCase()));
          
          // If it's a JWT error, don't try to refresh - just clear state
          if (isJwtError) {
            logger.warn('JWT error detected during session restore, clearing state:', errorMessage);
            resetSessionState();
            setUser(null);
            authService.setCurrentUser(null);
          } else {
            // Token might be expired, try to refresh
            const refreshResponse = await fetch('/api/auth/refresh', {
              method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' }
            });
            
            if (refreshResponse.ok) {
              // Retry getting user after refresh
              const retryResponse = await fetch('/api/auth/me', {
                method: 'GET',
                credentials: 'include'
              });
              
              if (retryResponse.ok) {
                const data = await retryResponse.json();
                setUser(data.user);
                authService.setCurrentUser(data.user);
              } else {
                setUser(null);
                authService.setCurrentUser(null);
              }
            } else {
              // Refresh failed - user is not authenticated
              setUser(null);
              authService.setCurrentUser(null);
            }
          }
        } else {
          setUser(null);
          authService.setCurrentUser(null);
        }
      } catch (err) {
        logger.error('Failed to fetch current user:', err);
        resetSessionState();
        setUser(null);
        authService.setCurrentUser(null);
      } finally {
        setLoading(false);
        setInitialized(true);
      }
    };

    fetchCurrentUser();
  }, []);

  const signIn = useCallback(async (email: string, password: string): Promise<User | SignInResponse> => {
    try {
      setLoading(true);
      setError(null);
      const result = await authService.signIn(email, password);
      
      // Check if 2FA is required
      if ('requires2FA' in result && result.requires2FA) {
        return result as SignInResponse;
      }
      
      // Normal login - set user
      setUser(result as User);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const register = useCallback(async (userData: RegisterData): Promise<RegisterResponse> => {
    try {
      setLoading(true);
      setError(null);
      const result = await authService.register(userData);
      toast.success(result.message, { duration: 6000 });
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const signOut = useCallback(async (): Promise<void> => {
    try {
      await authService.signOut();
      setUser(null);
    } catch (err) {
      logger.error('Sign out error:', err);
    }
  }, []);

  const handleSessionExpired = useCallback((): void => {
    logger.warn('[AuthContext] Session expired, cleaning up and redirecting');
    setUser(null);
    authService.setCurrentUser(null);
    void authService.signOut().finally(() => {
      redirectToExpiredSession();
    });
  }, []);

  useEffect(() => {
    setSessionExpiredHandler(handleSessionExpired);
    
    return () => {
      setSessionExpiredHandler(null);
    };
  }, [handleSessionExpired]);

  const value: AuthContextType = {
    user,
    loading,
    error,
    signIn,
    signOut,
    register,
    isAuthenticated: !!user && user.status === 'active'
  };

  // Don't render children until we've checked authentication status
  if (!initialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;

