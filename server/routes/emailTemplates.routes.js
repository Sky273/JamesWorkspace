/**
 * Email Templates Routes
 * CRUD operations for email templates with MJML support
 */

import express from 'express';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { validateBody, validateParams, createEmailTemplateFrontSchema, updateEmailTemplateFrontSchema, compileEmailTemplateSchema, previewEmailTemplateSchema } from '../utils/validation.js';
import { safeLog } from '../utils/logger.backend.js';
import * as emailTemplatesService from '../services/emailTemplates.service.js';
import { getUserFirmId } from '../utils/firmHelpers.js';

/**
 * Get firm ID from user info (either from JWT or database lookup)
 * @param {Object} user - User object from JWT
 * @returns {Promise<string|null>}
 */
async function getFirmIdForUser(user) {
    // Try direct properties first
    if (user.firmId) return user.firmId;
    if (user.firm_id) return user.firm_id;
    
    // Look up from database using user ID
    const userId = user.id || user.userId;
    if (userId) {
        const firmId = await emailTemplatesService.getUserFirmId(userId);
        if (firmId) return firmId;
    }

    return null;
}

const router = express.Router();

function isAdmin(req) {
    return req.user?.role === 'admin';
}

function requireAdmin(req, res) {
    if (!isAdmin(req)) {
        res.status(403).json({ error: 'Admin access required' });
        return false;
    }
    return true;
}

/**
 * GET /api/email-templates
 * Get all templates for the user's firm
 * Admin users can see system templates, regular users only see firm templates
 */
router.get('/', authenticateToken, async (req, res) => {
    try {
        if (!requireAdmin(req, res)) {
            return;
        }

        const firmId = await getUserFirmId(req) || await getFirmIdForUser(req.user);
        
        if (!firmId) {
            safeLog('warn', 'Firm ID not found for user', { userId: req.user.id, firmName: req.user.firmName || null });
            const templates = await emailTemplatesService.getTemplates(null, true);
            return res.json({ templates });
        }
        
        const templates = await emailTemplatesService.getTemplates(firmId, true);
        
        return res.json({ templates });
    } catch (error) {
        safeLog('error', 'Error fetching email templates', { error: error.message });
        return res.status(500).json({ error: 'Failed to fetch email templates' });
    }
});

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
router.get('/default', authenticateToken, async (req, res) => {
    try {
        if (!requireAdmin(req, res)) {
            return;
        }

        const firmId = await getUserFirmId(req) || await getFirmIdForUser(req.user);
        if (!firmId) {
            return res.status(403).json({ error: 'No firm association' });
        }
        
        const template = await emailTemplatesService.getDefaultTemplate(firmId);
        
        if (!template) {
            return res.status(404).json({ error: 'No default template found' });
        }
        
        return res.json({ template });
    } catch (error) {
        safeLog('error', 'Error fetching default template', { error: error.message });
        return res.status(500).json({ error: 'Failed to fetch default template' });
    }
});

/**
 * GET /api/email-templates/:id
 * Get a single template by ID
 */
router.get('/:id', authenticateToken, validateParams('id'), async (req, res) => {
    try {
        if (!requireAdmin(req, res)) {
            return;
        }

        const { id } = req.params;
        const firmId = await getUserFirmId(req) || await getFirmIdForUser(req.user);
        
        const template = await emailTemplatesService.getTemplate(id);
        
        if (!template) {
            return res.status(404).json({ error: 'Template not found' });
        }
        
        if (template.firm_id && firmId && template.firm_id !== firmId) {
            return res.status(403).json({ error: 'Access denied to this template' });
        }
        if (template.firm_id && !firmId) {
            return res.status(403).json({ error: 'Access denied to this template' });
        }
        
        return res.json({ template });
    } catch (error) {
        safeLog('error', 'Error fetching email template', { error: error.message });
        return res.status(500).json({ error: 'Failed to fetch email template' });
    }
});

/**
 * POST /api/email-templates
 * Create a new template
 */
router.post('/', authenticateToken, validateBody(createEmailTemplateFrontSchema), async (req, res) => {
    try {
        if (!requireAdmin(req, res)) {
            return;
        }

        const firmId = await getUserFirmId(req) || await getFirmIdForUser(req.user);
        const userId = req.user.id || req.user.userId;
        
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
    } catch (error) {
        safeLog('error', 'Error creating email template', { error: error.message });
        return res.status(500).json({ error: 'Failed to create email template' });
    }
});

/**
 * PUT /api/email-templates/:id
 * Update a template
 */
