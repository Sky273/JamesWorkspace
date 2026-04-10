/**
 * Templates - CRUD Routes
 * Endpoints for listing, getting, creating, updating, deleting templates
 */

import express from 'express';
import { authenticateToken, requireAdmin, isUserAdmin } from '../../middleware/auth.middleware.js';
import { validateBody, validateParams, createTemplateSchema, updateTemplateSchema, normalizeRequestBodyAliases } from '../../utils/validation.js';
import { securityLog, getRequestMetadata, LOG_LEVELS, SECURITY_EVENTS } from '../../services/security.service.js';
import { invalidateTemplatesCaches } from '../../services/cache.service.js';
import { safeLog } from '../../utils/logger.backend.js';
import { mapTemplateToFrontend, mapTemplateFromFrontend } from '../../utils/mappers.js';
import { getUserFirmId } from '../../utils/firmHelpers.js';
import * as templatesService from '../../services/templates.service.js';

const router = express.Router();

function normalizeTemplatePayload(payload = {}) {
    const normalized = normalizeRequestBodyAliases(payload);

    return {
        ...normalized,
        Name: normalized.name,
        Description: normalized.description,
        Popular: normalized.popular,
        Status: normalized.status,
        Tags: normalized.tags,
        PreviewImage: normalized.previewImage,
        HeaderContent: normalized.headerContent,
        TemplateContent: normalized.templateContent,
        FooterContent: normalized.footerContent,
        FooterHeight: normalized.footerHeight,
        Stylesheet: normalized.stylesheet,
        firm_id: normalized.firmId
    };
}

// GET /api/templates - Get all templates (with server-side pagination and filters)
router.get('/', authenticateToken, async (req, res) => {
    try {
        const parsedPage = Number.parseInt(req.query.page, 10);
        const parsedLimit = Number.parseInt(req.query.limit, 10);
        const page = Number.isNaN(parsedPage) ? 1 : parsedPage;
        const limit = Number.isNaN(parsedLimit) ? 100 : parsedLimit;
        const { search, status } = req.query;
        const isAdmin = isUserAdmin(req);
        const userFirmId = await getUserFirmId(req);

        if (!isAdmin && !userFirmId) {
            return res.status(403).json({ error: 'No firm association' });
        }

        if (page < 1 || limit < 1 || limit > 100) {
            return res.status(400).json({ error: 'Invalid pagination parameters' });
        }

        const { templates, totalCount, hasMore } = await templatesService.listTemplates({
            isAdmin, userFirmId, search, status, page, limit
        });
        
        // Debug log to check firm_name
        if (templates.length > 0) {
            safeLog('info', 'Templates with firm info', { 
                firstTemplate: { 
                    name: templates[0].name, 
                    firm_id: templates[0].firm_id, 
                    firm_name: templates[0].firm_name 
                }
            });
        }

        const totalPages = Math.ceil(totalCount / limit);
        const mappedTemplates = templates.map(mapTemplateToFrontend);

        return res.json({
            data: mappedTemplates,
            pagination: {
                page,
                limit,
                totalCount,
                totalPages,
                hasMore,
                nextPage: hasMore ? page + 1 : null
            }
        });
    } catch (error) {
        safeLog('error', 'Error fetching templates', { error: error.message });
        return res.status(500).json({ 
            error: 'Failed to fetch templates' 
        });
    }
});

// GET /api/templates/:id - Get template by ID
router.get('/:id', authenticateToken, validateParams('id'), async (req, res) => {
    try {
        const { id } = req.params;
        const isAdmin = isUserAdmin(req);
        const userFirmId = await getUserFirmId(req);
        const template = await templatesService.getTemplateByIdWithAccess(id, { isAdmin, userFirmId });
        
        // Map to frontend format (using PascalCase for compatibility)
        res.json(mapTemplateToFrontend(template));
    } catch (error) {
        if (error.statusCode === 404) {
            return res.status(404).json({ error: 'Template not found' });
        }
        safeLog('error', 'Error fetching template', { error: error.message, templateId: req.params.id });
        return res.status(500).json({ 
            error: 'Failed to fetch template' 
        });
    }
});

