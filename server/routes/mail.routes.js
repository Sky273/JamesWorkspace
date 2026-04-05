/**
 * Mail Routes
 * OAuth authentication and email draft creation endpoints
 */

import express from 'express';
import crypto from 'crypto';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { validateBody, createMailDraftSchema } from '../utils/validation.js';
import { safeLog } from '../utils/logger.backend.js';
import { getUserFirmId } from '../utils/firmHelpers.js';
import * as mailService from '../services/mail/mailService.js';
import * as emailTemplatesService from '../services/emailTemplates.service.js';
import * as submissionsService from '../services/resumeSubmissions.service.js';
import {
    setMailOauthState,
    takeMailOauthState
} from '../services/mailOauthState.service.js';

const router = express.Router();

const STATE_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const MAIL_CALLBACK_ERROR_CODE = 'mail_callback_failed';

function createMailRouteHandler(logMessage, errorMessage, handler) {
    return async (req, res) => {
        try {
            await handler(req, res);
        } catch (error) {
            safeLog('error', logMessage, { error: error.message });
            return res.status(500).json({ error: errorMessage });
        }
    };
}

function getAuthenticatedUserId(req) {
    return req.user.id || req.user.userId;
}

function getFrontendUrl() {
    return process.env.FRONTEND_URL || process.env.VITE_APP_URL || 'http://localhost:5173';
}

async function validateSubmissionTracking({ userFirmId, resumeId, clientId, contactId, missionId }) {
    if (!userFirmId) {
        return { ok: false, status: 403, error: 'No firm association' };
    }

    if (!resumeId || !clientId || !contactId) {
        return {
            ok: false,
            status: 400,
            error: 'resumeId, clientId and contactId are required to track a submission'
        };
    }

    const resumeCheck = await submissionsService.validateResume(resumeId, userFirmId);
    if (!resumeCheck.exists) {
        return { ok: false, status: 400, error: 'Resume not found' };
    }
    if (!resumeCheck.firmMatch) {
        return { ok: false, status: 403, error: 'Resume does not belong to your firm' };
    }

    const clientCheck = await submissionsService.validateClient(clientId, userFirmId);
    if (!clientCheck.exists) {
        return { ok: false, status: 400, error: 'Client not found' };
    }
    if (!clientCheck.firmMatch) {
        return { ok: false, status: 403, error: 'Client does not belong to your firm' };
    }

    const contactValid = await submissionsService.validateContact(contactId, clientId);
    if (!contactValid) {
        return { ok: false, status: 400, error: 'Contact not found or does not belong to this client' };
    }

    if (missionId) {
        const missionCheck = await submissionsService.validateMission(missionId, userFirmId);
        if (!missionCheck.exists) {
            return { ok: false, status: 400, error: 'Mission not found' };
        }
        if (!missionCheck.firmMatch) {
            return { ok: false, status: 403, error: 'Mission does not belong to your firm' };
        }
    }

    return { ok: true };
}

async function resolveTemplateDraftContext({ templateId, templateContext, userId, userFirmId }) {
    if (!templateId) {
        return { ok: true };
    }

    if (!templateContext) {
        return { ok: false, status: 400, error: 'Template context is required when templateId is provided' };
    }

    const template = await emailTemplatesService.getTemplate(templateId);
    if (!template) {
        return { ok: false, status: 404, error: 'Template not found' };
    }

    if (!template.is_system && template.firm_id !== userFirmId) {
        return { ok: false, status: 403, error: 'Template does not belong to your firm' };
    }

    const dbUser = await mailService.getUserWithFirmData(userId);
    const resolvedTemplateContext = { ...templateContext };

    if (dbUser) {
        resolvedTemplateContext.user = {
            ...resolvedTemplateContext.user,
            name: dbUser.name || resolvedTemplateContext.user?.name || '',
            email: dbUser.email || resolvedTemplateContext.user?.email || '',
            jobTitle: dbUser.job_title || resolvedTemplateContext.user?.jobTitle || '',
            phone: dbUser.phone || resolvedTemplateContext.user?.phone || ''
        };
        resolvedTemplateContext.firm = {
            ...resolvedTemplateContext.firm,
            name: dbUser.firm_name || resolvedTemplateContext.firm?.name || '',
            logo: dbUser.firm_logo || resolvedTemplateContext.firm?.logo || ''
        };
        safeLog('debug', 'Enriched template context with DB user data', {
            userName: resolvedTemplateContext.user.name,
            userJobTitle: resolvedTemplateContext.user.jobTitle,
            userPhone: resolvedTemplateContext.user.phone
        });
    }

    try {
        safeLog('info', 'Rendering email template', { templateId });
        const rendered = await emailTemplatesService.renderTemplate(templateId, resolvedTemplateContext);
        return {
            ok: true,
            subject: rendered.subject,
            body: rendered.html,
            html: rendered.html
        };
    } catch (templateError) {
        safeLog('error', 'Failed to render template', { error: templateError.message, stack: templateError.stack, templateId });
        return { ok: false, status: 400, error: 'Failed to render template' };
    }
}

