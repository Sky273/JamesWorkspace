/**
 * Tests for Google Auth Service
 * Tests account linking/unlinking, user lookup, link status, and Gmail tokens
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../config/database.js', () => ({
    query: vi.fn()
}));

vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn()
}));

vi.mock('../../config/oauth.config.js', () => ({
    googleAuthConfig: {
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        redirectUri: 'http://localhost:3001/api/auth/google/callback',
        scopes: ['email', 'profile']
    },
    encryptToken: vi.fn((t) => `enc_${t}`),
    decryptToken: vi.fn((t) => t.replace('enc_', '')),
    calculateTokenExpiry: vi.fn(() => new Date(Date.now() + 3600000))
}));

vi.mock('googleapis', () => ({
    google: {
        auth: { OAuth2: vi.fn(() => ({
            generateAuthUrl: vi.fn(() => 'https://accounts.google.com/auth'),
            getToken: vi.fn(() => ({ tokens: { access_token: 'at', refresh_token: 'rt' } })),
            setCredentials: vi.fn(),
            verifyIdToken: vi.fn(() => ({
                getPayload: () => ({ email: 'u@g.com', name: 'User', picture: '', sub: 'g1', email_verified: true })
            }))
        })) },
        oauth2: vi.fn(() => ({ userinfo: { get: vi.fn(() => ({ data: { email: 'u@g.com', name: 'User', picture: '', id: 'g1' } })) } }))
    }
}));

import { query } from '../../config/database.js';
import {
    linkGoogleAccount,
    unlinkGoogleAccount,
    findUserByGoogleId,
    findUserByEmail,
    getGoogleLinkStatus,
    destroyGoogleAuth
} from '../../services/googleAuth.service.js';

describe('Google Auth Service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('linkGoogleAccount', () => {
        it('should update user with google ID and email', async () => {
            query.mockResolvedValueOnce({ rows: [] });

            const result = await linkGoogleAccount('u1', 'g123', 'user@gmail.com');

            expect(result).toBe(true);
            expect(query.mock.calls[0][0]).toContain('google_id = $1');
            expect(query.mock.calls[0][1]).toEqual(['g123', 'user@gmail.com', 'u1']);
        });

        it('should throw on DB error', async () => {
            query.mockRejectedValueOnce(new Error('DB error'));
            await expect(linkGoogleAccount('u1', 'g1', 'e@g.com')).rejects.toThrow();
        });
    });

    describe('unlinkGoogleAccount', () => {
        it('should set google fields to NULL', async () => {
            query.mockResolvedValueOnce({ rows: [] });

            const result = await unlinkGoogleAccount('u1');

            expect(result).toBe(true);
            expect(query.mock.calls[0][0]).toContain('google_id = NULL');
        });

        it('should throw on DB error', async () => {
            query.mockRejectedValueOnce(new Error('DB error'));
            await expect(unlinkGoogleAccount('u1')).rejects.toThrow();
        });
    });

    describe('findUserByGoogleId', () => {
        it('should return user with firm logo', async () => {
            query.mockResolvedValueOnce({ rows: [{ id: 'u1', google_id: 'g1', firm_logo: '/logo.png' }] });

            const result = await findUserByGoogleId('g1');

            expect(result.id).toBe('u1');
            expect(query.mock.calls[0][0]).toContain('google_id = $1');
        });

        it('should return null if not found', async () => {
            query.mockResolvedValueOnce({ rows: [] });
            expect(await findUserByGoogleId('missing')).toBeNull();
        });

        it('should return null on error', async () => {
            query.mockRejectedValueOnce(new Error('DB error'));
            expect(await findUserByGoogleId('g1')).toBeNull();
        });
    });

    describe('findUserByEmail', () => {
        it('should return user with firm logo', async () => {
            query.mockResolvedValueOnce({ rows: [{ id: 'u1', email: 'user@test.com' }] });

            const result = await findUserByEmail('user@test.com');

            expect(result.email).toBe('user@test.com');
        });

        it('should return null if not found', async () => {
            query.mockResolvedValueOnce({ rows: [] });
            expect(await findUserByEmail('missing@test.com')).toBeNull();
        });

        it('should return null on error', async () => {
            query.mockRejectedValueOnce(new Error('DB error'));
            expect(await findUserByEmail('user@test.com')).toBeNull();
        });
    });

    describe('getGoogleLinkStatus', () => {
        it('should return linked status with email', async () => {
            query.mockResolvedValueOnce({ rows: [{ google_id: 'g1', google_email: 'u@g.com', google_linked_at: '2025-01-01' }] });

            const result = await getGoogleLinkStatus('u1');

            expect(result.linked).toBe(true);
            expect(result.email).toBe('u@g.com');
        });

        it('should return not linked if no google_id', async () => {
            query.mockResolvedValueOnce({ rows: [{ google_id: null, google_email: null, google_linked_at: null }] });

            const result = await getGoogleLinkStatus('u1');

            expect(result.linked).toBe(false);
        });

        it('should return not linked if user not found', async () => {
            query.mockResolvedValueOnce({ rows: [] });

            const result = await getGoogleLinkStatus('missing');

            expect(result).toEqual({ linked: false, email: null });
        });

        it('should return not linked on error', async () => {
            query.mockRejectedValueOnce(new Error('DB error'));

            const result = await getGoogleLinkStatus('u1');

            expect(result).toEqual({ linked: false, email: null });
        });
    });

    describe('destroyGoogleAuth', () => {
        it('should not throw', () => {
            expect(() => destroyGoogleAuth()).not.toThrow();
        });
    });
});
