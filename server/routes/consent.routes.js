/**
 * Consent Routes
 * API endpoints for GDPR consent management
 * Includes both authenticated routes and public consent response routes
 */

import express from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.middleware.js';
import { validateParams } from '../utils/validation.js';
import { safeLog } from '../utils/logger.backend.js';
import {
    initializeConsent,
    sendConsentRequest,
    validateConsentToken,
    recordConsentResponse,
    getConsentStatus,
    resendConsentRequest
} from '../services/consent.service.js';
import { runAllChecks } from '../services/scheduler.service.js';

const router = express.Router();

// ============================================
// AUTHENTICATED ROUTES (require login)
// ============================================

/**
 * POST /api/consent/initialize
 * Initialize consent for a resume
 */
router.post('/initialize', authenticateToken, async (req, res) => {
    try {
        const { resumeId, profileType, candidateName, candidateEmail } = req.body;

        if (!resumeId) {
            return res.status(400).json({ error: 'Resume ID is required' });
        }
        if (!profileType) {
            return res.status(400).json({ error: 'Profile type is required' });
        }
        if (!candidateName) {
            return res.status(400).json({ error: 'Candidate name is required' });
        }

        const result = await initializeConsent({
            resumeId,
            profileType,
            candidateName,
            candidateEmail
        });

        res.json({
            success: true,
            consent: result
        });
    } catch (error) {
        safeLog('error', 'Error initializing consent', { error: error.message });
        res.status(400).json({ error: error.message });
    }
});

/**
 * POST /api/consent/:resumeId/send
 * Send consent request email
 */
router.post('/:resumeId/send', authenticateToken, validateParams('resumeId'), async (req, res) => {
    try {
        const { resumeId } = req.params;

        const result = await sendConsentRequest(resumeId);

        res.json({
            success: true,
            message: 'Consent request email sent',
            sentTo: result.sentTo
        });
    } catch (error) {
        safeLog('error', 'Error sending consent request', { error: error.message, resumeId: req.params.resumeId });
        
        // Mark consent as error if email sending fails
        try {
            const { query } = await import('../config/database.js');
            await query(`
                UPDATE resumes 
                SET consent_status = 'error', updated_at = CURRENT_TIMESTAMP
                WHERE id = $1 AND consent_status = 'pending_consent'
            `, [req.params.resumeId]);
            safeLog('info', 'Consent status set to error after send failure', { resumeId: req.params.resumeId });
        } catch (updateError) {
            safeLog('error', 'Failed to update consent status to error', { error: updateError.message });
        }
        
        res.status(400).json({ error: error.message });
    }
});

/**
 * POST /api/consent/:resumeId/resend
 * Resend consent request email with new token
 */
router.post('/:resumeId/resend', authenticateToken, validateParams('resumeId'), async (req, res) => {
    try {
        const { resumeId } = req.params;

        const result = await resendConsentRequest(resumeId);

        res.json({
            success: true,
            message: 'Consent request email resent',
            sentTo: result.sentTo
        });
    } catch (error) {
        safeLog('error', 'Error resending consent request', { error: error.message, resumeId: req.params.resumeId });
        // Note: resendConsentRequest already marks consent as 'error' internally
        res.status(400).json({ error: error.message });
    }
});

/**
 * GET /api/consent/:resumeId/status
 * Get consent status for a resume
 */
router.get('/:resumeId/status', authenticateToken, validateParams('resumeId'), async (req, res) => {
    try {
        const { resumeId } = req.params;

        const status = await getConsentStatus(resumeId);

        res.json({
            success: true,
            consent: status
        });
    } catch (error) {
        safeLog('error', 'Error getting consent status', { error: error.message });
        res.status(400).json({ error: error.message });
    }
});

/**
 * POST /api/consent/run-checks
 * Manually trigger consent checks (admin only)
 */
router.post('/run-checks', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const results = await runAllChecks();

        res.json({
            success: true,
            message: 'Consent checks completed',
            results
        });
    } catch (error) {
        safeLog('error', 'Error running consent checks', { error: error.message });
        res.status(500).json({ error: 'Failed to run consent checks' });
    }
});

// ============================================
// PUBLIC ROUTES (no authentication required)
// ============================================

/**
 * GET /api/consent/respond/:token
 * Get consent request info for public response page
 */
router.get('/respond/:token', async (req, res) => {
    try {
        const { token } = req.params;

        const resume = await validateConsentToken(token);

        if (!resume) {
            return res.status(404).json({ 
                error: 'Invalid consent token',
                code: 'INVALID_TOKEN'
            });
        }

        if (resume.expired) {
            return res.status(410).json({ 
                error: 'This consent request has expired',
                code: 'TOKEN_EXPIRED'
            });
        }

        if (resume.alreadyProcessed) {
            return res.status(409).json({ 
                error: 'This consent request has already been processed',
                code: 'ALREADY_PROCESSED',
                status: resume.consent_status
            });
        }

        // Return info for the consent page (without sensitive data)
        res.json({
            success: true,
            candidateName: resume.candidate_name,
            firmName: resume.firm_name,
            firmLogo: resume.firm_logo
        });
    } catch (error) {
        safeLog('error', 'Error validating consent token', { error: error.message });
        res.status(500).json({ error: 'An error occurred' });
    }
});

/**
 * POST /api/consent/respond/:token
 * Record consent response (accept or refuse)
 */
router.post('/respond/:token', async (req, res) => {
    try {
        const { token } = req.params;
        const { action } = req.body;

        if (!action || !['accept', 'refuse'].includes(action)) {
            return res.status(400).json({ 
                error: 'Action must be "accept" or "refuse"' 
            });
        }

        const accepted = action === 'accept';
        const result = await recordConsentResponse(token, accepted);

        res.json({
            success: true,
            message: accepted 
                ? 'Thank you! Your consent has been recorded.' 
                : 'Your choice has been recorded. Your CV will be deleted.',
            status: result.consent_status,
            retentionUntil: result.retention_until
        });
    } catch (error) {
        safeLog('error', 'Error recording consent response', { error: error.message });
        
        // Provide user-friendly error messages
        if (error.message.includes('expired')) {
            return res.status(410).json({ 
                error: 'This consent request has expired',
                code: 'TOKEN_EXPIRED'
            });
        }
        if (error.message.includes('already been processed')) {
            return res.status(409).json({ 
                error: 'This consent request has already been processed',
                code: 'ALREADY_PROCESSED'
            });
        }
        if (error.message.includes('Invalid')) {
            return res.status(404).json({ 
                error: 'Invalid consent token',
                code: 'INVALID_TOKEN'
            });
        }

        res.status(500).json({ error: 'An error occurred' });
    }
});

export default router;
