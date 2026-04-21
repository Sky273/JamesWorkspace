import { useEffect, useRef } from 'react';
import { authService, type User } from '../services/authService';
import { resetSessionState } from '../utils/apiInterceptor';
import logger from '../utils/logger.frontend';

interface AuthInitializationArgs {
  setInitialized: (value: boolean) => void;
  setLoading: (value: boolean) => void;
  setUser: (user: User | null) => void;
}

function shouldSkipSessionRestore(): boolean {
  return window.location.pathname === '/signin' && window.location.search.includes('expired=true');
}

export function useAuthInitialization({
  setInitialized,
  setLoading,
  setUser,
}: AuthInitializationArgs): void {
  const authCheckStartedRef = useRef<boolean>(false);

  useEffect(() => {
    const fetchCurrentUser = async () => {
      if (authCheckStartedRef.current) {
        return;
      }
      authCheckStartedRef.current = true;

      if (shouldSkipSessionRestore()) {
        resetSessionState();
        setUser(null);
        authService.clearCurrentUser();
        setLoading(false);
        setInitialized(true);
        return;
      }

      try {
        const restoredUser = await authService.restoreSession();
        setUser(restoredUser);
      } catch (err) {
        logger.error('Failed to fetch current user:', err);
        resetSessionState();
        setUser(null);
        authService.clearCurrentUser();
      } finally {
        setLoading(false);
        setInitialized(true);
      }
    };

    void fetchCurrentUser();
  }, [setInitialized, setLoading, setUser]);
}
