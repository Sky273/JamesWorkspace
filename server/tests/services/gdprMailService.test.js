/**
 * Tests for GDPR Mail Service
 * Tests getConnectionStatus, disconnect, proactiveTokenRefresh, getAuthUrl
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGenerateAuthUrl = vi.fn(() => 'https://accounts.google.com/auth');
const mockGetToken = vi.fn(() => ({ tokens: { access_token: 'at', refresh_token: 'rt', expiry_date: Date.now() + 3600000 } }));
const mockSetCredentials = vi.fn();
const mockRevokeToken = vi.fn();
const mockRefreshAccessToken = vi.fn(() => ({
    credentials: { access_token: 'new_at', refresh_token: 'new_rt', expiry_date: Date.now() + 3600000 }
}));
const mockUserinfoGet = vi.fn(() => ({ data: { email: 'test@gmail.com' } }));

class MockOAuth2 {
    constructor() {}
    generateAuthUrl(...args) { return mockGenerateAuthUrl(...args); }
    getToken(...args) { return mockGetToken(...args); }
    setCredentials(...args) { return mockSetCredentials(...args); }
    revokeToken(...args) { return mockRevokeToken(...args); }
    refreshAccessToken(...args) { return mockRefreshAccessToken(...args); }
}

vi.mock('googleapis', () => ({
    google: {
        auth: { OAuth2: MockOAuth2 },
        oauth2: vi.fn(() => ({ userinfo: { get: mockUserinfoGet } })),
        gmail: vi.fn(() => ({
            users: {
                messages: { send: vi.fn(() => ({ data: { id: 'msg1' } })) },
                getProfile: vi.fn(() => ({ data: { emailAddress: 'test@gmail.com' } }))
            }
        }))
    }
}));

vi.mock('../../config/database.js', () => ({
    query: vi.fn()
}));

vi.mock('../../config/oauth.config.js', () => ({
    encryptToken: vi.fn((t) => `enc_${t}`),
    decryptToken: vi.fn((t) => t.replace('enc_', '')),
    calculateTokenExpiry: vi.fn(() => new Date(Date.now() + 3600000)),
    isTokenExpired: vi.fn(() => false)
}));

vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn()
}));

import { query } from '../../config/database.js';
import { isTokenExpired } from '../../config/oauth.config.js';
import {
    getAuthUrl,
    getConnectionStatus,
    disconnect,
    proactiveTokenRefresh,
    sendEmail
} from '../../services/mail/gdprMailService.js';

describe('GDPR Mail Service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        delete process.env.E2E_DISABLE_EXTERNAL_EMAIL;
    });

    describe('getAuthUrl', () => {
        it('should return an authorization URL', async () => {
            const url = await getAuthUrl('csrf-state');
            expect(url).toBe('https://accounts.google.com/auth');
            expect(mockGenerateAuthUrl).toHaveBeenCalledWith(
                expect.objectContaining({ access_type: 'offline', state: 'csrf-state' })
            );
        });
    });

    describe('getConnectionStatus', () => {
        it('should return connected status when token exists and valid', async () => {
            isTokenExpired.mockReturnValueOnce(false);
            query.mockResolvedValueOnce({
                rows: [{ provider: 'gmail', email: 'test@gmail.com', token_expiry: new Date(), updated_at: new Date() }]
            });

            const status = await getConnectionStatus();

            expect(status.connected).toBe(true);
            expect(status.email).toBe('test@gmail.com');
            expect(status.provider).toBe('gmail');
        });

        it('should return disconnected when no token exists', async () => {
            query.mockResolvedValueOnce({ rows: [] });

            const status = await getConnectionStatus();

            expect(status.connected).toBe(false);
        });

        it('should return needsReauth when token expired', async () => {
            isTokenExpired.mockReturnValueOnce(true);
            query.mockResolvedValueOnce({
                rows: [{ provider: 'gmail', email: 'test@gmail.com', token_expiry: new Date(), updated_at: new Date() }]
            });

            const status = await getConnectionStatus();

            expect(status.connected).toBe(false);
            expect(status.needsReauth).toBe(true);
        });
    });

    describe('disconnect', () => {
        it('should revoke token and delete from DB', async () => {
            query.mockResolvedValueOnce({ rows: [{ access_token_encrypted: 'enc_tok' }] }); // SELECT
            query.mockResolvedValueOnce({ rows: [] }); // DELETE

            await disconnect();

            expect(mockRevokeToken).toHaveBeenCalled();
            expect(query.mock.calls[1][0]).toContain('DELETE FROM global_gdpr_mail_token');
        });

        it('should delete from DB even if revocation fails', async () => {
            query.mockResolvedValueOnce({ rows: [{ access_token_encrypted: 'enc_tok' }] });
            mockRevokeToken.mockRejectedValueOnce(new Error('revoke error'));
            query.mockResolvedValueOnce({ rows: [] });

            await disconnect();

            expect(query.mock.calls[1][0]).toContain('DELETE');
        });

        it('should handle no token gracefully', async () => {
            query.mockResolvedValueOnce({ rows: [] });
            query.mockResolvedValueOnce({ rows: [] });

            await disconnect();

            expect(mockRevokeToken).not.toHaveBeenCalled();
        });
    });

    describe('sendEmail', () => {
        it('should short-circuit delivery when external email is disabled', async () => {
            process.env.E2E_DISABLE_EXTERNAL_EMAIL = 'true';

            const result = await sendEmail({
                to: 'playwright@example.com',
                subject: 'Disabled delivery',
                html: '<p>hello</p>',
                text: 'hello'
            });

            expect(result.success).toBe(true);
            expect(result.sentTo).toBe('playwright@example.com');
            expect(result.disabled).toBe(true);
            expect(query).not.toHaveBeenCalled();
        });
    });

    describe('proactiveTokenRefresh', () => {
        it('should return success with no token configured', async () => {
            query.mockResolvedValueOnce({ rows: [] });

            const result = await proactiveTokenRefresh();

            expect(result.success).toBe(true);
            expect(result.message).toContain('No token configured');
        });

        it('should return failure when no refresh token', async () => {
            query.mockResolvedValueOnce({
                rows: [{ access_token_encrypted: 'enc_at', refresh_token_encrypted: null, email: 'test@gmail.com' }]
            });

            const result = await proactiveTokenRefresh();

            expect(result.success).toBe(false);
            expect(result.message).toContain('No refresh token');
        });

        it('should refresh token successfully', async () => {
            query.mockResolvedValueOnce({
                rows: [{ access_token_encrypted: 'enc_at', refresh_token_encrypted: 'enc_rt', token_expiry: new Date(), email: 'test@gmail.com' }]
            });
            query.mockResolvedValueOnce({ rows: [] }); // UPDATE

            const result = await proactiveTokenRefresh();

            expect(result.success).toBe(true);
            expect(result.email).toBe('test@gmail.com');
        });

        it('should handle revoked token error', async () => {
            query.mockResolvedValueOnce({
                rows: [{ access_token_encrypted: 'enc_at', refresh_token_encrypted: 'enc_rt', email: 'test@gmail.com' }]
            });
            mockRefreshAccessToken.mockRejectedValueOnce(new Error('invalid_grant'));
            query.mockResolvedValueOnce({ rows: [] }); // mark invalid

            const result = await proactiveTokenRefresh();

            expect(result.success).toBe(false);
            expect(result.message).toContain('révoqué');
        });

        it('should handle generic refresh error', async () => {
            query.mockResolvedValueOnce({
                rows: [{ access_token_encrypted: 'enc_at', refresh_token_encrypted: 'enc_rt', email: 'test@gmail.com' }]
            });
            mockRefreshAccessToken.mockRejectedValueOnce(new Error('network error'));

            const result = await proactiveTokenRefresh();

            expect(result.success).toBe(false);
            expect(result.message).toBe('network error');
        });
    });
});
