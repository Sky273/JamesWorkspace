/**
 * Tests for Mail Service
 * Tests OAuth flow, token management, and connection status
 * Note: createDraft tests are skipped as they require complex Gmail API mocking
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies before importing the service
vi.mock('../../config/database.js', () => ({
    query: vi.fn()
}));

vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn()
}));

vi.mock('../../config/oauth.config.js', () => ({
    encryptToken: vi.fn(token => `encrypted_${token}`),
    decryptToken: vi.fn(token => token.replace('encrypted_', '')),
    calculateTokenExpiry: vi.fn(() => new Date(Date.now() + 3600000)),
    isTokenExpired: vi.fn(expiry => new Date(expiry) < new Date()),
    googleOAuthConfig: {
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        redirectUri: 'http://localhost:3001/api/mail/callback/gmail'
    }
}));

// Import after mocks
import { query } from '../../config/database.js';
import { isTokenExpired } from '../../config/oauth.config.js';
import mailService from '../../services/mail/mailService.js';

describe('Mail Service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('getProvider', () => {
        it('should return gmail provider by default', () => {
            const provider = mailService.getProvider();
            expect(provider).toBeDefined();
            expect(provider.getAuthUrl).toBeDefined();
        });

        it('should return gmail provider when specified', () => {
            const provider = mailService.getProvider('gmail');
            expect(provider).toBeDefined();
        });

        it('should throw error for unknown provider', () => {
            expect(() => mailService.getProvider('unknown')).toThrow('Unknown mail provider');
        });
    });

    describe('getConnectionStatus', () => {
        it('should return not connected if no tokens', async () => {
            query.mockResolvedValueOnce({ rows: [] });

            const status = await mailService.getConnectionStatus('user_123');

            expect(status.connected).toBe(false);
        });

        it('should return connected if valid token exists', async () => {
            const futureDate = new Date(Date.now() + 3600000);
            isTokenExpired.mockReturnValueOnce(false);
            
            query.mockResolvedValueOnce({ 
                rows: [{
                    provider: 'gmail',
                    email: 'test@gmail.com',
                    token_expiry: futureDate,
                    updated_at: new Date()
                }]
            });

            const status = await mailService.getConnectionStatus('user_123');

            expect(status.connected).toBe(true);
            expect(status.email).toBe('test@gmail.com');
            expect(status.provider).toBe('gmail');
        });

        it('should return needsReauth if token expired', async () => {
            const pastDate = new Date(Date.now() - 3600000);
            isTokenExpired.mockReturnValueOnce(true);
            
            query.mockResolvedValueOnce({ 
                rows: [{
                    provider: 'gmail',
                    email: 'test@gmail.com',
                    token_expiry: pastDate,
                    updated_at: new Date()
                }]
            });

            const status = await mailService.getConnectionStatus('user_123');

            expect(status.connected).toBe(false);
            expect(status.needsReauth).toBe(true);
        });
    });

    describe('getAccessToken', () => {
        it('should throw error if no connection found', async () => {
            query.mockResolvedValueOnce({ rows: [] });

            await expect(mailService.getAccessToken('user_123'))
                .rejects.toThrow('No mail connection found');
        });

        it('should return decrypted token if not expired', async () => {
            isTokenExpired.mockReturnValueOnce(false);
            
            query.mockResolvedValueOnce({ 
                rows: [{
                    access_token_encrypted: 'encrypted_valid_token',
                    refresh_token_encrypted: 'encrypted_refresh',
                    token_expiry: new Date(Date.now() + 3600000)
                }]
            });

            const token = await mailService.getAccessToken('user_123');

            expect(token).toBe('valid_token');
        });

        it('should throw error if expired and no refresh token', async () => {
            isTokenExpired.mockReturnValueOnce(true);
            
            query.mockResolvedValueOnce({ 
                rows: [{
                    access_token_encrypted: 'encrypted_old_token',
                    refresh_token_encrypted: null,
                    token_expiry: new Date(Date.now() - 3600000)
                }]
            });

            await expect(mailService.getAccessToken('user_123'))
                .rejects.toThrow('no refresh token');
        });
    });

    describe('disconnect', () => {
        it('should delete token from database', async () => {
            query.mockResolvedValueOnce({ rows: [] }); // Select query (no token)
            query.mockResolvedValueOnce({ rows: [] }); // Delete query

            await mailService.disconnect('user_123', 'gmail');

            expect(query).toHaveBeenCalledTimes(2);
            expect(query).toHaveBeenLastCalledWith(
                expect.stringContaining('DELETE FROM user_mail_tokens'),
                ['user_123', 'gmail']
            );
        });
    });
});
