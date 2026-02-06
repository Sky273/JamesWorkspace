/**
 * Custom hook for making authenticated API calls with automatic session expiration handling
 * This hook wraps the API interceptor utilities for easy use in React components
 */

import { useCallback } from 'react';
import { fetchWithAuth, fetchWithCsrfRetry, createAuthOptions, createAuthOptionsWithCsrf } from '../utils/apiInterceptor';

// ============================================
// TYPES
// ============================================

export interface FetchOptions extends RequestInit {
  headers?: Record<string, string>;
}

export interface UseAuthFetchReturn {
  authGet: (url: string, options?: FetchOptions) => Promise<Response>;
  authPost: <T = unknown>(url: string, body: T, options?: FetchOptions) => Promise<Response>;
  authPut: <T = unknown>(url: string, body: T, options?: FetchOptions) => Promise<Response>;
  authDelete: (url: string, options?: FetchOptions) => Promise<Response>;
  authFetch: (url: string, options?: FetchOptions) => Promise<Response>;
}

// ============================================
// HOOK
// ============================================

/**
 * Hook that provides authenticated fetch methods
 * Automatically handles session expiration and redirects to login
 */
export const useAuthFetch = (): UseAuthFetchReturn => {
  /**
   * Make an authenticated GET request
   */
  const authGet = useCallback(async (url: string, options: FetchOptions = {}): Promise<Response> => {
    const response = await fetchWithAuth(url, createAuthOptions({ ...options, method: 'GET' }));
    return response;
  }, []);

  /**
   * Make an authenticated POST request with CSRF token
   */
  const authPost = useCallback(async <T = unknown>(
    url: string, 
    body: T, 
    options: FetchOptions = {}
  ): Promise<Response> => {
    const authOptions = await createAuthOptionsWithCsrf({
      ...options,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      body: JSON.stringify(body),
    });
    // Use fetchWithCsrfRetry to automatically handle CSRF token refresh on 403
    const response = await fetchWithCsrfRetry(url, authOptions);
    return response;
  }, []);

  /**
   * Make an authenticated PUT request with CSRF token
   */
  const authPut = useCallback(async <T = unknown>(
    url: string, 
    body: T, 
    options: FetchOptions = {}
  ): Promise<Response> => {
    const authOptions = await createAuthOptionsWithCsrf({
      ...options,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      body: JSON.stringify(body),
    });
    // Use fetchWithCsrfRetry to automatically handle CSRF token refresh on 403
    const response = await fetchWithCsrfRetry(url, authOptions);
    return response;
  }, []);

  /**
   * Make an authenticated DELETE request with CSRF token
   */
  const authDelete = useCallback(async (url: string, options: FetchOptions = {}): Promise<Response> => {
    const authOptions = await createAuthOptionsWithCsrf({ ...options, method: 'DELETE' });
    // Use fetchWithCsrfRetry to automatically handle CSRF token refresh on 403
    const response = await fetchWithCsrfRetry(url, authOptions);
    return response;
  }, []);

  /**
   * Make a custom authenticated request (with CSRF for mutating methods)
   */
  const authFetch = useCallback(async (url: string, options: FetchOptions = {}): Promise<Response> => {
    const method = (options.method || 'GET').toUpperCase();
    const needsCsrf = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method);
    const authOptions = needsCsrf 
      ? await createAuthOptionsWithCsrf(options)
      : createAuthOptions(options);
    // Use fetchWithCsrfRetry for mutating requests to handle CSRF token refresh
    const response = needsCsrf 
      ? await fetchWithCsrfRetry(url, authOptions)
      : await fetchWithAuth(url, authOptions);
    return response;
  }, []);

  return {
    authGet,
    authPost,
    authPut,
    authDelete,
    authFetch,
  };
};

export default useAuthFetch;
