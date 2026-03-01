/**
 * GDPR Mail Service
 * Handles Gmail OAuth and direct email sending for GDPR consent requests
 * 
 * IMPORTANT: This service uses a GLOBAL Gmail token for ALL GDPR consent emails.
 * The token is stored in the global_gdpr_mail_token table (single row).
 * Email templates remain firm-specific.
 * 
 * SEPARATION OF CONCERNS:
 * - SSO Authentication: googleAuth.service.js (no token storage)
 * - CV Email Sending: mailService.js (user_mail_tokens table)
 * - GDPR Consent Emails: THIS SERVICE (global_gdpr_mail_token table - GLOBAL)
 * 
 * Each service has its own:
 * - Redirect URI (GOOGLE_GDPR_REDIRECT_URI)
 * - Scopes (gmail.send for direct sending)
 * - Token storage (global_gdpr_mail_token - SINGLE GLOBAL TOKEN)
 * - OAuth2 client instance (new instance per call)
 * 
 * TOKEN REFRESH: The access token is automatically refreshed using the refresh_token
 * when it expires. Google refresh tokens are long-lived but can be revoked.
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
 * Handle OAuth callback - exchange code and store GLOBAL token
 * @param {string} code - Authorization code
 * @returns {Promise<Object>}
 */
export async function handleOAuthCallback(code) {
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

    // Upsert GLOBAL token in database (single row with id='global')
    await query(`
        INSERT INTO global_gdpr_mail_token (id, provider, access_token_encrypted, refresh_token_encrypted, token_expiry, email)
        VALUES ('global', $1, $2, $3, $4, $5)
        ON CONFLICT (id) 
        DO UPDATE SET 
            provider = EXCLUDED.provider,
            access_token_encrypted = EXCLUDED.access_token_encrypted,
            refresh_token_encrypted = COALESCE(EXCLUDED.refresh_token_encrypted, global_gdpr_mail_token.refresh_token_encrypted),
            token_expiry = EXCLUDED.token_expiry,
            email = EXCLUDED.email,
            updated_at = CURRENT_TIMESTAMP
    `, ['gmail', accessTokenEncrypted, refreshTokenEncrypted, tokenExpiry, email]);

    safeLog('info', 'GDPR Gmail GLOBAL token stored', { email });

    return { email, provider: 'gmail' };
}

/**
 * Get GLOBAL connection status
 * @returns {Promise<Object>}
 */
export async function getConnectionStatus() {
    const result = await query(`
        SELECT provider, email, token_expiry, updated_at
        FROM global_gdpr_mail_token
        WHERE id = 'global'
    `);

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
        updatedAt: token.updated_at,
        needsReauth: expired
    };
}

/**
 * Get valid GLOBAL access token (refreshes if needed)
 * This is the core function that handles token refresh automatically
 * @returns {Promise<string>}
 */
async function getAccessToken() {
    const result = await query(`
        SELECT access_token_encrypted, refresh_token_encrypted, token_expiry
        FROM global_gdpr_mail_token
        WHERE id = 'global'
    `);

    if (result.rows.length === 0) {
        throw new Error('Gmail RGPD non configuré. Un administrateur doit connecter un compte Gmail dans Paramètres → RGPD Mail.');
    }

    const tokenData = result.rows[0];
    const expired = isTokenExpired(tokenData.token_expiry);

    if (!expired) {
        safeLog('debug', 'GDPR token still valid, using cached token');
        return decryptToken(tokenData.access_token_encrypted);
    }

    // Token expired - try to refresh using refresh_token
    safeLog('info', 'GDPR access token expired, attempting refresh');
    
    if (!tokenData.refresh_token_encrypted) {
        throw new Error('Token expiré et pas de refresh token. Un administrateur doit reconnecter Gmail.');
    }

    const refreshToken = decryptToken(tokenData.refresh_token_encrypted);
    const oauth2Client = await getOAuth2Client();
    oauth2Client.setCredentials({ refresh_token: refreshToken });

    try {
        const { credentials } = await oauth2Client.refreshAccessToken();
        
        // Update stored tokens with new access token (and refresh token if provided)
        const newAccessTokenEncrypted = encryptToken(credentials.access_token);
        const newRefreshTokenEncrypted = credentials.refresh_token 
            ? encryptToken(credentials.refresh_token) 
            : tokenData.refresh_token_encrypted;
        const newExpiry = calculateTokenExpiry(credentials.expiry_date 
            ? Math.floor((credentials.expiry_date - Date.now()) / 1000) 
            : 3600);

        await query(`
            UPDATE global_gdpr_mail_token
            SET access_token_encrypted = $1,
                refresh_token_encrypted = $2,
                token_expiry = $3,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = 'global'
        `, [newAccessTokenEncrypted, newRefreshTokenEncrypted, newExpiry]);

        safeLog('info', 'GDPR Gmail GLOBAL token refreshed successfully', { 
            newExpiry: newExpiry.toISOString(),
            hasNewRefreshToken: !!credentials.refresh_token
        });

        return credentials.access_token;
    } catch (error) {
        safeLog('error', 'GDPR GLOBAL token refresh failed', { error: error.message });
        
        // Mark token as invalid in database to force re-authentication
        await query(`
            UPDATE global_gdpr_mail_token
            SET token_expiry = NOW() - INTERVAL '1 day',
                updated_at = CURRENT_TIMESTAMP
            WHERE id = 'global'
        `);
        
        // Check if it's a revoked token error
        const isRevokedToken = error.message?.includes('invalid_grant') || 
                              error.message?.includes('Token has been expired or revoked') ||
                              error.message?.includes('invalid authentication credentials');
        
        if (isRevokedToken) {
            throw new Error('Le token Gmail RGPD a été révoqué par Google. Un administrateur doit reconnecter Gmail dans Paramètres → RGPD Mail.');
        }
        
        throw new Error('Échec du rafraîchissement du token Gmail RGPD. Un administrateur doit reconnecter Gmail.');
    }
}

