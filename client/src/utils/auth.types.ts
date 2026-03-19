/**
 * Shared auth types, error classes, and constants.
 * Extracted from apiInterceptor.ts for reuse across auth modules.
 */

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
 * Special error class for session expiration redirects.
 * This error should be caught and ignored — it indicates a redirect is in progress.
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
// AUTH ERROR PATTERNS
// ============================================

/**
 * Authentication-related error patterns that indicate session issues.
 * Single source of truth — used by apiInterceptor, AuthContext, etc.
 */
export const AUTH_ERROR_PATTERNS = [
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
export const isAuthErrorMessage = (message: string): boolean => {
  const lowerMessage = message.toLowerCase();
  return AUTH_ERROR_PATTERNS.some(pattern => lowerMessage.includes(pattern.toLowerCase()));
};
