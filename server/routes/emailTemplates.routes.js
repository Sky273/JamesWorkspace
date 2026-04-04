/**
 * Email Templates Routes
 * CRUD operations for email templates with MJML support
 */

import express from 'express';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { validateBody, validateParams, createEmailTemplateFrontSchema, updateEmailTemplateFrontSchema, compileEmailTemplateSchema, previewEmailTemplateSchema } from '../utils/validation.js';
import { safeLog } from '../utils/logger.backend.js';
import * as emailTemplatesService from '../services/emailTemplates.service.js';
import { getUserFirmId, getUserFirmIdFromUser, getUserFirmNameFromUser, isUserAdmin } from '../utils/firmHelpers.js';

/**
 * Get firm ID from user info (either from JWT or database lookup)
 * @param {Object} user - User object from JWT
 * @returns {Promise<string|null>}
 */
async function getFirmIdForUser(user) {
    const directFirmId = getUserFirmIdFromUser(user);
    if (directFirmId) {
        return directFirmId;
    }
    
    // Look up from database using user ID
    const userId = getAuthenticatedUserId(user);
    if (userId) {
        const firmId = await emailTemplatesService.getUserFirmId(userId);
        if (firmId) return firmId;
    }

    return null;
}

const router = express.Router();

function getAuthenticatedUserId(user) {
    return user?.id ?? user?.userId ?? null;
}

function createEmailTemplatesRouteHandler(logMessage, errorMessage, handler) {
    return async (req, res) => {
        try {
            await handler(req, res);
        } catch (error) {
            safeLog('error', logMessage, { error: error.message });
            return res.status(500).json({ error: errorMessage });
        }
    };
}

function requireAdmin(req, res) {
    if (!isUserAdmin(req)) {
        res.status(403).json({ error: 'Admin access required' });
        return false;
    }
    return true;
}

async function getRequestFirmId(req) {
    return (await getUserFirmId(req)) || getFirmIdForUser(req.user);
}

function ensureTemplateOwnership(res, template, firmId, { allowSystemTemplate = true, systemTemplateError = 'Cannot modify system template' } = {}) {
    if (!template) {
        res.status(404).json({ error: 'Template not found' });
        return null;
    }

    if (!allowSystemTemplate && template.is_system) {
        res.status(403).json({ error: systemTemplateError });
        return null;
    }

    if (template.firm_id && firmId && template.firm_id !== firmId) {
        res.status(403).json({ error: 'Access denied to this template' });
        return null;
    }

    if (template.firm_id && !firmId) {
        res.status(403).json({ error: 'Access denied to this template' });
        return null;
    }

    return template;
}

/**
 * GET /api/email-templates
 * Get all templates for the user's firm
 * Admin users can see system templates, regular users only see firm templates
 */
router.get('/', authenticateToken, createEmailTemplatesRouteHandler('Error fetching email templates', 'Failed to fetch email templates', async (req, res) => {
        if (!requireAdmin(req, res)) {
            return;
        }

        const firmId = await getRequestFirmId(req);
        
        if (!firmId) {
            safeLog('warn', 'Firm ID not found for user', {
                userId: getAuthenticatedUserId(req.user),
                firmName: getUserFirmNameFromUser(req.user)
            });
            const templates = await emailTemplatesService.getTemplates(null, true);
            return res.json({ templates });
        }
        
        const templates = await emailTemplatesService.getTemplates(firmId, true);
        
        return res.json({ templates });
}));

/**
 * GET /api/email-templates/keywords
 * Get available keywords for template substitution
 */
router.get('/keywords', authenticateToken, (req, res) => {
    if (!requireAdmin(req, res)) {
        return;
    }
    return res.json({ keywords: emailTemplatesService.TEMPLATE_KEYWORDS });
});

/**
 * GET /api/email-templates/default
 * Get the default template for the user's firm
 */
router.get('/default', authenticateToken, createEmailTemplatesRouteHandler('Error fetching default template', 'Failed to fetch default template', async (req, res) => {
        if (!requireAdmin(req, res)) {
            return;
        }

        const firmId = await getRequestFirmId(req);
        if (!firmId) {
            return res.status(403).json({ error: 'No firm association' });
        }
        
        const template = await emailTemplatesService.getDefaultTemplate(firmId);
        
        if (!template) {
            return res.status(404).json({ error: 'No default template found' });
        }
        
        return res.json({ template });
}));

/**
 * GET /api/email-templates/:id
 * Get a single template by ID
 */
router.get('/:id', authenticateToken, validateParams('id'), createEmailTemplatesRouteHandler('Error fetching email template', 'Failed to fetch email template', async (req, res) => {
        if (!requireAdmin(req, res)) {
            return;
        }

        const { id } = req.params;
        const firmId = await getRequestFirmId(req);
        
        const template = await emailTemplatesService.getTemplate(id);
        const accessibleTemplate = ensureTemplateOwnership(res, template, firmId);
        if (!accessibleTemplate) {
            return;
        }
        
        return res.json({ template: accessibleTemplate });
}));

/**
 * POST /api/email-templates
 * Create a new template
 */
