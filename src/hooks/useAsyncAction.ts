/**
 * useAsyncAction Hook
 * Manages async actions with loading state, progress, and error handling
 */

import { useState, useCallback } from 'react';
import { notifySuccess, notifyError } from '../utils/notifications';

interface AsyncActionState<T> {
  isLoading: boolean;
  progress: number | undefined;
  message: string;
  subMessage: string | undefined;
  error: Error | null;
  data: T | null;
}

interface AsyncActionOptions {
  successMessage?: string;
  errorMessage?: string;
  showNotifications?: boolean;
}

interface UseAsyncActionReturn<T> {
  state: AsyncActionState<T>;
  execute: (action: () => Promise<T>, options?: AsyncActionOptions) => Promise<T | null>;
  setProgress: (progress: number, message?: string) => void;
  setMessage: (message: string, subMessage?: string) => void;
  reset: () => void;
}

export function useAsyncAction<T = unknown>(
  initialMessage = 'Chargement...'
): UseAsyncActionReturn<T> {
  const [state, setState] = useState<AsyncActionState<T>>({
    isLoading: false,
    progress: undefined,
    message: initialMessage,
    subMessage: undefined,
    error: null,
    data: null
  });

  const setProgress = useCallback((progress: number, message?: string) => {
    setState(prev => ({
      ...prev,
      progress,
      message: message || prev.message
    }));
  }, []);

  const setMessage = useCallback((message: string, subMessage?: string) => {
    setState(prev => ({
      ...prev,
      message,
      subMessage
    }));
  }, []);

  const reset = useCallback(() => {
    setState({
      isLoading: false,
      progress: undefined,
      message: initialMessage,
      subMessage: undefined,
      error: null,
      data: null
    });
  }, [initialMessage]);

  const execute = useCallback(async (
    action: () => Promise<T>,
    options: AsyncActionOptions = {}
  ): Promise<T | null> => {
    const {
      successMessage,
      errorMessage = 'Une erreur est survenue',
      showNotifications = true
    } = options;

    setState(prev => ({
      ...prev,
      isLoading: true,
      error: null,
      data: null
    }));

    try {
      const result = await action();
      
      setState(prev => ({
        ...prev,
        isLoading: false,
        data: result,
        progress: 100
      }));

      if (showNotifications && successMessage) {
        notifySuccess(successMessage);
      }

      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: err
      }));

      if (showNotifications) {
        notifyError(errorMessage);
      }

      return null;
    }
  }, []);

  return {
    state,
    execute,
    setProgress,
    setMessage,
    reset
  };
}

export default useAsyncAction;
