/**
 * OAuth Configuration for Google Services
 * 
 * IMPORTANT: This application uses 3 SEPARATE OAuth2 flows:
 * 
 * 1. SSO AUTHENTICATION (googleAuthConfig)
 *    - Purpose: User login via "Sign in with Google"
 *    - Redirect: /api/auth/google/callback
 *    - Scopes: userinfo.email, userinfo.profile
 *    - Token Storage: NONE (only JWT session tokens)
 *    - Service: googleAuth.service.js
 * 
 * 2. CV EMAIL SENDING (googleOAuthConfig)
 *    - Purpose: Create Gmail drafts with CV attachments
 *    - Redirect: /api/mail/callback/gmail
 *    - Scopes: gmail.compose, userinfo.email
 *    - Token Storage: user_mail_tokens (per user)
 *    - Service: mailService.js + gmailProvider.js
 * 
 * 3. GDPR CONSENT EMAILS (configured in gdprMailService.js)
 *    - Purpose: Send GDPR consent request emails
 *    - Redirect: /api/gdpr/mail/callback
 *    - Scopes: gmail.send, userinfo.email
 *    - Token Storage: firm_gdpr_mail_tokens (per firm)
 *    - Service: gdprMailService.js
 * 
 * WHY SEPARATE?
 * - Different redirect URIs prevent token confusion
 * - Different scopes for different purposes (compose vs send)
 * - Different storage levels (user vs firm)
 * - Avoids Google's 50 refresh token limit per account/app
 * - Allows using different Gmail accounts for each purpose
 */

import crypto from 'crypto';

// ============================================
// CONFIG 1: SSO AUTHENTICATION + CV EMAIL
// ============================================
// Used by: googleAuth.service.js
// Purpose: User login via Google SSO + Gmail access for CV email sending
// Storage: user_mail_tokens table (tokens saved during SSO login)
// Note: SSO users get Gmail access automatically (no separate connection needed)

export const googleAuthConfig = {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: process.env.GOOGLE_AUTH_REDIRECT_URI || 'http://localhost:3001/api/auth/google/callback',
    scopes: [
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/gmail.compose' // For CV email sending when logged in via SSO
    ]
};

// ============================================
// CONFIG 2: CV EMAIL SENDING
// ============================================
// Used by: mailService.js, gmailProvider.js
// Purpose: Create Gmail drafts with CV attachments
// Storage: user_mail_tokens table (per user)

export const googleOAuthConfig = {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/api/mail/callback/gmail',
    scopes: [
        'https://www.googleapis.com/auth/gmail.compose',
        'https://www.googleapis.com/auth/userinfo.email'
    ]
};

// ============================================
// CONFIG 3: GDPR CONSENT EMAILS
// ============================================
// Configured directly in gdprMailService.js
// Uses: GOOGLE_GDPR_REDIRECT_URI env variable
// Storage: firm_gdpr_mail_tokens table (per firm)

// ============================================
// TOKEN ENCRYPTION
// ============================================

const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Get encryption key from environment
 */
function getEncryptionKey() {
    const key = process.env.MAIL_TOKEN_ENCRYPTION_KEY;
    if (!key || key.length < 64) {
        throw new Error('MAIL_TOKEN_ENCRYPTION_KEY must be at least 64 hex characters');
    }
    return Buffer.from(key.substring(0, 64), 'hex');
}

/**
 * Encrypt a token for secure storage
 * @param {string} token - Plain text token
 * @returns {string} - Encrypted token (base64)
 */
export function encryptToken(token) {
    if (!token) return null;
    
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
    
    let encrypted = cipher.update(token, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    
    const authTag = cipher.getAuthTag();
    
    // Format: iv:authTag:encryptedData (all base64)
    return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
}

/**
 * Decrypt a stored token
 * @param {string} encryptedToken - Encrypted token string
 * @returns {string} - Decrypted plain text token
 */
export function decryptToken(encryptedToken) {
    if (!encryptedToken) return null;
    
    const key = getEncryptionKey();
    const parts = encryptedToken.split(':');
    
    if (parts.length !== 3) {
        throw new Error('Invalid encrypted token format');
    }
    
    const iv = Buffer.from(parts[0], 'base64');
    const authTag = Buffer.from(parts[1], 'base64');
    const encrypted = parts[2];
    
    const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
}

// ============================================
// TOKEN EXPIRY
// ============================================

// Token validity duration - synchronized with JWT refresh token (7 days)
export const TOKEN_VALIDITY_DAYS = 7;

/**
 * Check if a token has expired
 * @param {Date} expiryDate - Token expiry date
 * @returns {boolean}
 */
export function isTokenExpired(expiryDate) {
    if (!expiryDate) return true;
    return new Date(expiryDate) < new Date();
}

/**
 * Calculate token expiry date for Gmail tokens
 * Uses JWT refresh token duration (7 days) since we have Google refresh token
 * to renew access tokens automatically
 * @param {number} expiresIn - Seconds until expiry (from OAuth response) - ignored when refresh token available
 * @param {boolean} hasRefreshToken - Whether we have a refresh token
 * @returns {Date}
 */
export function calculateTokenExpiry(expiresIn, hasRefreshToken = true) {
    const now = new Date();
    
    if (hasRefreshToken) {
        // With refresh token, we can renew access tokens
        // Set expiry to match JWT refresh token (7 days)
        const sessionValidityMs = TOKEN_VALIDITY_DAYS * 24 * 60 * 60 * 1000;
        return new Date(now.getTime() + sessionValidityMs);
    }
    
    // Without refresh token, use OAuth expiry (typically 1 hour)
    const oauthExpiryMs = (expiresIn || 3600) * 1000;
    return new Date(now.getTime() + oauthExpiryMs);
}