router.post('/', authenticateToken, validateBody(createEmailTemplateFrontSchema), createEmailTemplatesRouteHandler('Error creating email template', 'Failed to create email template', async (req, res) => {
        if (!requireAdmin(req, res)) {
            return;
        }

        const firmId = await getRequestFirmId(req);
        const userId = getAuthenticatedUserId(req.user);
        
        if (!firmId) {
            return res.status(400).json({ error: 'Firm ID not found for user. Please contact administrator.' });
        }
        
        const { name, description, subjectTemplate, mjmlContent, isDefault } = req.body;
        
        if (!name || !subjectTemplate || !mjmlContent) {
            return res.status(400).json({ error: 'Name, subject template, and MJML content are required' });
        }
        
        const template = await emailTemplatesService.createTemplate(firmId, {
            name,
            description,
            subjectTemplate,
            mjmlContent,
            isDefault
        }, userId);
        
        return res.status(201).json({ template });
}));

/**
 * PUT /api/email-templates/:id
 * Update a template
 */
router.put('/:id', authenticateToken, validateParams('id'), validateBody(updateEmailTemplateFrontSchema), createEmailTemplatesRouteHandler('Error updating email template', 'Failed to update email template', async (req, res) => {
        if (!requireAdmin(req, res)) {
            return;
        }

        const { id } = req.params;
        const firmId = await getRequestFirmId(req);
        
        const existing = await emailTemplatesService.getTemplate(id);
        if (!ensureTemplateOwnership(res, existing, firmId, { allowSystemTemplate: false })) {
            return;
        }
        
        const { name, description, subjectTemplate, mjmlContent, isDefault } = req.body;
        
        if (!name || !subjectTemplate || !mjmlContent) {
            return res.status(400).json({ error: 'Name, subject template, and MJML content are required' });
        }
        
        const template = await emailTemplatesService.updateTemplate(id, {
            name,
            description,
            subjectTemplate,
            mjmlContent,
            isDefault
        });
        
        return res.json({ template });
}));

/**
 * DELETE /api/email-templates/:id
 * Delete a template
 */
router.delete('/:id', authenticateToken, validateParams('id'), createEmailTemplatesRouteHandler('Error deleting email template', 'Failed to delete email template', async (req, res) => {
        if (!requireAdmin(req, res)) {
            return;
        }

        const { id } = req.params;
        const firmId = await getRequestFirmId(req);
        
        const existing = await emailTemplatesService.getTemplate(id);
        if (!ensureTemplateOwnership(res, existing, firmId)) {
            return;
        }
        
        await emailTemplatesService.deleteTemplate(id, { isAdmin: true });
        
        return res.json({ success: true, message: 'Template deleted successfully' });
}));

/**
 * POST /api/email-templates/:id/duplicate
 * Duplicate a template to the user's firm
 */
router.post('/:id/duplicate', authenticateToken, validateParams('id'), createEmailTemplatesRouteHandler('Error duplicating email template', 'Failed to duplicate email template', async (req, res) => {
        if (!requireAdmin(req, res)) {
            return;
        }

        const { id } = req.params;
        const firmId = await getRequestFirmId(req);
        const userId = getAuthenticatedUserId(req.user);
        
        if (!firmId) {
            return res.status(400).json({ error: 'Firm ID not found for user. Please contact administrator.' });
        }
        
        const existing = await emailTemplatesService.getTemplate(id);
        if (!ensureTemplateOwnership(res, existing, firmId)) {
            return;
        }
        
        const template = await emailTemplatesService.duplicateTemplate(id, firmId, userId);
        
        return res.status(201).json({ template });
}));

/**
 * POST /api/email-templates/:id/preview
 * Preview a template with context data
 */
router.post('/:id/preview', authenticateToken, validateParams('id'), validateBody(previewEmailTemplateSchema), createEmailTemplatesRouteHandler('Error previewing email template', 'Failed to preview email template', async (req, res) => {
        if (!requireAdmin(req, res)) {
            return;
        }

        const { id } = req.params;
        const firmId = await getRequestFirmId(req);
        const { context } = req.body;
        
        const existing = await emailTemplatesService.getTemplate(id);
        if (!ensureTemplateOwnership(res, existing, firmId)) {
            return;
        }
        
        const result = await emailTemplatesService.renderTemplate(id, context || {});
        
        return res.json(result);
}));

/**
 * POST /api/email-templates/compile
 * Compile MJML content to HTML (for live preview in editor)
 */
router.post('/compile', authenticateToken, validateBody(compileEmailTemplateSchema), createEmailTemplatesRouteHandler('Error compiling MJML', 'Failed to compile MJML', async (req, res) => {
        if (!requireAdmin(req, res)) {
            return;
        }

        const { mjmlContent, subjectTemplate, context } = req.body;
        
        if (!mjmlContent) {
            return res.status(400).json({ error: 'MJML content is required' });
        }
        
        const result = await emailTemplatesService.previewTemplate(
            mjmlContent, 
            subjectTemplate || '', 
            context
        );
        
        return res.json(result);
}));

export default router;
