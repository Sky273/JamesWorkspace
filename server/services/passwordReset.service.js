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
export const PASSWORD_RESET_EMAIL_TYPES = {
    RESET: 'reset',
    INVITE: 'invite',
    FORCE_CHANGE: 'force_change'
};

function generateToken() {
    const plain = crypto.randomBytes(32).toString('hex');
    const hash = crypto.createHash('sha256').update(plain).digest('hex');
    return { plain, hash };
}

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

async function invalidateExistingTokens(userId) {
    await query(
        `UPDATE password_reset_tokens
         SET used_at = NOW()
         WHERE user_id = $1 AND used_at IS NULL`,
        [userId]
    );
}

function getResetEmailCopy(emailType) {
    if (emailType === PASSWORD_RESET_EMAIL_TYPES.INVITE) {
        return {
            subject: 'Invitation ResumeConverter - Définissez votre mot de passe',
            intro: "Vous avez été invité à utiliser ResumeConverter. Cliquez sur le bouton ci-dessous pour définir votre mot de passe et activer votre accès :",
            cta: 'Définir mon mot de passe',
            footer: "Ce lien est valable 1 heure et ne peut être utilisé qu'une seule fois.",
            fallback: "Si vous n'êtes pas à l'origine de cette invitation, vous pouvez ignorer cet email."
        };
    }

    if (emailType === PASSWORD_RESET_EMAIL_TYPES.FORCE_CHANGE) {
        return {
            subject: 'ResumeConverter - Changement de mot de passe requis',
            intro: 'Un administrateur a exigé le remplacement de votre mot de passe. Cliquez sur le bouton ci-dessous pour en choisir un nouveau :',
            cta: 'Changer mon mot de passe',
            footer: "Ce lien est valable 1 heure et ne peut être utilisé qu'une seule fois.",
            fallback: "Si vous pensez que cet email est une erreur, contactez votre administrateur."
        };
    }

    return {
        subject: 'Réinitialisation de votre mot de passe - ResumeConverter',
        intro: 'Vous avez demandé la réinitialisation de votre mot de passe. Cliquez sur le bouton ci-dessous pour en choisir un nouveau :',
        cta: 'Réinitialiser mon mot de passe',
        footer: "Ce lien est valable 1 heure et ne peut être utilisé qu'une seule fois.",
        fallback: "Si vous n'avez pas demandé cette réinitialisation, vous pouvez ignorer cet email en toute sécurité."
    };
}

function buildResetEmailHtml(name, resetUrl, emailType = PASSWORD_RESET_EMAIL_TYPES.RESET) {
    const copy = getResetEmailCopy(emailType);

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
      <p style="color:#374151;font-size:16px;">${copy.intro}</p>
      <div style="text-align:center;margin:32px 0;">
        <a href="${resetUrl}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:16px;font-weight:600;">
          ${copy.cta}
        </a>
      </div>
      <p style="color:#6b7280;font-size:14px;">${copy.footer}</p>
      <p style="color:#6b7280;font-size:14px;">${copy.fallback}</p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
      <p style="color:#9ca3af;font-size:12px;">Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :</p>
      <p style="color:#6366f1;font-size:12px;word-break:break-all;">${resetUrl}</p>
    </div>
    <div style="background:#f9fafb;padding:16px 24px;text-align:center;">
      <p style="color:#9ca3af;font-size:12px;margin:0;">ResumeConverter - Gestion intelligente de CVthèque</p>
    </div>
  </div>
</body>
</html>`;
}

function buildResetEmailText(name, resetUrl, emailType = PASSWORD_RESET_EMAIL_TYPES.RESET) {
    const copy = getResetEmailCopy(emailType);

    return `Bonjour ${name},

${copy.intro}

${copy.cta} :
${resetUrl}

${copy.footer}

${copy.fallback}

-- ResumeConverter`;
}

export async function requestPasswordReset(email, options = {}) {
    const normalizedEmail = email.toLowerCase().trim();
    const emailType = options.emailType || PASSWORD_RESET_EMAIL_TYPES.RESET;

    const userResult = await query(
        'SELECT id, name, email, status FROM users WHERE LOWER(email) = $1 LIMIT 1',
        [normalizedEmail]
    );

    if (userResult.rows.length === 0) {
        safeLog('info', 'Password reset requested for non-existent email', { email: normalizedEmail });
        return { success: true };
    }

    const user = userResult.rows[0];

    if (user.status === 'inactive') {
        safeLog('info', 'Password reset requested for inactive account', { userId: user.id });
        return { success: true };
    }

    if (!options.skipRateLimit) {
        const underLimit = await checkRateLimit(user.id);
        if (!underLimit) {
            safeLog('warn', 'Password reset rate limit exceeded', { userId: user.id, email: normalizedEmail });
            return { success: true };
        }
    }

    await invalidateExistingTokens(user.id);

    const { plain, hash } = generateToken();
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

    await query(
        `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
         VALUES ($1, $2, $3)`,
        [user.id, hash, expiresAt]
    );

    if (options.markUserAsMustChangePassword) {
        await query(
            'UPDATE users SET must_change_password = true WHERE id = $1',
            [user.id]
        );
    }

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetUrl = `${frontendUrl}/reset-password?token=${plain}`;
    const copy = getResetEmailCopy(emailType);

    try {
        await sendEmail({
            to: user.email,
            subject: copy.subject,
            html: buildResetEmailHtml(user.name || user.email, resetUrl, emailType),
            text: buildResetEmailText(user.name || user.email, resetUrl, emailType)
        });
        safeLog('info', 'Password reset email sent', {
            userId: user.id,
            email: normalizedEmail,
            emailType
        });
    } catch (emailError) {
        safeLog('error', 'Failed to send password reset email', {
            userId: user.id,
            error: emailError.message,
            emailType
        });
        const deliveryError = new Error('Password reset token created, but email delivery failed');
        deliveryError.code = PASSWORD_RESET_EMAIL_DELIVERY_FAILED_CODE;
        deliveryError.statusCode = 503;
        deliveryError.cause = emailError;
        throw deliveryError;
    }

    return { success: true };
}

export async function resetPassword(plainToken, newPassword) {
    const tokenHash = crypto.createHash('sha256').update(plainToken).digest('hex');

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

    if (tokenRecord.used_at) {
        safeLog('warn', 'Password reset attempted with already-used token', { userId: tokenRecord.user_id });
        return { success: false, error: 'token_used' };
    }

    if (new Date(tokenRecord.expires_at) < new Date()) {
        safeLog('warn', 'Password reset attempted with expired token', { userId: tokenRecord.user_id });
        return { success: false, error: 'token_expired' };
    }

    if (tokenRecord.status === 'inactive') {
        safeLog('warn', 'Password reset attempted for inactive user', { userId: tokenRecord.user_id });
        return { success: false, error: 'account_inactive' };
    }

    const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);

    await query(
        'UPDATE users SET password = $1, must_change_password = false WHERE id = $2',
        [hashedPassword, tokenRecord.user_id]
    );

    await query(
        'UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1',
        [tokenRecord.id]
    );

    safeLog('info', 'Password reset successful', { userId: tokenRecord.user_id, email: tokenRecord.email });

    return { success: true };
}

export async function cleanupExpiredTokens() {
    const result = await query(
        `DELETE FROM password_reset_tokens
         WHERE expires_at < NOW() - INTERVAL '24 hours'
         OR used_at IS NOT NULL AND used_at < NOW() - INTERVAL '24 hours'`
    );
    return result.rowCount || 0;
}