/**
 * Send an email via Gmail using GLOBAL token
 * @param {Object} emailData - Email data
 * @param {string} emailData.to - Recipient email
 * @param {string} emailData.subject - Email subject
 * @param {string} emailData.html - HTML body
 * @param {string} emailData.text - Plain text body (optional)
 * @param {boolean} isRetry - Internal flag for retry after token refresh
 * @returns {Promise<Object>}
 */
export async function sendEmail({ to, subject, html, text }, isRetry = false) {
    // Get GLOBAL access token (will refresh if needed)
    let accessToken;
    try {
        accessToken = await getAccessToken();
    } catch (tokenError) {
        safeLog('error', 'Failed to get GDPR GLOBAL access token', { error: tokenError.message });
        throw tokenError;
    }
    
    const oauth2Client = await getOAuth2Client();
    oauth2Client.setCredentials({ access_token: accessToken });

    const google = await getGoogle();
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Get sender email from GLOBAL token
    const statusResult = await query(`
        SELECT email FROM global_gdpr_mail_token WHERE id = 'global'
    `);
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

    try {
        // Send email
        const result = await gmail.users.messages.send({
            userId: 'me',
            requestBody: {
                raw: encodedMessage
            }
        });

        safeLog('info', 'GDPR email sent via Gmail (GLOBAL)', { to, messageId: result.data.id });

        return {
            success: true,
            messageId: result.data.id,
            sentTo: to
        };
    } catch (sendError) {
        // Check if it's an authentication error - token might be invalid even if not expired
        const isAuthError = sendError.message?.includes('invalid authentication credentials') ||
                           sendError.message?.includes('Invalid Credentials') ||
                           sendError.message?.includes('Request had invalid authentication') ||
                           sendError.code === 401;
        
        if (isAuthError && !isRetry) {
            safeLog('warn', 'GDPR token rejected by Google, forcing refresh and retry', { error: sendError.message });
            
            // Force token expiry to trigger refresh on next call
            await query(`
                UPDATE global_gdpr_mail_token
                SET token_expiry = NOW() - INTERVAL '1 hour',
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = 'global'
            `);
            
            // Retry once with refreshed token
            return sendEmail({ to, subject, html, text }, true);
        }
        
        // Re-throw the error if it's not an auth error or if retry already failed
        throw sendError;
    }
}

/**
 * Send a test email using GLOBAL token
 * @param {string} email - Recipient email address
 */
