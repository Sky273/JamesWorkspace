/**
 * GDPR Mail Routes
 * Handles Gmail OAuth for GDPR consent email sending
 * Uses a GLOBAL token (not per-firm) for all GDPR emails
 * Email templates remain firm-specific
 */

import express from 'express';
import crypto from 'crypto';
import { authenticateToken, requireAdmin } from '../middleware/auth.middleware.js';
import { safeLog } from '../utils/logger.backend.js';
import { gdprMailService } from '../services/mail/gdprMailService.js';

const router = express.Router();

// Server-side OAuth state store (prevents state forgery)
const gdprOauthStates = new Map();
const GDPR_STATE_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

function cleanupExpiredGdprStates() {
    const now = Date.now();
    for (const [state, data] of gdprOauthStates.entries()) {
        if (now - data.createdAt > GDPR_STATE_EXPIRY_MS) {
            gdprOauthStates.delete(state);
        }
    }
}

setInterval(cleanupExpiredGdprStates, 5 * 60 * 1000);

/**
 * @route GET /api/gdpr/mail/status
 * @desc Get GLOBAL GDPR mail connection status
 * @access Private (Admin)
 */
router.get('/status', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const status = await gdprMailService.getConnectionStatus();
        res.json(status);
    } catch (error) {
        safeLog('error', 'Error getting GDPR mail status', { error: error.message });
        res.status(500).json({ error: 'Failed to get mail status' });
    }
});

/**
 * @route GET /api/gdpr/mail/auth-url
 * @desc Get Gmail OAuth URL for GLOBAL GDPR mail configuration
 * @access Private (Admin)
 */
router.get('/auth-url', authenticateToken, requireAdmin, async (req, res) => {
    try {
        // Generate cryptographic nonce for state (prevents forgery)
        const state = crypto.randomBytes(32).toString('hex');
        gdprOauthStates.set(state, {
            userId: req.user.id,
            type: 'gdpr',
            createdAt: Date.now()
        });

        const authUrl = await gdprMailService.getAuthUrl(state);
        res.json({ authUrl });
    } catch (error) {
        safeLog('error', 'Error getting GDPR auth URL', { error: error.message });
        res.status(500).json({ error: 'Failed to get auth URL' });
    }
});

/**
 * @route GET /api/gdpr/mail/callback
 * @desc Handle Gmail OAuth callback for GLOBAL GDPR mail
 * @access Public (OAuth callback)
 */
router.get('/callback', async (req, res) => {
    try {
        const { code, state } = req.query;
        
        if (!code || !state) {
            return res.status(400).send('Missing code or state parameter');
        }

        // Validate state against server-side store (prevents forgery)
        if (!gdprOauthStates.has(state)) {
            safeLog('warn', 'Invalid GDPR OAuth state - possible forgery attempt');
            return res.status(400).send('Invalid or expired state parameter');
        }

        const stateData = gdprOauthStates.get(state);
        gdprOauthStates.delete(state);

        // Check state expiry
        if (Date.now() - stateData.createdAt > GDPR_STATE_EXPIRY_MS) {
            return res.status(400).send('OAuth state expired, please try again');
        }

        // Exchange code for GLOBAL token (no firmId needed)
        await gdprMailService.handleOAuthCallback(code);

        // Close popup with success message (no inline scripts for CSP compliance)
        res.send(`
            <html>
                <body data-callback-type="gdpr-oauth-success">
                    <p>Gmail RGPD connecté avec succès ! Ce compte sera utilisé pour tous les emails de consentement RGPD.</p>
                    <script src="/api/docs/static/oauth-callback.js"></script>
                </body>
            </html>
        `);
    } catch (error) {
        safeLog('error', 'Error in GDPR OAuth callback', { error: error.message });
        res.send(`
            <html>
                <body data-callback-type="gdpr-oauth-error" data-callback-error="${error.message}">
                    <p>Erreur de connexion Gmail: ${error.message}</p>
                    <script src="/api/docs/static/oauth-callback.js"></script>
                </body>
            </html>
        `);
    }
});

/**
 * @route POST /api/gdpr/mail/disconnect
 * @desc Disconnect GLOBAL Gmail for GDPR mail
 * @access Private (Admin)
 */
router.post('/disconnect', authenticateToken, requireAdmin, async (req, res) => {
    try {

        await gdprMailService.disconnect();
        res.json({ success: true });
    } catch (error) {
        safeLog('error', 'Error disconnecting GDPR mail', { error: error.message });
        res.status(500).json({ error: 'Failed to disconnect' });
    }
});

/**
 * @route POST /api/gdpr/mail/test
 * @desc Send a test email via GLOBAL GDPR Gmail
 * @access Private (Admin)
 */
router.post('/test', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { email } = req.body;

        if (!email || typeof email !== 'string') {
            return res.status(400).json({ error: 'Email address required' });
        }

        // Basic email format validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email) || email.length > 254) {
            return res.status(400).json({ error: 'Invalid email address format' });
        }

        await gdprMailService.sendTestEmail(email);
        res.json({ success: true, sentTo: email });
    } catch (error) {
        safeLog('error', 'Error sending test email', { error: error.message });
        res.status(500).json({ error: error.message || 'Failed to send test email' });
    }
});

export default router;
