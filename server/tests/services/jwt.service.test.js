/**
 * Tests for JWT Service
 * Tests token generation, verification, revocation, and role extraction
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn()
}));

vi.mock('../../config/constants.js', () => ({
    JWT_SECRET: 'test-jwt-secret-32chars-minimum!',
    REFRESH_TOKEN_SECRET: 'test-refresh-secret-32chars-min!',
    JWT_EXPIRES_IN: '1h',
    REFRESH_TOKEN_EXPIRES_IN: '7d'
}));

vi.mock('../../services/tokenBlacklist.service.js', () => ({
    isTokenBlacklistedAsync: vi.fn(() => Promise.resolve(false)),
    blacklistToken: vi.fn(() => Promise.resolve(true))
}));

import { isTokenBlacklistedAsync, blacklistToken } from '../../services/tokenBlacklist.service.js';
import {
    generateAccessToken,
    generateRefreshToken,
    verifyToken,
    verifyRefreshToken,
    revokeToken,
    extractRoleFromUser
} from '../../services/jwt.service.js';

const testUser = {
    id: 'u1',
    email: 'test@test.com',
    name: 'Test User',
    status: 'active',
    role: 'user',
    firm_id: 'f1',
    firm: 'Acme'
};

describe('JWT Service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        isTokenBlacklistedAsync.mockResolvedValue(false);
    });

    describe('generateAccessToken', () => {
        it('should return a JWT string', () => {
            const token = generateAccessToken(testUser);
            expect(typeof token).toBe('string');
            expect(token.split('.')).toHaveLength(3);
        });

        it('should include user payload', () => {
            const token = generateAccessToken(testUser);
            return verifyToken(token).then((decoded) => {
                expect(decoded.id).toBe('u1');
                expect(decoded.sub).toBe('u1');
                expect(decoded.role).toBe('user');
                expect(decoded.firmId).toBe('f1');
                expect(decoded.email).toBeUndefined();
                expect(decoded.name).toBeUndefined();
                expect(decoded.status).toBeUndefined();
                expect(decoded.firmName).toBeUndefined();
                expect(decoded.jti).toBeDefined();
            });
        });
    });

    describe('generateRefreshToken', () => {
        it('should return a JWT string', () => {
            const token = generateRefreshToken(testUser);
            expect(typeof token).toBe('string');
            expect(token.split('.')).toHaveLength(3);
        });

        it('should include refresh type', () => {
            const token = generateRefreshToken(testUser);
            return verifyRefreshToken(token).then((decoded) => {
                expect(decoded.type).toBe('refresh');
                expect(decoded.id).toBe('u1');
                expect(decoded.sub).toBe('u1');
                expect(decoded.email).toBeUndefined();
            });
        });
    });

    describe('verifyToken', () => {
        it('should verify valid access token', async () => {
            const token = generateAccessToken(testUser);
            const decoded = await verifyToken(token);

            expect(decoded).not.toBeNull();
            expect(decoded.id).toBe('u1');
        });

        it('should return null for invalid token', () => {
            return expect(verifyToken('invalid.token.here')).resolves.toBeNull();
        });

        it('should return null for blacklisted token', async () => {
            isTokenBlacklistedAsync.mockResolvedValue(true);
            const token = generateAccessToken(testUser);
            await expect(verifyToken(token)).resolves.toBeNull();
        });

        it('should return null when blacklist lookup fails', async () => {
            isTokenBlacklistedAsync.mockRejectedValueOnce(new Error('blacklist db down'));
            const token = generateAccessToken(testUser);

            await expect(verifyToken(token)).resolves.toBeNull();
        });
    });

    describe('verifyRefreshToken', () => {
        it('should verify valid refresh token', async () => {
            const token = generateRefreshToken(testUser);
            const decoded = await verifyRefreshToken(token);

            expect(decoded).not.toBeNull();
            expect(decoded.type).toBe('refresh');
        });

        it('should return null for invalid token', () => {
            return expect(verifyRefreshToken('bad.token')).resolves.toBeNull();
        });

        it('should return null for blacklisted refresh token', async () => {
            isTokenBlacklistedAsync.mockResolvedValue(true);
            const token = generateRefreshToken(testUser);
            await expect(verifyRefreshToken(token)).resolves.toBeNull();
        });

        it('should reject access token used as refresh token', async () => {
            const accessToken = generateAccessToken(testUser);
            // Access token signed with different secret should fail verification
            await expect(verifyRefreshToken(accessToken)).resolves.toBeNull();
        });
    });

    describe('revokeToken', () => {
        it('should blacklist a valid token', async () => {
            const token = generateAccessToken(testUser);

            const result = await revokeToken(token);

            expect(result).toBe(true);
            expect(blacklistToken).toHaveBeenCalled();
        });

        it('should return false for invalid token', async () => {
            expect(await revokeToken('not-a-jwt')).toBe(false);
        });
    });

    describe('extractRoleFromUser', () => {
        it('should return role from fields', () => {
            expect(extractRoleFromUser({ role: 'admin' })).toBe('admin');
        });

        it('should normalize role to lowercase', () => {
            expect(extractRoleFromUser({ role: 'Admin' })).toBe('admin');
        });

        it('should return "user" for missing role', () => {
            expect(extractRoleFromUser({})).toBe('user');
        });

        it('should return "user" for invalid role', () => {
            expect(extractRoleFromUser({ role: 'superadmin' })).toBe('user');
        });

        it('should accept Role (capital R)', () => {
            expect(extractRoleFromUser({ Role: 'admin' })).toBe('admin');
        });
    });
});