// ============================================
// GET /api/mail/status - Get connection status
// ============================================
router.get('/status', authenticateToken, createMailRouteHandler(
    'Error getting mail status',
    'Failed to get mail status',
    async (req, res) => {
        const status = await mailService.getConnectionStatus(getAuthenticatedUserId(req));
        return res.json(status);
    }
));

// ============================================
// GET /api/mail/auth/gmail - Initiate Gmail OAuth
// ============================================
router.get('/auth/gmail', authenticateToken, createMailRouteHandler(
    'Error initiating Gmail OAuth',
    'Failed to initiate Gmail authentication',
    async (req, res) => {
        const userId = getAuthenticatedUserId(req);

        // Generate CSRF state
        const state = crypto.randomBytes(32).toString('hex');
        setMailOauthState(state, {
            userId,
            provider: 'gmail',
            createdAt: Date.now()
        });

        // Get authorization URL (async due to lazy loading of googleapis)
        const authUrl = await mailService.getAuthUrl('gmail', state);

        safeLog('info', 'Gmail OAuth initiated', { userId });

        return res.json({ authUrl });
    }
));

// ============================================
// GET /api/mail/callback/gmail - Gmail OAuth callback
// ============================================
router.get('/callback/gmail', async (req, res) => {
    try {
        const { code, state, error: oauthError } = req.query;
        const frontendUrl = getFrontendUrl();
        
        // Check for OAuth error
        if (oauthError) {
            safeLog('warn', 'Gmail OAuth error', { error: oauthError });
            return res.redirect(`${frontendUrl}/resumes?mail_error=${MAIL_CALLBACK_ERROR_CODE}`);
        }
        
        // Validate state
        if (!state) {
            safeLog('warn', 'Invalid OAuth state');
            return res.redirect(`${frontendUrl}/resumes?mail_error=invalid_state`);
        }

        const stateData = takeMailOauthState(state);
        if (!stateData) {
            safeLog('warn', 'Invalid OAuth state');
            return res.redirect(`${frontendUrl}/resumes?mail_error=invalid_state`);
        }
        
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
        const frontendUrl = getFrontendUrl();
        return res.redirect(`${frontendUrl}/resumes?mail_error=${MAIL_CALLBACK_ERROR_CODE}`);
    }
});