// POST /api/templates - Create template
router.post('/', authenticateToken, requireAdmin, validateBody(createTemplateSchema), async (req, res) => {
    try {
        await invalidateTemplatesCaches();
        
        const isAdmin = isUserAdmin(req);
        const userFirmId = await getUserFirmId(req);
        
        // Determine target firm_id: admin can specify a different firm or create global templates
        const normalizedTemplate = normalizeTemplatePayload(req.body);

        let targetFirmId = userFirmId;
        const requestedFirmId = normalizedTemplate.firm_id;
        
        if (isAdmin) {
            if (requestedFirmId === '' || requestedFirmId === null) {
                // Admin explicitly wants a global template
                targetFirmId = null;
            } else if (requestedFirmId && requestedFirmId !== userFirmId) {
                // Admin is creating for another firm - validate the firm exists
                const firm = await templatesService.getFirmIfExists(requestedFirmId);
                if (!firm) {
                    return res.status(400).json({ error: 'Specified firm not found' });
                }
                targetFirmId = firm.id;
                safeLog('info', 'Admin creating template for another firm', { 
                    adminId: req.user?.id, 
                    targetFirmId, 
                    targetFirmName: firm.name 
                });
            }
        }
        
        const templateData = {
            ...mapTemplateFromFrontend(normalizedTemplate),
            firm_id: targetFirmId
        };

        const created = await templatesService.createTemplate(templateData);
        
        // Map back to frontend format
        res.json(mapTemplateToFrontend(created));
    } catch (error) {
        if (error.code === '23505') {
            return res.status(400).json({ 
                error: 'Template with this name already exists' 
            });
        }
        safeLog('error', 'Error creating template', { error: error.message });
        return res.status(500).json({ 
            error: 'Failed to create template' 
        });
    }
});

// PUT /api/templates/:id - Update template
router.put('/:id', authenticateToken, requireAdmin, validateParams('id'), validateBody(updateTemplateSchema), async (req, res) => {
    try {
        await invalidateTemplatesCaches();
        
        const { id } = req.params;
        const isAdmin = isUserAdmin(req);
        
        // Get existing template to check firm_id
        const existingTemplate = await templatesService.getTemplateById(id);
        
        // Handle firm_id update (admin only)
        const normalizedTemplate = normalizeTemplatePayload(req.body);

        let targetFirmId = existingTemplate.firm_id;
        const requestedFirmId = normalizedTemplate.firm_id;
        
        if (isAdmin && requestedFirmId !== undefined) {
            if (requestedFirmId === '' || requestedFirmId === null) {
                // Admin explicitly wants a global template
                targetFirmId = null;
            } else if (requestedFirmId !== existingTemplate.firm_id) {
                // Admin is changing to another firm - validate the firm exists
                const firm = await templatesService.getFirmIfExists(requestedFirmId);
                if (!firm) {
                    return res.status(400).json({ error: 'Specified firm not found' });
                }
                targetFirmId = firm.id;
                safeLog('info', 'Admin changing template firm', { 
                    adminId: req.user?.id, 
                    templateId: id,
                    oldFirmId: existingTemplate.firm_id,
                    newFirmId: targetFirmId 
                });
            }
        }
        
        const templateData = {
            ...mapTemplateFromFrontend(req.body),
            firm_id: targetFirmId
        };

        const updated = await templatesService.updateTemplate(id, templateData);
        
        // Map back to frontend format
        res.json(mapTemplateToFrontend(updated));
    } catch (error) {
        if (error.statusCode === 404) {
            return res.status(404).json({ error: 'Template not found' });
        }
        if (error.code === '23505') {
            return res.status(400).json({ 
                error: 'Template with this name already exists' 
            });
        }
        safeLog('error', 'Error updating template', { error: error.message, templateId: req.params.id });
        return res.status(500).json({ 
            error: 'Failed to update template' 
        });
    }
});

// DELETE /api/templates/:id - Delete template
router.delete('/:id', authenticateToken, requireAdmin, validateParams('id'), async (req, res) => {
    try {
        const { id } = req.params;
        
        await invalidateTemplatesCaches();
        await templatesService.deleteTemplate(id);
        
        securityLog(LOG_LEVELS.SECURITY, SECURITY_EVENTS.TEMPLATE_DELETED, {
            ...getRequestMetadata(req),
            templateId: id,
            deletedBy: req.user.id,
            action: 'TEMPLATE_DELETED',
            message: 'Template deleted by admin'
        });
        
        res.json({ message: 'Template deleted successfully' });
    } catch (error) {
        if (error.statusCode === 404) {
            return res.status(404).json({ error: 'Template not found' });
        }
        safeLog('error', 'Error deleting template', { error: error.message, templateId: req.params.id });
        return res.status(500).json({ 
            error: 'Failed to delete template' 
        });
    }
});

export default router;

