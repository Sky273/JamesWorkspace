/**
 * GDPR Mail Routes
 * Handles Gmail OAuth for GDPR consent email sending
 * Uses a GLOBAL token (not per-firm) for all GDPR emails
 * Email templates remain firm-specific
 */

import express from 'express';
import crypto from 'crypto';
import { authenticateToken, requireAdmin } from '../middleware/auth.middleware.js';
import { validateBody, gdprMailConfigSchema, gdprMailTestSchema } from '../utils/validation.js';
import { safeLog } from '../utils/logger.backend.js';
import { gdprMailService } from '../services/mail/gdprMailService.js';
import {
    setGdprMailOauthState,
    hasGdprMailOauthState,
    takeGdprMailOauthState
} from '../services/gdprMailOauthState.service.js';

const router = express.Router();

const GDPR_STATE_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const GDPR_CALLBACK_ERROR_CODE = 'gdpr_mail_callback_failed';

function getTrustedFrontendOrigin() {
    const frontendUrl = process.env.FRONTEND_URL || process.env.VITE_APP_URL || 'http://localhost:5173';
    try {
        return new URL(frontendUrl).origin;
    } catch {
        return 'http://localhost:5173';
    }
}

function escapeHtmlAttribute(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

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

router.get('/config', authenticateToken, requireAdmin, async (_req, res) => {
    try {
        const config = await gdprMailService.getMailConfiguration();
        res.json(config);
    } catch (error) {
        safeLog('error', 'Error getting GDPR mail config', { error: error.message });
        res.status(500).json({ error: 'Failed to get mail config' });
    }
});

router.put('/config', authenticateToken, requireAdmin, validateBody(gdprMailConfigSchema), async (req, res) => {
    try {
        const config = await gdprMailService.updateMailConfiguration(req.body);
        res.json(config);
    } catch (error) {
        safeLog('error', 'Error updating GDPR mail config', { error: error.message });
        res.status(500).json({ error: 'Failed to update mail config' });
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
        setGdprMailOauthState(state, {
            userId: req.user.id,
            type: 'gdpr',
            createdAt: Date.now()
        });

        const authUrl = await gdprMailService.getAuthUrl(state);
        res.json({ authUrl });
    } catch (error) {
        if (error?.code === 'MAIL_PROVIDER_OAUTH_UNAVAILABLE') {
            return res.status(400).json({ error: error.message });
        }
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
        if (!hasGdprMailOauthState(state)) {
            safeLog('warn', 'Invalid GDPR OAuth state - possible forgery attempt');
            return res.status(400).send('Invalid or expired state parameter');
        }

        const stateData = takeGdprMailOauthState(state);

        // Check state expiry
        if (Date.now() - stateData.createdAt > GDPR_STATE_EXPIRY_MS) {
            return res.status(400).send('OAuth state expired, please try again');
        }

        // Exchange code for GLOBAL token (no firmId needed)
        await gdprMailService.handleOAuthCallback(code);
        const targetOrigin = escapeHtmlAttribute(getTrustedFrontendOrigin());

        // Close popup with success message (no inline scripts for CSP compliance)
        res.send(`
            <html>
                <body data-callback-type="gdpr-oauth-success" data-target-origin="${targetOrigin}">
                    <p>Gmail RGPD connecte avec succes. Ce compte sera utilise pour tous les emails de consentement RGPD.</p>
                    <script src="/api/docs/static/oauth-callback.js"></script>
                </body>
            </html>
        `);
    } catch (error) {
        safeLog('error', 'Error in GDPR OAuth callback', { error: error.message });
        const targetOrigin = escapeHtmlAttribute(getTrustedFrontendOrigin());
        res.send(`
            <html>
                <body data-callback-type="gdpr-oauth-error" data-callback-error="${GDPR_CALLBACK_ERROR_CODE}" data-target-origin="${targetOrigin}">
                    <p>Erreur de connexion Gmail. Veuillez reessayer.</p>
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
        if (error?.code === 'MAIL_PROVIDER_DISCONNECT_UNAVAILABLE') {
            return res.status(400).json({ error: error.message });
        }
        safeLog('error', 'Error disconnecting GDPR mail', { error: error.message });
        res.status(500).json({ error: 'Failed to disconnect' });
    }
});

/**
 * @route POST /api/gdpr/mail/test
 * @desc Send a test email via GLOBAL GDPR Gmail
 * @access Private (Admin)
 */
router.post('/test', authenticateToken, requireAdmin, validateBody(gdprMailTestSchema), async (req, res) => {
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
        res.status(500).json({ error: 'Failed to send test email' });
    }
});

export default router;
