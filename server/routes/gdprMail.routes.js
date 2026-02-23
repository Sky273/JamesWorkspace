/**
 * GDPR Mail Routes
 * Handles Gmail OAuth for GDPR consent email sending
 * Separate from user mail tokens - this is firm-level configuration
 */

import express from 'express';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { query } from '../config/database.js';
import { safeLog } from '../utils/logger.backend.js';
import { gdprMailService } from '../services/mail/gdprMailService.js';

const router = express.Router();

/**
 * Helper to get firm_id for user (from token or database)
 */
async function getUserFirmId(user) {
    // First check if firmId is in the token
    if (user.firmId) {
        return user.firmId;
    }
    
    // Otherwise, fetch from database
    const result = await query(`
        SELECT firm_id FROM users WHERE id = $1
    `, [user.id]);
    
    if (result.rows.length > 0 && result.rows[0].firm_id) {
        return result.rows[0].firm_id;
    }
    
    // If user has no firm, try to get the first/default firm
    const firmResult = await query(`
        SELECT id FROM firms ORDER BY created_at ASC LIMIT 1
    `);
    
    if (firmResult.rows.length > 0) {
        return firmResult.rows[0].id;
    }
    
    return null;
}

/**
 * @route GET /api/gdpr/mail/status
 * @desc Get GDPR mail connection status for the firm
 * @access Private (Admin)
 */
router.get('/status', authenticateToken, async (req, res) => {
    try {
        const firmId = await getUserFirmId(req.user);
        if (!firmId) {
            return res.status(400).json({ 
                error: 'No firm found. Please create a firm first.',
                code: 'NO_FIRM'
            });
        }

        const status = await gdprMailService.getConnectionStatus(firmId);
        res.json(status);
    } catch (error) {
        safeLog('error', 'Error getting GDPR mail status', { error: error.message });
        res.status(500).json({ error: 'Failed to get mail status' });
    }
});

/**
 * @route GET /api/gdpr/mail/auth-url
 * @desc Get Gmail OAuth URL for GDPR mail configuration
 * @access Private (Admin)
 */
router.get('/auth-url', authenticateToken, async (req, res) => {
    try {
        const firmId = await getUserFirmId(req.user);
        if (!firmId) {
            return res.status(400).json({ 
                error: 'No firm found. Please create a firm first.',
                code: 'NO_FIRM'
            });
        }

        // Generate state with firmId for callback
        const state = Buffer.from(JSON.stringify({ 
            firmId, 
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
 * @desc Handle Gmail OAuth callback for GDPR mail
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
        } catch (e) {
            return res.status(400).send('Invalid state parameter');
        }

        if (stateData.type !== 'gdpr') {
            return res.status(400).send('Invalid state type');
        }

        // Exchange code for tokens
        await gdprMailService.handleOAuthCallback(code, stateData.firmId);

        // Close popup with success message
        res.send(`
            <html>
                <body>
                    <script>
                        window.opener && window.opener.postMessage({ type: 'gdpr-oauth-success' }, '*');
                        window.close();
                    </script>
                    <p>Gmail connecté avec succès ! Vous pouvez fermer cette fenêtre.</p>
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
 * @desc Disconnect Gmail for GDPR mail
 * @access Private (Admin)
 */
router.post('/disconnect', authenticateToken, async (req, res) => {
    try {
        const firmId = await getUserFirmId(req.user);
        if (!firmId) {
            return res.status(400).json({ 
                error: 'No firm found. Please create a firm first.',
                code: 'NO_FIRM'
            });
        }

        await gdprMailService.disconnect(firmId);
        res.json({ success: true });
    } catch (error) {
        safeLog('error', 'Error disconnecting GDPR mail', { error: error.message });
        res.status(500).json({ error: 'Failed to disconnect' });
    }
});

/**
 * @route POST /api/gdpr/mail/test
 * @desc Send a test email via GDPR Gmail
 * @access Private (Admin)
 */
router.post('/test', authenticateToken, async (req, res) => {
    try {
        const firmId = await getUserFirmId(req.user);
        const { email } = req.body;

        if (!firmId) {
            return res.status(400).json({ 
                error: 'No firm found. Please create a firm first.',
                code: 'NO_FIRM'
            });
        }

        if (!email) {
            return res.status(400).json({ error: 'Email address required' });
        }

        await gdprMailService.sendTestEmail(firmId, email);
        res.json({ success: true, sentTo: email });
    } catch (error) {
        safeLog('error', 'Error sending test email', { error: error.message });
        res.status(500).json({ error: error.message || 'Failed to send test email' });
    }
});

export default router;
