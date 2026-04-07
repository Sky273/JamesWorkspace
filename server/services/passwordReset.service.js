/**
 * Password Reset Service
 * Handles token generation, verification, and reset email sending
 * Uses the GDPR Gmail service for email delivery (already configured)
 */

import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { query } from '../config/database.js';
import { SALT_ROUNDS } from '../config/constants.js';
import { sendEmail } from './mail/gdprMailService.js';
import { safeLog } from '../utils/logger.backend.js';

const TOKEN_EXPIRY_HOURS = 1;
const MAX_REQUESTS_PER_HOUR = 3;
export const PASSWORD_RESET_EMAIL_DELIVERY_FAILED_CODE = 'PASSWORD_RESET_EMAIL_DELIVERY_FAILED';

/**
 * Generate a cryptographically secure reset token
 * @returns {{ plain: string, hash: string }} - Plain token (for email) and SHA-256 hash (for DB)
 */
function generateToken() {
    const plain = crypto.randomBytes(32).toString('hex');
    const hash = crypto.createHash('sha256').update(plain).digest('hex');
    return { plain, hash };
}

/**
 * Check rate limit: max N requests per email per hour
 * @param {string} userId
 * @returns {Promise<boolean>} true if under limit
 */
async function checkRateLimit(userId) {
    const result = await query(
        `SELECT COUNT(*) as count 
         FROM password_reset_tokens 
         WHERE user_id = $1 
           AND created_at > NOW() - INTERVAL '1 hour'`,
        [userId]
    );
    return parseInt(result.rows[0].count, 10) < MAX_REQUESTS_PER_HOUR;
}

/**
 * Invalidate all existing tokens for a user
 * @param {string} userId
 */
async function invalidateExistingTokens(userId) {
    await query(
        `UPDATE password_reset_tokens 
         SET used_at = NOW() 
         WHERE user_id = $1 AND used_at IS NULL`,
        [userId]
    );
}

/**
 * Create a password reset request
 * - Checks if user exists
 * - Checks rate limit
 * - Invalidates old tokens
 * - Creates new token
 * - Sends reset email
 * 
 * IMPORTANT: Always returns success to prevent email enumeration
 * 
 * @param {string} email
 * @returns {Promise<{ success: boolean }>}
 */
export async function requestPasswordReset(email) {
    const normalizedEmail = email.toLowerCase().trim();
    
    // Find user
    const userResult = await query(
        'SELECT id, name, email, status FROM users WHERE LOWER(email) = $1 LIMIT 1',
        [normalizedEmail]
    );

    if (userResult.rows.length === 0) {
        // Don't reveal that the email doesn't exist
        safeLog('info', 'Password reset requested for non-existent email', { email: normalizedEmail });
        return { success: true };
    }

    const user = userResult.rows[0];

    // Don't allow reset for inactive accounts
    if (user.status === 'inactive') {
        safeLog('info', 'Password reset requested for inactive account', { userId: user.id });
        return { success: true };
    }

    // Check rate limit
    const underLimit = await checkRateLimit(user.id);
    if (!underLimit) {
        safeLog('warn', 'Password reset rate limit exceeded', { userId: user.id, email: normalizedEmail });
        return { success: true }; // Don't reveal rate limit to prevent enumeration
    }

    // Invalidate existing tokens
    await invalidateExistingTokens(user.id);

    // Generate new token
    const { plain, hash } = generateToken();
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

    // Store token hash in DB
    await query(
        `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
         VALUES ($1, $2, $3)`,
        [user.id, hash, expiresAt]
    );

    // Build reset URL
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetUrl = `${frontendUrl}/reset-password?token=${plain}`;

    // Send email
    try {
        await sendEmail({
            to: user.email,
            subject: 'Réinitialisation de votre mot de passe - ResumeConverter',
            html: buildResetEmailHtml(user.name || user.email, resetUrl),
            text: buildResetEmailText(user.name || user.email, resetUrl)
        });
        safeLog('info', 'Password reset email sent', { userId: user.id, email: normalizedEmail });
    } catch (emailError) {
        safeLog('error', 'Failed to send password reset email', { 
            userId: user.id, 
            error: emailError.message 
        });
        const deliveryError = new Error('Password reset token created, but email delivery failed');
        deliveryError.code = PASSWORD_RESET_EMAIL_DELIVERY_FAILED_CODE;
        deliveryError.statusCode = 503;
        deliveryError.cause = emailError;
        throw deliveryError;
    }

    return { success: true };
}

