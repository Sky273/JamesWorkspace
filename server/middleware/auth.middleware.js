import { verifyToken } from '../services/jwt.service.js';
import { findUserById } from '../services/users.service.js';
import { safeLog } from '../utils/logger.backend.js';

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
    
    const decoded = verifyToken(token);
    
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
    
    const currentUser = await findUserById(decoded.id);
    if (!currentUser) {
        safeLog('warn', 'Authenticated user no longer exists', { userId: decoded.id });
        return res.status(401).json({
            error: 'Invalid or expired token',
            code: 'TOKEN_INVALID',
            message: 'Session expired. Please sign in again.'
        });
    }

    const userStatus = (currentUser.status || decoded.status || '').toLowerCase();
    if (userStatus === 'inactive') {
        safeLog('warn', 'User account is inactive', { userId: decoded.id });
        return res.status(403).json({ 
            error: 'Account is inactive',
            message: 'Your account has been deactivated. Please contact an administrator.'
        });
    }

    req.user = {
        ...decoded,
        id: currentUser.id,
        email: currentUser.email,
        name: currentUser.name,
        status: currentUser.status,
        role: currentUser.role,
        firmId: currentUser.firm_id || null,
        firm_id: currentUser.firm_id || null,
        firm: currentUser.firm_name || decoded.firm || null,
        customer: currentUser.firm_name || decoded.customer || null
    };
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
    
    const userFirm = req.user?.firm;
    return userFirm && userFirm === resourceFirm;
}

// Backward compatibility alias
export const hasCustomerAccess = hasFirmAccess;

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
        } catch (error) {
            return res.status(500).json({
                error: 'Authorization check failed',
                message: error.message
            });
        }
    };
}

