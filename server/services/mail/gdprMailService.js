/**
 * GDPR Mail Service
 * Handles Gmail OAuth and direct email sending for GDPR consent requests
 * 
 * IMPORTANT: This service is DEDICATED to GDPR consent emails.
 * It stores tokens at FIRM level (not user level).
 * 
 * SEPARATION OF CONCERNS:
 * - SSO Authentication: googleAuth.service.js (no token storage)
 * - CV Email Sending: mailService.js (user_mail_tokens table)
 * - GDPR Consent Emails: THIS SERVICE (firm_gdpr_mail_tokens table)
 * 
 * Each service has its own:
 * - Redirect URI (GOOGLE_GDPR_REDIRECT_URI)
 * - Scopes (gmail.send for direct sending)
 * - Token storage (firm_gdpr_mail_tokens)
 * - OAuth2 client instance (new instance per call)
 */

import { query } from '../../config/database.js';
import { encryptToken, decryptToken, calculateTokenExpiry, isTokenExpired } from '../../config/oauth.config.js';
import { safeLog } from '../../utils/logger.backend.js';

// Lazy load googleapis to avoid startup overhead
let google = null;
async function getGoogle() {
    if (!google) {
        const { google: g } = await import('googleapis');
        google = g;
        safeLog('info', 'googleapis module loaded for GDPR mail');
    }
    return google;
}

// OAuth2 configuration - DEDICATED to GDPR emails
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_GDPR_REDIRECT_URI || 
    `${process.env.BACKEND_URL || 'http://localhost:3001'}/api/gdpr/mail/callback`;

// Scopes needed for SENDING emails (not just composing drafts)
const SCOPES = [
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/userinfo.email'
];

/**
 * Create a NEW OAuth2 client instance for GDPR mail
 * NOTE: We create a new instance each time to avoid state pollution
 */
async function getOAuth2Client() {
    const g = await getGoogle();
    return new g.auth.OAuth2(
        GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET,
        GOOGLE_REDIRECT_URI
    );
}

/**
 * Get OAuth authorization URL
 * @param {string} state - State parameter for CSRF protection
 * @returns {Promise<string>}
 */
export async function getAuthUrl(state) {
    const oauth2Client = await getOAuth2Client();
    return oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
        state,
        prompt: 'consent' // Force consent to get refresh token
    });
}

/**
 * Handle OAuth callback - exchange code and store tokens
 * @param {string} code - Authorization code
 * @param {string} firmId - Firm ID
 * @returns {Promise<Object>}
 */
export async function handleOAuthCallback(code, firmId) {
    const oauth2Client = await getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    
    oauth2Client.setCredentials(tokens);
    
    // Get user email
    const google = await getGoogle();
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data: userInfo } = await oauth2.userinfo.get();
    const email = userInfo.email;

    // Encrypt tokens for storage
    const accessTokenEncrypted = encryptToken(tokens.access_token);
    const refreshTokenEncrypted = tokens.refresh_token 
        ? encryptToken(tokens.refresh_token) 
        : null;
    const tokenExpiry = calculateTokenExpiry(tokens.expiry_date 
        ? Math.floor((tokens.expiry_date - Date.now()) / 1000) 
        : 3600);

    // Upsert tokens in database (firm level)
    await query(`
        INSERT INTO firm_gdpr_mail_tokens (firm_id, provider, access_token_encrypted, refresh_token_encrypted, token_expiry, email)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (firm_id) 
        DO UPDATE SET 
            provider = EXCLUDED.provider,
            access_token_encrypted = EXCLUDED.access_token_encrypted,
            refresh_token_encrypted = COALESCE(EXCLUDED.refresh_token_encrypted, firm_gdpr_mail_tokens.refresh_token_encrypted),
            token_expiry = EXCLUDED.token_expiry,
            email = EXCLUDED.email,
            updated_at = CURRENT_TIMESTAMP
    `, [firmId, 'gmail', accessTokenEncrypted, refreshTokenEncrypted, tokenExpiry, email]);

    safeLog('info', 'GDPR Gmail tokens stored', { firmId, email });

    return { email, provider: 'gmail' };
}

/**
 * Get connection status for a firm
 * @param {string} firmId
 * @returns {Promise<Object>}
 */
