/**
 * Mail Routes
 * OAuth authentication and email draft creation endpoints
 */

import express from 'express';
import crypto from 'crypto';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { safeLog } from '../utils/logger.backend.js';
import * as mailService from '../services/mail/mailService.js';

const router = express.Router();

// Store OAuth states temporarily (in production, use Redis or database)
const oauthStates = new Map();
const STATE_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Clean up expired OAuth states
 */
function cleanupExpiredStates() {
    const now = Date.now();
    for (const [state, data] of oauthStates.entries()) {
        if (now - data.createdAt > STATE_EXPIRY_MS) {
            oauthStates.delete(state);
        }
    }
}

// Cleanup every 5 minutes
let mailStatesCleanupInterval = setInterval(cleanupExpiredStates, 5 * 60 * 1000);

/**
 * Destroy mail states cleanup interval (for graceful shutdown)
 */
function destroyMailStatesCleanup() {
    if (mailStatesCleanupInterval) {
        clearInterval(mailStatesCleanupInterval);
        mailStatesCleanupInterval = null;
    }
    oauthStates.clear();
}

// ============================================
// GET /api/mail/status - Get connection status
// ============================================
router.get('/status', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id || req.user.userId;
        const status = await mailService.getConnectionStatus(userId);
        return res.json(status);
    } catch (error) {
        safeLog('error', 'Error getting mail status', { error: error.message });
        return res.status(500).json({ error: 'Failed to get mail status' });
    }
});

// ============================================
// GET /api/mail/auth/gmail - Initiate Gmail OAuth
// ============================================
router.get('/auth/gmail', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id || req.user.userId;
        
        // Generate CSRF state
        const state = crypto.randomBytes(32).toString('hex');
        oauthStates.set(state, {
            userId,
            provider: 'gmail',
            createdAt: Date.now()
        });
        
        // Get authorization URL
        const authUrl = mailService.getAuthUrl('gmail', state);
        
        safeLog('info', 'Gmail OAuth initiated', { userId });
        
        return res.json({ authUrl });
    } catch (error) {
        safeLog('error', 'Error initiating Gmail OAuth', { error: error.message });
        return res.status(500).json({ error: 'Failed to initiate Gmail authentication' });
    }
});

// ============================================
// GET /api/mail/callback/gmail - Gmail OAuth callback
// ============================================
router.get('/callback/gmail', async (req, res) => {
    try {
        const { code, state, error: oauthError } = req.query;
        
        // Get frontend URL from environment
        const frontendUrl = process.env.FRONTEND_URL || process.env.VITE_APP_URL || 'http://localhost:5173';
        
        // Check for OAuth error
        if (oauthError) {
            safeLog('warn', 'Gmail OAuth error', { error: oauthError });
            return res.redirect(`${frontendUrl}/resumes?mail_error=${encodeURIComponent(oauthError)}`);
        }
        
        // Validate state
        if (!state || !oauthStates.has(state)) {
            safeLog('warn', 'Invalid OAuth state');
            return res.redirect(`${frontendUrl}/resumes?mail_error=invalid_state`);
        }
        
        const stateData = oauthStates.get(state);
        oauthStates.delete(state);
        
        // Check state expiry
        if (Date.now() - stateData.createdAt > STATE_EXPIRY_MS) {
            return res.redirect(`${frontendUrl}/resumes?mail_error=state_expired`);
        }
        
        // Exchange code for tokens
        const result = await mailService.handleOAuthCallback('gmail', code, stateData.userId);
        
        safeLog('info', 'Gmail OAuth successful', { userId: stateData.userId, email: result.email });
        
        // Redirect back to app with success
        return res.redirect(`${frontendUrl}/resumes?mail_connected=gmail&email=${encodeURIComponent(result.email)}`);
    } catch (error) {
        safeLog('error', 'Gmail OAuth callback error', { error: error.message });
        const frontendUrl = process.env.FRONTEND_URL || process.env.VITE_APP_URL || 'http://localhost:5173';
        return res.redirect(`${frontendUrl}/resumes?mail_error=${encodeURIComponent(error.message)}`);
    }
});

// ============================================
// POST /api/mail/draft - Create email draft
// ============================================
router.post('/draft', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id || req.user.userId;
        const { to, subject, body, pdfBase64, pdfFilename, provider = 'gmail' } = req.body;
        
        // Validate required fields
        if (!to) {
            return res.status(400).json({ error: 'Recipient email (to) is required' });
        }
        if (!subject) {
            return res.status(400).json({ error: 'Subject is required' });
        }
        
        // Convert base64 PDF to buffer if provided
        let attachment = null;
        let attachmentName = pdfFilename || 'CV.pdf';
        if (pdfBase64) {
            attachment = Buffer.from(pdfBase64, 'base64');
        }
        
        // Create draft
        const result = await mailService.createDraft(userId, {
            provider,
            to,
            subject,
            body: body || '',
            attachment,
            attachmentName
        });
        
        safeLog('info', 'Email draft created via API', { userId, to, subject });
        
        return res.json({
            success: true,
            draftId: result.draftId,
            webLink: result.webLink,
            message: 'Draft created successfully'
        });
    } catch (error) {
        safeLog('error', 'Error creating email draft', { error: error.message });
        
        // Check if it's an auth error
        if (error.message.includes('connect') || error.message.includes('token')) {
            return res.status(401).json({ 
                error: error.message,
                needsReauth: true 
            });
        }
        
        return res.status(500).json({ error: error.message || 'Failed to create draft' });
    }
});

// ============================================
// DELETE /api/mail/disconnect - Disconnect provider
// ============================================
router.delete('/disconnect', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id || req.user.userId;
        const { provider = 'gmail' } = req.query;
        
        await mailService.disconnect(userId, provider);
        
        return res.json({ success: true, message: 'Mail provider disconnected' });
    } catch (error) {
        safeLog('error', 'Error disconnecting mail', { error: error.message });
        return res.status(500).json({ error: 'Failed to disconnect mail provider' });
    }
});

export default router;
export { destroyMailStatesCleanup };