router.put('/:id', authenticateToken, validateParams('id'), validateBody(updateEmailTemplateFrontSchema), async (req, res) => {
    try {
        if (!requireAdmin(req, res)) {
            return;
        }

        const { id } = req.params;
        const firmId = await getUserFirmId(req) || await getFirmIdForUser(req.user);
        
        // Check ownership
        const existing = await emailTemplatesService.getTemplate(id);
        if (!existing) {
            return res.status(404).json({ error: 'Template not found' });
        }
        if (existing.is_system) {
            return res.status(403).json({ error: 'Cannot modify system template' });
        }
        if (existing.firm_id && firmId && existing.firm_id !== firmId) {
            return res.status(403).json({ error: 'Access denied to this template' });
        }
        if (existing.firm_id && !firmId) {
            return res.status(403).json({ error: 'Access denied to this template' });
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
    } catch (error) {
        safeLog('error', 'Error updating email template', { error: error.message });
        return res.status(500).json({ error: 'Failed to update email template' });
    }
});

/**
 * DELETE /api/email-templates/:id
 * Delete a template
 */
router.delete('/:id', authenticateToken, validateParams('id'), async (req, res) => {
    try {
        if (!requireAdmin(req, res)) {
            return;
        }

        const { id } = req.params;
        const firmId = await getUserFirmId(req) || await getFirmIdForUser(req.user);
        
        // Check ownership
        const existing = await emailTemplatesService.getTemplate(id);
        if (!existing) {
            return res.status(404).json({ error: 'Template not found' });
        }
        if (!existing.is_system && existing.firm_id && firmId && existing.firm_id !== firmId) {
            return res.status(403).json({ error: 'Access denied to this template' });
        }
        if (!existing.is_system && existing.firm_id && !firmId) {
            return res.status(403).json({ error: 'Access denied to this template' });
        }
        
        await emailTemplatesService.deleteTemplate(id, { isAdmin: true });
        
        return res.json({ success: true, message: 'Template deleted successfully' });
    } catch (error) {
        safeLog('error', 'Error deleting email template', { error: error.message });
        return res.status(500).json({ error: 'Failed to delete email template' });
    }
});

/**
 * POST /api/email-templates/:id/duplicate
 * Duplicate a template to the user's firm
 */
router.post('/:id/duplicate', authenticateToken, validateParams('id'), async (req, res) => {
    try {
        if (!requireAdmin(req, res)) {
            return;
        }

        const { id } = req.params;
        const firmId = await getUserFirmId(req) || await getFirmIdForUser(req.user);
        const userId = req.user.id || req.user.userId;
        
        if (!firmId) {
            return res.status(400).json({ error: 'Firm ID not found for user. Please contact administrator.' });
        }
        
        // Check access to original template
        const existing = await emailTemplatesService.getTemplate(id);
        if (!existing) {
            return res.status(404).json({ error: 'Template not found' });
        }
        if (existing.firm_id && firmId && existing.firm_id !== firmId) {
            return res.status(403).json({ error: 'Access denied to this template' });
        }
        if (existing.firm_id && !firmId) {
            return res.status(403).json({ error: 'Access denied to this template' });
        }
        
        const template = await emailTemplatesService.duplicateTemplate(id, firmId, userId);
        
        return res.status(201).json({ template });
    } catch (error) {
        safeLog('error', 'Error duplicating email template', { error: error.message });
        return res.status(500).json({ error: 'Failed to duplicate email template' });
    }
});

/**
 * POST /api/email-templates/:id/preview
 * Preview a template with context data
 */
router.post('/:id/preview', authenticateToken, validateParams('id'), validateBody(previewEmailTemplateSchema), async (req, res) => {
    try {
        if (!requireAdmin(req, res)) {
            return;
        }

        const { id } = req.params;
        const firmId = await getUserFirmId(req) || await getFirmIdForUser(req.user);
        const { context } = req.body;
        
        // Check access
        const existing = await emailTemplatesService.getTemplate(id);
        if (!existing) {
            return res.status(404).json({ error: 'Template not found' });
        }
        if (existing.firm_id && firmId && existing.firm_id !== firmId) {
            return res.status(403).json({ error: 'Access denied to this template' });
        }
        if (existing.firm_id && !firmId) {
            return res.status(403).json({ error: 'Access denied to this template' });
        }
        
        const result = await emailTemplatesService.renderTemplate(id, context || {});
        
        return res.json(result);
    } catch (error) {
        safeLog('error', 'Error previewing email template', { error: error.message });
        return res.status(500).json({ error: 'Failed to preview email template' });
    }
});

/**
 * POST /api/email-templates/compile
 * Compile MJML content to HTML (for live preview in editor)
 */
router.post('/compile', authenticateToken, validateBody(compileEmailTemplateSchema), async (req, res) => {
    try {
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
    } catch (error) {
        safeLog('error', 'Error compiling MJML', { error: error.message });
        return res.status(500).json({ error: 'Failed to compile MJML' });
    }
});

export default router;
