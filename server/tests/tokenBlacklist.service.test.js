/**
 * Tests for Token Blacklist Service
 * Tests the in-memory cache behavior (database is mocked)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the logger
vi.mock('../utils/logger.backend.js', () => ({
    safeLog: vi.fn()
}));

// Mock the database
vi.mock('../config/database.js', () => ({
    query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 })
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
} from '../services/tokenBlacklist.service.js';
import { query } from '../config/database.js';

describe('Token Blacklist Service', () => {
    beforeEach(() => {
        // Clear caches before each test
        _internals.tokenCache.clear();
        _internals.userCache.clear();
        query.mockReset();
        query.mockImplementation((sql, params = []) => {
            if (sql.includes('INSERT INTO token_blacklist')) {
                return Promise.resolve({
                    rowCount: 1,
                    rows: [{
                        token_jti: params[0],
                        user_id: params[1],
                        reason: params[2],
                        expires_at: params[3],
                        created_at: new Date()
                    }]
                });
            }

            if (sql.includes('INSERT INTO user_blacklist')) {
                return Promise.resolve({ rowCount: 1, rows: [] });
            }

            if (sql.includes('DELETE FROM user_blacklist')) {
                return Promise.resolve({ rowCount: 0, rows: [] });
            }

            if (sql.includes('DELETE FROM token_blacklist')) {
                return Promise.resolve({ rowCount: 0, rows: [] });
            }

            return Promise.resolve({ rows: [], rowCount: 0 });
        });
    });

    describe('blacklistToken', () => {
        it('should add token to cache', async () => {
            const result = await blacklistToken('token123', Date.now() + 3600000, 'logout', 'user1');
            
            expect(result).toBe(true);
            expect(_internals.tokenCache.has('token123')).toBe(true);
        });

        it('should return false for null token', async () => {
            const result = await blacklistToken(null, Date.now() + 3600000);
            
            expect(result).toBe(false);
        });

        it('should store token metadata in cache', async () => {
            const expiresAt = Date.now() + 3600000;
            await blacklistToken('token123', expiresAt, 'security_incident', 'user1');
            
            const entry = _internals.tokenCache.get('token123');
            expect(entry.expiresAt).toBe(expiresAt);
            expect(entry.reason).toBe('security_incident');
            expect(entry.userId).toBe('user1');
            expect(entry.blacklistedAt).toBeDefined();
        });
    });

    describe('blacklistUser', () => {
        it('should add user to cache', async () => {
            const result = await blacklistUser('user123', 'account_deactivated');
            
            expect(result).toBe(true);
            expect(_internals.userCache.has('user123')).toBe(true);
        });

        it('should return false for null user', async () => {
            const result = await blacklistUser(null);
            
            expect(result).toBe(false);
        });

        it('should store user metadata in cache', async () => {
            await blacklistUser('user123', 'security_incident');
            
            const entry = _internals.userCache.get('user123');
            expect(entry.reason).toBe('security_incident');
            expect(entry.blacklistedAt).toBeDefined();
        });
    });

    describe('unblacklistUser', () => {
        it('should remove user from cache', async () => {
            await blacklistUser('user123');
            expect(_internals.userCache.has('user123')).toBe(true);
            
            // Mock database to return rowCount > 0
            query.mockResolvedValueOnce({ rows: [], rowCount: 1 });
            
            const result = await unblacklistUser('user123');
            
            expect(result).toBe(true);
            expect(_internals.userCache.has('user123')).toBe(false);
        });

        it('should return false if user not in database', async () => {
            const result = await unblacklistUser('nonexistent');
            
            expect(result).toBe(false);
        });
    });

    describe('isTokenBlacklisted', () => {
        it('should return true for blacklisted token in cache', async () => {
            await blacklistToken('token123', Date.now() + 3600000);
            
            expect(isTokenBlacklisted('token123')).toBe(true);
        });

        it('should return false for non-blacklisted token', () => {
            expect(isTokenBlacklisted('unknown')).toBe(false);
        });

        it('should return true for blacklisted user with old token', async () => {
            // Blacklist user
            await blacklistUser('user123');
            
            // Token issued before blacklist (iat in seconds, 1 hour ago)
            const tokenIssuedAt = Math.floor(Date.now() / 1000) - 3600;
            
            expect(isTokenBlacklisted(null, 'user123', tokenIssuedAt)).toBe(true);
        });

        it('should return true for blacklisted user without timing info', async () => {
            await blacklistUser('user123');
            
            // No timing info - should be considered blacklisted for safety
            expect(isTokenBlacklisted(null, 'user123')).toBe(true);
        });

        it('should return false for non-blacklisted user', () => {
            expect(isTokenBlacklisted(null, 'user123', Math.floor(Date.now() / 1000))).toBe(false);
        });
    });

    describe('getBlacklistStats', () => {
        it('should return correct counts', async () => {
            await blacklistToken('token1', Date.now() + 3600000);
            await blacklistToken('token2', Date.now() + 3600000);
            await blacklistUser('user1');
            
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
        it('should call database cleanup', async () => {
            const { query } = await import('../config/database.js');
            query.mockResolvedValueOnce({ rows: [], rowCount: 5 });
            
            const cleaned = await cleanupExpiredTokens();
            
            expect(cleaned).toBe(5);
        });
    });

    describe('destroyBlacklist', () => {
        it('should clear all caches', async () => {
            await blacklistToken('token1', Date.now() + 3600000);
            await blacklistUser('user1');
            
            destroyBlacklist();
            
            expect(_internals.tokenCache.size).toBe(0);
            expect(_internals.userCache.size).toBe(0);
        });
    });
});

describe('Integration: Token Revocation Flow', () => {
    beforeEach(() => {
        _internals.tokenCache.clear();
        _internals.userCache.clear();
    });

    it('should block access after logout', async () => {
        const tokenJti = 'abc123';
        const userId = 'user1';
        const tokenIat = Math.floor(Date.now() / 1000);
        
        // Initially not blacklisted
        expect(isTokenBlacklisted(tokenJti, userId, tokenIat)).toBe(false);
        
        // User logs out - token is blacklisted
        await blacklistToken(tokenJti, Date.now() + 3600000, 'logout', userId);
        
        // Now should be blacklisted
        expect(isTokenBlacklisted(tokenJti, userId, tokenIat)).toBe(true);
    });

    it('should block all tokens after account deactivation', async () => {
        const userId = 'user1';
        const oldTokenIat = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
        
        // Initially not blacklisted
        expect(isTokenBlacklisted(null, userId, oldTokenIat)).toBe(false);
        
        // Account is deactivated
        await blacklistUser(userId, 'account_deactivated');
        
        // Old token should now be blocked
        expect(isTokenBlacklisted(null, userId, oldTokenIat)).toBe(true);
        
        // Any token without timing should be blocked
        expect(isTokenBlacklisted(null, userId)).toBe(true);
    });

    it('should allow access after account reactivation', async () => {
        const userId = 'user1';
        
        // Deactivate account
        await blacklistUser(userId, 'account_deactivated');
        expect(isTokenBlacklisted(null, userId)).toBe(true);
        
        // Mock database to return rowCount > 0 for unblacklist
        query.mockResolvedValueOnce({ rows: [], rowCount: 1 });
        
        // Reactivate account
        await unblacklistUser(userId);
        
        // New tokens should work (user not in cache)
        const newTokenIat = Math.floor(Date.now() / 1000);
        expect(isTokenBlacklisted(null, userId, newTokenIat)).toBe(false);
    });
});
