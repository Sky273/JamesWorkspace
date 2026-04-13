/**
 * API Interceptor for handling session expiration and automatic logout.
 * Orchestrates session management, token refresh, and fetch wrappers.
 *
 * Types & constants: ./auth.types.ts
 * CSRF management:   ./csrfManager.ts
 */

import logger from './logger.frontend';
import {
  createAuthOptions as buildAuthOptions,
  createAuthOptionsWithCsrf as buildAuthOptionsWithCsrf,
  fetchWithCsrfRetry as fetchWithCsrfRetryInternal,
} from './apiInterceptor.authOptions';
import { fetchWithTimeout as fetchWithTimeoutInternal } from './apiInterceptor.fetch';

// Re-export types, error classes, and constants so existing imports don't break
export {
  SessionRedirectError,
  isSessionRedirectError,
  AUTH_ERROR_PATTERNS,
  isAuthErrorMessage,
} from './auth.types';
export type { SessionExpiredHandler, FetchOptions } from './auth.types';

// Re-export CSRF functions so existing imports don't break
export {
  getCsrfToken,
  refreshCsrfToken,
  fetchCsrfToken,
  clearCsrfToken,
} from './csrfManager';
export { getResponseErrorMessage } from './apiInterceptor.responses';

// Import what we need internally
import { SessionRedirectError, isAuthErrorMessage } from './auth.types';
import type { SessionExpiredHandler, FetchOptions } from './auth.types';
import { getCsrfToken, refreshCsrfToken, resetCsrfState, isCsrfError } from './csrfManager';
import {
  REQUEST_TIMEOUT_MESSAGE,
  isSessionForbiddenError,
  parseForbiddenResponse,
  toTimeoutError,
  toTimeoutUserError,
} from './apiInterceptor.responses';
import {
  isSessionRedirectInProgress,
  resetSessionRedirect,
  setSessionExpiredHandler as setRedirectHandler,
  triggerSessionExpiry,
} from './sessionRedirect';

// ============================================
// SESSION STATE
// ============================================

const API_BASE_URL = '';
const LONG_RUNNING_REQUEST_REFRESH_THRESHOLD_MS = 240000;

let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

// Flag to track if proactive refresh is in progress
let isProactiveRefreshing = false;

/**
 * Proactively refresh token when it's about to expire
 */
const proactiveTokenRefresh = async (): Promise<void> => {
  if (isProactiveRefreshing || isSessionRedirectInProgress()) return;
  
  isProactiveRefreshing = true;
  try {
    logger.log('[API Interceptor] Proactive token refresh - token expiring soon');
    const success = await attemptTokenRefresh();
    if (!success) {
      logger.warn('[API Interceptor] Proactive refresh failed');
    }
  } finally {
    isProactiveRefreshing = false;
  }
};

// ============================================
// SESSION HANDLER
// ============================================

/**
 * Register a callback to be called when session expires
 */
export const setSessionExpiredHandler = (callback: SessionExpiredHandler): void => {
  setRedirectHandler(callback);
};

// ============================================
// FETCH UTILITIES
// ============================================

const fetchWithTimeout = async (
  url: string, 
  options: FetchOptions = {}, 
  timeout: number = 120000, // Default 2 minutes timeout (long operations should pass explicit timeout)
  retryCount: number = 0
): Promise<Response> => {
  return fetchWithTimeoutInternal(
    { apiBaseUrl: API_BASE_URL, logger, toTimeoutError },
    url,
    options,
    timeout,
    retryCount
  );
};

/**
 * Attempt to refresh the access token using the refresh token
 * Exported for use in long-running operations (e.g., batch upload)
 */
