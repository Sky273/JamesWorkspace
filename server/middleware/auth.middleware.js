import { verifyToken } from '../services/jwt.service.js';
import { findUserById } from '../services/users.service.js';
import { safeLog } from '../utils/logger.backend.js';
import { getUserFirmIdFromUser, getUserFirmNameFromUser } from '../utils/firmHelpers.js';

const AUTH_USER_CACHE_TTL_MS = Math.max(1000, Number.parseInt(process.env.AUTH_USER_CACHE_TTL_MS || '2000', 10) || 2000);
const authUserCache = new Map();

function getMaxAuthUserCacheSize() {
    return Math.max(10, Number.parseInt(process.env.MAX_AUTH_USER_CACHE_SIZE || '1000', 10) || 1000);
}

function getCachedAuthenticatedUser(cacheKey) {
    if (!cacheKey) {
        return null;
    }

    const cached = authUserCache.get(cacheKey);
    if (!cached) {
        return null;
    }

    if (cached.expiresAt <= Date.now()) {
        authUserCache.delete(cacheKey);
        return null;
    }

    return cached.user;
}

function setCachedAuthenticatedUser(cacheKey, user) {
    if (!cacheKey || !user?.id) {
        return;
    }

    if (authUserCache.has(cacheKey)) {
        authUserCache.delete(cacheKey);
    }

    while (authUserCache.size >= getMaxAuthUserCacheSize()) {
        const oldestCacheKey = authUserCache.keys().next().value;
        if (!oldestCacheKey) {
            break;
        }
        authUserCache.delete(oldestCacheKey);
    }

    const cacheEntry = {
        user,
        expiresAt: Date.now() + AUTH_USER_CACHE_TTL_MS
    };

    authUserCache.set(cacheKey, cacheEntry);
}

function buildAuthenticatedRequestUser(decoded, currentUser) {
    return {
        id: currentUser.id,
        email: currentUser.email,
        name: currentUser.name,
        status: currentUser.status,
        role: currentUser.role,
        firmId: getUserFirmIdFromUser(currentUser),
        firmName: getUserFirmNameFromUser(currentUser),
        exp: decoded.exp,
        iat: decoded.iat,
        jti: decoded.jti || null
    };
}

export function resetAuthUserCacheForTests() {
    authUserCache.clear();
}

export function getAuthUserCacheSizeForTests() {
    return authUserCache.size;
}

// ============================================
// AUTHENTICATION MIDDLEWARE
// ============================================

/**
 * Authenticate JWT token from header or cookie
 * Also verifies:
 * - Token is not blacklisted
 * - User status is Active (from token payload)
 */
export async function authenticateToken(req, res, next) {
    // Authentication via httpOnly cookies only
    const token = req.cookies.accessToken;
    
    safeLog('debug', 'Token authentication check', {
        hasCookieToken: !!token
    });
    
    if (!token) {
        safeLog('debug', 'No access token cookie provided', {
            path: req.path,
            method: req.method
        });
        return res.status(401).json({ 
            error: 'Access token required',
            code: 'TOKEN_MISSING',
            message: 'Session expired. Please sign in again.'
        });
    }
    
    const decoded = await verifyToken(token);
    
    if (!decoded) {
        safeLog('warn', 'Token verification failed - token is invalid, expired, or blacklisted');
        return res.status(401).json({ 
            error: 'Invalid or expired token',
            code: 'TOKEN_INVALID',
            message: 'Session expired. Please sign in again.'
        });
    }
    
    // Calculate time remaining until token expiration
    const now = Math.floor(Date.now() / 1000);
    const expiresIn = decoded.exp ? decoded.exp - now : 0;
    
    // Add header with token expiration info for frontend
    res.setHeader('X-Token-Expires-In', expiresIn.toString());
    
    // If token expires in less than 5 minutes, add a warning header
    if (expiresIn > 0 && expiresIn < 300) {
        res.setHeader('X-Token-Expiring-Soon', 'true');
        safeLog('debug', 'Token expiring soon', { 
            userId: decoded.id, 
            expiresIn: `${expiresIn}s` 
        });
    }
    
    // Format time remaining for logging
    const formatTimeRemaining = (seconds) => {
        if (seconds <= 0) return '0s';
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        if (mins > 0) return `${mins}m ${secs}s`;
        return `${secs}s`;
    };
    
    safeLog('debug', 'Token verified successfully', {
        userId: decoded.id,
        email: decoded.email,
        role: decoded.role,
        status: decoded.status,
        tokenExpiresIn: formatTimeRemaining(expiresIn)
    });
    
    if (!decoded.id || !decoded.email) {
        safeLog('warn', 'Token missing required fields (id, email)');
        return res.status(403).json({ error: 'Invalid token payload' });
    }
    
    let currentUser = getCachedAuthenticatedUser(token);
    if (!currentUser) {
        currentUser = await findUserById(decoded.id);
    }
    if (!currentUser) {
        safeLog('warn', 'Authenticated user no longer exists', { userId: decoded.id });
        return res.status(401).json({
            error: 'Invalid or expired token',
            code: 'TOKEN_INVALID',
            message: 'Session expired. Please sign in again.'
        });
    }

    setCachedAuthenticatedUser(token, currentUser);

    const userStatus = (currentUser.status || decoded.status || '').toLowerCase();
    if (userStatus === 'inactive') {
        safeLog('warn', 'User account is inactive', { userId: decoded.id });
        return res.status(403).json({ 
            error: 'Account is inactive',
            message: 'Your account has been deactivated. Please contact an administrator.'
        });
    }

    req.user = buildAuthenticatedRequestUser(decoded, currentUser);
    next();
}

/**
 * Require admin role
 */
export function requireAdmin(req, res, next) {
    if (req.user?.role?.toLowerCase() !== 'admin') {
        return res.status(403).json({ 
            error: 'Access denied. Admin privileges required.' 
        });
    }
    
    next();
}

// ============================================
// AUTHORIZATION HELPERS
// ============================================

/**
 * Check if user is admin
 */
export function isUserAdmin(req) {
    return req.user?.role?.toLowerCase() === 'admin';
}

/**
 * Check if user has access to a firm's data
 */
export function hasFirmAccess(req, resourceFirm) {
    if (isUserAdmin(req)) {
        return true;
    }

    const userFirmId = getUserFirmIdFromUser(req.user);

    const resourceFirmId = resourceFirm && typeof resourceFirm === 'object'
        ? (resourceFirm.firmId || resourceFirm.firm_id || resourceFirm.id || null)
        : null;

    return Boolean(userFirmId && resourceFirmId && userFirmId === resourceFirmId);
}

/**
 * Middleware to require firm access
 */
export function requireFirmAccess(getResourceFirm) {
    return async (req, res, next) => {
        try {
            const resourceFirm = await getResourceFirm(req);
            
            if (!hasFirmAccess(req, resourceFirm)) {
                return res.status(403).json({
                    error: 'Access denied',
                    message: 'You do not have permission to access this resource'
                });
            }
            
            next();
        } catch {
            return res.status(500).json({
                error: 'Authorization check failed',
                message: 'Unable to verify access permissions'
            });
        }
    };
}
