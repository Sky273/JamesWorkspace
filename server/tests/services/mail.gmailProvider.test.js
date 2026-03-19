/**
 * Tests for Gmail Provider
 * GmailProvider class: auth URL, code exchange, token refresh, draft, MIME, revoke
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Shared mock functions accessible to both the mock factory and test assertions
const mockGenerateAuthUrl = vi.fn(() => 'https://accounts.google.com/o/oauth2/auth?test');
const mockGetToken = vi.fn(() => ({ tokens: { access_token: 'at', refresh_token: 'rt', expiry_date: Date.now() + 3600000 } }));
const mockSetCredentials = vi.fn();
const mockRefreshAccessToken = vi.fn(() => ({ credentials: { access_token: 'new-at', refresh_token: 'new-rt', expiry_date: Date.now() + 3600000 } }));
const mockRevokeToken = vi.fn();
const mockUserinfoGet = vi.fn(() => ({ data: { email: 'user@gmail.com' } }));
const mockDraftsCreate = vi.fn(() => ({ data: { id: 'draft-1', message: { id: 'msg-1' } } }));

// OAuth2 must be a real constructor (called with `new`)
class MockOAuth2 {
    constructor() {}
    generateAuthUrl(...args) { return mockGenerateAuthUrl(...args); }
    getToken(...args) { return mockGetToken(...args); }
    setCredentials(...args) { return mockSetCredentials(...args); }
    refreshAccessToken(...args) { return mockRefreshAccessToken(...args); }
    revokeToken(...args) { return mockRevokeToken(...args); }
}

vi.mock('googleapis', () => ({
    google: {
        auth: { OAuth2: MockOAuth2 },
        oauth2: vi.fn(() => ({ userinfo: { get: mockUserinfoGet } })),
        gmail: vi.fn(() => ({ users: { drafts: { create: mockDraftsCreate } } }))
    }
}));

vi.mock('../../config/oauth.config.js', () => ({
    googleOAuthConfig: {
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        redirectUri: 'http://localhost:3000/callback',
        scopes: ['https://www.googleapis.com/auth/gmail.send']
    }
}));

vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn()
}));

import { gmailProvider } from '../../services/mail/gmailProvider.js';

describe('Gmail Provider', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('name', () => {
        it('should return gmail', () => {
            expect(gmailProvider.name).toBe('gmail');
        });
    });

    describe('getAuthUrl', () => {
        it('should generate OAuth URL with state parameter', async () => {
            const url = await gmailProvider.getAuthUrl('csrf-token-123');

            expect(url).toContain('google.com');
            expect(mockGenerateAuthUrl).toHaveBeenCalledWith(expect.objectContaining({
                access_type: 'offline',
                state: 'csrf-token-123',
                prompt: 'consent'
            }));
        });
    });

    describe('exchangeCode', () => {
        it('should exchange code for tokens and get email', async () => {
            const result = await gmailProvider.exchangeCode('auth-code-123');

            expect(result.accessToken).toBe('at');
            expect(result.refreshToken).toBe('rt');
            expect(result.email).toBe('user@gmail.com');
            expect(mockGetToken).toHaveBeenCalledWith('auth-code-123');
        });

        it('should throw on failure', async () => {
            mockGetToken.mockRejectedValueOnce(new Error('Invalid code'));

            await expect(gmailProvider.exchangeCode('bad-code')).rejects.toThrow('Failed to exchange');
        });
    });

    describe('refreshAccessToken', () => {
        it('should refresh and return new tokens', async () => {
            const result = await gmailProvider.refreshAccessToken('old-refresh-token');

            expect(result.accessToken).toBe('new-at');
            expect(result.refreshToken).toBe('new-rt');
            expect(mockSetCredentials).toHaveBeenCalledWith({ refresh_token: 'old-refresh-token' });
        });

        it('should throw on failure', async () => {
            mockRefreshAccessToken.mockRejectedValueOnce(new Error('Token expired'));

            await expect(gmailProvider.refreshAccessToken('bad-rt')).rejects.toThrow('Failed to refresh');
        });
    });

    describe('createDraft', () => {
        it('should create draft with attachment', async () => {
            const result = await gmailProvider.createDraft('access-token', {
                to: 'recipient@example.com',
                subject: 'CV Candidat',
                body: '<p>Bonjour</p>',
                attachment: Buffer.from('pdf-data'),
                attachmentName: 'cv.pdf'
            });

            expect(result.draftId).toBe('draft-1');
            expect(result.webLink).toContain('mail.google.com');
        });

        it('should throw on failure', async () => {
            mockDraftsCreate.mockRejectedValueOnce(new Error('Quota exceeded'));

            await expect(gmailProvider.createDraft('tok', {
                to: 'a@b.com', subject: 's', body: 'b'
            })).rejects.toThrow('Failed to create Gmail draft');
        });
    });

    describe('_buildMimeMessage', () => {
        it('should build simple message without attachment', () => {
            const mime = gmailProvider._buildMimeMessage({
                to: 'test@example.com',
                subject: 'Test',
                body: '<p>Hello</p>'
            });

            expect(mime).toContain('To: test@example.com');
            expect(mime).toContain('MIME-Version: 1.0');
            expect(mime).toContain('<p>Hello</p>');
            expect(mime).not.toContain('multipart/mixed');
        });

        it('should build multipart message with attachment', () => {
            const mime = gmailProvider._buildMimeMessage({
                to: 'test@example.com',
                subject: 'CV',
                body: '<p>Attached</p>',
                attachment: Buffer.from('fake-pdf'),
                attachmentName: 'doc.pdf'
            });

            expect(mime).toContain('multipart/mixed');
            expect(mime).toContain('application/pdf');
            expect(mime).toContain('doc.pdf');
        });
    });

    describe('revokeToken', () => {
        it('should revoke without throwing', async () => {
            await gmailProvider.revokeToken('some-token');
            expect(mockRevokeToken).toHaveBeenCalledWith('some-token');
        });

        it('should not throw on revocation failure', async () => {
            mockRevokeToken.mockRejectedValueOnce(new Error('Already revoked'));
            await gmailProvider.revokeToken('bad-token');
            // No error thrown
        });
    });
});
