/**
 * TOTP (Time-based One-Time Password) Service
 * Implements 2FA using RFC 6238 TOTP algorithm
 * 
 * Uses speakeasy for reliable TOTP generation/verification
 * Uses qrcode for QR code generation
 */

import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import crypto from 'crypto';
import { query } from '../config/database.js';
import { safeLog } from '../utils/logger.backend.js';

/**
 * Generate a random base32 secret using speakeasy
 * @returns {string} Base32 secret
 */
function generateSecret() {
    const secret = speakeasy.generateSecret({ length: 20 });
    return secret.base32;
}

/**
 * Verify a TOTP token against a secret using speakeasy
 * @param {string} token - The 6-digit token
 * @param {string} secret - The base32 secret
 * @returns {boolean} Whether the token is valid
 */
function verifyToken(token, secret) {
    try {
        const isValid = speakeasy.totp.verify({
            secret: secret,
            encoding: 'base32',
            token: token,
            window: 2 // Allow 2 steps before/after for clock drift (60 seconds)
        });
        return isValid;
    } catch (error) {
        safeLog('error', 'TOTP verification error', { 
            error: error.message,
            stack: error.stack?.substring(0, 200)
        });
        return false;
    }
}

// Encryption key for storing secrets (use same as OAuth tokens)
const ENCRYPTION_KEY = process.env.OAUTH_ENCRYPTION_KEY || process.env.JWT_SECRET;
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';

/**
 * Encrypt a TOTP secret for database storage
 * @param {string} secret - Plain text secret
 * @returns {string} Encrypted secret (iv:authTag:encrypted)
 */
