/**
 * 2FA (Two-Factor Authentication) Routes
 * Handles TOTP setup, verification, and management
 */

import express from 'express';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { safeLog } from '../utils/logger.backend.js';
import {
    generateTotpSecret,
    verifyAndEnable2FA,
    get2FAStatus,
    disable2FA,
    regenerateBackupCodes
} from '../services/totp.service.js';

const router = express.Router();

/**
 * @route GET /api/2fa/status
 * @desc Get 2FA status for current user
 * @access Private
 */
router.get('/status', authenticateToken, async (req, res) => {
    try {
        const status = await get2FAStatus(req.user.id);
        res.json(status);
    } catch (error) {
        safeLog('error', 'Error getting 2FA status', { error: error.message });
        res.status(500).json({ error: 'Failed to get 2FA status' });
    }
});

/**
 * @route POST /api/2fa/setup
 * @desc Generate TOTP secret and QR code for 2FA setup
 * @access Private
 */
router.post('/setup', authenticateToken, async (req, res) => {
    try {
        const { secret, qrCodeDataUrl, backupCodes } = await generateTotpSecret(
            req.user.id,
            req.user.email
        );
        
        res.json({
            secret,
            qrCodeDataUrl,
            backupCodes,
            message: 'Scannez le QR code avec votre application d\'authentification'
        });
    } catch (error) {
        safeLog('error', 'Error setting up 2FA', { error: error.message });
        res.status(500).json({ error: 'Failed to setup 2FA' });
    }
});

/**
 * @route POST /api/2fa/verify
 * @desc Verify TOTP code and enable 2FA
 * @access Private
 */
router.post('/verify', authenticateToken, async (req, res) => {
    try {
        const { code } = req.body;
        
        if (!code || code.length !== 6) {
            return res.status(400).json({ error: 'Code à 6 chiffres requis' });
        }
        
        const result = await verifyAndEnable2FA(req.user.id, code);
        
        if (result.success) {
            res.json(result);
        } else {
            res.status(400).json(result);
        }
    } catch (error) {
        safeLog('error', 'Error verifying 2FA', { error: error.message });
        res.status(500).json({ error: 'Failed to verify 2FA' });
    }
});

/**
 * @route POST /api/2fa/disable
 * @desc Disable 2FA for current user
 * @access Private
 */
router.post('/disable', authenticateToken, async (req, res) => {
    try {
        const { code } = req.body;
        
        if (!code) {
            return res.status(400).json({ error: 'Code requis pour désactiver 2FA' });
        }
        
        const result = await disable2FA(req.user.id, code);
        
        if (result.success) {
            res.json(result);
        } else {
            res.status(400).json(result);
        }
    } catch (error) {
        safeLog('error', 'Error disabling 2FA', { error: error.message });
        res.status(500).json({ error: 'Failed to disable 2FA' });
    }
});

/**
 * @route POST /api/2fa/backup-codes/regenerate
 * @desc Regenerate backup codes
 * @access Private
 */
router.post('/backup-codes/regenerate', authenticateToken, async (req, res) => {
    try {
        const { code } = req.body;
        
        if (!code) {
            return res.status(400).json({ error: 'Code requis pour régénérer les codes de secours' });
        }
        
        const result = await regenerateBackupCodes(req.user.id, code);
        
        if (result.success) {
            res.json(result);
        } else {
            res.status(400).json(result);
        }
    } catch (error) {
        safeLog('error', 'Error regenerating backup codes', { error: error.message });
        res.status(500).json({ error: 'Failed to regenerate backup codes' });
    }
});

export default router;
