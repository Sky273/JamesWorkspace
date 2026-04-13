import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockQuery = vi.fn();
const mockSendEmail = vi.fn();

vi.mock('../../config/database.js', () => ({
    query: (...args) => mockQuery(...args)
}));

vi.mock('../../services/mail/gdprMailService.js', () => ({
    sendEmail: (...args) => mockSendEmail(...args)
}));

vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn()
}));

import {
    getEmailVerificationRedirectUrl,
    sendVerificationEmail,
    verifyEmailToken
} from '../../services/emailVerification.service.js';

describe('emailVerification.service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.FRONTEND_URL = 'https://resumeconverter.net';
    });

    it('sends a verification email with a backend verification link and signin CTA', async () => {
        mockQuery
            .mockResolvedValueOnce({ rows: [{ count: '0' }] })
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({ rows: [] });
        mockSendEmail.mockResolvedValueOnce({ success: true });

        await sendVerificationEmail({
            userId: 'user-123',
            email: 'user@example.com',
            name: 'Jean Test'
        });

        expect(mockSendEmail).toHaveBeenCalledTimes(1);
        const payload = mockSendEmail.mock.calls[0][0];
        expect(payload.subject).toContain('Confirmez votre email');
        expect(payload.html).toContain('https://resumeconverter.net/api/auth/verify-email?token=');
        expect(payload.html).toContain('https://resumeconverter.net/signin');
        expect(payload.text).toContain('connectez-vous ici : https://resumeconverter.net/signin');
    });

    it('verifies a valid token and marks it as used', async () => {
        mockQuery
            .mockResolvedValueOnce({
                rows: [{
                    id: 'token-1',
                    user_id: 'user-123',
                    expires_at: new Date(Date.now() + 60_000),
                    used_at: null,
                    status: 'active'
                }]
            })
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({ rows: [] });

        const result = await verifyEmailToken('valid-token');

        expect(result).toEqual({ success: true });
        expect(mockQuery.mock.calls[1][0]).toContain('SET email_verified_at = COALESCE');
        expect(mockQuery.mock.calls[2][0]).toContain('UPDATE email_verification_tokens SET used_at');
    });

    it('returns token_expired when verification token is expired', async () => {
        mockQuery.mockResolvedValueOnce({
            rows: [{
                id: 'token-1',
                user_id: 'user-123',
                expires_at: new Date(Date.now() - 60_000),
                used_at: null,
                status: 'active'
            }]
        });

        await expect(verifyEmailToken('expired-token')).resolves.toEqual({
            success: false,
            error: 'token_expired'
        });
    });

    it('builds the success redirect to the sign-in screen', () => {
        expect(getEmailVerificationRedirectUrl({ success: true })).toBe('https://resumeconverter.net/signin?success=email_verified');
        expect(getEmailVerificationRedirectUrl({ success: false, error: 'invalid_token' })).toBe('https://resumeconverter.net/signin?error=invalid_token');
    });
});
