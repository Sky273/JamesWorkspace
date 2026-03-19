/**
 * CSRF Token Manager
 * Handles fetching, caching, and refreshing CSRF tokens.
 * Extracted from apiInterceptor.ts for separation of concerns.
 */

import logger from './logger.frontend';

// ============================================
// STATE
// ============================================

let csrfTokenCache: string | null = null;
let csrfTokenFetchPromise: Promise<string | null> | null = null;
let csrfTokenLastFetch: number = 0;
const CSRF_TOKEN_MAX_AGE = 2 * 60 * 1000; // 2 minutes

// ============================================
// CORE
// ============================================

/**
 * Get CSRF token with smart caching and deduplication.
 * - Caches token for 2 minutes
 * - Deduplicates concurrent requests
 * - Forces refresh if token is stale or on demand
 */
export const getCsrfToken = async (forceRefresh: boolean = false): Promise<string | null> => {
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
 * Reset all CSRF state (call on login)
 */
export const resetCsrfState = (): void => {
  csrfTokenCache = null;
  csrfTokenLastFetch = 0;
  csrfTokenFetchPromise = null;
};

// ============================================
// CSRF ERROR DETECTION
// ============================================

/**
 * Check if an error response is a CSRF error
 */
export const isCsrfError = async (response: Response): Promise<boolean> => {
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
