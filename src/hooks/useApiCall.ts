/**
 * useApiCall Hook
 * Centralized API call management with loading, error handling, and retry logic
 */

import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

interface ApiCallState<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
}

interface ApiCallOptions {
  showErrorToast?: boolean;
  showSuccessToast?: boolean;
  successMessage?: string;
  errorMessage?: string;
  redirectOnUnauthorized?: boolean;
  retryCount?: number;
  retryDelay?: number;
}

interface UseApiCallReturn<T> {
  state: ApiCallState<T>;
  execute: (apiCall: () => Promise<T>, options?: ApiCallOptions) => Promise<T | null>;
  reset: () => void;
  setData: (data: T | null) => void;
}

const defaultOptions: ApiCallOptions = {
  showErrorToast: true,
  showSuccessToast: false,
  redirectOnUnauthorized: true,
  retryCount: 0,
  retryDelay: 1000
};

export function useApiCall<T = unknown>(): UseApiCallReturn<T> {
  const [state, setState] = useState<ApiCallState<T>>({
    data: null,
    isLoading: false,
    error: null
  });

  const navigate = useNavigate();
  const { signOut } = useAuth();

  const reset = useCallback(() => {
    setState({ data: null, isLoading: false, error: null });
  }, []);

  const setData = useCallback((data: T | null) => {
    setState(prev => ({ ...prev, data }));
  }, []);

  const execute = useCallback(async (
    apiCall: () => Promise<T>,
    options: ApiCallOptions = {}
  ): Promise<T | null> => {
    const opts = { ...defaultOptions, ...options };
    let lastError: Error | null = null;
    let attempts = 0;
    const maxAttempts = (opts.retryCount || 0) + 1;

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    while (attempts < maxAttempts) {
      try {
        const result = await apiCall();
        
        setState({ data: result, isLoading: false, error: null });
        
        if (opts.showSuccessToast && opts.successMessage) {
          toast.success(opts.successMessage);
        }
        
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        attempts++;

        // Check for authentication errors
        if (lastError.message.includes('401') || lastError.message.includes('unauthorized')) {
          if (opts.redirectOnUnauthorized) {
            signOut();
            navigate('/login');
            toast.error('Session expirée. Veuillez vous reconnecter.');
            setState({ data: null, isLoading: false, error: 'Session expirée' });
            return null;
          }
        }

        // Retry logic
        if (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, opts.retryDelay));
          continue;
        }
      }
    }

    // All attempts failed
    const errorMessage = opts.errorMessage || getErrorMessage(lastError);
    setState({ data: null, isLoading: false, error: errorMessage });

    if (opts.showErrorToast) {
      toast.error(errorMessage);
    }

    return null;
  }, [navigate, signOut]);

  return { state, execute, reset, setData };
}

/**
 * Extract user-friendly error message
 */
function getErrorMessage(error: Error | null): string {
  if (!error) return 'Une erreur est survenue';

  const message = error.message.toLowerCase();

  if (message.includes('network') || message.includes('fetch')) {
    return 'Erreur de connexion. Vérifiez votre connexion internet.';
  }
  if (message.includes('timeout')) {
    return 'La requête a pris trop de temps. Veuillez réessayer.';
  }
  if (message.includes('403') || message.includes('forbidden')) {
    return 'Accès refusé. Vous n\'avez pas les droits nécessaires.';
  }
  if (message.includes('404') || message.includes('not found')) {
    return 'Ressource non trouvée.';
  }
  if (message.includes('500') || message.includes('server')) {
    return 'Erreur serveur. Veuillez réessayer plus tard.';
  }

  return error.message || 'Une erreur est survenue';
}

export default useApiCall;
