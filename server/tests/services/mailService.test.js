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

// Mock gmail provider
const mockGetAuthUrl = vi.fn();
const mockExchangeCode = vi.fn();
const mockRefreshAccessToken = vi.fn();
const mockCreateDraft = vi.fn();
const mockRevokeToken = vi.fn();

vi.mock('../../services/mail/gmailProvider.js', () => ({
    gmailProvider: {
        getAuthUrl: (...args) => mockGetAuthUrl(...args),
        exchangeCode: (...args) => mockExchangeCode(...args),
        refreshAccessToken: (...args) => mockRefreshAccessToken(...args),
        createDraft: (...args) => mockCreateDraft(...args),
        revokeToken: (...args) => mockRevokeToken(...args)
    }
}));

// Import after mocks
import { query } from '../../config/database.js';
import { isTokenExpired } from '../../config/oauth.config.js';
import * as mailService from '../../services/mail/mailService.js';

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
            // First query: check user_mail_tokens - no tokens
            query.mockResolvedValueOnce({ rows: [] });
            // Second query: check users for SSO - no SSO
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

        it('should detect Google SSO user without mail tokens', async () => {
            // No mail tokens
            query.mockResolvedValueOnce({ rows: [] });
            // SSO user found
            query.mockResolvedValueOnce({ 
                rows: [{ google_id: 'goog-123', google_email: 'sso@gmail.com' }] 
            });

            const status = await mailService.getConnectionStatus('user_123');

            expect(status.connected).toBe(false);
            expect(status.isSsoUser).toBe(true);
            expect(status.email).toBe('sso@gmail.com');
            expect(status.needsReauth).toBe(true);
            expect(status.source).toBe('sso');
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

        it('should refresh expired token with refresh token', async () => {
            isTokenExpired.mockReturnValueOnce(true);
            
            query.mockResolvedValueOnce({ 
                rows: [{
                    access_token_encrypted: 'encrypted_old_token',
                    refresh_token_encrypted: 'encrypted_refresh_token',
                    token_expiry: new Date(Date.now() - 3600000)
                }]
            });
            mockRefreshAccessToken.mockResolvedValueOnce({
                accessToken: 'new_access_token',
                refreshToken: 'new_refresh_token',
                expiresIn: 3600
            });
            // Mock UPDATE query
            query.mockResolvedValueOnce({ rows: [] });

            const token = await mailService.getAccessToken('user_123');

            expect(token).toBe('new_access_token');
            expect(mockRefreshAccessToken).toHaveBeenCalledWith('refresh_token');
        });

        it('should throw when refresh fails', async () => {
            isTokenExpired.mockReturnValueOnce(true);
            
            query.mockResolvedValueOnce({ 
                rows: [{
                    access_token_encrypted: 'encrypted_old_token',
                    refresh_token_encrypted: 'encrypted_refresh_token',
                    token_expiry: new Date(Date.now() - 3600000)
                }]
            });
            mockRefreshAccessToken.mockRejectedValueOnce(new Error('Invalid grant'));

            await expect(mailService.getAccessToken('user_123'))
                .rejects.toThrow('Failed to refresh token');
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

        it('should revoke token before deleting', async () => {
            query.mockResolvedValueOnce({ 
                rows: [{ access_token_encrypted: 'encrypted_my_token' }] 
            });
            mockRevokeToken.mockResolvedValueOnce();
            query.mockResolvedValueOnce({ rows: [] }); // Delete query

            await mailService.disconnect('user_123', 'gmail');

            expect(mockRevokeToken).toHaveBeenCalledWith('my_token');
        });

        it('should still disconnect even if revocation fails', async () => {
            query.mockResolvedValueOnce({ 
                rows: [{ access_token_encrypted: 'encrypted_my_token' }] 
            });
            mockRevokeToken.mockRejectedValueOnce(new Error('Revocation failed'));
            query.mockResolvedValueOnce({ rows: [] }); // Delete query

            await mailService.disconnect('user_123', 'gmail');

            // Should still delete the token
            expect(query).toHaveBeenLastCalledWith(
                expect.stringContaining('DELETE FROM user_mail_tokens'),
                ['user_123', 'gmail']
            );
        });
    });

    describe('handleOAuthCallback', () => {
        it('should exchange code and store tokens', async () => {
            mockExchangeCode.mockResolvedValueOnce({
                accessToken: 'new_access',
                refreshToken: 'new_refresh',
                expiresIn: 3600,
                email: 'user@gmail.com'
            });
            query.mockResolvedValueOnce({ rows: [] }); // INSERT/UPSERT

            const result = await mailService.handleOAuthCallback('gmail', 'auth-code', 'user_123');

            expect(result.email).toBe('user@gmail.com');
            expect(result.provider).toBe('gmail');
            expect(query).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO user_mail_tokens'),
                expect.arrayContaining(['user_123', 'gmail'])
            );
        });

        it('should handle callback without refresh token', async () => {
            mockExchangeCode.mockResolvedValueOnce({
                accessToken: 'new_access',
                refreshToken: null,
                expiresIn: 3600,
                email: 'user@gmail.com'
            });
            query.mockResolvedValueOnce({ rows: [] });

            const result = await mailService.handleOAuthCallback('gmail', 'auth-code', 'user_123');

            expect(result.email).toBe('user@gmail.com');
        });
    });

    describe('createDraft', () => {
        it('should create draft with valid token', async () => {
            // getAccessToken mock
            isTokenExpired.mockReturnValueOnce(false);
            query.mockResolvedValueOnce({
                rows: [{
                    access_token_encrypted: 'encrypted_valid_token',
                    refresh_token_encrypted: 'encrypted_refresh',
                    token_expiry: new Date(Date.now() + 3600000)
                }]
            });
            mockCreateDraft.mockResolvedValueOnce({ id: 'draft-123', threadId: 'thread-1' });

            const result = await mailService.createDraft('user_123', {
                to: 'recipient@example.com',
                subject: 'CV Submission',
                body: '<p>Please find attached...</p>',
                attachment: Buffer.from('PDF data'),
                attachmentName: 'resume.pdf'
            });

            expect(result.id).toBe('draft-123');
            expect(mockCreateDraft).toHaveBeenCalledWith('valid_token', expect.objectContaining({
                to: 'recipient@example.com',
                subject: 'CV Submission'
            }));
        });

        it('should invalidate token on insufficient scopes error', async () => {
            isTokenExpired.mockReturnValueOnce(false);
            query.mockResolvedValueOnce({
                rows: [{
                    access_token_encrypted: 'encrypted_valid_token',
                    refresh_token_encrypted: 'encrypted_refresh',
                    token_expiry: new Date(Date.now() + 3600000)
                }]
            });
            mockCreateDraft.mockRejectedValueOnce(new Error('Insufficient Permission'));
            // Mock the UPDATE query to invalidate token
            query.mockResolvedValueOnce({ rows: [] });

            await expect(mailService.createDraft('user_123', {
                to: 'test@example.com',
                subject: 'Test',
                body: ''
            })).rejects.toThrow('permissions nécessaires');

            // Verify token was invalidated
            expect(query).toHaveBeenCalledWith(
                expect.stringContaining('token_expiry = NOW()'),
                ['user_123', 'gmail']
            );
        });
    });

    describe('getUserWithFirmData', () => {
        it('should return user with firm data', async () => {
            query.mockResolvedValueOnce({
                rows: [{ id: 'user_123', name: 'Test', firm_logo: 'logo.png', firm_name: 'Acme' }]
            });

            const user = await mailService.getUserWithFirmData('user_123');

            expect(user.firm_name).toBe('Acme');
            expect(user.firm_logo).toBe('logo.png');
        });

        it('should return null if user not found', async () => {
            query.mockResolvedValueOnce({ rows: [] });

            const user = await mailService.getUserWithFirmData('nonexistent');

            expect(user).toBeNull();
        });
    });

    describe('getClientFirmId', () => {
        it('should return firm_id for existing client', async () => {
            query.mockResolvedValueOnce({ rows: [{ firm_id: 'firm-abc' }] });

            const firmId = await mailService.getClientFirmId('client-123');

            expect(firmId).toBe('firm-abc');
        });

        it('should return null if client not found', async () => {
            query.mockResolvedValueOnce({ rows: [] });

            const firmId = await mailService.getClientFirmId('nonexistent');

            expect(firmId).toBeNull();
        });
    });

    describe('getResumeCurrentVersion', () => {
        it('should return max version number', async () => {
            query.mockResolvedValueOnce({ rows: [{ max_version: 3 }] });

            const version = await mailService.getResumeCurrentVersion('resume-123');

            expect(version).toBe(3);
        });

        it('should return null if no versions', async () => {
            query.mockResolvedValueOnce({ rows: [{ max_version: null }] });

            const version = await mailService.getResumeCurrentVersion('resume-123');

            expect(version).toBeNull();
        });
    });

    describe('recordSubmission', () => {
        it('should insert submission and return id', async () => {
            query.mockResolvedValueOnce({ rows: [{ id: 'sub-123' }] });

            const id = await mailService.recordSubmission({
                resumeId: 'resume-1',
                clientId: 'client-1',
                contactId: 'contact-1',
                missionId: null,
                firmId: 'firm-1',
                sentBy: 'user-1',
                versionNumber: 2,
                templateId: null,
                emailHtmlSent: '<html>...</html>'
            });

            expect(id).toBe('sub-123');
            expect(query).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO resume_submissions'),
                expect.arrayContaining(['resume-1', 'client-1'])
            );
        });

        it('should return null if insert returns no rows', async () => {
            query.mockResolvedValueOnce({ rows: [] });

            const id = await mailService.recordSubmission({
                resumeId: 'resume-1',
                clientId: 'client-1',
                contactId: 'contact-1',
                firmId: 'firm-1',
                sentBy: 'user-1',
                versionNumber: 1
            });

            expect(id).toBeNull();
        });
    });

    describe('getAuthUrl', () => {
        it('should delegate to provider getAuthUrl', async () => {
            mockGetAuthUrl.mockResolvedValueOnce('https://accounts.google.com/o/oauth2/auth?...');

            const url = await mailService.getAuthUrl('gmail', 'csrf-state');

            expect(url).toContain('accounts.google.com');
            expect(mockGetAuthUrl).toHaveBeenCalledWith('csrf-state');
        });
    });
});
