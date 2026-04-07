/**
 * Google OAuth2 Authentication Service
 * Handles "Sign in with Google" for MFA/SSO ONLY
 * 
 * IMPORTANT: This service is DEDICATED to user authentication (SSO).
 * It does NOT handle Gmail tokens for email sending.
 * 
 * For CV email sending: use mailService.js (user_mail_tokens table)
 * For GDPR consent emails: use gdprMailService.js (firm_gdpr_mail_tokens table)
 * 
 * Each OAuth2 use case has its own:
 * - Redirect URI
 * - Scopes
 * - Token storage
 * - OAuth2 client instance
 */

import { googleAuthConfig } from '../config/oauth.config.js';
import { safeLog } from '../utils/logger.backend.js';
import { query } from '../config/database.js';

export const GOOGLE_AUTH_DB_ERROR_CODE = 'GOOGLE_AUTH_DB_ERROR';
export const GOOGLE_AUTH_UPSTREAM_ERROR_CODE = 'GOOGLE_AUTH_UPSTREAM_ERROR';

// Lazy-loaded googleapis module
let google = null;

/**
 * Get googleapis module (lazy loaded)
 */
async function getGoogle() {
    if (!google) {
        const googleapis = await import('googleapis');
        google = googleapis.google;
        safeLog('info', 'googleapis module loaded for SSO auth');
    }
    return google;
}

/**
 * Create a NEW OAuth2 client instance for SSO
 * NOTE: We create a new instance each time to avoid state pollution
 * between different OAuth flows (SSO vs Mail vs GDPR)
 */
async function createOAuth2Client() {
    const g = await getGoogle();
    return new g.auth.OAuth2(
        googleAuthConfig.clientId,
        googleAuthConfig.clientSecret,
        googleAuthConfig.redirectUri
    );
}

function createGoogleAuthDbError(operation, error) {
    const wrappedError = new Error(`Google auth database operation failed: ${operation}`);
    wrappedError.code = GOOGLE_AUTH_DB_ERROR_CODE;
    wrappedError.statusCode = 503;
    wrappedError.cause = error;
    return wrappedError;
}

function isGoogleUpstreamError(error) {
    const retryableCodes = new Set(['ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN', 'ECONNREFUSED', 'ENOTFOUND']);
    const responseStatus = error?.response?.status;
    return retryableCodes.has(error?.code) || responseStatus === 429 || (Number.isInteger(responseStatus) && responseStatus >= 500);
}

function createGoogleAuthUpstreamError(operation, error) {
    const wrappedError = new Error(`Google auth upstream service unavailable: ${operation}`);
    wrappedError.code = GOOGLE_AUTH_UPSTREAM_ERROR_CODE;
    wrappedError.statusCode = 503;
    wrappedError.cause = error;
    return wrappedError;
}

/**
 * Generate Google OAuth authorization URL
 * @param {string} state - State parameter for CSRF protection
 * @returns {Promise<string>} Authorization URL
 */
export async function getAuthUrl(state) {
    const client = await createOAuth2Client();
    return client.generateAuthUrl({
        access_type: 'offline',
        scope: googleAuthConfig.scopes,
        state: state,
        prompt: 'consent' // Force consent to always get refresh token for Gmail access
    });
}

/**
 * Exchange authorization code for tokens and get user info
 * @param {string} code - Authorization code from Google
 * @returns {Promise<Object>} User info { email, name, picture, googleId }
 */
export async function exchangeCodeForUserInfo(code) {
    try {
        const client = await createOAuth2Client();
        const { tokens } = await client.getToken(code);
        client.setCredentials(tokens);
        
        // Get user info from Google
        const g = await getGoogle();
        const oauth2 = g.oauth2({ version: 'v2', auth: client });
        const { data } = await oauth2.userinfo.get();
        
        safeLog('info', 'Google user info retrieved', { email: data.email });
        
        return {
            email: data.email,
            name: data.name || data.email.split('@')[0],
            picture: data.picture,
            googleId: data.id,
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token
        };
    } catch (error) {
        safeLog('error', 'Failed to exchange Google code', { error: error.message });
        if (isGoogleUpstreamError(error)) {
            throw createGoogleAuthUpstreamError('exchangeCodeForUserInfo', error);
        }
        throw new Error('Failed to authenticate with Google');
    }
}

/**
 * Verify Google ID token (for frontend Google Sign-In button)
 * @param {string} idToken - ID token from Google Sign-In
 * @returns {Promise<Object>} User info
 */
export async function verifyIdToken(idToken) {
    try {
        const client = await createOAuth2Client();
        const ticket = await client.verifyIdToken({
            idToken: idToken,
            audience: googleAuthConfig.clientId
        });
        
        const payload = ticket.getPayload();
        
        return {
            email: payload.email,
            name: payload.name || payload.email.split('@')[0],
            picture: payload.picture,
            googleId: payload.sub,
            emailVerified: payload.email_verified
        };
    } catch (error) {
        safeLog('error', 'Failed to verify Google ID token', { error: error.message });
        if (isGoogleUpstreamError(error)) {
            throw createGoogleAuthUpstreamError('verifyIdToken', error);
        }
        throw new Error('Invalid Google token');
    }
}

/**
 * Link Google account to existing user
 * @param {string} userId - User ID
 * @param {string} googleId - Google account ID
 * @param {string} googleEmail - Google email
 * @returns {Promise<boolean>}
 */