export async function getConnectionStatus(firmId) {
    const result = await query(`
        SELECT provider, email, token_expiry, updated_at
        FROM firm_gdpr_mail_tokens
        WHERE firm_id = $1
    `, [firmId]);

    if (result.rows.length === 0) {
        return { connected: false };
    }

    const token = result.rows[0];
    const expired = isTokenExpired(token.token_expiry);

    return {
        connected: !expired,
        provider: token.provider,
        email: token.email,
        expiresAt: token.token_expiry,
        needsReauth: expired
    };
}

/**
 * Get valid access token for firm (refreshes if needed)
 * @param {string} firmId
 * @returns {Promise<string>}
 */
async function getAccessToken(firmId) {
    const result = await query(`
        SELECT access_token_encrypted, refresh_token_encrypted, token_expiry
        FROM firm_gdpr_mail_tokens
        WHERE firm_id = $1
    `, [firmId]);

    if (result.rows.length === 0) {
        throw new Error('Gmail RGPD non configuré. Veuillez connecter un compte Gmail dans les paramètres.');
    }

    const tokenData = result.rows[0];
    const expired = isTokenExpired(tokenData.token_expiry);

    if (!expired) {
        return decryptToken(tokenData.access_token_encrypted);
    }

    // Token expired - try to refresh
    if (!tokenData.refresh_token_encrypted) {
        throw new Error('Token expiré et pas de refresh token. Veuillez reconnecter Gmail.');
    }

    const refreshToken = decryptToken(tokenData.refresh_token_encrypted);
    const oauth2Client = await getOAuth2Client();
    oauth2Client.setCredentials({ refresh_token: refreshToken });

    try {
        const { credentials } = await oauth2Client.refreshAccessToken();
        
        // Update stored tokens
        const newAccessTokenEncrypted = encryptToken(credentials.access_token);
        const newRefreshTokenEncrypted = credentials.refresh_token 
            ? encryptToken(credentials.refresh_token) 
            : tokenData.refresh_token_encrypted;
        const newExpiry = calculateTokenExpiry(credentials.expiry_date 
            ? Math.floor((credentials.expiry_date - Date.now()) / 1000) 
            : 3600);

        await query(`
            UPDATE firm_gdpr_mail_tokens
            SET access_token_encrypted = $1,
                refresh_token_encrypted = $2,
                token_expiry = $3,
                updated_at = CURRENT_TIMESTAMP
            WHERE firm_id = $4
        `, [newAccessTokenEncrypted, newRefreshTokenEncrypted, newExpiry, firmId]);

        safeLog('info', 'GDPR Gmail token refreshed', { firmId });

        return credentials.access_token;
    } catch (error) {
        safeLog('error', 'GDPR token refresh failed', { firmId, error: error.message });
        
        // Mark token as invalid in database to force re-authentication
        await query(`
            UPDATE firm_gdpr_mail_tokens
            SET token_expiry = NOW() - INTERVAL '1 day',
                updated_at = CURRENT_TIMESTAMP
            WHERE firm_id = $1
        `, [firmId]);
        
        // Check if it's a revoked token error
        const isRevokedToken = error.message?.includes('invalid_grant') || 
                              error.message?.includes('Token has been expired or revoked') ||
                              error.message?.includes('invalid authentication credentials');
        
        if (isRevokedToken) {
            throw new Error('Le token Gmail RGPD a été révoqué. Veuillez reconnecter Gmail dans les paramètres. Note: Si vous utilisez le même compte Gmail pour l\'authentification SSO, les tokens peuvent entrer en conflit.');
        }
        
        throw new Error('Échec du rafraîchissement du token. Veuillez reconnecter Gmail dans les paramètres.');
    }
}

/**
 * Send an email via Gmail
 * @param {string} firmId - Firm ID
 * @param {Object} emailData - Email data
 * @param {string} emailData.to - Recipient email
 * @param {string} emailData.subject - Email subject
 * @param {string} emailData.html - HTML body
 * @param {string} emailData.text - Plain text body (optional)
 * @returns {Promise<Object>}
 */
