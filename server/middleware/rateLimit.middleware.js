import rateLimit from 'express-rate-limit';
import { RATE_LIMIT } from '../config/constants.js';
import { safeLog } from '../utils/logger.backend.js';

function isE2ERateLimitRelaxed() {
    return process.env.E2E_RELAX_RATE_LIMITING === 'true';
}

// ============================================
// RATE LIMITING MIDDLEWARE
// ============================================

// Global rate limiter
export const globalLimiter = rateLimit({
    windowMs: RATE_LIMIT.GLOBAL.windowMs,
    max: RATE_LIMIT.GLOBAL.max,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.path === '/health' || isE2ERateLimitRelaxed(),
    handler: (req, res) => {
        safeLog('warn', 'Rate limit exceeded', { ip: req.ip, method: req.method, path: req.path });
        res.status(429).json({
            error: 'Too many requests from this IP, please try again later.',
            retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
        });
    }
});

// Auth rate limiter (anti brute-force)
export const authLimiter = rateLimit({
    windowMs: RATE_LIMIT.AUTH.windowMs,
    max: RATE_LIMIT.AUTH.max,
    message: 'Too many authentication attempts, please try again after 15 minutes.',
    skipSuccessfulRequests: true,
    handler: (req, res) => {
        safeLog('warn', 'Auth rate limit exceeded', { ip: req.ip });
        res.status(429).json({
            error: 'Too many authentication attempts, please try again after 15 minutes.',
            retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
        });
    }
});

// Per-user rate limiting store (by User ID)
const userRateLimitStore = new Map();

// Combined IP + User rate limiting store (prevents bypass via proxy/VPN)
const combinedRateLimitStore = new Map();

// Maximum entries to prevent memory leaks (10,000 users/IPs should be more than enough)
const MAX_RATE_LIMIT_ENTRIES = 10000;

/**
 * Get client IP address (handles proxies)
 */
function getClientIP(req) {
    return req.ip || 
           req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
           req.connection?.remoteAddress || 
           'unknown';
}

/**
 * Rate limiter per authenticated user
 * Administrators get 3x the limit
 */
export function userRateLimit(maxRequests = RATE_LIMIT.USER.max, windowMs = RATE_LIMIT.USER.windowMs) {
    return (req, res, next) => {
        if (isE2ERateLimitRelaxed()) {
            return next();
        }

        if (!req.user || !req.user.id) {
            return next();
        }

        const userId = req.user.id;
        const isAdmin = req.user.role === 'admin';
        const effectiveLimit = isAdmin ? maxRequests * 3 : maxRequests;
        const now = Date.now();
        
        let userLimit = userRateLimitStore.get(userId);
        
        if (!userLimit || now > userLimit.resetTime) {
            // Prevent memory leak: if store is too large, clear oldest entries
            if (userRateLimitStore.size >= MAX_RATE_LIMIT_ENTRIES) {
                const entriesToDelete = Math.floor(MAX_RATE_LIMIT_ENTRIES * 0.1);
                const iterator = userRateLimitStore.keys();
                for (let i = 0; i < entriesToDelete; i++) {
                    const key = iterator.next().value;
                    if (key) userRateLimitStore.delete(key);
                }
                safeLog('warn', 'Rate limit store pruned due to size limit', { 
                    store: 'user', 
                    entriesRemoved: entriesToDelete 
                });
            }
            
            userLimit = {
                count: 0,
                resetTime: now + windowMs
            };
            userRateLimitStore.set(userId, userLimit);
        }
        
        userLimit.count++;
        
        if (userLimit.count > effectiveLimit) {
            const retryAfter = Math.ceil((userLimit.resetTime - now) / 1000);
            
            safeLog('warn', 'User rate limit exceeded', {
                userId,
                email: req.user.email,
                role: req.user.role,
                isAdmin,
                path: req.path
            });
            
            return res.status(429).json({
                error: 'Too many requests. Please try again later.',
                retryAfter,
                limit: effectiveLimit,
                windowMinutes: windowMs / 60000
            });
        }
        
        res.setHeader('X-RateLimit-Limit', effectiveLimit);
        res.setHeader('X-RateLimit-Remaining', Math.max(0, effectiveLimit - userLimit.count));
        res.setHeader('X-RateLimit-Reset', new Date(userLimit.resetTime).toISOString());
        
        next();
    };
}

