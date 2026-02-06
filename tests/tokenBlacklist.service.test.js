/**
 * Tests for Token Blacklist Service
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the logger
vi.mock('../src/utils/logger.backend.js', () => ({
    safeLog: vi.fn()
}));

import {
    blacklistToken,
    blacklistUser,
    unblacklistUser,
    isTokenBlacklisted,
    getBlacklistStats,
    cleanupExpiredTokens,
    destroyBlacklist,
    _internals
} from '../src/services/tokenBlacklist.service.js';

describe('Token Blacklist Service', () => {
    beforeEach(() => {
        // Clear blacklists before each test
        _internals.blacklistedTokens.clear();
        _internals.blacklistedUsers.clear();
    });

    describe('blacklistToken', () => {
        it('should add token to blacklist', () => {
            const result = blacklistToken('token123', Date.now() + 3600000, 'logout', 'user1');
            
            expect(result).toBe(true);
            expect(_internals.blacklistedTokens.has('token123')).toBe(true);
        });

        it('should return false for null token', () => {
            const result = blacklistToken(null, Date.now() + 3600000);
            
            expect(result).toBe(false);
        });

        it('should store token metadata', () => {
            const expiresAt = Date.now() + 3600000;
            blacklistToken('token123', expiresAt, 'security_incident', 'user1');
            
            const entry = _internals.blacklistedTokens.get('token123');
            expect(entry.expiresAt).toBe(expiresAt);
            expect(entry.reason).toBe('security_incident');
            expect(entry.userId).toBe('user1');
            expect(entry.blacklistedAt).toBeDefined();
        });
    });

    describe('blacklistUser', () => {
        it('should add user to blacklist', () => {
            const result = blacklistUser('user123', 'account_deactivated');
            
            expect(result).toBe(true);
            expect(_internals.blacklistedUsers.has('user123')).toBe(true);
        });

        it('should return false for null user', () => {
            const result = blacklistUser(null);
            
            expect(result).toBe(false);
        });

        it('should store user metadata', () => {
            blacklistUser('user123', 'security_incident');
            
            const entry = _internals.blacklistedUsers.get('user123');
            expect(entry.reason).toBe('security_incident');
            expect(entry.blacklistedAt).toBeDefined();
        });
    });

    describe('unblacklistUser', () => {
        it('should remove user from blacklist', () => {
            blacklistUser('user123');
            expect(_internals.blacklistedUsers.has('user123')).toBe(true);
            
            const result = unblacklistUser('user123');
            
            expect(result).toBe(true);
            expect(_internals.blacklistedUsers.has('user123')).toBe(false);
        });

        it('should return false if user not in blacklist', () => {
            const result = unblacklistUser('nonexistent');
            
            expect(result).toBe(false);
        });
    });

    describe('isTokenBlacklisted', () => {
        it('should return true for blacklisted token', () => {
            blacklistToken('token123', Date.now() + 3600000);
            
            expect(isTokenBlacklisted('token123')).toBe(true);
        });

        it('should return false for non-blacklisted token', () => {
            expect(isTokenBlacklisted('unknown')).toBe(false);
        });

        it('should return true for blacklisted user with old token', () => {
            // Blacklist user
            blacklistUser('user123');
            
            // Token issued before blacklist (iat in seconds, 1 hour ago)
            const tokenIssuedAt = Math.floor(Date.now() / 1000) - 3600;
            
            expect(isTokenBlacklisted(null, 'user123', tokenIssuedAt)).toBe(true);
        });

        it('should return true for blacklisted user without timing info', () => {
            blacklistUser('user123');
            
            // No timing info - should be considered blacklisted for safety
            expect(isTokenBlacklisted(null, 'user123')).toBe(true);
        });

        it('should return false for non-blacklisted user', () => {
            expect(isTokenBlacklisted(null, 'user123', Math.floor(Date.now() / 1000))).toBe(false);
        });
    });

    describe('getBlacklistStats', () => {
        it('should return correct counts', () => {
            blacklistToken('token1', Date.now() + 3600000);
            blacklistToken('token2', Date.now() + 3600000);
            blacklistUser('user1');
            
            const stats = getBlacklistStats();
            
            expect(stats.blacklistedTokens).toBe(2);
            expect(stats.blacklistedUsers).toBe(1);
        });

        it('should return zeros when empty', () => {
            const stats = getBlacklistStats();
            
            expect(stats.blacklistedTokens).toBe(0);
            expect(stats.blacklistedUsers).toBe(0);
        });
    });

    describe('cleanupExpiredTokens', () => {
        it('should remove expired tokens', () => {
            // Add expired token (expired 2 hours ago)
            const expiredTime = Date.now() - 2 * 3600000;
            blacklistToken('expired', expiredTime);
            
            // Add valid token
            blacklistToken('valid', Date.now() + 3600000);
            
            const cleaned = cleanupExpiredTokens();
            
            expect(cleaned).toBe(1);
            expect(_internals.blacklistedTokens.has('expired')).toBe(false);
            expect(_internals.blacklistedTokens.has('valid')).toBe(true);
        });

        it('should not remove recently expired tokens (within buffer)', () => {
            // Token expired 30 minutes ago (within 1 hour buffer)
            const recentlyExpired = Date.now() - 30 * 60000;
            blacklistToken('recent', recentlyExpired);
            
            const cleaned = cleanupExpiredTokens();
            
            expect(cleaned).toBe(0);
            expect(_internals.blacklistedTokens.has('recent')).toBe(true);
        });
    });

    describe('destroyBlacklist', () => {
        it('should clear all blacklists', () => {
            blacklistToken('token1', Date.now() + 3600000);
            blacklistUser('user1');
            
            destroyBlacklist();
            
            expect(_internals.blacklistedTokens.size).toBe(0);
            expect(_internals.blacklistedUsers.size).toBe(0);
        });
    });
});

describe('Integration: Token Revocation Flow', () => {
    beforeEach(() => {
        _internals.blacklistedTokens.clear();
        _internals.blacklistedUsers.clear();
    });

    it('should block access after logout', () => {
        const tokenJti = 'abc123';
        const userId = 'user1';
        const tokenIat = Math.floor(Date.now() / 1000);
        
        // Initially not blacklisted
        expect(isTokenBlacklisted(tokenJti, userId, tokenIat)).toBe(false);
        
        // User logs out - token is blacklisted
        blacklistToken(tokenJti, Date.now() + 3600000, 'logout', userId);
        
        // Now should be blacklisted
        expect(isTokenBlacklisted(tokenJti, userId, tokenIat)).toBe(true);
    });

    it('should block all tokens after account deactivation', () => {
        const userId = 'user1';
        const oldTokenIat = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
        
        // Initially not blacklisted
        expect(isTokenBlacklisted(null, userId, oldTokenIat)).toBe(false);
        
        // Account is deactivated
        blacklistUser(userId, 'account_deactivated');
        
        // Old token should now be blocked
        expect(isTokenBlacklisted(null, userId, oldTokenIat)).toBe(true);
        
        // Any token without timing should be blocked
        expect(isTokenBlacklisted(null, userId)).toBe(true);
    });

    it('should allow access after account reactivation', () => {
        const userId = 'user1';
        
        // Deactivate account
        blacklistUser(userId, 'account_deactivated');
        expect(isTokenBlacklisted(null, userId)).toBe(true);
        
        // Reactivate account
        unblacklistUser(userId);
        
        // New tokens should work (user not in blacklist)
        const newTokenIat = Math.floor(Date.now() / 1000);
        expect(isTokenBlacklisted(null, userId, newTokenIat)).toBe(false);
    });
});