export async function sendTestEmail(email) {
    return sendEmail({
        to: email,
        subject: 'Test RGPD - ResumeConverter',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #2563eb;">Test de configuration RGPD</h2>
                <p>Ce message confirme que la configuration Gmail GLOBAL pour l'envoi des emails de consentement RGPD fonctionne correctement.</p>
                <p style="color: #6b7280; font-size: 14px;">Envoyé depuis ResumeConverter</p>
            </div>
        `,
        text: 'Test de configuration RGPD - Ce message confirme que la configuration Gmail GLOBAL fonctionne correctement.'
    });
}

/**
 * Disconnect GLOBAL Gmail token
 */
export async function disconnect() {
    // Get GLOBAL token to revoke
    const result = await query(`
        SELECT access_token_encrypted
        FROM global_gdpr_mail_token
        WHERE id = 'global'
    `);

    if (result.rows.length > 0) {
        try {
            const accessToken = decryptToken(result.rows[0].access_token_encrypted);
            const oauth2Client = await getOAuth2Client();
            await oauth2Client.revokeToken(accessToken);
        } catch (error) {
            // Ignore revocation errors
            safeLog('warn', 'GLOBAL token revocation failed', { error: error.message });
        }
    }

    // Delete GLOBAL token from database
    await query(`
        DELETE FROM global_gdpr_mail_token
        WHERE id = 'global'
    `);

    safeLog('info', 'GDPR Gmail GLOBAL token disconnected');
}

/**
 * Validate GLOBAL token by making a test API call
 * @returns {Promise<{valid: boolean, error?: string}>}
 */
export async function validateToken() {
    try {
        const accessToken = await getAccessToken();
        
        const oauth2Client = await getOAuth2Client();
        oauth2Client.setCredentials({ access_token: accessToken });

        const google = await getGoogle();
        const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
        
        // Try to get user profile - lightweight API call to validate token
        await gmail.users.getProfile({ userId: 'me' });
        
        return { valid: true };
    } catch (error) {
        safeLog('warn', 'GDPR GLOBAL token validation failed', { error: error.message });
        return { 
            valid: false, 
            error: error.message?.includes('invalid authentication credentials') 
                ? 'Token révoqué - reconnexion requise'
                : error.message 
        };
    }
}

/**
 * Proactively refresh the GLOBAL GDPR token
 * This should be called periodically (e.g., weekly) to ensure token persistence
 * Google access tokens expire after 1 hour, but refresh tokens are long-lived
 * Proactive refresh keeps the refresh token active and prevents expiration
 * @returns {Promise<{success: boolean, message: string, email?: string}>}
 */
export async function proactiveTokenRefresh() {
    safeLog('info', '[GDPR Token Refresh] Starting proactive token refresh');
    
    try {
        // Check if we have a token configured
        const result = await query(`
            SELECT access_token_encrypted, refresh_token_encrypted, token_expiry, email
            FROM global_gdpr_mail_token
            WHERE id = 'global'
        `);

        if (result.rows.length === 0) {
            safeLog('info', '[GDPR Token Refresh] No GDPR token configured, skipping refresh');
            return { success: true, message: 'No token configured' };
        }

        const tokenData = result.rows[0];
        
        if (!tokenData.refresh_token_encrypted) {
            safeLog('warn', '[GDPR Token Refresh] No refresh token available');
            return { success: false, message: 'No refresh token available' };
        }

        // Force refresh by getting a new access token using the refresh token
        const refreshToken = decryptToken(tokenData.refresh_token_encrypted);
        const oauth2Client = await getOAuth2Client();
        oauth2Client.setCredentials({ refresh_token: refreshToken });

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
            UPDATE global_gdpr_mail_token
            SET access_token_encrypted = $1,
                refresh_token_encrypted = $2,
                token_expiry = $3,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = 'global'
        `, [newAccessTokenEncrypted, newRefreshTokenEncrypted, newExpiry]);

        safeLog('info', '[GDPR Token Refresh] Token refreshed successfully', { 
            email: tokenData.email,
            newExpiry: newExpiry.toISOString(),
            hasNewRefreshToken: !!credentials.refresh_token
        });

        return { 
            success: true, 
            message: 'Token refreshed successfully',
            email: tokenData.email
        };
    } catch (error) {
        safeLog('error', '[GDPR Token Refresh] Proactive refresh failed', { error: error.message });
        
        // Check if token was revoked
        const isRevokedToken = error.message?.includes('invalid_grant') || 
                              error.message?.includes('Token has been expired or revoked');
        
        if (isRevokedToken) {
            // Mark token as invalid
            await query(`
                UPDATE global_gdpr_mail_token
                SET token_expiry = NOW() - INTERVAL '1 day',
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = 'global'
            `);
            
            return { 
                success: false, 
                message: 'Token révoqué par Google - reconnexion requise'
            };
        }
        
        return { 
            success: false, 
            message: error.message 
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
    disconnect,
    proactiveTokenRefresh
};

export default gdprMailService;
