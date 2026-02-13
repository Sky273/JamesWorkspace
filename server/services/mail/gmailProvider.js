/**
 * Gmail Provider
 * Implementation of MailProviderInterface for Google Gmail
 * Uses Google OAuth 2.0 and Gmail API
 */

import { google } from 'googleapis';
import { googleOAuthConfig } from '../../config/oauth.config.js';
import { safeLog } from '../../utils/logger.backend.js';

class GmailProvider {
    constructor() {
        this._name = 'gmail';
        this.oauth2Client = new google.auth.OAuth2(
            googleOAuthConfig.clientId,
            googleOAuthConfig.clientSecret,
            googleOAuthConfig.redirectUri
        );
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
     * @returns {string}
     */
    getAuthUrl(state) {
        return this.oauth2Client.generateAuthUrl({
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
            const { tokens } = await this.oauth2Client.getToken(code);
            this.oauth2Client.setCredentials(tokens);

            // Get user email
            const oauth2 = google.oauth2({ version: 'v2', auth: this.oauth2Client });
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
            this.oauth2Client.setCredentials({ refresh_token: refreshToken });
            const { credentials } = await this.oauth2Client.refreshAccessToken();

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
            this.oauth2Client.setCredentials({ access_token: accessToken });
            const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });

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
            await this.oauth2Client.revokeToken(accessToken);
            safeLog('info', 'Gmail token revoked');
        } catch (error) {
            safeLog('warn', 'Gmail token revocation failed', { error: error.message });
            // Don't throw - token might already be invalid
        }
    }
}

// Export singleton instance
export const gmailProvider = new GmailProvider();
export default gmailProvider;
