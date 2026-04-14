/**
 * Auth Routes Configuration
 * Centralized cookie options to ensure consistency between set/clear operations
 */

import { safeLog } from '../../utils/logger.backend.js';

// Determine if secure cookies should be used when the request itself is secure.
export const useSecureCookiesByDefault =
    process.env.NODE_ENV === 'production' || process.env.HTTPS_ENABLED === 'true';

function extractForwardedProto(req) {
    const forwardedProto = req?.headers?.['x-forwarded-proto'];
    if (Array.isArray(forwardedProto)) {
        return forwardedProto[0] || '';
    }

    return typeof forwardedProto === 'string' ? forwardedProto : '';
}

export function shouldUseSecureCookies(req) {
    if (!useSecureCookiesByDefault) {
        return false;
    }

    if (!req) {
        return useSecureCookiesByDefault;
    }

    const forwardedProto = extractForwardedProto(req)
        .split(',')
        .map((value) => value.trim().toLowerCase())
        .find(Boolean);

    return Boolean(req.secure || forwardedProto === 'https');
}

function createCookieOptions({ secure, path, maxAge }) {
    return {
        httpOnly: true,
        secure,
        sameSite: 'lax',
        path,
        ...(typeof maxAge === 'number' ? { maxAge } : {})
    };
}

function logInsecureCookieFallback(req, cookieName) {
    if (!useSecureCookiesByDefault || shouldUseSecureCookies(req)) {
        return;
    }

    safeLog('warn', 'Auth cookie emitted without Secure attribute', {
        cookieName,
        path: req?.path,
        host: req?.headers?.host,
        origin: req?.headers?.origin,
        requestSecure: Boolean(req?.secure),
        forwardedProto: extractForwardedProto(req) || null
    });
}

// Backward-compatible static exports used by tests and any non-request-aware consumers.
export const ACCESS_TOKEN_COOKIE = createCookieOptions({
    secure: useSecureCookiesByDefault,
    path: '/',
    maxAge: 60 * 60 * 1000
});

export const REFRESH_TOKEN_COOKIE = createCookieOptions({
    secure: useSecureCookiesByDefault,
    path: '/api/auth',
    maxAge: 7 * 24 * 60 * 60 * 1000
});

export const CLEAR_ACCESS_TOKEN = createCookieOptions({
    secure: useSecureCookiesByDefault,
    path: '/'
});

export const CLEAR_REFRESH_TOKEN = createCookieOptions({
    secure: useSecureCookiesByDefault,
    path: '/api/auth'
});

export function getAccessTokenCookieOptions(req) {
    logInsecureCookieFallback(req, 'accessToken');
    return createCookieOptions({
        secure: shouldUseSecureCookies(req),
        path: '/',
        maxAge: 60 * 60 * 1000
    });
}

export function getRefreshTokenCookieOptions(req) {
    logInsecureCookieFallback(req, 'refreshToken');
    return createCookieOptions({
        secure: shouldUseSecureCookies(req),
        path: '/api/auth',
        maxAge: 7 * 24 * 60 * 60 * 1000
    });
}

export function getClearAccessTokenOptions(req) {
    return createCookieOptions({
        secure: shouldUseSecureCookies(req),
        path: '/'
    });
}

export function getClearRefreshTokenOptions(req) {
    return createCookieOptions({
        secure: shouldUseSecureCookies(req),
        path: '/api/auth'
    });
}
