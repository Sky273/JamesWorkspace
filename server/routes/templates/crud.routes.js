/**
 * Templates - CRUD Routes
 * Endpoints for listing, getting, creating, updating, deleting templates
 */

import express from 'express';
import { authenticateToken, requireAdmin, isUserAdmin } from '../../middleware/auth.middleware.js';
import { validateBody, validateParams, createTemplateSchema } from '../../utils/validation.js';
import { templatesCache } from '../../services/cache.service.js';
import { safeLog } from '../../utils/logger.backend.js';
import { 
    selectWithTimeout, 
    findWithTimeout, 
    createWithTimeout, 
    updateWithTimeout, 
    destroyWithTimeout,
    escapeLike 
} from '../../utils/postgresHelpers.js';
import { query } from '../../config/database.js';
import { getUserFirmId } from '../../utils/firmHelpers.js';

const router = express.Router();

// GET /api/templates - Get all templates (with server-side pagination and filters)
router.get('/', authenticateToken, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 100;
        const offset = (page - 1) * limit;
        const { search, status } = req.query;
        const isAdmin = isUserAdmin(req);
        const userFirmId = await getUserFirmId(req);
        
        // Build WHERE clause
        const conditions = [];
        const params = [];
        let paramIndex = 1;
        
        // Firm filter: non-admins see only their firm's templates + global templates (firm_id IS NULL)
        if (!isAdmin && userFirmId) {
            conditions.push(`(t.firm_id = $${paramIndex} OR t.firm_id IS NULL)`);
            params.push(userFirmId);
            paramIndex++;
        }
        
        if (status && status !== 'all') {
            conditions.push(`t.status = $${paramIndex}`);
            params.push(status.toLowerCase());
            paramIndex++;
        }
        
        if (search) {
            conditions.push(`(LOWER(t.name) LIKE $${paramIndex} OR LOWER(t.description) LIKE $${paramIndex})`);
            params.push(`%${escapeLike(search.toLowerCase())}%`);
            paramIndex++;
        }
        
        const whereClause = conditions.length > 0 ? conditions.join(' AND ') : '';

        // Get total count first
        const countWhereClause = whereClause ? `WHERE ${whereClause}` : '';
        const countQuery = `SELECT COUNT(*) as total FROM templates t ${countWhereClause}`;
        const countResult = await selectWithTimeout('templates', {
            rawQuery: countQuery,
            rawParams: params
        });
        const totalCount = parseInt(countResult[0]?.total || 0);

        // Fetch templates with pagination and firm name
        const selectWhereClause = whereClause ? `WHERE ${whereClause}` : '';
        const templatesQuery = `
            SELECT t.*, f.name as firm_name
            FROM templates t
            LEFT JOIN firms f ON t.firm_id = f.id
            ${selectWhereClause}
            ORDER BY t.name ASC
            LIMIT $${params.length + 1} OFFSET $${params.length + 2}
        `;
        const templatesResult = await query(templatesQuery, [...params, limit + 1, offset]);
        const templates = templatesResult.rows;
        
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

        // Check if there are more records
        const hasMore = templates.length > limit;
        if (hasMore) {
            templates.pop();
        }

        const totalPages = Math.ceil(totalCount / limit);

        // Map to frontend format (using PascalCase for compatibility)
        const mappedTemplates = templates.map(template => ({
            id: template.id,
            Name: template.name,
            Description: template.description,
            Popular: template.popular || false,
            Status: template.status || 'active',
            Tags: template.tags || [],
            previewImage: template.preview_image_url || null,
            HeaderContent: template.header_content || '',
            TemplateContent: template.template_content,
            FooterContent: template.footer_content || '',
            FooterHeight: template.footer_height || 25,
            Stylesheet: template.stylesheet || '',
            FirmId: template.firm_id || null,
            FirmName: template.firm_name || null,
            lastUpdated: template.updated_at
        }));

        const response = {
            data: mappedTemplates,
            pagination: {
                page,
                limit,
                totalCount,
                totalPages,
                hasMore,
                nextPage: hasMore ? page + 1 : null
            }
        };

        return res.json(response);
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
        const template = await findWithTimeout('templates', id);
        
        // Map to frontend format (using PascalCase for compatibility)
        const mappedTemplate = {
            id: template.id,
            Name: template.name,
            Description: template.description,
            Popular: template.popular || false,
            Status: template.status || 'active',
            Tags: template.tags || [],
            previewImage: template.preview_image_url || null,
            HeaderContent: template.header_content || '',
            TemplateContent: template.template_content || '',
            FooterContent: template.footer_content || '',
            FooterHeight: template.footer_height || 25,
            Stylesheet: template.stylesheet || '',
            FirmId: template.firm_id || null,
            lastUpdated: template.updated_at
        };
        
        res.json(mappedTemplate);
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
        templatesCache.invalidate('all_templates');
        
        const isAdmin = isUserAdmin(req);
        const userFirmId = await getUserFirmId(req);
        
        // Determine target firm_id: admin can specify a different firm or create global templates
        let targetFirmId = userFirmId;
        const requestedFirmId = req.body.firm_id || req.body['Firm ID'];
        
        if (isAdmin) {
            if (requestedFirmId === '' || requestedFirmId === null) {
                // Admin explicitly wants a global template
                targetFirmId = null;
            } else if (requestedFirmId && requestedFirmId !== userFirmId) {
                // Admin is creating for another firm - validate the firm exists
                const firmResult = await query('SELECT id, name FROM firms WHERE id = $1', [requestedFirmId]);
                if (firmResult.rows.length === 0) {
                    return res.status(400).json({ error: 'Specified firm not found' });
                }
                targetFirmId = firmResult.rows[0].id;
                safeLog('info', 'Admin creating template for another firm', { 
                    adminId: req.user?.id, 
                    targetFirmId, 
                    targetFirmName: firmResult.rows[0].name 
                });
            }
        }
        
        const templateData = {
            name: req.body.Name,
            description: req.body.Description || null,
            popular: req.body.Popular || false,
            status: (req.body.Status || 'active').toLowerCase(),
            tags: req.body.Tags || [],
            preview_image_url: req.body.PreviewImage || null,
            header_content: req.body.HeaderContent || '',
            template_content: req.body.TemplateContent,
            footer_content: req.body.FooterContent || '',
            footer_height: req.body.FooterHeight || 25,
            stylesheet: req.body.Stylesheet || '',
            firm_id: targetFirmId
        };

        const records = await createWithTimeout('templates', [{
            fields: templateData
        }]);
        
        // Map back to frontend format
        const result = records[0];
        res.json({
            id: result.id,
            Name: result.name,
            Description: result.description,
            Popular: result.popular,
            Status: result.status,
            Tags: result.tags,
            PreviewImage: result.preview_image_url,
            HeaderContent: result.header_content,
            TemplateContent: result.template_content,
            FooterContent: result.footer_content,
            FooterHeight: result.footer_height,
            Stylesheet: result.stylesheet,
            LastUpdated: result.updated_at
        });
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
router.put('/:id', authenticateToken, requireAdmin, validateParams('id'), async (req, res) => {
    try {
        templatesCache.invalidate('all_templates');
        
        const { id } = req.params;
        const isAdmin = isUserAdmin(req);
        
        // Get existing template to check firm_id
        const existingTemplate = await findWithTimeout('templates', id);
        
        // Handle firm_id update (admin only)
        let targetFirmId = existingTemplate.firm_id;
        const requestedFirmId = req.body.firm_id || req.body.FirmId;
        
        if (isAdmin && requestedFirmId !== undefined) {
            if (requestedFirmId === '' || requestedFirmId === null) {
                // Admin explicitly wants a global template
                targetFirmId = null;
            } else if (requestedFirmId !== existingTemplate.firm_id) {
                // Admin is changing to another firm - validate the firm exists
                const firmResult = await query('SELECT id, name FROM firms WHERE id = $1', [requestedFirmId]);
                if (firmResult.rows.length === 0) {
                    return res.status(400).json({ error: 'Specified firm not found' });
                }
                targetFirmId = firmResult.rows[0].id;
                safeLog('info', 'Admin changing template firm', { 
                    adminId: req.user?.id, 
                    templateId: id,
                    oldFirmId: existingTemplate.firm_id,
                    newFirmId: targetFirmId 
                });
            }
        }
        
        const templateData = {
            name: req.body.Name,
            description: req.body.Description,
            popular: req.body.Popular,
            status: req.body.Status ? req.body.Status.toLowerCase() : undefined,
            tags: req.body.Tags,
            preview_image_url: req.body.PreviewImage,
            header_content: req.body.HeaderContent,
            template_content: req.body.TemplateContent,
            footer_content: req.body.FooterContent,
            footer_height: req.body.FooterHeight,
            stylesheet: req.body.Stylesheet,
            firm_id: targetFirmId
        };

        // Remove undefined values (but keep null for firm_id)
        Object.keys(templateData).forEach(key => {
            if (templateData[key] === undefined) {
                delete templateData[key];
            }
        });

        const records = await updateWithTimeout('templates', [{
            id: id,
            fields: templateData
        }]);
        
        // Map back to frontend format
        const result = records[0];
        res.json({
            id: result.id,
            Name: result.name,
            Description: result.description,
            Popular: result.popular,
            Status: result.status,
            Tags: result.tags,
            PreviewImage: result.preview_image_url,
            HeaderContent: result.header_content,
            TemplateContent: result.template_content,
            FooterContent: result.footer_content,
            FooterHeight: result.footer_height,
            Stylesheet: result.stylesheet,
            FirmId: result.firm_id,
            LastUpdated: result.updated_at
        });
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
        
        templatesCache.invalidate('all_templates');
        await destroyWithTimeout('templates', [id]);
        
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
