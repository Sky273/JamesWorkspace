/* eslint-disable react-refresh/only-export-components */
/**
 * Authentication Context
 * TypeScript version with full type safety
 */

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { authService, User, RegisterData, RegisterResponse, SignInResponse } from '../services/authService';
import { redirectToExpiredSession, setSessionExpiredHandler } from '../utils/sessionRedirect';
import toast from 'react-hot-toast';
import logger from '../utils/logger.frontend';
import { useAuthInitialization } from './useAuthInitialization';


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

  useAuthInitialization({
    setInitialized,
    setLoading,
    setUser,
  });

  const signIn = useCallback(async (email: string, password: string): Promise<User | SignInResponse> => {
    try {
      setLoading(true);
      setError(null);
      const result = await authService.signIn(email, password);
      
      // Check if 2FA is required
      if ('requires2FA' in result && result.requires2FA) {
        return result as SignInResponse;
      }
      
      const resolvedUser = result as User;
      if (resolvedUser.status === 'active') {
        setUser(resolvedUser);
      } else {
        setUser(null);
        authService.clearCurrentUser();
      }
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
    authService.clearCurrentUser();
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

