/**
 * Auth Routes Configuration
 */

// Determine if secure cookies should be used
export const useSecureCookies = process.env.NODE_ENV === 'production' || process.env.HTTPS_ENABLED === 'true';
