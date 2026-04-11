/**
 * Token Blacklist Service
 * PostgreSQL-backed blacklist for revoked JWT tokens
 * 
 * SECURITY: This service allows immediate revocation of JWT tokens
 * without waiting for their natural expiration.
 * 
 * Use cases:
 * - User logout (revoke access token)
 * - Account deactivation (revoke all user tokens)
 * - Security incident (revoke compromised tokens)
 * 
 * FEATURES:
 * - Persistent storage: blacklist survives server restarts
 * - In-memory cache for fast lookups
 * - Automatic cleanup of expired tokens
 */

import { safeLog } from '../utils/logger.backend.js';
import { query } from '../config/database.js';
import { buildApplicationCacheMetrics } from './cacheMetrics.service.js';

// ============================================
// TOKEN BLACKLIST (with in-memory cache)
// ============================================

// In-memory cache for fast lookups (synced with DB)
const tokenCache = new Map();
const userCache = new Map();

// Cache TTL (5 minutes) - entries are refreshed from DB periodically
const CACHE_TTL = 5 * 60 * 1000;
let lastCacheRefresh = 0;

// Maximum cache sizes to prevent memory leaks
const MAX_TOKEN_CACHE_SIZE = 10000;
const MAX_USER_CACHE_SIZE = 1000;

class TokenBlacklistLookupError extends Error {
    constructor(message, cause) {
        super(message);
        this.name = 'TokenBlacklistLookupError';
        this.code = 'TOKEN_BLACKLIST_LOOKUP_FAILED';
        this.statusCode = 503;
        if (cause) {
            this.cause = cause;
        }
    }
}

// Cleanup interval reference
let cleanupInterval = null;
let refreshPromise = null;

function cacheActive(now = Date.now()) {
    return now - lastCacheRefresh < CACHE_TTL;
}

/**
 * Refresh cache from database
 */
async function refreshCache({ force = false } = {}) {
    const now = Date.now();
    if (!force && cacheActive(now)) {
        return;
    }

    if (refreshPromise) {
        return refreshPromise;
    }
    
    refreshPromise = (async () => {
        try {
            const [tokenResult, userResult] = await Promise.all([
                query(
                    `SELECT token_jti, user_id, reason, expires_at, created_at
                     FROM token_blacklist
                     WHERE expires_at > NOW()
                     ORDER BY created_at DESC
                     LIMIT $1`,
                    [MAX_TOKEN_CACHE_SIZE]
                ),
                query(
                    `SELECT user_id, reason, created_at
                     FROM user_blacklist
                     ORDER BY created_at DESC
                     LIMIT $1`,
                    [MAX_USER_CACHE_SIZE]
                )
            ]);
            
            tokenCache.clear();
            for (const row of tokenResult.rows) {
                tokenCache.set(row.token_jti, {
                    expiresAt: new Date(row.expires_at).getTime(),
                    reason: row.reason,
                    userId: row.user_id,
                    blacklistedAt: new Date(row.created_at).getTime()
                });
            }
            
            if (tokenResult.rows.length > MAX_TOKEN_CACHE_SIZE) {
                safeLog('warn', 'Token blacklist cache truncated due to size limit', {
                    total: tokenResult.rows.length,
                    cached: MAX_TOKEN_CACHE_SIZE
                });
            }
            
            userCache.clear();
            for (const row of userResult.rows) {
                userCache.set(row.user_id, {
                    blacklistedAt: new Date(row.created_at).getTime(),
                    reason: row.reason
                });
            }
            
            if (userResult.rows.length > MAX_USER_CACHE_SIZE) {
                safeLog('warn', 'User blacklist cache truncated due to size limit', {
                    total: userResult.rows.length,
                    cached: MAX_USER_CACHE_SIZE
                });
            }
            
            lastCacheRefresh = Date.now();
            safeLog('debug', 'Token blacklist cache refreshed', { 
                tokens: tokenCache.size, 
                users: userCache.size 
            });
        } catch (error) {
            safeLog('error', 'Failed to refresh blacklist cache', { error: error.message });
        } finally {
            refreshPromise = null;
        }
    })();

    return refreshPromise;
}

