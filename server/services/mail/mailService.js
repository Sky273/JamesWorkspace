/**
 * Mail Service
 * Orchestrates email operations for CV SENDING (draft creation)
 * 
 * IMPORTANT: This service is DEDICATED to CV email sending.
 * It stores tokens at USER level (not firm level).
 * 
 * SEPARATION OF CONCERNS:
 * - SSO Authentication: googleAuth.service.js (no token storage)
 * - CV Email Sending: THIS SERVICE (user_mail_tokens table)
 * - GDPR Consent Emails: gdprMailService.js (firm_gdpr_mail_tokens table)
 * 
 * Each service has its own:
 * - Redirect URI (GOOGLE_REDIRECT_URI → /api/mail/callback/gmail)
 * - Scopes (gmail.compose for draft creation)
 * - Token storage (user_mail_tokens)
 * - OAuth2 client instance (via gmailProvider)
 * 
 * REFRESH TOKEN HANDLING:
 * - Tokens are automatically refreshed when expired
 * - Refresh tokens are stored encrypted in database
 * - If refresh fails, user is prompted to reconnect
 */

import { query } from '../../config/database.js';
import { encryptToken, decryptToken, calculateTokenExpiry, isTokenExpired } from '../../config/oauth.config.js';
import { gmailProvider } from './gmailProvider.js';
import { safeLog } from '../../utils/logger.backend.js';

// Available providers
const providers = {
    gmail: gmailProvider
    // outlook: outlookProvider (future)
};

/**
 * Get provider by name
 * @param {string} providerName 
 * @returns {Object}
 */
export function getProvider(providerName = 'gmail') {
    const provider = providers[providerName];
    if (!provider) {
        throw new Error(`Unknown mail provider: ${providerName}`);
    }
    return provider;
}

/**
 * Get OAuth authorization URL for a provider
 * @param {string} providerName 
 * @param {string} state - CSRF state
 * @returns {Promise<string>}
 */
export async function getAuthUrl(providerName, state) {
    const provider = getProvider(providerName);
    return await provider.getAuthUrl(state);
}

/**
 * Handle OAuth callback - exchange code and store tokens
 * @param {string} providerName 
 * @param {string} code - Authorization code
 * @param {string} userId - User ID
 * @returns {Promise<Object>}
 */
export async function handleOAuthCallback(providerName, code, userId) {
    const provider = getProvider(providerName);
    
    // Exchange code for tokens
    const authResult = await provider.exchangeCode(code);
    
    // Encrypt tokens for storage
    const accessTokenEncrypted = encryptToken(authResult.accessToken);
    const refreshTokenEncrypted = authResult.refreshToken 
        ? encryptToken(authResult.refreshToken) 
        : null;
    const tokenExpiry = calculateTokenExpiry(authResult.expiresIn);
    
    // Upsert tokens in database
    await query(`
        INSERT INTO user_mail_tokens (user_id, provider, access_token_encrypted, refresh_token_encrypted, token_expiry, email)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (user_id, provider) 
        DO UPDATE SET 
            access_token_encrypted = EXCLUDED.access_token_encrypted,
            refresh_token_encrypted = COALESCE(EXCLUDED.refresh_token_encrypted, user_mail_tokens.refresh_token_encrypted),
            token_expiry = EXCLUDED.token_expiry,
            email = EXCLUDED.email,
            updated_at = CURRENT_TIMESTAMP
    `, [userId, providerName, accessTokenEncrypted, refreshTokenEncrypted, tokenExpiry, authResult.email]);
    
    safeLog('info', 'OAuth tokens stored', { userId, provider: providerName, email: authResult.email });
    
    return {
        email: authResult.email,
        provider: providerName
    };
}

/**
 * Get user's mail connection status
 * @param {string} userId 
 * @returns {Promise<Object>}
 */