export async function linkGoogleAccount(userId, googleId, googleEmail) {
    try {
        const result = await query(
            `UPDATE users SET 
                google_id = $1, 
                google_email = $2,
                google_linked_at = CURRENT_TIMESTAMP
            WHERE id = $3`,
            [googleId, googleEmail, userId]
        );

        if (!result.rowCount) {
            safeLog('warn', 'Google account link skipped because user was not found', { userId, googleEmail });
            return false;
        }
        
        safeLog('info', 'Google account linked', { userId, googleEmail });
        return true;
    } catch (error) {
        safeLog('error', 'Failed to link Google account', { error: error.message, userId });
        throw error;
    }
}

/**
 * Unlink Google account from user
 * @param {string} userId - User ID
 * @returns {Promise<boolean>}
 */
export async function unlinkGoogleAccount(userId) {
    try {
        await query(
            `UPDATE users SET 
                google_id = NULL, 
                google_email = NULL,
                google_linked_at = NULL
            WHERE id = $1`,
            [userId]
        );
        
        safeLog('info', 'Google account unlinked', { userId });
        return true;
    } catch (error) {
        safeLog('error', 'Failed to unlink Google account', { error: error.message, userId });
        throw error;
    }
}

/**
 * Find user by Google ID
 * @param {string} googleId - Google account ID
 * @returns {Promise<Object|null>} User or null
 */
export async function findUserByGoogleId(googleId) {
    try {
        const result = await query(
            `SELECT u.*, f.logo_url as firm_logo
            FROM users u
            LEFT JOIN firms f ON u.firm_id = f.id
            WHERE u.google_id = $1
            LIMIT 1`,
            [googleId]
        );
        
        return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
        safeLog('error', 'Failed to find user by Google ID', { error: error.message });
        throw createGoogleAuthDbError('findUserByGoogleId', error);
    }
}

/**
 * Find user by email (for linking)
 * @param {string} email - Email address
 * @returns {Promise<Object|null>} User or null
 */
export async function findUserByEmail(email) {
    try {
        const result = await query(
            `SELECT u.*, f.logo_url as firm_logo
            FROM users u
            LEFT JOIN firms f ON u.firm_id = f.id
            WHERE LOWER(u.email) = LOWER($1)
            LIMIT 1`,
            [email]
        );
        
        return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
        safeLog('error', 'Failed to find user by email', { error: error.message });
        throw createGoogleAuthDbError('findUserByEmail', error);
    }
}

/**
 * Check if user has Google linked
 * @param {string} userId - User ID
 * @returns {Promise<Object>} { linked: boolean, email: string|null }
 */
export async function getGoogleLinkStatus(userId) {
    try {
        const result = await query(
            'SELECT google_id, google_email, google_linked_at FROM users WHERE id = $1',
            [userId]
        );
        
        if (result.rows.length === 0) {
            return { linked: false, email: null };
        }
        
        const user = result.rows[0];
        return {
            linked: !!user.google_id,
            email: user.google_email,
            linkedAt: user.google_linked_at
        };
    } catch (error) {
        safeLog('error', 'Failed to get Google link status', { error: error.message, userId });
        throw createGoogleAuthDbError('getGoogleLinkStatus', error);
    }
}

/**
 * Save Gmail tokens for a user (for email draft creation)
 * Called during SSO login to enable seamless CV email sending
 * @param {string} userId - User ID
 * @param {string} accessToken - Gmail access token
 * @param {string} refreshToken - Gmail refresh token (optional)
 * @param {number} expiresIn - Token expiry in seconds
 * @returns {Promise<boolean>}
 */
export async function saveGmailTokens(userId, accessToken, refreshToken, expiresIn = 3600) {
    // Import encryption functions dynamically to avoid circular dependencies
    const { encryptToken, calculateTokenExpiry } = await import('../config/oauth.config.js');
    
    try {
        const encryptedAccess = encryptToken(accessToken);
        const encryptedRefresh = refreshToken ? encryptToken(refreshToken) : null;
        const hasRefreshToken = !!refreshToken;
        const expiresAt = calculateTokenExpiry(expiresIn, hasRefreshToken);
        
        // Check if user already has Gmail connection
        const existing = await query(
            'SELECT id FROM user_mail_tokens WHERE user_id = $1 AND provider = $2',
            [userId, 'gmail']
        );
        
        if (existing.rows.length > 0) {
            // Update existing connection
            await query(
                `UPDATE user_mail_tokens 
                 SET access_token_encrypted = $1, 
                     refresh_token_encrypted = COALESCE($2, refresh_token_encrypted),
                     token_expiry = $3,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE user_id = $4 AND provider = $5`,
                [encryptedAccess, encryptedRefresh, expiresAt, userId, 'gmail']
            );
        } else {
            // Create new connection - get user email first
            const userResult = await query('SELECT email FROM users WHERE id = $1', [userId]);
            const userEmail = userResult.rows[0]?.email || '';
            
            await query(
                `INSERT INTO user_mail_tokens 
                 (user_id, provider, email, access_token_encrypted, refresh_token_encrypted, token_expiry)
                 VALUES ($1, 'gmail', $2, $3, $4, $5)`,
                [userId, userEmail, encryptedAccess, encryptedRefresh, expiresAt]
            );
        }
        
        safeLog('info', 'Gmail tokens saved via Google SSO', { userId });
        return true;
    } catch (error) {
        safeLog('error', 'Failed to save Gmail tokens', { error: error.message, userId });
        return false;
    }
}

/**
 * Destroy googleapis module reference (for graceful shutdown)
 */
export function destroyGoogleAuth() {
    google = null;
    safeLog('info', 'Google SSO auth module destroyed');
}
