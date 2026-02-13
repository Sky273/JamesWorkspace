/**
 * OAuth Configuration for Email Providers
 * Supports Gmail (Google) and Outlook (Microsoft) - extensible
 */

import crypto from 'crypto';

// ============================================
// GOOGLE OAUTH CONFIG
// ============================================

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

// Token validity duration (1 week)
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
 * Calculate token expiry date
 * @param {number} expiresIn - Seconds until expiry (from OAuth response)
 * @returns {Date}
 */
export function calculateTokenExpiry(expiresIn) {
    const now = new Date();
    // Use the shorter of: OAuth expiry or our max validity
    const maxValidityMs = TOKEN_VALIDITY_DAYS * 24 * 60 * 60 * 1000;
    const oauthExpiryMs = (expiresIn || 3600) * 1000;
    const expiryMs = Math.min(maxValidityMs, oauthExpiryMs);
    return new Date(now.getTime() + expiryMs);
}
