/**
 * useDebounce & useThrottle Hooks
 * Utility hooks for optimizing search inputs and frequent updates
 */

import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Debounce a value - delays updating until after wait milliseconds of inactivity
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Debounced callback - returns a function that delays execution
 */
export function useDebouncedCallback<T extends (...args: unknown[]) => unknown>(
  callback: T,
  delay: number
): (...args: Parameters<T>) => void {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  const debouncedFn = useCallback((...args: Parameters<T>) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      callbackRef.current(...args);
    }, delay);
  }, [delay]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return debouncedFn;
}

/**
 * Throttle a value - limits updates to at most once per wait milliseconds
 */
export function useThrottle<T>(value: T, limit: number): T {
  const [throttledValue, setThrottledValue] = useState<T>(value);
  const lastRan = useRef(Date.now());

  useEffect(() => {
    const handler = setTimeout(() => {
      if (Date.now() - lastRan.current >= limit) {
        setThrottledValue(value);
        lastRan.current = Date.now();
      }
    }, limit - (Date.now() - lastRan.current));

    return () => clearTimeout(handler);
  }, [value, limit]);

  return throttledValue;
}

/**
 * Throttled callback - limits function execution to at most once per limit milliseconds
 */
export function useThrottledCallback<T extends (...args: unknown[]) => unknown>(
  callback: T,
  limit: number
): (...args: Parameters<T>) => void {
  const lastRan = useRef(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  const throttledFn = useCallback((...args: Parameters<T>) => {
    const now = Date.now();

    if (now - lastRan.current >= limit) {
      callbackRef.current(...args);
      lastRan.current = now;
    } else {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args);
        lastRan.current = Date.now();
      }, limit - (now - lastRan.current));
    }
  }, [limit]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return throttledFn;
}

/**
 * Debounced search input hook - combines state and debouncing
 */
export function useDebouncedSearch(initialValue = '', delay = 300): {
  value: string;
  debouncedValue: string;
  setValue: (value: string) => void;
  clear: () => void;
} {
  const [value, setValue] = useState(initialValue);
  const debouncedValue = useDebounce(value, delay);

  const clear = useCallback(() => {
    setValue('');
  }, []);

  return { value, debouncedValue, setValue, clear };
}

export default useDebounce;