/**
 * Combined IP + User ID rate limiter
 * Prevents bypass via proxy/VPN by tracking both dimensions
 * - Same user from different IPs: limited by user quota
 * - Same IP with different users: limited by IP quota
 * - Same user + same IP: limited by combined quota (strictest)
 */
export function combinedRateLimit(maxRequests = 30, windowMs = 60 * 1000) {
    return (req, res, next) => {
        if (isE2ERateLimitRelaxed()) {
            return next();
        }

        const ip = getClientIP(req);
        const userId = req.user?.id || 'anonymous';
        const combinedKey = `${ip}:${userId}`;
        const now = Date.now();
        
        let limit = combinedRateLimitStore.get(combinedKey);
        
        if (!limit || now > limit.resetTime) {
            // Prevent memory leak: if store is too large, clear oldest entries
            if (combinedRateLimitStore.size >= MAX_RATE_LIMIT_ENTRIES) {
                const entriesToDelete = Math.floor(MAX_RATE_LIMIT_ENTRIES * 0.1);
                const iterator = combinedRateLimitStore.keys();
                for (let i = 0; i < entriesToDelete; i++) {
                    const key = iterator.next().value;
                    if (key) combinedRateLimitStore.delete(key);
                }
                safeLog('warn', 'Rate limit store pruned due to size limit', { 
                    store: 'combined', 
                    entriesRemoved: entriesToDelete 
                });
            }
            
            limit = {
                count: 0,
                resetTime: now + windowMs,
                ip,
                userId
            };
            combinedRateLimitStore.set(combinedKey, limit);
        }
        
        limit.count++;
        
        if (limit.count > maxRequests) {
            const retryAfter = Math.ceil((limit.resetTime - now) / 1000);
            
            safeLog('warn', 'Combined rate limit exceeded', {
                ip,
                userId,
                combinedKey,
                path: req.path,
                count: limit.count
            });
            
            return res.status(429).json({
                error: 'Too many requests. Please try again later.',
                retryAfter,
                limit: maxRequests
            });
        }
        
        res.setHeader('X-RateLimit-Limit', maxRequests);
        res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - limit.count));
        res.setHeader('X-RateLimit-Reset', new Date(limit.resetTime).toISOString());
        
        next();
    };
}

// Upload rate limiter
export const uploadLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50,
    message: 'Too many file uploads, please try again later.',
    skip: () => isE2ERateLimitRelaxed(),
    handler: (req, res) => {
        safeLog('warn', 'Upload rate limit exceeded', { ip: req.ip });
        res.status(429).json({
            error: 'Too many file uploads, please try again later.',
            retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
        });
    }
});

// LLM rate limiter
export const llmLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 100,
    message: 'Too many LLM requests, please try again later.',
    skip: () => isE2ERateLimitRelaxed(),
    handler: (req, res) => {
        safeLog('warn', 'LLM rate limit exceeded', { ip: req.ip });
        res.status(429).json({
            error: 'Too many LLM requests, please try again later.',
            retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
        });
    }
});

let rateLimitCleanupInterval = null;

function runRateLimitCleanup() {
    const now = Date.now();
    let cleanedUser = 0;
    let cleanedCombined = 0;
    
    // Clean user rate limit store
    for (const [userId, data] of userRateLimitStore.entries()) {
        if (now > data.resetTime + 3600000) {
            userRateLimitStore.delete(userId);
            cleanedUser++;
        }
    }
    
    // Clean combined rate limit store
    for (const [key, data] of combinedRateLimitStore.entries()) {
        if (now > data.resetTime + 3600000) {
            combinedRateLimitStore.delete(key);
            cleanedCombined++;
        }
    }
    
    if (cleanedUser > 0 || cleanedCombined > 0) {
        safeLog('debug', 'Cleaned up rate limit stores', { 
            userEntriesRemoved: cleanedUser,
            combinedEntriesRemoved: cleanedCombined
        });
    }
}

export const startRateLimitCleanup = (intervalMs = 3600000) => {
    if (rateLimitCleanupInterval) {
        return rateLimitCleanupInterval;
    }

    rateLimitCleanupInterval = setInterval(runRateLimitCleanup, intervalMs);
    return rateLimitCleanupInterval;
};

// Export cleanup function for graceful shutdown
export const cleanupRateLimitStore = () => {
    if (rateLimitCleanupInterval) {
        clearInterval(rateLimitCleanupInterval);
        rateLimitCleanupInterval = null;
    }

    userRateLimitStore.clear();
    combinedRateLimitStore.clear();
    safeLog('info', 'Rate limit stores cleaned up');
};
