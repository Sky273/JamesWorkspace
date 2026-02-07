/**
 * Authentication Context
 * TypeScript version with full type safety
 */

import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';
import { authService, User, RegisterData, RegisterResponse } from '../services/authService';
import { setSessionExpiredHandler, resetSessionState } from '../utils/apiInterceptor';
import toast from 'react-hot-toast';
import logger from '../utils/logger.frontend';

// Prevent duplicate auth calls in StrictMode
let authCheckInProgress = false;

// ============================================
// TYPES
// ============================================

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
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

  // Fetch current user from server on mount (session restored via httpOnly cookies)
  useEffect(() => {
    const fetchCurrentUser = async () => {
      // Prevent duplicate calls in React StrictMode
      if (authCheckInProgress) {
        return;
      }
      authCheckInProgress = true;

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
          const isJwtError = ['kid_malformed', 'jwt malformed', 'jwt expired', 'invalid token', 'invalid signature']
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
        authCheckInProgress = false;
        setInitialized(true);
      }
    };

    fetchCurrentUser();
  }, []);

  const signIn = useCallback(async (email: string, password: string): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      const userData = await authService.signIn(email, password);
      setUser(userData);
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
    
    // Set user to null first to trigger component unmounts
    setUser(null);
    
    // Clean up TinyMCE editors to prevent "isUnsaved" errors
    try {
      const tinymce = (window as unknown as { tinymce?: { editors?: Array<{ remove: () => void }> } }).tinymce;
      if (tinymce?.editors) {
        // Remove all TinyMCE editors before redirect
        [...tinymce.editors].forEach(editor => {
          try {
            editor.remove();
          } catch {
            // Ignore errors during cleanup
          }
        });
      }
    } catch {
      // Ignore TinyMCE cleanup errors
    }
    
    // Sign out (clears tokens)
    authService.signOut();
    
    // Small delay to allow React to process state changes before redirect
    setTimeout(() => {
      window.location.replace('/signin?expired=true');
    }, 50);
  }, []);

  useEffect(() => {
    setSessionExpiredHandler(handleSessionExpired);
    
    return () => {
      setSessionExpiredHandler(null as unknown as () => void);
    };
  }, [handleSessionExpired]);

  // Handle both 'status' (backend) and 'Status' (legacy) property names
  const userStatus = user?.status || user?.Status || '';
  
  const value: AuthContextType = {
    user,
    loading,
    error,
    signIn,
    signOut,
    register,
    isAuthenticated: !!user && (userStatus === 'Active' || userStatus === 'active')
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
