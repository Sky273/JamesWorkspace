import crypto from 'crypto';
import { query } from '../config/database.js';
import { sendEmail } from './mail/gdprMailService.js';
import { safeLog } from '../utils/logger.backend.js';

const TOKEN_EXPIRY_HOURS = 24;
const MAX_REQUESTS_PER_DAY = 3;
const DEFAULT_FRONTEND_URL = 'http://localhost:5173';

function generateToken() {
    const plain = crypto.randomBytes(32).toString('hex');
    const hash = crypto.createHash('sha256').update(plain).digest('hex');
    return { plain, hash };
}

function getFrontendUrl() {
    return String(process.env.FRONTEND_URL || DEFAULT_FRONTEND_URL).replace(/\/+$/, '');
}

function getSignInUrl(search = '') {
    return `${getFrontendUrl()}/signin${search}`;
}

function getVerificationUrl(plainToken) {
    return `${getFrontendUrl()}/api/auth/verify-email?token=${encodeURIComponent(plainToken)}`;
}

function buildEmailHtml(name, verificationUrl) {
    const signInUrl = getSignInUrl();

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
      <p style="color:#374151;font-size:16px;">Confirmez votre adresse email pour finaliser votre inscription.</p>
      <div style="margin:28px 0;text-align:center;">
        <a href="${verificationUrl}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 24px;border-radius:12px;">Verifier mon email</a>
      </div>
      <p style="color:#6b7280;font-size:14px;">Ce lien est valable 24 heures et ne peut etre utilise qu'une seule fois.</p>
      <p style="color:#6b7280;font-size:14px;">Apres verification, vous serez redirige vers la page de connexion : <a href="${signInUrl}" style="color:#4f46e5;">${signInUrl}</a></p>
      <p style="color:#6b7280;font-size:12px;word-break:break-all;">Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur : ${verificationUrl}</p>
    </div>
    <div style="background:#f9fafb;padding:16px 24px;text-align:center;">
      <p style="color:#9ca3af;font-size:12px;margin:0;">ResumeConverter - Gestion intelligente de CVtheque</p>
    </div>
  </div>
</body>
</html>`;
}

function buildEmailText(name, verificationUrl) {
    return `Bonjour ${name},

Confirmez votre adresse email pour finaliser votre inscription.

Verifier mon email : ${verificationUrl}

Ce lien est valable 24 heures et ne peut etre utilise qu'une seule fois.

Apres verification, connectez-vous ici : ${getSignInUrl()}`;
}

async function countRecentTokens(userId) {
    const result = await query(
        `SELECT COUNT(*) AS count
         FROM email_verification_tokens
         WHERE user_id = $1
           AND created_at > NOW() - INTERVAL '24 hours'`,
        [userId]
    );
    return parseInt(result.rows[0]?.count || '0', 10);
}

async function invalidateExistingTokens(userId) {
    await query(
        `UPDATE email_verification_tokens
         SET used_at = NOW()
         WHERE user_id = $1 AND used_at IS NULL`,
        [userId]
    );
}

export async function sendVerificationEmail({ userId, email, name, skipRateLimit = false }) {
    if (!skipRateLimit) {
        const recentCount = await countRecentTokens(userId);
        if (recentCount >= MAX_REQUESTS_PER_DAY) {
            safeLog('warn', 'Email verification rate limit exceeded', { userId, email });
            return { success: true, skipped: true };
        }
    }

    await invalidateExistingTokens(userId);

    const { plain, hash } = generateToken();
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

    await query(
        `INSERT INTO email_verification_tokens (user_id, token_hash, expires_at)
         VALUES ($1, $2, $3)`,
        [userId, hash, expiresAt]
    );

    const verificationUrl = getVerificationUrl(plain);

    await sendEmail({
        to: email,
        subject: 'Confirmez votre email ResumeConverter',
        html: buildEmailHtml(name || email, verificationUrl),
        text: buildEmailText(name || email, verificationUrl)
    });

    safeLog('info', 'Email verification sent', { userId, email });
    return { success: true };
}

export async function verifyEmailToken(plainToken) {
    const tokenHash = crypto.createHash('sha256').update(plainToken).digest('hex');

    const tokenResult = await query(
        `SELECT evt.id, evt.user_id, evt.expires_at, evt.used_at, u.status
         FROM email_verification_tokens evt
         JOIN users u ON u.id = evt.user_id
         WHERE evt.token_hash = $1
         LIMIT 1`,
        [tokenHash]
    );

    if (tokenResult.rows.length === 0) {
        return { success: false, error: 'invalid_token' };
    }

    const tokenRecord = tokenResult.rows[0];

    if (tokenRecord.used_at) {
        return { success: false, error: 'token_used' };
    }

    if (new Date(tokenRecord.expires_at) < new Date()) {
        return { success: false, error: 'token_expired' };
    }

    if (tokenRecord.status === 'inactive') {
        return { success: false, error: 'account_inactive' };
    }

    await query(
        `UPDATE users
         SET email_verified_at = COALESCE(email_verified_at, CURRENT_TIMESTAMP)
         WHERE id = $1`,
        [tokenRecord.user_id]
    );

    await query(
        'UPDATE email_verification_tokens SET used_at = NOW() WHERE id = $1',
        [tokenRecord.id]
    );

    await query(
        `UPDATE email_verification_tokens
         SET used_at = NOW()
         WHERE user_id = $1 AND id <> $2 AND used_at IS NULL`,
        [tokenRecord.user_id, tokenRecord.id]
    );

    safeLog('info', 'Email successfully verified', { userId: tokenRecord.user_id });
    return { success: true };
}

export function getEmailVerificationRedirectUrl(result) {
    if (result?.success) {
        return getSignInUrl('?success=email_verified');
    }

    const errorCode = result?.error || 'email_verification_failed';
    return getSignInUrl(`?error=${encodeURIComponent(errorCode)}`);
}
