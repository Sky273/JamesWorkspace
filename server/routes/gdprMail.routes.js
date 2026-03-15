/**
 * GDPR Mail Routes
 * Handles Gmail OAuth for GDPR consent email sending
 * Uses a GLOBAL token (not per-firm) for all GDPR emails
 * Email templates remain firm-specific
 */

import express from 'express';
import { authenticateToken } from '../middleware/auth.middleware.js';
// Note: query import removed - no longer needed for GLOBAL token approach
import { safeLog } from '../utils/logger.backend.js';
import { gdprMailService } from '../services/mail/gdprMailService.js';

const router = express.Router();

/**
 * @route GET /api/gdpr/mail/status
 * @desc Get GLOBAL GDPR mail connection status
 * @access Private (Admin)
 */
router.get('/status', authenticateToken, async (req, res) => {
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
router.get('/auth-url', authenticateToken, async (req, res) => {
    try {
        // Check if user is admin
        if (req.user.role !== 'admin') {
            return res.status(403).json({ 
                error: 'Only administrators can configure GDPR mail.',
                code: 'ADMIN_REQUIRED'
            });
        }

        // Generate state for callback (no firmId needed - GLOBAL token)
        const state = Buffer.from(JSON.stringify({ 
            userId: req.user.id,
            type: 'gdpr'
        })).toString('base64');

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

        // Decode state
        let stateData;
        try {
            stateData = JSON.parse(Buffer.from(state, 'base64').toString());
        } catch (_e) {
            return res.status(400).send('Invalid state parameter');
        }

        if (stateData.type !== 'gdpr') {
            return res.status(400).send('Invalid state type');
        }

        // Exchange code for GLOBAL token (no firmId needed)
        await gdprMailService.handleOAuthCallback(code);

        // Close popup with success message
        res.send(`
            <html>
                <body>
                    <script>
                        window.opener && window.opener.postMessage({ type: 'gdpr-oauth-success' }, '*');
                        window.close();
                    </script>
                    <p>Gmail RGPD connecté avec succès ! Ce compte sera utilisé pour tous les emails de consentement RGPD.</p>
                </body>
            </html>
        `);
    } catch (error) {
        safeLog('error', 'Error in GDPR OAuth callback', { error: error.message });
        res.send(`
            <html>
                <body>
                    <script>
                        window.opener && window.opener.postMessage({ type: 'gdpr-oauth-error', error: '${error.message}' }, '*');
                        window.close();
                    </script>
                    <p>Erreur de connexion Gmail: ${error.message}</p>
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
router.post('/disconnect', authenticateToken, async (req, res) => {
    try {
        // Check if user is admin
        if (req.user.role !== 'admin') {
            return res.status(403).json({ 
                error: 'Only administrators can disconnect GDPR mail.',
                code: 'ADMIN_REQUIRED'
            });
        }

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
router.post('/test', authenticateToken, async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email address required' });
        }

        await gdprMailService.sendTestEmail(email);
        res.json({ success: true, sentTo: email });
    } catch (error) {
        safeLog('error', 'Error sending test email', { error: error.message });
        res.status(500).json({ error: error.message || 'Failed to send test email' });
    }
});

export default router;
