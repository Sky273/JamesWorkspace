/**
 * Gmail Provider
 * Implementation of MailProviderInterface for Google Gmail
 * Uses Google OAuth 2.0 and Gmail API
 * 
 * NOTE: googleapis is loaded lazily to save ~58MB of memory at startup
 * The module is automatically unloaded after 10 minutes of inactivity
 */

import { googleOAuthConfig } from '../../config/oauth.config.js';
import { safeLog } from '../../utils/logger.backend.js';

// Lazy-loaded googleapis module (saves ~58MB at startup)
let google = null;
let googleLastUsed = 0;
let googleUnloadTimer = null;

// Unload googleapis after 10 minutes of inactivity to free ~58MB
const GOOGLE_UNLOAD_TIMEOUT = 10 * 60 * 1000;

/**
 * Schedule unloading of googleapis module after inactivity
 */
function scheduleGoogleUnload() {
    // Clear existing timer
    if (googleUnloadTimer) {
        clearTimeout(googleUnloadTimer);
    }
    
    // Schedule unload
    googleUnloadTimer = setTimeout(() => {
        if (google && Date.now() - googleLastUsed >= GOOGLE_UNLOAD_TIMEOUT) {
            unloadGoogle();
        }
    }, GOOGLE_UNLOAD_TIMEOUT + 1000); // Add 1 second buffer
    
    // Don't keep process alive for this timer
    if (googleUnloadTimer.unref) {
        googleUnloadTimer.unref();
    }
}

/**
 * Unload googleapis module to free memory (~58MB)
 */
function unloadGoogle() {
    if (google) {
        google = null;
        googleLastUsed = 0;
        
        // Also clear the oauth2Client reference in the provider
        if (gmailProviderInstance) {
            gmailProviderInstance.oauth2Client = null;
        }
        
        // Clear module from require cache to allow garbage collection
        // For ES modules, we just null the reference and let GC handle it
        
        // Trigger garbage collection if available
        if (global.gc) {
            global.gc();
            safeLog('info', 'googleapis module unloaded and GC triggered (~58MB freed)');
        } else {
            safeLog('info', 'googleapis module unloaded (~58MB will be freed by GC)');
        }
    }
}

// Reference to the singleton for cleanup
let gmailProviderInstance = null;

async function getGoogle() {
    googleLastUsed = Date.now();
    
    if (!google) {
        const googleapis = await import('googleapis');
        google = googleapis.google;
        safeLog('info', 'googleapis module loaded lazily (~58MB)');
    }
    
    // Schedule unload after inactivity
    scheduleGoogleUnload();
    
    return google;
}

/**
 * Destroy googleapis resources (for graceful shutdown)
 */
function destroyGoogleapis() {
    if (googleUnloadTimer) {
        clearTimeout(googleUnloadTimer);
        googleUnloadTimer = null;
    }
    unloadGoogle();
}

class GmailProvider {
    constructor() {
        this._name = 'gmail';
        this.oauth2Client = null;
    }

    /**
     * Get or create OAuth2 client (lazy initialization)
     */
    async _getOAuth2Client() {
        if (!this.oauth2Client) {
            const g = await getGoogle();
            this.oauth2Client = new g.auth.OAuth2(
                googleOAuthConfig.clientId,
                googleOAuthConfig.clientSecret,
                googleOAuthConfig.redirectUri
            );
        }
        return this.oauth2Client;
    }

    /**
     * Provider name
     */
    get name() {
        return this._name;
    }

    /**
     * Generate OAuth authorization URL
     * @param {string} state - CSRF state parameter
     * @returns {Promise<string>}
     */
    async getAuthUrl(state) {
        const client = await this._getOAuth2Client();
        return client.generateAuthUrl({
            access_type: 'offline',
            scope: googleOAuthConfig.scopes,
            state: state,
            prompt: 'consent' // Force consent to get refresh token
        });
    }

    /**
     * Exchange authorization code for tokens
     * @param {string} code - Authorization code
     * @returns {Promise<Object>}
     */
    async exchangeCode(code) {
        try {
            const client = await this._getOAuth2Client();
            const g = await getGoogle();
            const { tokens } = await client.getToken(code);
            client.setCredentials(tokens);

            // Get user email
            const oauth2 = g.oauth2({ version: 'v2', auth: client });
            const userInfo = await oauth2.userinfo.get();

            return {
                accessToken: tokens.access_token,
                refreshToken: tokens.refresh_token,
                expiresIn: tokens.expiry_date 
                    ? Math.floor((tokens.expiry_date - Date.now()) / 1000)
                    : 3600,
                email: userInfo.data.email
            };
        } catch (error) {
            safeLog('error', 'Gmail OAuth code exchange failed', { error: error.message });
            throw new Error('Failed to exchange authorization code');
        }
    }

