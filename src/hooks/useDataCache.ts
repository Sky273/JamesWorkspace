/**
 * useDataCache Hook
 * Simple data caching with automatic refresh and stale-while-revalidate pattern
 */

import { useState, useEffect, useCallback, useRef } from 'react';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  isStale: boolean;
}

interface UseCacheOptions {
  cacheTime?: number;      // How long data stays in cache (ms)
  staleTime?: number;      // How long before data is considered stale (ms)
  refetchOnMount?: boolean;
  refetchOnFocus?: boolean;
  enabled?: boolean;
}

interface UseCacheReturn<T> {
  data: T | null;
  isLoading: boolean;
  isRefetching: boolean;
  isStale: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  invalidate: () => void;
}

// Global cache store
const globalCache = new Map<string, CacheEntry<unknown>>();

const DEFAULT_CACHE_TIME = 5 * 60 * 1000;  // 5 minutes
const DEFAULT_STALE_TIME = 30 * 1000;       // 30 seconds

export function useDataCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: UseCacheOptions = {}
): UseCacheReturn<T> {
  const {
    cacheTime = DEFAULT_CACHE_TIME,
    staleTime = DEFAULT_STALE_TIME,
    refetchOnMount = true,
    refetchOnFocus = true,
    enabled = true
  } = options;

  const [data, setData] = useState<T | null>(() => {
    const cached = globalCache.get(key) as CacheEntry<T> | undefined;
    return cached?.data ?? null;
  });
  const [isLoading, setIsLoading] = useState(!data);
  const [isRefetching, setIsRefetching] = useState(false);
  const [isStale, setIsStale] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const isCacheValid = useCallback((): boolean => {
    const cached = globalCache.get(key);
    if (!cached) return false;
    return Date.now() - cached.timestamp < cacheTime;
  }, [key, cacheTime]);

  const isCacheStale = useCallback((): boolean => {
    const cached = globalCache.get(key);
    if (!cached) return true;
    return Date.now() - cached.timestamp > staleTime;
  }, [key, staleTime]);

  const fetchData = useCallback(async (isBackground = false) => {
    if (!enabled) return;

    if (isBackground) {
      setIsRefetching(true);
    } else {
      setIsLoading(true);
    }
    setError(null);

    try {
      const result = await fetcherRef.current();
      
      const entry: CacheEntry<T> = {
        data: result,
        timestamp: Date.now(),
        isStale: false
      };
      
      globalCache.set(key, entry);
      setData(result);
      setIsStale(false);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
      setIsRefetching(false);
    }
  }, [key, enabled]);

  const refetch = useCallback(async () => {
    await fetchData(!!data);
  }, [fetchData, data]);

  const invalidate = useCallback(() => {
    globalCache.delete(key);
    setData(null);
    setIsStale(true);
  }, [key]);

  // Initial fetch or revalidation
  useEffect(() => {
    if (!enabled) return;

    const cached = globalCache.get(key) as CacheEntry<T> | undefined;
    
    if (cached) {
      setData(cached.data);
      const stale = isCacheStale();
      setIsStale(stale);
      
      if (stale && refetchOnMount) {
        fetchData(true); // Background refetch
      }
    } else if (refetchOnMount) {
      fetchData(false);
    }
  }, [key, enabled, refetchOnMount, fetchData, isCacheStale]);

  // Refetch on window focus
  useEffect(() => {
    if (!refetchOnFocus || !enabled) return;

    const handleFocus = () => {
      if (isCacheStale()) {
        fetchData(true);
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [refetchOnFocus, enabled, isCacheStale, fetchData]);

  // Cleanup expired cache entries periodically
  useEffect(() => {
    const cleanup = setInterval(() => {
      const now = Date.now();
      globalCache.forEach((entry, cacheKey) => {
        if (now - entry.timestamp > cacheTime) {
          globalCache.delete(cacheKey);
        }
      });
    }, 60000); // Every minute

    return () => clearInterval(cleanup);
  }, [cacheTime]);

  return {
    data,
    isLoading,
    isRefetching,
    isStale,
    error,
    refetch,
    invalidate
  };
}

// Utility to invalidate cache by key pattern
export function invalidateCache(pattern?: string | RegExp): void {
  if (!pattern) {
    globalCache.clear();
    return;
  }

  globalCache.forEach((_, key) => {
    if (typeof pattern === 'string' ? key.includes(pattern) : pattern.test(key)) {
      globalCache.delete(key);
    }
  });
}

// Utility to prefetch data
export async function prefetchData<T>(key: string, fetcher: () => Promise<T>): Promise<void> {
  try {
    const data = await fetcher();
    globalCache.set(key, {
      data,
      timestamp: Date.now(),
      isStale: false
    });
  } catch {
    // Silently fail prefetch
  }
}

export default useDataCache;