export async function getConnectionStatus(userId) {
    const result = await query(`
        SELECT provider, email, token_expiry, updated_at
        FROM user_mail_tokens
        WHERE user_id = $1
    `, [userId]);
    
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
 * Get valid access token for user (refreshes if needed)
 * @param {string} userId 
 * @param {string} providerName 
 * @returns {Promise<string>}
 */
export async function getAccessToken(userId, providerName = 'gmail') {
    const result = await query(`
        SELECT access_token_encrypted, refresh_token_encrypted, token_expiry
        FROM user_mail_tokens
        WHERE user_id = $1 AND provider = $2
    `, [userId, providerName]);
    
    if (result.rows.length === 0) {
        throw new Error('No mail connection found. Please connect your email first.');
    }
    
    const tokenData = result.rows[0];
    const expired = isTokenExpired(tokenData.token_expiry);
    
    if (!expired) {
        return decryptToken(tokenData.access_token_encrypted);
    }
    
    // Token expired - try to refresh
    if (!tokenData.refresh_token_encrypted) {
        throw new Error('Token expired and no refresh token available. Please reconnect.');
    }
    
    const refreshToken = decryptToken(tokenData.refresh_token_encrypted);
    const provider = getProvider(providerName);
    
    try {
        const newTokens = await provider.refreshAccessToken(refreshToken);
        
        // Update stored tokens
        const newAccessTokenEncrypted = encryptToken(newTokens.accessToken);
        const newRefreshTokenEncrypted = newTokens.refreshToken 
            ? encryptToken(newTokens.refreshToken) 
            : tokenData.refresh_token_encrypted;
        const newExpiry = calculateTokenExpiry(newTokens.expiresIn);
        
        await query(`
            UPDATE user_mail_tokens
            SET access_token_encrypted = $1,
                refresh_token_encrypted = $2,
                token_expiry = $3,
                updated_at = CURRENT_TIMESTAMP
            WHERE user_id = $4 AND provider = $5
        `, [newAccessTokenEncrypted, newRefreshTokenEncrypted, newExpiry, userId, providerName]);
        
        safeLog('info', 'OAuth token refreshed', { userId, provider: providerName });
        
        return newTokens.accessToken;
    } catch (error) {
        safeLog('error', 'Token refresh failed', { userId, provider: providerName, error: error.message });
        throw new Error('Failed to refresh token. Please reconnect your email.');
    }
}

/**
 * Create email draft with attachment
 * @param {string} userId 
 * @param {Object} draftData 
 * @returns {Promise<Object>}
 */
export async function createDraft(userId, draftData) {
    const { provider: providerName = 'gmail', to, subject, body, attachment, attachmentName } = draftData;
    
    // Get valid access token
    const accessToken = await getAccessToken(userId, providerName);
    
    // Get provider and create draft
    const provider = getProvider(providerName);
    
    try {
        const result = await provider.createDraft(accessToken, {
            to,
            subject,
            body: body || '',
            attachment,
            attachmentName
        });
        
        safeLog('info', 'Email draft created', { userId, provider: providerName, to, subject });
        
        return result;
    } catch (error) {
        // Check for insufficient scopes error - invalidate token to force reconnection
        if (error.message?.includes('insufficient authentication scopes') ||
            error.message?.includes('Insufficient Permission') ||
            error.message?.includes('403')) {
            
            safeLog('warn', 'Gmail token has insufficient scopes, invalidating', { userId, provider: providerName });
            
            // Invalidate the token to force user to reconnect with correct scopes
            await query(`
                UPDATE user_mail_tokens
                SET token_expiry = NOW() - INTERVAL '1 day',
                    updated_at = CURRENT_TIMESTAMP
                WHERE user_id = $1 AND provider = $2
            `, [userId, providerName]);
            
            throw new Error('Votre connexion Gmail ne dispose pas des permissions nécessaires. Veuillez reconnecter Gmail pour autoriser la création de brouillons.');
        }
        
        throw error;
    }
}

/**
 * Disconnect mail provider
 * @param {string} userId 
 * @param {string} providerName 
 */
export async function disconnect(userId, providerName = 'gmail') {
    // Get token to revoke
    const result = await query(`
        SELECT access_token_encrypted
        FROM user_mail_tokens
        WHERE user_id = $1 AND provider = $2
    `, [userId, providerName]);
    
    if (result.rows.length > 0) {
        try {
            const accessToken = decryptToken(result.rows[0].access_token_encrypted);
            const provider = getProvider(providerName);
            await provider.revokeToken(accessToken);
        } catch (error) {
            // Log revocation errors but don't fail the disconnect
            safeLog('warn', 'Token revocation failed during disconnect', { 
                userId, 
                provider: providerName, 
                error: error.message 
            });
        }
    }
    
    // Delete from database
    await query(`
        DELETE FROM user_mail_tokens
        WHERE user_id = $1 AND provider = $2
    `, [userId, providerName]);
    
    safeLog('info', 'Mail provider disconnected', { userId, provider: providerName });
}

export default {
    getProvider,
    getAuthUrl,
    handleOAuthCallback,
    getConnectionStatus,
    getAccessToken,
    createDraft,
    disconnect
};
