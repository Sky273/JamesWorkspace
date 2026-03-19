import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { JWT_SECRET, REFRESH_TOKEN_SECRET, JWT_EXPIRES_IN, REFRESH_TOKEN_EXPIRES_IN } from '../config/constants.js';
import { safeLog } from '../utils/logger.backend.js';
import { isTokenBlacklisted, blacklistToken } from './tokenBlacklist.service.js';

// ============================================
// JWT TOKEN SERVICES
// ============================================

// Security: Always specify the algorithm to prevent algorithm confusion attacks
const JWT_ALGORITHM = 'HS256';

/**
 * Generate access token
 * Includes a unique jti (JWT ID) for blacklist support
 */
export function generateAccessToken(user) {
    const jti = crypto.randomBytes(16).toString('hex');
    const payload = { 
        id: user.id, 
        email: user.email,
        name: user.name,
        status: user.status,
        role: user.role || 'user',
        firmId: user.firm_id || user.firmId,
        firm: user.firm,
        customer: user.firm || user.customer,
        jti // Unique token ID for blacklist support
    };
    
    safeLog('debug', 'Generating JWT', { 
        userId: payload.id, 
        role: payload.role, 
        firm: payload.firm,
        jti 
    });
    
    return jwt.sign(payload, JWT_SECRET, { algorithm: JWT_ALGORITHM, expiresIn: JWT_EXPIRES_IN });
}

/**
 * Generate refresh token
 * Uses a separate secret from access tokens for enhanced security
 * Includes a unique jti (JWT ID) for blacklist support
 */
export function generateRefreshToken(user) {
    const jti = crypto.randomBytes(16).toString('hex');
    return jwt.sign(
        { id: user.id, email: user.email, type: 'refresh', jti },
        REFRESH_TOKEN_SECRET,
        { algorithm: JWT_ALGORITHM, expiresIn: REFRESH_TOKEN_EXPIRES_IN }
    );
}

/**
 * Verify access token
 * Also checks if the token has been blacklisted
 */
export function verifyToken(token) {
    try {
        // Security: Explicitly specify allowed algorithms to prevent algorithm confusion attacks
        const decoded = jwt.verify(token, JWT_SECRET, { algorithms: [JWT_ALGORITHM] });
        
        // Check if token or user is blacklisted
        if (isTokenBlacklisted(decoded.jti, decoded.id, decoded.iat)) {
            safeLog('warn', 'Token is blacklisted', { 
                jti: decoded.jti,
                userId: decoded.id 
            });
            return null;
        }
        
        return decoded;
    } catch (error) {
        // Log detailed error for debugging
        safeLog('error', 'JWT verification failed', { 
            error: error.message,
            errorName: error.name,
            tokenPreview: token ? token.substring(0, 20) + '...' : 'null'
        });
        return null;
    }
}

/**
 * Verify refresh token
 * Uses separate secret from access tokens for enhanced security
 * Also checks if the token has been blacklisted
 */
export function verifyRefreshToken(token) {
    try {
        const decoded = jwt.verify(token, REFRESH_TOKEN_SECRET, { algorithms: [JWT_ALGORITHM] });
        
        // Validate token type if present (for tokens generated after this update)
        if (decoded.type && decoded.type !== 'refresh') {
            safeLog('warn', 'Token type mismatch - expected refresh token', { 
                tokenType: decoded.type 
            });
            return null;
        }
        
        // Check if token or user is blacklisted
        if (isTokenBlacklisted(decoded.jti, decoded.id, decoded.iat)) {
            safeLog('warn', 'Refresh token is blacklisted', { 
                jti: decoded.jti,
                userId: decoded.id 
            });
            return null;
        }
        
        return decoded;
    } catch (error) {
        safeLog('error', 'Refresh token verification failed', { 
            error: error.message,
            errorName: error.name,
            tokenPreview: token ? token.substring(0, 20) + '...' : 'null'
        });
        return null;
    }
}

/**
 * Extract role from user fields
 */
/**
 * Revoke a token by adding it to the blacklist
 * @param {string} token - The JWT token to revoke
 * @returns {Promise<boolean>} - True if successfully revoked
 */
export async function revokeToken(token) {
    try {
        // Decode without verification to get the payload
        const decoded = jwt.decode(token);
        if (!decoded) {
            safeLog('warn', 'Cannot revoke invalid token');
            return false;
        }
        
        // Calculate expiration time in ms
        const expiresAt = decoded.exp ? decoded.exp * 1000 : Date.now() + 3600000;
        
        return await blacklistToken(decoded.jti || token, expiresAt, 'revoked', decoded.id);
    } catch (error) {
        safeLog('error', 'Error revoking token', { error: error.message });
        return false;
    }
}

export function extractRoleFromUser(fields) {
    const roleField = fields.role || fields.Role;
    
    if (!roleField) {
        return 'user';
    }
    
    const normalizedRole = String(roleField).toLowerCase().trim();
    
    const validRoles = ['admin', 'user'];
    if (validRoles.includes(normalizedRole)) {
        return normalizedRole;
    }
    
    return 'user';
}
