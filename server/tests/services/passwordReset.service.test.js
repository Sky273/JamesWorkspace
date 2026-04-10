/**
 * Tests for Password Reset Service
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../config/database.js', () => ({
    query: vi.fn()
}));

vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn()
}));

vi.mock('../../services/mail/gdprMailService.js', () => ({
    sendEmail: vi.fn()
}));

vi.mock('bcryptjs', () => ({
    default: { hash: vi.fn(() => Promise.resolve('hashed_password')) }
}));

vi.mock('../../config/constants.js', () => ({
    SALT_ROUNDS: 10
}));

import { query } from '../../config/database.js';
import { sendEmail } from '../../services/mail/gdprMailService.js';
import {
    PASSWORD_RESET_EMAIL_DELIVERY_FAILED_CODE,
    PASSWORD_RESET_EMAIL_TYPES,
    requestPasswordReset,
    resetPassword,
    cleanupExpiredTokens
} from '../../services/passwordReset.service.js';

describe('Password Reset Service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('requestPasswordReset', () => {
        it('should return success even if user not found', async () => {
            query.mockResolvedValueOnce({ rows: [] });

            const result = await requestPasswordReset('unknown@test.com');

            expect(result.success).toBe(true);
            expect(sendEmail).not.toHaveBeenCalled();
        });

        it('should return success for inactive account without sending email', async () => {
            query.mockResolvedValueOnce({ rows: [{ id: 'u1', name: 'User', email: 'u@t.com', status: 'inactive' }] });

            const result = await requestPasswordReset('u@t.com');

            expect(result.success).toBe(true);
            expect(sendEmail).not.toHaveBeenCalled();
        });

        it('should return success if rate limited', async () => {
            query
                .mockResolvedValueOnce({ rows: [{ id: 'u1', name: 'User', email: 'u@t.com', status: 'active' }] })
                .mockResolvedValueOnce({ rows: [{ count: '3' }] });

            const result = await requestPasswordReset('u@t.com');

            expect(result.success).toBe(true);
            expect(sendEmail).not.toHaveBeenCalled();
        });

        it('should send reset email on valid request', async () => {
            query
                .mockResolvedValueOnce({ rows: [{ id: 'u1', name: 'User', email: 'u@t.com', status: 'active' }] })
                .mockResolvedValueOnce({ rows: [{ count: '0' }] })
                .mockResolvedValueOnce({ rows: [] })
                .mockResolvedValueOnce({ rows: [] });
            sendEmail.mockResolvedValueOnce();

            const result = await requestPasswordReset('u@t.com');

            expect(result.success).toBe(true);
            expect(sendEmail).toHaveBeenCalledTimes(1);
            expect(sendEmail.mock.calls[0][0].to).toBe('u@t.com');
            expect(sendEmail.mock.calls[0][0].subject).toContain('Réinitialisation');
        });

        it('should mark user and send invite email when requested', async () => {
            query
                .mockResolvedValueOnce({ rows: [{ id: 'u1', name: 'User', email: 'u@t.com', status: 'active' }] })
                .mockResolvedValueOnce({ rows: [{ count: '0' }] })
                .mockResolvedValueOnce({ rows: [] })
                .mockResolvedValueOnce({ rows: [] })
                .mockResolvedValueOnce({ rows: [] });
            sendEmail.mockResolvedValueOnce();

            const result = await requestPasswordReset('u@t.com', {
                emailType: PASSWORD_RESET_EMAIL_TYPES.INVITE,
                markUserAsMustChangePassword: true
            });

            expect(result.success).toBe(true);
            expect(query.mock.calls[4][0]).toContain('must_change_password = true');
            expect(sendEmail.mock.calls[0][0].subject).toContain('Invitation ResumeConverter');
        });

        it('should reject with delivery error metadata when email sending fails', async () => {
            query
                .mockResolvedValueOnce({ rows: [{ id: 'u1', name: 'User', email: 'u@t.com', status: 'active' }] })
                .mockResolvedValueOnce({ rows: [{ count: '0' }] })
                .mockResolvedValueOnce({ rows: [] })
                .mockResolvedValueOnce({ rows: [] });
            sendEmail.mockRejectedValueOnce(new Error('SMTP down'));

            await expect(requestPasswordReset('u@t.com')).rejects.toMatchObject({
                code: PASSWORD_RESET_EMAIL_DELIVERY_FAILED_CODE,
                statusCode: 503
            });
        });
    });

    describe('resetPassword', () => {
        it('should return invalid_token if token not found', async () => {
            query.mockResolvedValueOnce({ rows: [] });

            const result = await resetPassword('badtoken', 'newpass');

            expect(result).toEqual({ success: false, error: 'invalid_token' });
        });

        it('should return token_used if already used', async () => {
            query.mockResolvedValueOnce({ rows: [{
                id: 't1',
                user_id: 'u1',
                expires_at: new Date(Date.now() + 3600000),
                used_at: new Date(),
                email: 'u@t.com',
                status: 'active'
            }] });

            const result = await resetPassword('sometoken', 'newpass');

            expect(result).toEqual({ success: false, error: 'token_used' });
        });

        it('should return token_expired if expired', async () => {
            query.mockResolvedValueOnce({ rows: [{
                id: 't1',
                user_id: 'u1',
                expires_at: new Date(Date.now() - 1000),
                used_at: null,
                email: 'u@t.com',
                status: 'active'
            }] });

            const result = await resetPassword('sometoken', 'newpass');

            expect(result).toEqual({ success: false, error: 'token_expired' });
        });

        it('should return account_inactive for inactive users', async () => {
            query.mockResolvedValueOnce({ rows: [{
                id: 't1',
                user_id: 'u1',
                expires_at: new Date(Date.now() + 3600000),
                used_at: null,
                email: 'u@t.com',
                status: 'inactive'
            }] });

            const result = await resetPassword('sometoken', 'newpass');

            expect(result).toEqual({ success: false, error: 'account_inactive' });
        });

        it('should reset password successfully and clear must_change_password', async () => {
            query
                .mockResolvedValueOnce({ rows: [{
                    id: 't1',
                    user_id: 'u1',
                    expires_at: new Date(Date.now() + 3600000),
                    used_at: null,
                    email: 'u@t.com',
                    status: 'active'
                }] })
                .mockResolvedValueOnce({ rows: [] })
                .mockResolvedValueOnce({ rows: [] });

            const result = await resetPassword('validtoken', 'newSecurePass');

            expect(result).toEqual({ success: true });
            expect(query.mock.calls[1][0]).toContain('must_change_password = false');
            expect(query.mock.calls[2][0]).toContain('UPDATE password_reset_tokens SET used_at');
        });
    });

    describe('cleanupExpiredTokens', () => {
        it('should return count of deleted tokens', async () => {
            query.mockResolvedValueOnce({ rowCount: 5 });

            const result = await cleanupExpiredTokens();

            expect(result).toBe(5);
            expect(query.mock.calls[0][0]).toContain('DELETE FROM password_reset_tokens');
        });

        it('should return 0 if no tokens deleted', async () => {
            query.mockResolvedValueOnce({ rowCount: 0 });
            expect(await cleanupExpiredTokens()).toBe(0);
        });
    });
});
