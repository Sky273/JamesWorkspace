/**
 * Mail Provider Interface
 * Abstract interface for email providers (Gmail, Outlook, etc.)
 * All providers must implement these methods
 */

/**
 * @typedef {Object} DraftMessage
 * @property {string} to - Recipient email address
 * @property {string} subject - Email subject
 * @property {string} body - Email body (HTML or plain text)
 * @property {Buffer} [attachment] - PDF attachment buffer
 * @property {string} [attachmentName] - Attachment filename
 */

/**
 * @typedef {Object} DraftResult
 * @property {string} draftId - ID of the created draft
 * @property {string} webLink - Link to open the draft in webmail
 */

/**
 * @typedef {Object} AuthResult
 * @property {string} accessToken - OAuth access token
 * @property {string} refreshToken - OAuth refresh token
 * @property {number} expiresIn - Token expiry in seconds
 * @property {string} email - User's email address
 */

/**
 * Mail Provider Interface
 * @interface
 */
export class MailProviderInterface {
    /**
     * Provider name (e.g., 'gmail', 'outlook')
     * @type {string}
     */
    get name() {
        throw new Error('Not implemented');
    }

    /**
     * Generate OAuth authorization URL
     * @param {string} state - CSRF state parameter
     * @returns {string} - Authorization URL
     */
    getAuthUrl(state) {
        throw new Error('Not implemented');
    }

    /**
     * Exchange authorization code for tokens
     * @param {string} code - Authorization code from OAuth callback
     * @returns {Promise<AuthResult>}
     */
    async exchangeCode(code) {
        throw new Error('Not implemented');
    }

    /**
     * Refresh access token using refresh token
     * @param {string} refreshToken - Refresh token
     * @returns {Promise<AuthResult>}
     */
    async refreshAccessToken(refreshToken) {
        throw new Error('Not implemented');
    }

    /**
     * Create a draft email with attachment
     * @param {string} accessToken - OAuth access token
     * @param {DraftMessage} message - Draft message details
     * @returns {Promise<DraftResult>}
     */
    async createDraft(accessToken, message) {
        throw new Error('Not implemented');
    }

    /**
     * Revoke OAuth tokens
     * @param {string} accessToken - Access token to revoke
     * @returns {Promise<void>}
     */
    async revokeToken(accessToken) {
        throw new Error('Not implemented');
    }
}

export default MailProviderInterface;