/**
 * Add a token to the blacklist
 * @param {string} tokenId - The JWT token ID (jti) or the token itself
 * @param {number} expiresAt - Token expiration timestamp (ms)
 * @param {string} reason - Reason for blacklisting
 * @param {string} userId - User ID associated with the token
 */
export async function blacklistToken(tokenId, expiresAt, reason = 'logout', userId = null) {
    if (!tokenId) {
        safeLog('warn', 'Attempted to blacklist null/undefined token');
        return false;
    }

    try {
        const result = await query(
            `INSERT INTO token_blacklist (token_jti, user_id, reason, expires_at) 
             VALUES ($1, $2, $3, $4) 
             ON CONFLICT (token_jti) DO NOTHING
             RETURNING token_jti, user_id, reason, expires_at, created_at`,
            [tokenId, userId, reason, new Date(expiresAt)]
        );

        if (result.rowCount === 0) {
            safeLog('warn', 'Token already blacklisted', {
                tokenIdPreview: tokenId.substring(0, 20) + '...',
                reason,
                userId
            });
            return false;
        }

        const row = result.rows[0];
        tokenCache.set(row.token_jti, {
            expiresAt: new Date(row.expires_at).getTime(),
            reason: row.reason,
            userId: row.user_id,
            blacklistedAt: new Date(row.created_at).getTime()
        });

        safeLog('info', 'Token blacklisted', { 
            tokenIdPreview: tokenId.substring(0, 20) + '...', 
            reason, 
            userId 
        });

        return true;
    } catch (error) {
        safeLog('error', 'Failed to blacklist token', { error: error.message });
        return false;
    }
}

/**
 * Blacklist all tokens for a specific user
 * This is useful when deactivating an account or on security incidents
 * @param {string} userId - The user ID to blacklist
 * @param {string} reason - Reason for blacklisting
 */
export async function blacklistUser(userId, reason = 'account_deactivated') {
    if (!userId) {
        safeLog('warn', 'Attempted to blacklist null/undefined user');
        return false;
    }

    try {
        // Insert into database
        await query(
            `INSERT INTO user_blacklist (user_id, reason) 
             VALUES ($1, $2) 
             ON CONFLICT (user_id) DO UPDATE SET reason = $2, created_at = CURRENT_TIMESTAMP`,
            [userId, reason]
        );
        
        // Update cache immediately
        userCache.set(userId, {
            blacklistedAt: Date.now(),
            reason
        });

        safeLog('security', 'User blacklisted - all tokens invalidated', { userId, reason });

        return true;
    } catch (error) {
        safeLog('error', 'Failed to blacklist user', { error: error.message });
        return false;
    }
}

/**
 * Remove a user from the blacklist (e.g., when reactivating account)
 * @param {string} userId - The user ID to remove from blacklist
 */
export async function unblacklistUser(userId) {
    try {
        const result = await query(
            'DELETE FROM user_blacklist WHERE user_id = $1',
            [userId]
        );
        
        if (result.rowCount > 0) {
            userCache.delete(userId);
            safeLog('info', 'User removed from blacklist', { userId });
            return true;
        }
        return false;
    } catch (error) {
        safeLog('error', 'Failed to unblacklist user', { error: error.message });
        return false;
    }
}

/**
 * Check if a token is blacklisted (synchronous - uses cache only)
 * Cache is refreshed periodically by startBlacklistCleanup
 * @param {string} tokenId - The JWT token ID or token to check
 * @param {string} userId - The user ID from the token
 * @param {number} tokenIssuedAt - When the token was issued (iat claim, in seconds)
 * @returns {boolean} - True if token is blacklisted
 */