export async function sendEmail(firmId, { to, subject, html, text }) {
    // Get access token (will refresh if needed)
    let accessToken;
    try {
        accessToken = await getAccessToken(firmId);
    } catch (tokenError) {
        safeLog('error', 'Failed to get GDPR access token', { firmId, error: tokenError.message });
        throw tokenError;
    }
    
    const oauth2Client = await getOAuth2Client();
    oauth2Client.setCredentials({ access_token: accessToken });

    const google = await getGoogle();
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Get sender email
    const statusResult = await query(`
        SELECT email FROM firm_gdpr_mail_tokens WHERE firm_id = $1
    `, [firmId]);
    const fromEmail = statusResult.rows[0]?.email || 'noreply@example.com';

    // Build MIME message
    const boundary = '----=_Part_' + Date.now().toString(36);
    const mimeMessage = [
        `From: ${fromEmail}`,
        `To: ${to}`,
        `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`,
        'MIME-Version: 1.0',
        `Content-Type: multipart/alternative; boundary="${boundary}"`,
        '',
        `--${boundary}`,
        'Content-Type: text/plain; charset=UTF-8',
        'Content-Transfer-Encoding: base64',
        '',
        Buffer.from(text || html.replace(/<[^>]*>/g, '')).toString('base64'),
        '',
        `--${boundary}`,
        'Content-Type: text/html; charset=UTF-8',
        'Content-Transfer-Encoding: base64',
        '',
        Buffer.from(html).toString('base64'),
        '',
        `--${boundary}--`
    ].join('\r\n');

    // Encode for Gmail API
    const encodedMessage = Buffer.from(mimeMessage)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

    // Send email
    const result = await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
            raw: encodedMessage
        }
    });

    safeLog('info', 'GDPR email sent via Gmail', { firmId, to, messageId: result.data.id });

    return {
        success: true,
        messageId: result.data.id,
        sentTo: to
    };
}

/**
 * Send a test email
 * @param {string} firmId
 * @param {string} email
 */
export async function sendTestEmail(firmId, email) {
    return sendEmail(firmId, {
        to: email,
        subject: 'Test RGPD - ResumeConverter',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #2563eb;">Test de configuration RGPD</h2>
                <p>Ce message confirme que la configuration Gmail pour l'envoi des emails de consentement RGPD fonctionne correctement.</p>
                <p style="color: #6b7280; font-size: 14px;">Envoyé depuis ResumeConverter</p>
            </div>
        `,
        text: 'Test de configuration RGPD - Ce message confirme que la configuration Gmail fonctionne correctement.'
    });
}

/**
 * Disconnect Gmail for a firm
 * @param {string} firmId
 */
export async function disconnect(firmId) {
    // Get token to revoke
    const result = await query(`
        SELECT access_token_encrypted
        FROM firm_gdpr_mail_tokens
        WHERE firm_id = $1
    `, [firmId]);

    if (result.rows.length > 0) {
        try {
            const accessToken = decryptToken(result.rows[0].access_token_encrypted);
            const oauth2Client = await getOAuth2Client();
            await oauth2Client.revokeToken(accessToken);
        } catch (error) {
            // Ignore revocation errors
            safeLog('warn', 'Token revocation failed', { firmId, error: error.message });
        }
    }

    // Delete from database
    await query(`
        DELETE FROM firm_gdpr_mail_tokens
        WHERE firm_id = $1
    `, [firmId]);

    safeLog('info', 'GDPR Gmail disconnected', { firmId });
}

/**
 * Validate token by making a test API call
 * @param {string} firmId
 * @returns {Promise<{valid: boolean, error?: string}>}
 */
export async function validateToken(firmId) {
    try {
        const accessToken = await getAccessToken(firmId);
        
        const oauth2Client = await getOAuth2Client();
        oauth2Client.setCredentials({ access_token: accessToken });

        const google = await getGoogle();
        const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
        
        // Try to get user profile - lightweight API call to validate token
        await gmail.users.getProfile({ userId: 'me' });
        
        return { valid: true };
    } catch (error) {
        safeLog('warn', 'GDPR token validation failed', { firmId, error: error.message });
        return { 
            valid: false, 
            error: error.message?.includes('invalid authentication credentials') 
                ? 'Token révoqué - reconnexion requise'
                : error.message 
        };
    }
}

export const gdprMailService = {
    getAuthUrl,
    handleOAuthCallback,
    getConnectionStatus,
    validateToken,
    sendEmail,
    sendTestEmail,
    disconnect
};

export default gdprMailService;
