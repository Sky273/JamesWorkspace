/**
 * API Interceptor for handling session expiration and automatic logout
 * TypeScript version with full type safety
 */

import logger from './logger.frontend';

// ============================================
// TYPES
// ============================================

export type SessionExpiredHandler = (() => void) | null;

export interface FetchOptions extends RequestInit {
  headers?: Record<string, string>;
}

// ============================================
// SESSION REDIRECT ERROR
// ============================================

/**
 * Special error class for session expiration redirects
 * This error should be caught and ignored - it indicates a redirect is in progress
 */
export class SessionRedirectError extends Error {
  constructor() {
    super('Session expired - redirecting to login');
    this.name = 'SessionRedirectError';
  }
}

/**
 * Check if an error is a SessionRedirectError
 */
export const isSessionRedirectError = (error: unknown): boolean => {
  return error instanceof SessionRedirectError || 
    (error instanceof Error && error.name === 'SessionRedirectError');
};

// ============================================
// STATE
// ============================================

const API_BASE_URL = '';

let onSessionExpired: SessionExpiredHandler = null;
let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;
let csrfTokenCache: string | null = null;
let csrfTokenFetchPromise: Promise<string | null> | null = null;
let csrfTokenLastFetch: number = 0;
const CSRF_TOKEN_MAX_AGE = 2 * 60 * 1000; // 2 minutes (reduced to avoid desync with server cookie)

// Flag to prevent requests during session expiration redirect
let isSessionExpiring = false;

// Flag to track if proactive refresh is in progress
let isProactiveRefreshing = false;

// Authentication-related error patterns that indicate session issues
const AUTH_ERROR_PATTERNS = [
  'kid_malformed',
  'Mal_wellFormed',
  'jwt malformed',
  'jwt expired',
  'invalid token',
  'token expired',
  'invalid signature',
  'token_missing',
  'token_invalid'
];

/**
 * Check if an error message indicates an authentication problem
 */
const isAuthErrorMessage = (message: string): boolean => {
  const lowerMessage = message.toLowerCase();
  return AUTH_ERROR_PATTERNS.some(pattern => lowerMessage.includes(pattern.toLowerCase()));
};

/**
 * Proactively refresh token when it's about to expire
 */
const proactiveTokenRefresh = async (): Promise<void> => {
  if (isProactiveRefreshing || isSessionExpiring) return;
  
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
  onSessionExpired = callback;
};

// ============================================
// FETCH UTILITIES
// ============================================

/**
 * Create a fetch request with timeout and automatic retry for transient 400 errors
 */
const fetchWithTimeout = async (
  url: string, 
  options: FetchOptions = {}, 
  timeout: number = 600000, // Default 10 minutes timeout
  retryCount: number = 0
): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  const fullUrl = url.startsWith('/') ? `${API_BASE_URL}${url}` : url;
  
  // Add cache-busting headers to prevent stale responses
  const headersWithCacheBust = {
    ...options.headers,
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache'
  };
  
  try {
    const response = await fetch(fullUrl, {
      ...options,
      headers: headersWithCacheBust,
      signal: controller.signal,
      credentials: 'include'
    } as RequestInit);
    clearTimeout(timeoutId);
    
    // Retry once on 400 errors for GET requests (likely stale cache/proxy issue)
    if (response.status === 400 && retryCount < 1 && (!options.method || options.method === 'GET')) {
      logger.warn(`[API Interceptor] Got 400 on GET request, retrying once: ${url}`);
      await new Promise(resolve => setTimeout(resolve, 500)); // Small delay before retry
      return fetchWithTimeout(url, options, timeout, retryCount + 1);
    }
    
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      logger.error(`[API Interceptor] Request timeout after ${timeout}ms:`, url);
      throw new Error(`Request timeout after ${timeout / 1000}s`);
    }
    logger.error('[API Interceptor] Fetch error', { message: (error as Error).message, url });
    throw error;
  }
};

/**
 * Attempt to refresh the access token using the refresh token
 */