/**
 * Verify a reset token and reset the password
 * @param {string} plainToken - The token from the reset URL
 * @param {string} newPassword - The new password
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function resetPassword(plainToken, newPassword) {
    // Hash the provided token to match against DB
    const tokenHash = crypto.createHash('sha256').update(plainToken).digest('hex');

    // Find valid token
    const tokenResult = await query(
        `SELECT prt.id, prt.user_id, prt.expires_at, prt.used_at, u.email, u.status
         FROM password_reset_tokens prt
         JOIN users u ON u.id = prt.user_id
         WHERE prt.token_hash = $1
         LIMIT 1`,
        [tokenHash]
    );

    if (tokenResult.rows.length === 0) {
        safeLog('warn', 'Password reset attempted with invalid token');
        return { success: false, error: 'invalid_token' };
    }

    const tokenRecord = tokenResult.rows[0];

    // Check if already used
    if (tokenRecord.used_at) {
        safeLog('warn', 'Password reset attempted with already-used token', { userId: tokenRecord.user_id });
        return { success: false, error: 'token_used' };
    }

    // Check expiry
    if (new Date(tokenRecord.expires_at) < new Date()) {
        safeLog('warn', 'Password reset attempted with expired token', { userId: tokenRecord.user_id });
        return { success: false, error: 'token_expired' };
    }

    // Check user status
    if (tokenRecord.status === 'inactive') {
        safeLog('warn', 'Password reset attempted for inactive user', { userId: tokenRecord.user_id });
        return { success: false, error: 'account_inactive' };
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);

    // Update password
    await query(
        'UPDATE users SET password = $1 WHERE id = $2',
        [hashedPassword, tokenRecord.user_id]
    );

    // Mark token as used
    await query(
        'UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1',
        [tokenRecord.id]
    );

    safeLog('info', 'Password reset successful', { userId: tokenRecord.user_id, email: tokenRecord.email });

    return { success: true };
}

/**
 * Cleanup expired tokens (can be called periodically)
 * @returns {Promise<number>} Number of deleted tokens
 */
export async function cleanupExpiredTokens() {
    const result = await query(
        `DELETE FROM password_reset_tokens 
         WHERE expires_at < NOW() - INTERVAL '24 hours'
         OR used_at IS NOT NULL AND used_at < NOW() - INTERVAL '24 hours'`
    );
    return result.rowCount || 0;
}

/**
 * Build HTML email for password reset
 */
function buildResetEmailHtml(name, resetUrl) {
    return `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:Arial,sans-serif;">
  <div style="max-width:600px;margin:40px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
    <div style="background:linear-gradient(135deg,#4f46e5,#6366f1);padding:32px 24px;text-align:center;">
      <h1 style="color:#ffffff;margin:0;font-size:24px;">ResumeConverter</h1>
    </div>
    <div style="padding:32px 24px;">
      <p style="color:#374151;font-size:16px;margin-top:0;">Bonjour <strong>${name}</strong>,</p>
      <p style="color:#374151;font-size:16px;">Vous avez demandé la réinitialisation de votre mot de passe. Cliquez sur le bouton ci-dessous pour en choisir un nouveau :</p>
      <div style="text-align:center;margin:32px 0;">
        <a href="${resetUrl}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:16px;font-weight:600;">
          Réinitialiser mon mot de passe
        </a>
      </div>
      <p style="color:#6b7280;font-size:14px;">Ce lien est valable <strong>1 heure</strong> et ne peut être utilisé qu'une seule fois.</p>
      <p style="color:#6b7280;font-size:14px;">Si vous n'avez pas demandé cette réinitialisation, vous pouvez ignorer cet email en toute sécurité.</p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
      <p style="color:#9ca3af;font-size:12px;">Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :</p>
      <p style="color:#6366f1;font-size:12px;word-break:break-all;">${resetUrl}</p>
    </div>
    <div style="background:#f9fafb;padding:16px 24px;text-align:center;">
      <p style="color:#9ca3af;font-size:12px;margin:0;">ResumeConverter — Gestion intelligente de CVthèque</p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Build plain text email for password reset
 */
function buildResetEmailText(name, resetUrl) {
    return `Bonjour ${name},

Vous avez demandé la réinitialisation de votre mot de passe sur ResumeConverter.

Cliquez sur ce lien pour choisir un nouveau mot de passe :
${resetUrl}

Ce lien est valable 1 heure et ne peut être utilisé qu'une seule fois.

Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.

— ResumeConverter`;
}
