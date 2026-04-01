/**
 * Tests for config/oauth.config.js
 * encryptToken, decryptToken, isTokenExpired, calculateTokenExpiry, config objects
 */

import { describe, it, expect, beforeEach } from 'vitest';
import crypto from 'crypto';

// Set encryption key BEFORE module import (getEncryptionKey reads process.env at call time)
const TEST_KEY = crypto.randomBytes(32).toString('hex'); // 64 hex chars
process.env.MAIL_TOKEN_ENCRYPTION_KEY = TEST_KEY;

import {
    encryptToken,
    decryptToken,
    isTokenExpired,
    calculateTokenExpiry,
    googleAuthConfig,
    googleOAuthConfig,
    TOKEN_VALIDITY_DAYS
} from '../../config/oauth.config.js';

describe('oauth.config', () => {
    beforeEach(() => {
        process.env.MAIL_TOKEN_ENCRYPTION_KEY = TEST_KEY;
    });

    describe('encryptToken / decryptToken', () => {
        it('should encrypt and decrypt a token round-trip', () => {
            const original = 'ya29.a0AfH6SMA_test_token_value';
            
            const encrypted = encryptToken(original);
            expect(encrypted).not.toBe(original);
            expect(encrypted).toContain(':'); // format: iv:authTag:data
            
            const decrypted = decryptToken(encrypted);
            expect(decrypted).toBe(original);
        });

        it('should return null for null/empty input', () => {
            expect(encryptToken(null)).toBeNull();
            expect(decryptToken(null)).toBeNull();
        });

        it('should produce different ciphertexts for the same input (random IV)', () => {
            const token = 'same-token';
            
            const enc1 = encryptToken(token);
            const enc2 = encryptToken(token);
            
            expect(enc1).not.toBe(enc2); // Different IVs
        });

        it('should throw on invalid encrypted format', () => {
            expect(() => decryptToken('invalid-no-colons')).toThrow('Invalid encrypted token format');
        });

        it('should throw when encryption key is missing', () => {
            delete process.env.MAIL_TOKEN_ENCRYPTION_KEY;
            
            expect(() => encryptToken('test')).toThrow('MAIL_TOKEN_ENCRYPTION_KEY');
        });

        it('should throw when encryption key is too short', () => {
            process.env.MAIL_TOKEN_ENCRYPTION_KEY = 'tooshort';
            
            expect(() => encryptToken('test')).toThrow('MAIL_TOKEN_ENCRYPTION_KEY');
        });
    });

    describe('isTokenExpired', () => {
        it('should return true for null/undefined', () => {
            expect(isTokenExpired(null)).toBe(true);
            expect(isTokenExpired(undefined)).toBe(true);
        });

        it('should return true for past dates', () => {
            expect(isTokenExpired(new Date(Date.now() - 86400000))).toBe(true);
        });

        it('should return false for future dates', () => {
            expect(isTokenExpired(new Date(Date.now() + 86400000))).toBe(false);
        });

        it('should handle string dates', () => {
            const futureStr = new Date(Date.now() + 86400000).toISOString();
            expect(isTokenExpired(futureStr)).toBe(false);
        });
    });

    describe('calculateTokenExpiry', () => {
        it('should return 7-day expiry when refresh token available', () => {
            const before = Date.now();
            const expiry = calculateTokenExpiry(3600, true);
            
            const expectedMs = TOKEN_VALIDITY_DAYS * 24 * 60 * 60 * 1000;
            expect(expiry.getTime()).toBeGreaterThanOrEqual(before + expectedMs - 100);
        });

        it('should use OAuth expiresIn when no refresh token', () => {
            const before = Date.now();
            const expiry = calculateTokenExpiry(7200, false); // 2 hours
            
            const diff = expiry.getTime() - before;
            expect(diff).toBeGreaterThan(7100 * 1000);
            expect(diff).toBeLessThan(7300 * 1000);
        });

        it('should default to 1 hour when no expiresIn and no refresh token', () => {
            const before = Date.now();
            const expiry = calculateTokenExpiry(null, false);
            
            const diff = expiry.getTime() - before;
            expect(diff).toBeGreaterThan(3500 * 1000);
            expect(diff).toBeLessThan(3700 * 1000);
        });

        it('should default to refresh token behavior (hasRefreshToken=true)', () => {
            const expiry = calculateTokenExpiry(3600);
            const diff = expiry.getTime() - Date.now();
            const expectedMs = TOKEN_VALIDITY_DAYS * 24 * 60 * 60 * 1000;
            expect(diff).toBeGreaterThan(expectedMs - 5000);
        });
    });

    describe('config objects', () => {
        it('should export googleAuthConfig with SSO scopes', () => {
            expect(googleAuthConfig).toBeDefined();
            expect(googleAuthConfig.scopes).toContain('https://www.googleapis.com/auth/userinfo.email');
            expect(googleAuthConfig.scopes).toContain('https://www.googleapis.com/auth/userinfo.profile');
        });

        it('should export googleOAuthConfig with gmail compose scope', () => {
            expect(googleOAuthConfig).toBeDefined();
            expect(googleOAuthConfig.scopes).toContain('https://www.googleapis.com/auth/gmail.compose');
        });

        it('should export TOKEN_VALIDITY_DAYS as 7', () => {
            expect(TOKEN_VALIDITY_DAYS).toBe(7);
        });
    });
});