// ============================================
// POST /api/mail/draft - Create email draft
// ============================================
router.post('/draft', authenticateToken, validateBody(createMailDraftSchema), async (req, res) => {
    try {
        const userId = getAuthenticatedUserId(req);
        const userFirmId = await getUserFirmId(req);
        
        // Debug: log raw request body keys and template info
        safeLog('debug', 'Mail draft request body', { 
            keys: Object.keys(req.body),
            templateId: req.body.templateId || 'NOT_PROVIDED',
            hasTemplateContext: !!req.body.templateContext,
            templateContextKeys: req.body.templateContext ? Object.keys(req.body.templateContext) : []
        });
        
        const { 
            to, subject, body, pdfBase64, pdfFilename, provider = 'gmail',
            // Submission tracking fields
            resumeId, clientId, contactId, missionId, versionNumber,
            // Template fields
            templateId, templateContext
        } = req.body;
        
        // Validate required fields
        if (!to) {
            return res.status(400).json({ error: 'Recipient email (to) is required' });
        }

        const shouldTrackSubmission = Boolean(resumeId || clientId || contactId || missionId);
        if (shouldTrackSubmission) {
            const submissionValidation = await validateSubmissionTracking({
                userFirmId,
                resumeId,
                clientId,
                contactId,
                missionId
            });
            if (!submissionValidation.ok) {
                return res.status(submissionValidation.status).json({ error: submissionValidation.error });
            }
        }
        
        // Process template if provided
        let finalSubject = subject;
        let finalBody = body || '';
        let emailHtmlSent = null;
        
        // Debug: log template info
        safeLog('debug', 'Template processing check', { 
            hasTemplateId: !!templateId, 
            templateId: templateId || 'NONE',
            hasTemplateContext: !!templateContext,
            templateContextKeys: templateContext ? Object.keys(templateContext) : []
        });
        
        if (templateId) {
            const templateResult = await resolveTemplateDraftContext({
                templateId,
                templateContext,
                userId,
                userFirmId
            });
            if (!templateResult.ok) {
                return res.status(templateResult.status).json({ error: templateResult.error });
            }

            finalSubject = templateResult.subject;
            finalBody = templateResult.body;
            emailHtmlSent = templateResult.html;
            safeLog('info', 'Email template rendered successfully', { templateId, subject: finalSubject, bodyLength: finalBody?.length });
        }
        
        if (!finalSubject) {
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
            subject: finalSubject,
            body: finalBody,
            attachment,
            attachmentName
        });
        
        safeLog('info', 'Email draft created via API', { userId, to, subject, resumeId, clientId, contactId });
        
        // Record submission if client/contact info provided
        let submissionId = null;
        safeLog('debug', 'Submission tracking check', { 
            resumeId: resumeId || 'MISSING', 
            clientId: clientId || 'MISSING', 
            contactId: contactId || 'MISSING',
            versionNumber: versionNumber || 'MISSING',
            hasAll: !!(resumeId && clientId && contactId) 
        });
        if (resumeId && clientId && contactId) {
            try {
                // Get current version number if not provided
                let currentVersion = versionNumber;
                if (!currentVersion) {
                    currentVersion = await mailService.getResumeCurrentVersion(resumeId);
                }

                submissionId = await mailService.recordSubmission({
                    resumeId, clientId, contactId, missionId,
                    firmId: userFirmId, sentBy: userId, versionNumber: currentVersion,
                    templateId, emailHtmlSent
                });
                safeLog('info', 'Resume submission recorded', { submissionId, resumeId, clientId, contactId, versionNumber: currentVersion, templateId: templateId || null });
            } catch (submissionError) {
                // Log but don't fail the request - draft was created successfully
                safeLog('warn', 'Failed to record submission', { error: submissionError.message });
            }
        }
        
        return res.json({
            success: true,
            draftId: result.draftId,
            webLink: result.webLink,
            submissionId,
            message: 'Draft created successfully'
        });
    } catch (error) {
        safeLog('error', 'Error creating email draft', { error: error.message });
        
        // Check if it's an auth error
        if (error.message.includes('connect') || error.message.includes('token')) {
            return res.status(401).json({ 
                error: 'Mail provider authentication required',
                needsReauth: true 
            });
        }
        
        return res.status(500).json({ error: 'Failed to create draft' });
    }
});

// ============================================
// DELETE /api/mail/disconnect - Disconnect provider
// ============================================
router.delete('/disconnect', authenticateToken, createMailRouteHandler(
    'Error disconnecting mail',
    'Failed to disconnect mail provider',
    async (req, res) => {
        const { provider = 'gmail' } = req.query;
        await mailService.disconnect(getAuthenticatedUserId(req), provider);

        return res.json({ success: true, message: 'Mail provider disconnected' });
    }
));

export default router;
