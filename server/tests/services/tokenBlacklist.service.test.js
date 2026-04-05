/**
 * Tests for Token Blacklist Service
 * Security-critical: JWT token revocation with DB + in-memory cache
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../config/database.js', () => ({
    query: vi.fn()
}));

vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn()
}));

import { query } from '../../config/database.js';
import { safeLog } from '../../utils/logger.backend.js';
import {
    blacklistToken,
    blacklistUser,
    unblacklistUser,
    isTokenBlacklisted,
    isTokenBlacklistedAsync,
    getBlacklistStats,
    cleanupExpiredTokens,
    startBlacklistCleanup,
    destroyBlacklist,
    _internals
} from '../../services/tokenBlacklist.service.js';

describe('Token Blacklist Service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Clear internal caches
        _internals.tokenCache.clear();
        _internals.userCache.clear();
    });

    describe('blacklistToken', () => {
        it('should blacklist a token and update cache', async () => {
            query.mockResolvedValueOnce({
                rowCount: 1,
                rows: [{
                    token_jti: 'jti-123',
                    user_id: 'user-1',
                    reason: 'logout',
                    expires_at: new Date(Date.now() + 3600000),
                    created_at: new Date()
                }]
            });

            const result = await blacklistToken('jti-123', Date.now() + 3600000, 'logout', 'user-1');

            expect(result).toBe(true);
            expect(query).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO token_blacklist'),
                expect.arrayContaining(['jti-123', 'user-1', 'logout'])
            );
            expect(_internals.tokenCache.has('jti-123')).toBe(true);
        });

        it('should return false when the token was already blacklisted', async () => {
            query.mockResolvedValueOnce({ rowCount: 0, rows: [] });

            const result = await blacklistToken('jti-123', Date.now() + 3600000, 'logout', 'user-1');

            expect(result).toBe(false);
            expect(_internals.tokenCache.has('jti-123')).toBe(false);
        });

        it('should return false for null tokenId', async () => {
            const result = await blacklistToken(null);
            expect(result).toBe(false);
            expect(query).not.toHaveBeenCalled();
        });

        it('should return false on DB error', async () => {
            query.mockRejectedValueOnce(new Error('DB error'));

            const result = await blacklistToken('jti-123', Date.now() + 3600000);

            expect(result).toBe(false);
            expect(safeLog).toHaveBeenCalledWith('error', expect.any(String), expect.any(Object));
        });
    });

    describe('blacklistUser', () => {
        it('should blacklist a user and update cache', async () => {
            query.mockResolvedValueOnce({ rows: [] });

            const result = await blacklistUser('user-1', 'account_deactivated');

            expect(result).toBe(true);
            expect(query).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO user_blacklist'),
                ['user-1', 'account_deactivated']
            );
            expect(_internals.userCache.has('user-1')).toBe(true);
        });

        it('should return false for null userId', async () => {
            const result = await blacklistUser(null);
            expect(result).toBe(false);
        });

        it('should return false on DB error', async () => {
            query.mockRejectedValueOnce(new Error('DB error'));

            const result = await blacklistUser('user-1');

            expect(result).toBe(false);
        });
    });

    describe('unblacklistUser', () => {
        it('should remove user from blacklist', async () => {
            _internals.userCache.set('user-1', { blacklistedAt: Date.now(), reason: 'test' });
            query.mockResolvedValueOnce({ rowCount: 1 });

            const result = await unblacklistUser('user-1');

            expect(result).toBe(true);
            expect(_internals.userCache.has('user-1')).toBe(false);
        });

        it('should return false if user not in blacklist', async () => {
            query.mockResolvedValueOnce({ rowCount: 0 });

            const result = await unblacklistUser('unknown');

            expect(result).toBe(false);
        });

        it('should return false on DB error', async () => {
            query.mockRejectedValueOnce(new Error('DB error'));

            const result = await unblacklistUser('user-1');

            expect(result).toBe(false);
        });
    });

    describe('isTokenBlacklisted', () => {
        it('should return true if token is in cache', () => {
            _internals.tokenCache.set('jti-123', { expiresAt: Date.now() + 3600000 });

            expect(isTokenBlacklisted('jti-123')).toBe(true);
        });

        it('should return false if token not in cache', () => {
            expect(isTokenBlacklisted('jti-unknown')).toBe(false);
        });

        it('should return true if user is blacklisted and token was issued before', () => {
            const blacklistedAt = Date.now();
            _internals.userCache.set('user-1', { blacklistedAt, reason: 'test' });

            // Token issued 10 seconds before blacklisting (iat in seconds)
            const tokenIssuedAt = Math.floor((blacklistedAt - 10000) / 1000);

            expect(isTokenBlacklisted(null, 'user-1', tokenIssuedAt)).toBe(true);
        });

        it('should return false if token was issued after user blacklisting', () => {
            const blacklistedAt = Date.now() - 60000; // blacklisted 1 min ago
            _internals.userCache.set('user-1', { blacklistedAt, reason: 'test' });

            // Token issued 10 seconds ago (after blacklisting)
            const tokenIssuedAt = Math.floor((Date.now() - 10000) / 1000);

            expect(isTokenBlacklisted(null, 'user-1', tokenIssuedAt)).toBe(false);
        });

        it('should return true if user is blacklisted with no timing info', () => {
            _internals.userCache.set('user-1', { blacklistedAt: Date.now(), reason: 'test' });

            expect(isTokenBlacklisted(null, 'user-1', null)).toBe(true);
        });
    });

    describe('isTokenBlacklistedAsync', () => {
        it('should refresh cache and check token', async () => {
            // Mock cache refresh queries
            query.mockResolvedValueOnce({ rows: [{ token_jti: 'jti-999', user_id: 'u1', reason: 'logout', expires_at: new Date(Date.now() + 3600000), created_at: new Date() }] });
            query.mockResolvedValueOnce({ rows: [] });

            const result = await isTokenBlacklistedAsync('jti-999');

            expect(result).toBe(true);
        });
    });

    describe('getBlacklistStats', () => {
        it('should return cache statistics', () => {
            _internals.tokenCache.set('t1', {});
            _internals.tokenCache.set('t2', {});
            _internals.userCache.set('u1', {});

            const stats = getBlacklistStats();

            expect(stats.blacklistedTokens).toBe(2);
            expect(stats.blacklistedUsers).toBe(1);
            expect(stats.maxTokenCacheSize).toBe(10000);
            expect(stats.maxUserCacheSize).toBe(1000);
        });
    });

    describe('cleanupExpiredTokens', () => {
        it('should delete expired tokens from DB', async () => {
            query.mockResolvedValueOnce({ rowCount: 5 });

            const cleaned = await cleanupExpiredTokens();

            expect(cleaned).toBe(5);
            expect(query).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM token_blacklist'));
        });

        it('should return 0 on DB error', async () => {
            query.mockRejectedValueOnce(new Error('DB error'));

            const cleaned = await cleanupExpiredTokens();

            expect(cleaned).toBe(0);
        });
    });

    describe('destroyBlacklist', () => {
        it('should clear all caches', () => {
            _internals.tokenCache.set('t1', {});
            _internals.userCache.set('u1', {});

            destroyBlacklist();

            expect(_internals.tokenCache.size).toBe(0);
            expect(_internals.userCache.size).toBe(0);
        });
    });

    describe('startBlacklistCleanup', () => {
        it('should start cleanup interval', () => {
            query.mockResolvedValue({ rows: [] });

            startBlacklistCleanup(60000);

            expect(safeLog).toHaveBeenCalledWith('info', 'Token blacklist cleanup started', expect.any(Object));

            // Cleanup
            destroyBlacklist();
        });
    });
});
