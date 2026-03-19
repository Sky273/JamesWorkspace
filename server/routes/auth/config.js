/**
 * Auth Routes Configuration
 * Centralized cookie options to ensure consistency between set/clear operations
 */

// Determine if secure cookies should be used
export const useSecureCookies = process.env.NODE_ENV === 'production' || process.env.HTTPS_ENABLED === 'true';

// Access token cookie options (1 hour)
export const ACCESS_TOKEN_COOKIE = {
    httpOnly: true,
    secure: useSecureCookies,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 1000 // 1 hour
};

// Refresh token cookie options (7 days)
// Path restricted to /api/auth to minimize exposure
export const REFRESH_TOKEN_COOKIE = {
    httpOnly: true,
    secure: useSecureCookies,
    sameSite: 'lax',
    path: '/api/auth',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
};

// clearCookie requires the same options (minus maxAge/expires) to match the cookie
export const CLEAR_ACCESS_TOKEN = {
    httpOnly: true,
    secure: useSecureCookies,
    sameSite: 'lax',
    path: '/'
};

export const CLEAR_REFRESH_TOKEN = {
    httpOnly: true,
    secure: useSecureCookies,
    sameSite: 'lax',
    path: '/api/auth'
};
