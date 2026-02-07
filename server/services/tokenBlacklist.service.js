/**
 * Token Blacklist Service
 * In-memory blacklist for revoked JWT tokens
 * 
 * SECURITY: This service allows immediate revocation of JWT tokens
 * without waiting for their natural expiration.
 * 
 * Use cases:
 * - User logout (revoke access token)
 * - Account deactivation (revoke all user tokens)
 * - Security incident (revoke compromised tokens)
 * 
 * LIMITATIONS:
 * - In-memory storage: blacklist is lost on server restart
 * - Single instance: not shared across multiple server instances
 * 
 * For production with multiple instances, consider:
 * - Redis for shared blacklist
 * - Database table for persistent blacklist
 */

import { safeLog } from '../utils/logger.backend.js';

// ============================================
// TOKEN BLACKLIST
// ============================================

// Map of blacklisted tokens: tokenId -> { expiresAt, reason, userId }
const blacklistedTokens = new Map();

// Map of blacklisted users: userId -> { blacklistedAt, reason }
// All tokens for these users are considered invalid
const blacklistedUsers = new Map();

// Cleanup interval reference
let cleanupInterval = null;

/**
 * Add a token to the blacklist
 * @param {string} tokenId - The JWT token ID (jti) or the token itself
 * @param {number} expiresAt - Token expiration timestamp (ms)
 * @param {string} reason - Reason for blacklisting
 * @param {string} userId - User ID associated with the token
 */
export function blacklistToken(tokenId, expiresAt, reason = 'logout', userId = null) {
    if (!tokenId) {
        safeLog('warn', 'Attempted to blacklist null/undefined token');
        return false;
    }

    blacklistedTokens.set(tokenId, {
        expiresAt,
        reason,
        userId,
        blacklistedAt: Date.now()
    });

    safeLog('info', 'Token blacklisted', { 
        tokenIdPreview: tokenId.substring(0, 20) + '...', 
        reason, 
        userId 
    });

    return true;
}

/**
 * Blacklist all tokens for a specific user
 * This is useful when deactivating an account or on security incidents
 * @param {string} userId - The user ID to blacklist
 * @param {string} reason - Reason for blacklisting
 */
export function blacklistUser(userId, reason = 'account_deactivated') {
    if (!userId) {
        safeLog('warn', 'Attempted to blacklist null/undefined user');
        return false;
    }

    blacklistedUsers.set(userId, {
        blacklistedAt: Date.now(),
        reason
    });

    safeLog('security', 'User blacklisted - all tokens invalidated', { userId, reason });

    return true;
}

/**
 * Remove a user from the blacklist (e.g., when reactivating account)
 * @param {string} userId - The user ID to remove from blacklist
 */
export function unblacklistUser(userId) {
    if (blacklistedUsers.has(userId)) {
        blacklistedUsers.delete(userId);
        safeLog('info', 'User removed from blacklist', { userId });
        return true;
    }
    return false;
}

/**
 * Check if a token is blacklisted
 * @param {string} tokenId - The JWT token ID or token to check
 * @param {string} userId - The user ID from the token
 * @param {number} tokenIssuedAt - When the token was issued (iat claim, in seconds)
 * @returns {boolean} - True if token is blacklisted
 */
export function isTokenBlacklisted(tokenId, userId = null, tokenIssuedAt = null) {
    // Check if specific token is blacklisted
    if (tokenId && blacklistedTokens.has(tokenId)) {
        return true;
    }

    // Check if user is blacklisted
    if (userId && blacklistedUsers.has(userId)) {
        const userBlacklist = blacklistedUsers.get(userId);
        
        // If token was issued before user was blacklisted, it's invalid
        // tokenIssuedAt is in seconds (JWT standard), blacklistedAt is in ms
        if (tokenIssuedAt && userBlacklist.blacklistedAt) {
            const tokenIssuedAtMs = tokenIssuedAt * 1000;
            if (tokenIssuedAtMs < userBlacklist.blacklistedAt) {
                return true;
            }
        } else {
            // If we can't determine timing, consider it blacklisted for safety
            return true;
        }
    }

    return false;
}

/**
 * Get blacklist statistics
 */
export function getBlacklistStats() {
    return {
        blacklistedTokens: blacklistedTokens.size,
        blacklistedUsers: blacklistedUsers.size
    };
}

/**
 * Cleanup expired tokens from the blacklist
 * Tokens that have naturally expired don't need to stay in the blacklist
 */
export function cleanupExpiredTokens() {
    const now = Date.now();
    let cleaned = 0;

    for (const [tokenId, data] of blacklistedTokens.entries()) {
        // Remove tokens that have expired (with 1 hour buffer for clock skew)
        if (data.expiresAt && now > data.expiresAt + 3600000) {
            blacklistedTokens.delete(tokenId);
            cleaned++;
        }
    }

    if (cleaned > 0) {
        safeLog('debug', 'Cleaned expired tokens from blacklist', { count: cleaned });
    }

    return cleaned;
}

/**
 * Start periodic cleanup of expired tokens
 * @param {number} intervalMs - Cleanup interval in milliseconds (default: 1 hour)
 */
export function startBlacklistCleanup(intervalMs = 3600000) {
    if (cleanupInterval) {
        clearInterval(cleanupInterval);
    }

    cleanupInterval = setInterval(() => {
        cleanupExpiredTokens();
    }, intervalMs);

    safeLog('info', 'Token blacklist cleanup started', { intervalMs });
}

/**
 * Stop cleanup and clear the blacklist (for graceful shutdown)
 */
export function destroyBlacklist() {
    if (cleanupInterval) {
        clearInterval(cleanupInterval);
        cleanupInterval = null;
    }
    
    const stats = getBlacklistStats();
    blacklistedTokens.clear();
    blacklistedUsers.clear();
    
    safeLog('info', 'Token blacklist destroyed', stats);
}

// Export for testing
export const _internals = {
    blacklistedTokens,
    blacklistedUsers
};