export const attemptTokenRefresh = async (): Promise<boolean> => {
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      logger.log('[API Interceptor] Attempting to refresh access token...');
      const response = await fetchWithTimeout('/api/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      }, 30000);

      if (response.ok) {
        logger.log('[API Interceptor] Token refresh successful');
        return true;
      } else {
        logger.warn('[API Interceptor] Token refresh failed');
        return false;
      }
    } catch (error) {
      logger.error('[API Interceptor] Token refresh error:', error);
      return false;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
};

// ============================================
// MAIN FETCH WITH AUTH
// ============================================

/**
 * Enhanced fetch wrapper that handles session expiration with automatic token refresh
 */
export const fetchWithAuth = async (
  url: string, 
  options: FetchOptions = {}, 
  timeout: number = 120000 // Default 2 minutes timeout (long operations should pass explicit timeout)
): Promise<Response> => {
  // If session is expiring, don't make new requests
  if (isSessionRedirectInProgress()) {
    logger.warn('[API Interceptor] Request blocked - session is expiring');
    throw new SessionRedirectError();
  }
  
  try {
    const response = await fetchWithTimeout(url, options, timeout);

    if (response.status === 401) {
      // Check if response body contains auth error details
      let errorMessage = '';
      let errorCode = '';
      try {
        const clonedResponse = response.clone();
        const errorData = await clonedResponse.json();
        errorMessage = errorData.error || errorData.message || '';
        errorCode = errorData.code || '';
      } catch {
        // Ignore JSON parse errors
      }

      // If it's a JWT-related error, skip refresh attempt and redirect immediately
      if (isAuthErrorMessage(errorMessage) || errorCode === 'TOKEN_INVALID') {
        logger.warn('[API Interceptor] JWT error detected, redirecting to signin:', errorMessage || errorCode);
        triggerSessionExpiry();
        throw new SessionRedirectError();
      }

      if (errorCode === 'TOKEN_MISSING') {
        logger.warn('[API Interceptor] Access token cookie missing - attempting token refresh');
      } else {
        logger.warn('[API Interceptor] 401 Unauthorized - attempting token refresh');
      }
      
      if (url.includes('/api/auth/refresh')) {
        throw new Error('Refresh token expired');
      }

      const refreshSuccess = await attemptTokenRefresh();

      if (refreshSuccess) {
        logger.log('[API Interceptor] Retrying original request with refreshed token');
        const retryResponse = await fetchWithTimeout(url, options, timeout);
        
        if (retryResponse.ok || retryResponse.status !== 401) {
          return retryResponse;
        }
      }

      logger.warn('[API Interceptor] Token refresh failed or retry unsuccessful - session expired');
      
      triggerSessionExpiry();
      // Throw special error to stop all processing
      throw new SessionRedirectError();
    }

    if (response.status === 403) {
      logger.warn('[API Interceptor] 403 Forbidden - checking if session related');

      const csrfError = await isCsrfError(response);
      if (csrfError) {
        logger.warn('[API Interceptor] CSRF error detected, returning response for CSRF retry flow');
        return response;
      }

      const { errorMessage, errorCode } = await parseForbiddenResponse(response);
      if (isSessionForbiddenError(errorMessage, errorCode)) {
        logger.warn('[API Interceptor] Session/CSRF error detected, redirecting to signin');
        triggerSessionExpiry();
        // Throw special error to stop all processing
        throw new SessionRedirectError();
      }

      throw new Error(errorMessage);
    }

    // Check for token expiration warning header and trigger proactive refresh
    const tokenExpiringSoon = response.headers.get('X-Token-Expiring-Soon');
    if (tokenExpiringSoon === 'true') {
      // Trigger proactive refresh in background (don't await)
      proactiveTokenRefresh();
    }

    return response;
  } catch (error) {
    if (error instanceof Error && error.message === REQUEST_TIMEOUT_MESSAGE) {
      logger.error('[API Interceptor] Request timed out:', url);
      throw toTimeoutUserError();
    }
    throw error;
  }
};

/**
 * Reset session expiring flag and CSRF state (call on successful login)
 */
export const resetSessionState = (): void => {
  resetSessionRedirect();
  resetCsrfState();
};

// ============================================
// AUTH OPTIONS HELPERS
// ============================================

/**
 * Helper to create fetch options with authentication headers
 */
export const createAuthOptions = (options: FetchOptions = {}): FetchOptions => {
  return buildAuthOptions(options);
};

export const prepareLongRunningRequest = async (
  timeout: number,
  options: { requiresCsrf?: boolean } = {}
): Promise<void> => {
  if (timeout < LONG_RUNNING_REQUEST_REFRESH_THRESHOLD_MS) {
    return;
  }

  if (isSessionRedirectInProgress()) {
    throw new SessionRedirectError();
  }

  try {
    logger.log('[API Interceptor] Preparing session for long-running request');
    await attemptTokenRefresh();
  } catch (error) {
    logger.warn('[API Interceptor] Long-running request pre-refresh failed', error);
  }

  if (options.requiresCsrf) {
    await refreshCsrfToken();
  }
};

/**
 * Create auth options with CSRF token for mutating requests
 */
export const createAuthOptionsWithCsrf = async (options: FetchOptions = {}, forceRefreshCsrf: boolean = false): Promise<FetchOptions> => {
  return buildAuthOptionsWithCsrf({ getCsrfToken, logger }, options, forceRefreshCsrf);
};

/**
 * Execute a mutating request with automatic CSRF retry
 * If the request fails with 403 (CSRF error), refresh the token and retry once
 */
export const fetchWithCsrfRetry = async (
  url: string,
  options: FetchOptions = {},
  timeout: number = 120000 // Default 2 minutes timeout (long operations should pass explicit timeout)
): Promise<Response> => {
  return fetchWithCsrfRetryInternal(
    { fetchWithAuth, isCsrfError, logger, refreshCsrfToken },
    url,
    options,
    timeout
  );
};

// ============================================
// CONVENIENCE METHODS
// For use in non-React service files that can't use hooks.
// React components should prefer the useAuthFetch() hook.
// All mutating methods use fetchWithCsrfRetry for automatic CSRF retry.
// ============================================

/**
 * Convenience method for GET requests with auth
 */
export const authGet = (url: string, options: FetchOptions = {}): Promise<Response> => {
  return fetchWithAuth(url, createAuthOptions({ ...options, method: 'GET' }));
};

/**
 * Convenience method for POST requests with auth, CSRF, and automatic CSRF retry
 */
export const authPost = async <T = unknown>(
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
  return fetchWithCsrfRetry(url, authOptions);
};

/**
 * Convenience method for PUT requests with auth, CSRF, and automatic CSRF retry
 */
export const authPut = async <T = unknown>(
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
  return fetchWithCsrfRetry(url, authOptions);
};

/**
 * Convenience method for DELETE requests with auth, CSRF, and automatic CSRF retry
 */
export const authDelete = async (url: string, options: FetchOptions = {}): Promise<Response> => {
  const authOptions = await createAuthOptionsWithCsrf({ ...options, method: 'DELETE' });
  return fetchWithCsrfRetry(url, authOptions);
};

