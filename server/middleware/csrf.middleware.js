import { doubleCsrf } from 'csrf-csrf';
import { safeLog } from '../utils/logger.backend.js';
import { CSRF_SECRET } from '../config/constants.js';

// ============================================
// CSRF PROTECTION
// ============================================

const csrfProtection = doubleCsrf({
    getSecret: () => CSRF_SECRET,
    cookieName: 'x-csrf-token',
    cookieOptions: {
        httpOnly: true,
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production',
        path: '/'
    },
    size: 64,
    ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
    getTokenFromRequest: (req) => {
        return req.headers['x-csrf-token'];
    },
    getSessionIdentifier: (req) => {
        return req.user?.id || req.sessionID || 'anonymous';
    }
});

export const doubleCsrfProtection = csrfProtection.doubleCsrfProtection;
export const generateToken = csrfProtection.generateCsrfToken;
export const generateCsrfToken = csrfProtection.generateCsrfToken;

safeLog('info', 'CSRF protection enabled');