export function isTokenBlacklisted(tokenId, userId = null, tokenIssuedAt = null) {
    // Check if specific token is blacklisted (from cache)
    if (tokenId && tokenCache.has(tokenId)) {
        return true;
    }

    // Check if user is blacklisted (from cache)
    if (userId && userCache.has(userId)) {
        const userBlacklist = userCache.get(userId);
        
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
 * Check if a token is blacklisted (async - refreshes cache if needed)
 * @param {string} tokenId - The JWT token ID or token to check
 * @param {string} userId - The user ID from the token
 * @param {number} tokenIssuedAt - When the token was issued (iat claim, in seconds)
 * @returns {Promise<boolean>} - True if token is blacklisted
 */
export async function isTokenBlacklistedAsync(tokenId, userId = null, tokenIssuedAt = null) {
    await refreshCache();

    if (isTokenBlacklisted(tokenId, userId, tokenIssuedAt)) {
        return true;
    }

    try {
        const checks = [];

        if (tokenId) {
            checks.push(
                query(
                    `SELECT token_jti, user_id, reason, expires_at, created_at
                     FROM token_blacklist
                     WHERE token_jti = $1 AND expires_at > NOW()
                     LIMIT 1`,
                    [tokenId]
                )
            );
        } else {
            checks.push(Promise.resolve({ rows: [] }));
        }

        if (userId) {
            checks.push(
                query(
                    `SELECT user_id, reason, created_at
                     FROM user_blacklist
                     WHERE user_id = $1
                     LIMIT 1`,
                    [userId]
                )
            );
        } else {
            checks.push(Promise.resolve({ rows: [] }));
        }

        const [tokenResult, userResult] = await Promise.all(checks);

        if (tokenResult.rows[0]) {
            const row = tokenResult.rows[0];
            tokenCache.set(row.token_jti, {
                expiresAt: new Date(row.expires_at).getTime(),
                reason: row.reason,
                userId: row.user_id,
                blacklistedAt: new Date(row.created_at).getTime()
            });
            return true;
        }

        if (userResult.rows[0]) {
            const row = userResult.rows[0];
            userCache.set(row.user_id, {
                blacklistedAt: new Date(row.created_at).getTime(),
                reason: row.reason
            });
            return isTokenBlacklisted(tokenId, userId, tokenIssuedAt);
        }

        return false;
    } catch (error) {
        safeLog('error', 'Failed targeted blacklist lookup', { error: error.message, tokenId, userId });
        throw new TokenBlacklistLookupError('Failed to verify token blacklist state', error);
    }
}

/**
 * Get blacklist statistics
 */
export function getBlacklistStats() {
    return buildApplicationCacheMetrics({
        size: tokenCache.size + userCache.size,
        maxSize: MAX_TOKEN_CACHE_SIZE + MAX_USER_CACHE_SIZE,
        ageMs: lastCacheRefresh ? Date.now() - lastCacheRefresh : null,
        ttlMs: CACHE_TTL,
        extra: {
        blacklistedTokens: tokenCache.size,
        blacklistedUsers: userCache.size,
        maxTokenCacheSize: MAX_TOKEN_CACHE_SIZE,
        maxUserCacheSize: MAX_USER_CACHE_SIZE,
        cacheAgeMs: lastCacheRefresh ? Date.now() - lastCacheRefresh : null,
        cacheTtlMs: CACHE_TTL
        }
    });
}

/**
 * Cleanup expired tokens from the blacklist (database)
 * Tokens that have naturally expired don't need to stay in the blacklist
 */
export async function cleanupExpiredTokens() {
    try {
        const result = await query(
            'DELETE FROM token_blacklist WHERE expires_at < NOW() - INTERVAL \'1 hour\''
        );
        
        const cleaned = result.rowCount || 0;
        
        if (cleaned > 0) {
            safeLog('debug', 'Cleaned expired tokens from blacklist', { count: cleaned });
            // Force cache refresh on next check
            lastCacheRefresh = 0;
        }

        return cleaned;
    } catch (error) {
        safeLog('error', 'Failed to cleanup expired tokens', { error: error.message });
        return 0;
    }
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

    // Initial cache load
    refreshCache({ force: true });

    safeLog('info', 'Token blacklist cleanup started', { intervalMs });
}

/**
 * Stop cleanup and clear the cache (for graceful shutdown)
 */
export function destroyBlacklist() {
    if (cleanupInterval) {
        clearInterval(cleanupInterval);
        cleanupInterval = null;
    }
    
    const stats = getBlacklistStats();
    tokenCache.clear();
    userCache.clear();
    lastCacheRefresh = 0;
    
    safeLog('info', 'Token blacklist cache cleared', stats);
}

// Export for testing
export const _internals = {
    tokenCache,
    userCache
};