    /**
     * Refresh access token
     * @param {string} refreshToken - Refresh token
     * @returns {Promise<Object>}
     */
    async refreshAccessToken(refreshToken) {
        try {
            const client = await this._getOAuth2Client();
            client.setCredentials({ refresh_token: refreshToken });
            const { credentials } = await client.refreshAccessToken();

            return {
                accessToken: credentials.access_token,
                refreshToken: credentials.refresh_token || refreshToken,
                expiresIn: credentials.expiry_date
                    ? Math.floor((credentials.expiry_date - Date.now()) / 1000)
                    : 3600
            };
        } catch (error) {
            safeLog('error', 'Gmail token refresh failed', { error: error.message });
            throw new Error('Failed to refresh access token');
        }
    }

    /**
     * Create a draft email with PDF attachment
     * @param {string} accessToken - OAuth access token
     * @param {Object} message - Draft message details
     * @returns {Promise<Object>}
     */
    async createDraft(accessToken, message) {
        try {
            const client = await this._getOAuth2Client();
            const g = await getGoogle();
            client.setCredentials({ access_token: accessToken });
            const gmail = g.gmail({ version: 'v1', auth: client });

            // Build MIME message
            const mimeMessage = this._buildMimeMessage(message);
            const encodedMessage = Buffer.from(mimeMessage)
                .toString('base64')
                .replace(/\+/g, '-')
                .replace(/\//g, '_')
                .replace(/=+$/, '');

            // Create draft
            const response = await gmail.users.drafts.create({
                userId: 'me',
                requestBody: {
                    message: {
                        raw: encodedMessage
                    }
                }
            });

            const draftId = response.data.id;
            const messageId = response.data.message?.id;

            safeLog('info', 'Gmail draft created', { draftId, to: message.to });

            return {
                draftId: draftId,
                webLink: `https://mail.google.com/mail/u/0/#drafts?compose=${messageId || draftId}`
            };
        } catch (error) {
            safeLog('error', 'Gmail draft creation failed', { error: error.message });
            throw new Error('Failed to create Gmail draft: ' + error.message);
        }
    }

    /**
     * Build MIME message with attachment
     * @private
     */
    _buildMimeMessage(message) {
        const boundary = '----=_Part_' + Date.now().toString(36);
        const { to, subject, body, attachment, attachmentName } = message;

        let mimeMessage = '';

        // Headers
        mimeMessage += `To: ${to}\r\n`;
        mimeMessage += `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=\r\n`;
        mimeMessage += `MIME-Version: 1.0\r\n`;

        if (attachment) {
            // Multipart message with attachment
            mimeMessage += `Content-Type: multipart/mixed; boundary="${boundary}"\r\n\r\n`;

            // Body part
            mimeMessage += `--${boundary}\r\n`;
            mimeMessage += `Content-Type: text/html; charset=UTF-8\r\n`;
            mimeMessage += `Content-Transfer-Encoding: 7bit\r\n\r\n`;
            mimeMessage += `${body || ''}\r\n\r\n`;

            // Attachment part
            mimeMessage += `--${boundary}\r\n`;
            mimeMessage += `Content-Type: application/pdf; name="${attachmentName}"\r\n`;
            mimeMessage += `Content-Disposition: attachment; filename="${attachmentName}"\r\n`;
            mimeMessage += `Content-Transfer-Encoding: base64\r\n\r\n`;
            mimeMessage += attachment.toString('base64').replace(/(.{76})/g, '$1\r\n');
            mimeMessage += `\r\n--${boundary}--`;
        } else {
            // Simple message without attachment
            mimeMessage += `Content-Type: text/html; charset=UTF-8\r\n\r\n`;
            mimeMessage += body || '';
        }

        return mimeMessage;
    }

    /**
     * Revoke OAuth token
     * @param {string} accessToken - Token to revoke
     */
    async revokeToken(accessToken) {
        try {
            const client = await this._getOAuth2Client();
            await client.revokeToken(accessToken);
            safeLog('info', 'Gmail token revoked');
        } catch (error) {
            safeLog('warn', 'Gmail token revocation failed', { error: error.message });
            // Don't throw - token might already be invalid
        }
    }
}

// Export singleton instance
export const gmailProvider = new GmailProvider();
gmailProviderInstance = gmailProvider;

// Export destroy function for graceful shutdown
export { destroyGoogleapis };

export default gmailProvider;