function encryptSecret(secret) {
    const iv = crypto.randomBytes(16);
    const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
    const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
    
    let encrypted = cipher.update(secret, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypt a TOTP secret from database
 * @param {string} encryptedSecret - Encrypted secret (iv:authTag:encrypted)
 * @returns {string} Plain text secret
 */
function decryptSecret(encryptedSecret) {
    const [ivHex, authTagHex, encrypted] = encryptedSecret.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
    
    const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
}

/**
 * Generate a new TOTP secret for a user
 * @param {string} userId - User UUID
 * @param {string} userEmail - User email for QR code label
 * @returns {Promise<{secret: string, qrCodeDataUrl: string, backupCodes: string[]}>}
 */
export async function generateTotpSecret(userId, userEmail) {
    // Generate a new secret
    const secret = generateSecret();
    
    // Generate backup codes (8 codes, 8 characters each)
    const backupCodes = [];
    for (let i = 0; i < 8; i++) {
        backupCodes.push(crypto.randomBytes(4).toString('hex').toUpperCase());
    }
    
    // Create otpauth URL for QR code
    const appName = 'ResumeConverter';
    const otpauthUrl = `otpauth://totp/${encodeURIComponent(appName)}:${encodeURIComponent(userEmail)}?secret=${secret}&issuer=${encodeURIComponent(appName)}&digits=6&period=30`;
    
    // Generate QR code as data URL
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl, {
        width: 256,
        margin: 2,
        color: {
            dark: '#000000',
            light: '#ffffff'
        }
    });
    
    // Store pending secret (not yet verified)
    const encryptedSecret = encryptSecret(secret);
    const encryptedBackupCodes = encryptSecret(JSON.stringify(backupCodes));
    
    await query(`
        UPDATE users 
        SET totp_pending_secret = $1,
            totp_pending_backup_codes = $2,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
    `, [encryptedSecret, encryptedBackupCodes, userId]);
    
    safeLog('info', '2FA setup initiated', { userId });
    
    return {
        secret, // Return plain secret for manual entry
        qrCodeDataUrl,
        backupCodes
    };
}

/**
 * Verify TOTP code and enable 2FA for user
 * @param {string} userId - User UUID
 * @param {string} code - 6-digit TOTP code
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function verifyAndEnable2FA(userId, code) {
    // Get pending secret
    const result = await query(`
        SELECT totp_pending_secret, totp_pending_backup_codes
        FROM users
        WHERE id = $1
    `, [userId]);
    
    if (result.rows.length === 0) {
        return { success: false, message: 'Utilisateur non trouvé' };
    }
    
    const { totp_pending_secret, totp_pending_backup_codes: _totp_pending_backup_codes } = result.rows[0];
    
    if (!totp_pending_secret) {
        return { success: false, message: 'Aucune configuration 2FA en attente' };
    }
    
    // Decrypt and verify using speakeasy
    const secret = decryptSecret(totp_pending_secret);
    const isValid = verifyToken(code, secret);
    
    if (!isValid) {
        safeLog('warn', '2FA verification failed - invalid code', { userId });
        return { success: false, message: 'Code invalide. Veuillez réessayer.' };
    }
    
    // Enable 2FA - move pending to active
    await query(`
        UPDATE users 
        SET totp_secret = totp_pending_secret,
            totp_backup_codes = totp_pending_backup_codes,
            totp_enabled = true,
            totp_pending_secret = NULL,
            totp_pending_backup_codes = NULL,
            totp_enabled_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
    `, [userId]);
    
    safeLog('info', '2FA enabled successfully', { userId });
    
    return { success: true, message: '2FA activé avec succès' };
}

/**
 * Verify a TOTP code for login
 * @param {string} userId - User UUID
 * @param {string} code - 6-digit TOTP code or backup code
 * @returns {Promise<{valid: boolean, usedBackupCode: boolean}>}
 */
export async function verifyTotpCode(userId, code) {
    const result = await query(`
        SELECT totp_secret, totp_backup_codes, totp_enabled
        FROM users
        WHERE id = $1
    `, [userId]);
    
    if (result.rows.length === 0 || !result.rows[0].totp_enabled) {
        return { valid: false, usedBackupCode: false };
    }
    
    const { totp_secret, totp_backup_codes } = result.rows[0];
    
    if (!totp_secret) {
        return { valid: false, usedBackupCode: false };
    }
    
    // Try TOTP code first
    const secret = decryptSecret(totp_secret);
    const isValidTotp = verifyToken(code, secret);
    
    if (isValidTotp) {
        safeLog('debug', '2FA verification successful (TOTP)', { userId });
        return { valid: true, usedBackupCode: false };
    }
    
    // Try backup codes
    if (totp_backup_codes) {
        const backupCodes = JSON.parse(decryptSecret(totp_backup_codes));
        const normalizedCode = code.toUpperCase().replace(/\s/g, '');
        const codeIndex = backupCodes.indexOf(normalizedCode);
        
        if (codeIndex !== -1) {
            // Remove used backup code
            backupCodes.splice(codeIndex, 1);
            const encryptedBackupCodes = encryptSecret(JSON.stringify(backupCodes));
            
            await query(`
                UPDATE users 
                SET totp_backup_codes = $1,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $2
            `, [encryptedBackupCodes, userId]);
            
            safeLog('warn', '2FA verification successful (backup code used)', { 
                userId, 
                remainingBackupCodes: backupCodes.length 
            });
            
            return { valid: true, usedBackupCode: true };
        }
    }
    
    safeLog('warn', '2FA verification failed', { userId });
    return { valid: false, usedBackupCode: false };
}

/**
 * Check if user has 2FA enabled
 * @param {string} userId - User UUID
 * @returns {Promise<boolean>}
 */
export async function is2FAEnabled(userId) {
    const result = await query(`
        SELECT totp_enabled FROM users WHERE id = $1
    `, [userId]);
    
    return result.rows.length > 0 && result.rows[0].totp_enabled === true;
}

/**
 * Get 2FA status for user
 * @param {string} userId - User UUID
 * @returns {Promise<{enabled: boolean, enabledAt: Date|null, backupCodesRemaining: number}>}
 */
export async function get2FAStatus(userId) {
    const result = await query(`
        SELECT totp_enabled, totp_enabled_at, totp_backup_codes
        FROM users
        WHERE id = $1
    `, [userId]);
    
    if (result.rows.length === 0) {
        return { enabled: false, enabledAt: null, backupCodesRemaining: 0 };
    }
    
    const { totp_enabled, totp_enabled_at, totp_backup_codes } = result.rows[0];
    
    let backupCodesRemaining = 0;
    if (totp_backup_codes) {
        try {
            const codes = JSON.parse(decryptSecret(totp_backup_codes));
            backupCodesRemaining = codes.length;
        } catch (_e) {
            // Ignore decryption errors
        }
    }
    
    return {
        enabled: totp_enabled === true,
        enabledAt: totp_enabled_at,
        backupCodesRemaining
    };
}

/**
 * Disable 2FA for user
 * @param {string} userId - User UUID
 * @param {string} code - Current TOTP code to confirm
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function disable2FA(userId, code) {
    // Verify current code first
    const verification = await verifyTotpCode(userId, code);
    
    if (!verification.valid) {
        return { success: false, message: 'Code invalide. Veuillez réessayer.' };
    }
    
    // Disable 2FA
    await query(`
        UPDATE users 
        SET totp_enabled = false,
            totp_secret = NULL,
            totp_backup_codes = NULL,
            totp_pending_secret = NULL,
            totp_pending_backup_codes = NULL,
            totp_enabled_at = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
    `, [userId]);
    
    safeLog('info', '2FA disabled', { userId });
    
    return { success: true, message: '2FA désactivé avec succès' };
}

/**
 * Regenerate backup codes
 * @param {string} userId - User UUID
 * @param {string} code - Current TOTP code to confirm
 * @returns {Promise<{success: boolean, backupCodes?: string[], message: string}>}
 */
export async function regenerateBackupCodes(userId, code) {
    // Verify current code first
    const verification = await verifyTotpCode(userId, code);
    
    if (!verification.valid) {
        return { success: false, message: 'Code invalide. Veuillez réessayer.' };
    }
    
    // Generate new backup codes
    const backupCodes = [];
    for (let i = 0; i < 8; i++) {
        backupCodes.push(crypto.randomBytes(4).toString('hex').toUpperCase());
    }
    
    const encryptedBackupCodes = encryptSecret(JSON.stringify(backupCodes));
    
    await query(`
        UPDATE users 
        SET totp_backup_codes = $1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
    `, [encryptedBackupCodes, userId]);
    
    safeLog('info', '2FA backup codes regenerated', { userId });
    
    return { 
        success: true, 
        backupCodes,
        message: 'Nouveaux codes de secours générés' 
    };
}

export default {
    generateTotpSecret,
    verifyAndEnable2FA,
    verifyTotpCode,
    is2FAEnabled,
    get2FAStatus,
    disable2FA,
    regenerateBackupCodes
};