const attemptTokenRefresh = async (): Promise<boolean> => {
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
  timeout: number = 600000 // Default 10 minutes timeout
): Promise<Response> => {
  // If session is expiring, don't make new requests
  if (isSessionExpiring) {
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

      // If it's a TOKEN_MISSING error, the cookie has expired - redirect immediately
      if (errorCode === 'TOKEN_MISSING') {
        logger.warn('[API Interceptor] Cookie expired (TOKEN_MISSING), redirecting to signin');
        isSessionExpiring = true;
        // Redirect and throw special error to stop all processing
        window.location.href = '/signin?expired=true';
        throw new SessionRedirectError();
      }

      // If it's a JWT-related error, skip refresh attempt and redirect immediately
      if (isAuthErrorMessage(errorMessage) || errorCode === 'TOKEN_INVALID') {
        logger.warn('[API Interceptor] JWT error detected, redirecting to signin:', errorMessage || errorCode);
        isSessionExpiring = true;
        // Redirect and throw special error to stop all processing
        window.location.href = '/signin?expired=true';
        throw new SessionRedirectError();
      }

      logger.warn('[API Interceptor] 401 Unauthorized - attempting token refresh');
      
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
      
      // Set flag to prevent further requests during redirect
      isSessionExpiring = true;
      
      if (onSessionExpired) {
        onSessionExpired();
      } else {
        logger.warn('[API Interceptor] Session expired - redirecting to signin');
        window.location.href = '/signin?expired=true';
      }
      // Throw special error to stop all processing
      throw new SessionRedirectError();
    }

    if (response.status === 403) {
      logger.warn('[API Interceptor] 403 Forbidden - checking if session related');
      
      let errorMessage = 'Accès refusé';
      let errorCode = '';
      try {
        const errorData = await response.clone().json();
        errorMessage = errorData.error || errorMessage;
        errorCode = errorData.code || '';
      } catch {
        // Ignore JSON parse errors
      }

      // Check if this is a session/CSRF related error - redirect to signin
      const sessionErrorPatterns = [
        'csrf',
        'token',
        'session',
        'expired',
        'invalid_csrf',
        'CSRF_INVALID',
        'TOKEN_EXPIRED'
      ];
      
      const isSessionError = sessionErrorPatterns.some(pattern => 
        errorMessage.toLowerCase().includes(pattern.toLowerCase()) ||
        errorCode.toLowerCase().includes(pattern.toLowerCase())
      );

      if (isSessionError) {
        logger.warn('[API Interceptor] Session/CSRF error detected, redirecting to signin');
        isSessionExpiring = true;
        window.location.href = '/signin?expired=true';
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
    if (error instanceof Error && error.message === 'Request timeout') {
      logger.error('[API Interceptor] Request timed out:', url);
      throw new Error('La requête a expiré. Veuillez réessayer.');
    }
    throw error;
  }
};

// ============================================
// CSRF TOKEN
// ============================================

/**
 * Get CSRF token with smart caching and deduplication
 * - Caches token for 5 minutes
 * - Deduplicates concurrent requests
 * - Forces refresh if token is stale or on demand
 */
const getCsrfToken = async (forceRefresh: boolean = false): Promise<string | null> => {
  const now = Date.now();
  const isStale = (now - csrfTokenLastFetch) > CSRF_TOKEN_MAX_AGE;
  
  // Return cached token if valid and not forcing refresh
  if (csrfTokenCache && !isStale && !forceRefresh) {
    return csrfTokenCache;
  }
  
  // If already fetching, wait for that promise
  if (csrfTokenFetchPromise) {
    return csrfTokenFetchPromise;
  }
  
  // Fetch new token
  csrfTokenFetchPromise = (async () => {
    try {
      logger.log('[CSRF] Fetching new CSRF token...');
      const response = await fetch('/api/csrf-token', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      if (response.ok) {
        const data = await response.json();
        csrfTokenCache = data.csrfToken;
        csrfTokenLastFetch = Date.now();
        logger.log('[CSRF] Token fetched successfully');
        return csrfTokenCache;
      } else {
        logger.warn('[CSRF] Failed to fetch token, status:', response.status);
      }
    } catch (error) {
      logger.error('[CSRF] Failed to fetch CSRF token:', error);
    } finally {
      csrfTokenFetchPromise = null;
    }
    return null;
  })();
  
  return csrfTokenFetchPromise;
};

/**
 * Force refresh the CSRF token
 */
export const refreshCsrfToken = async (): Promise<string | null> => {
  csrfTokenCache = null;
  csrfTokenLastFetch = 0;
  return getCsrfToken(true);
};

/**
 * Get CSRF token for use in custom requests (e.g., file uploads)
 */
export const fetchCsrfToken = async (): Promise<string> => {
  const token = await getCsrfToken(false);
  return token || '';
};

/**
 * Clear CSRF token cache (call on logout)
 */
export const clearCsrfToken = (): void => {
  csrfTokenCache = null;
  csrfTokenLastFetch = 0;
  csrfTokenFetchPromise = null;
};

/**
 * Reset session expiring flag (call on successful login)
 */
export const resetSessionState = (): void => {
  isSessionExpiring = false;
  csrfTokenCache = null;
  csrfTokenLastFetch = 0;
  csrfTokenFetchPromise = null;
};

// ============================================
// AUTH OPTIONS HELPERS
// ============================================

/**
 * Helper to create fetch options with authentication headers
 */
export const createAuthOptions = (options: FetchOptions = {}): FetchOptions => {
  return {
    ...options,
    headers: {
      ...options.headers
    },
    credentials: 'include'
  };
};

/**
 * Create auth options with CSRF token for mutating requests
 */
export const createAuthOptionsWithCsrf = async (options: FetchOptions = {}, forceRefreshCsrf: boolean = false): Promise<FetchOptions> => {
  // IMPORTANT: Await the CSRF token BEFORE building the options
  const csrfToken = await getCsrfToken(forceRefreshCsrf);
  
  logger.log('[CSRF] Building options with token:', csrfToken ? 'present' : 'missing');
  
  // Merge headers with x-csrf-token LAST to ensure it's not overwritten
  const mergedHeaders: Record<string, string> = {
    ...options.headers,
    'x-csrf-token': csrfToken || ''
  };
  
  return {
    ...options,
    headers: mergedHeaders,
    credentials: 'include'
  };
};

/**
 * Check if an error response is a CSRF error
 */
const isCsrfError = async (response: Response): Promise<boolean> => {
  if (response.status !== 403) return false;
  
  try {
    const clonedResponse = response.clone();
    const text = await clonedResponse.text();
    const lowerText = text.toLowerCase();
    
    // Check for CSRF-related keywords in the response
    if (lowerText.includes('csrf') || lowerText.includes('token')) {
      return true;
    }
    
    // Try to parse as JSON for more specific check
    try {
      const data = JSON.parse(text);
      if (data.error?.toLowerCase().includes('csrf') || 
          data.message?.toLowerCase().includes('csrf') ||
          data.error?.toLowerCase().includes('invalid') && data.error?.toLowerCase().includes('token')) {
        return true;
      }
    } catch {
      // Not JSON, use text-based detection above
    }
  } catch {
    // If we can't read the response, assume it might be CSRF
    return true;
  }
  
  return false;
};

/**
 * Execute a mutating request with automatic CSRF retry
 * If the request fails with 403 (CSRF error), refresh the token and retry once
 */
export const fetchWithCsrfRetry = async (
  url: string,
  options: FetchOptions = {},
  timeout: number = 600000 // Default 10 minutes timeout
): Promise<Response> => {
  // First attempt
  let response = await fetchWithAuth(url, options, timeout);
  
  // If CSRF error (403), refresh token and retry
  if (response.status === 403) {
    const isCsrf = await isCsrfError(response);
    
    if (isCsrf) {
      logger.warn('[CSRF] Token invalid, refreshing and retrying...');
      
      // Force refresh the CSRF token
      const newToken = await refreshCsrfToken();
      
      if (newToken) {
        logger.log('[CSRF] Got new token, retrying request...');
        
        // Update the options with new token
        const retryOptions: FetchOptions = {
          ...options,
          headers: {
            ...options.headers,
            'x-csrf-token': newToken
          }
        };
        
        // Retry the request
        response = await fetchWithAuth(url, retryOptions, timeout);
        
        if (response.ok) {
          logger.log('[CSRF] Retry successful');
        } else {
          logger.warn('[CSRF] Retry failed with status:', response.status);
        }
      } else {
        logger.error('[CSRF] Failed to get new token for retry');
      }
    }
  }
  
  return response;
};

// ============================================
// CONVENIENCE METHODS
// ============================================

/**
 * Convenience method for GET requests with auth
 */
export const authGet = (url: string, options: FetchOptions = {}): Promise<Response> => {
  return fetchWithAuth(url, createAuthOptions({ ...options, method: 'GET' }));
};

/**
 * Convenience method for POST requests with auth and CSRF
 */
export const authPost = async <T = unknown>(
  url: string, 
  body: T, 
  options: FetchOptions = {}
): Promise<Response> => {
  logger.log('[authPost] Starting request to:', url);
  
  // CRITICAL: Get CSRF token FIRST, completely separately
  logger.log('[authPost] Fetching CSRF token...');
  const csrfToken = await getCsrfToken(false);
  logger.log('[authPost] CSRF token obtained:', csrfToken ? 'present' : 'MISSING');
  
  if (!csrfToken) {
    logger.error('[authPost] No CSRF token available!');
  }
  
  // Now build the options with the token we already have
  const authOptions: FetchOptions = {
    ...options,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
      'x-csrf-token': csrfToken || ''
    },
    body: JSON.stringify(body),
    credentials: 'include'
  };
  
  logger.log('[authPost] Making request with x-csrf-token:', !!(authOptions.headers as Record<string, string>)?.['x-csrf-token']);
  
  return fetchWithAuth(url, authOptions);
};

/**
 * Convenience method for PUT requests with auth and CSRF
 */
export const authPut = async <T = unknown>(
  url: string, 
  body: T, 
  options: FetchOptions = {}
): Promise<Response> => {
  // CRITICAL: Get CSRF token FIRST
  const csrfToken = await getCsrfToken(false);
  
  const authOptions: FetchOptions = {
    ...options,
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
      'x-csrf-token': csrfToken || ''
    },
    body: JSON.stringify(body),
    credentials: 'include'
  };
  
  return fetchWithAuth(url, authOptions);
};

/**
 * Convenience method for DELETE requests with auth and CSRF
 */
export const authDelete = async (url: string, options: FetchOptions = {}): Promise<Response> => {
  // CRITICAL: Get CSRF token FIRST
  const csrfToken = await getCsrfToken(false);
  
  const authOptions: FetchOptions = {
    ...options,
    method: 'DELETE',
    headers: {
      ...options.headers,
      'x-csrf-token': csrfToken || ''
    },
    credentials: 'include'
  };
  
  return fetchWithAuth(url, authOptions);
};
