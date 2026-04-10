/**
 * Consent Routes
 * API endpoints for GDPR consent management
 * Includes both authenticated routes and public consent response routes
 */

import express from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.middleware.js';
import { validateBody, validateParams, initializeConsentSchema, normalizeRequestBodyAliases, respondConsentSchema } from '../utils/validation.js';
import { safeLog } from '../utils/logger.backend.js';
import { getResumeForAccessCheck } from '../services/resumes.service.js';
import { getUserFirmId } from '../utils/firmHelpers.js';
import {
    initializeConsent,
    sendConsentRequest,
    validateConsentToken,
    recordConsentResponse,
    getConsentStatus,
    resendConsentRequest,
    markConsentError
} from '../services/consent.service.js';
import { runAllChecks } from '../services/scheduler.service.js';

const router = express.Router();

function getAuthenticatedConsentErrorResponse(action) {
    switch (action) {
    case 'initialize':
        return { status: 400, body: { error: 'Failed to initialize consent' } };
    case 'send':
        return { status: 400, body: { error: 'Failed to send consent request' } };
    case 'resend':
        return { status: 400, body: { error: 'Failed to resend consent request' } };
    case 'status':
        return { status: 400, body: { error: 'Failed to get consent status' } };
    default:
        return { status: 400, body: { error: 'Consent request failed' } };
    }
}

async function assertResumeAccess(req, res, resumeId) {
    const resume = await getResumeForAccessCheck(resumeId);

    if (!resume) {
        res.status(404).json({ error: 'Resume not found' });
        return null;
    }

    if (req.user?.role === 'admin') {
        return resume;
    }

    const userFirmId = await getUserFirmId(req);
    if (!userFirmId || !resume.firm_id || resume.firm_id !== userFirmId) {
        res.status(403).json({ error: 'Access denied' });
        return null;
    }

    return resume;
}

function normalizeConsentInitializationPayload(payload = {}) {
    const normalized = normalizeRequestBodyAliases(payload);

    return {
        ...normalized,
        resumeId: normalized.resumeId,
        profileType: normalized.profileType,
        candidateName: normalized.candidateName,
        candidateEmail: normalized.candidateEmail
    };
}

// ============================================
// AUTHENTICATED ROUTES (require login)
// ============================================

/**
 * POST /api/consent/initialize
 * Initialize consent for a resume
 */
router.post('/initialize', authenticateToken, validateBody(initializeConsentSchema), async (req, res) => {
    try {
        const normalizedPayload = normalizeConsentInitializationPayload(req.body);
        const { resumeId, profileType, candidateName, candidateEmail } = normalizedPayload;

        if (!resumeId) {
            return res.status(400).json({ error: 'Resume ID is required' });
        }
        if (!profileType) {
            return res.status(400).json({ error: 'Profile type is required' });
        }
        if (!candidateName) {
            return res.status(400).json({ error: 'Candidate name is required' });
        }

        const resume = await assertResumeAccess(req, res, resumeId);
        if (!resume) {
            return;
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
        const failure = getAuthenticatedConsentErrorResponse('initialize');
        res.status(failure.status).json(failure.body);
    }
});

/**
 * POST /api/consent/:resumeId/send
 * Send consent request email
 */
router.post('/:resumeId/send', authenticateToken, validateParams('resumeId'), async (req, res) => {
    try {
        const { resumeId } = req.params;
        const resume = await assertResumeAccess(req, res, resumeId);

        if (!resume) {
            return;
        }

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
            await markConsentError(req.params.resumeId);
            safeLog('info', 'Consent status set to error after send failure', { resumeId: req.params.resumeId });
        } catch (updateError) {
            safeLog('error', 'Failed to update consent status to error', { error: updateError.message });
        }
        
        const failure = getAuthenticatedConsentErrorResponse('send');
        res.status(failure.status).json(failure.body);
    }
});

/**
 * POST /api/consent/:resumeId/resend
 * Resend consent request email with new token
 */
router.post('/:resumeId/resend', authenticateToken, validateParams('resumeId'), async (req, res) => {
    try {
        const { resumeId } = req.params;
        const resume = await assertResumeAccess(req, res, resumeId);

        if (!resume) {
            return;
        }

        const result = await resendConsentRequest(resumeId);

        res.json({
            success: true,
            message: 'Consent request email resent',
            sentTo: result.sentTo
        });
    } catch (error) {
        safeLog('error', 'Error resending consent request', { error: error.message, resumeId: req.params.resumeId });
        // Note: resendConsentRequest already marks consent as 'error' internally
        const failure = getAuthenticatedConsentErrorResponse('resend');
        res.status(failure.status).json(failure.body);
    }
});

/**
 * GET /api/consent/:resumeId/status
 * Get consent status for a resume
 */
router.get('/:resumeId/status', authenticateToken, validateParams('resumeId'), async (req, res) => {
    try {
        const { resumeId } = req.params;
        const resume = await assertResumeAccess(req, res, resumeId);

        if (!resume) {
            return;
        }

        const status = await getConsentStatus(resumeId);

        res.json({
            success: true,
            consent: status
        });
    } catch (error) {
        safeLog('error', 'Error getting consent status', { error: error.message });
        const failure = getAuthenticatedConsentErrorResponse('status');
        res.status(failure.status).json(failure.body);
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
router.post('/respond/:token', validateBody(respondConsentSchema), async (req, res) => {
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
