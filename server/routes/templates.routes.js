import express from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.middleware.js';
import { validateBody, validateParams, createTemplateSchema } from '../utils/validation.js';
import { templatesCache } from '../services/cache.service.js';
import { safeLog } from '../utils/logger.backend.js';
import { 
    selectWithTimeout, 
    findWithTimeout, 
    createWithTimeout, 
    updateWithTimeout, 
    destroyWithTimeout 
} from '../utils/postgresHelpers.js';

const router = express.Router();

// ============================================
// TEMPLATES ROUTES (PostgreSQL)
// ============================================

// GET /api/templates - Get all templates (with server-side pagination and filters)
router.get('/', authenticateToken, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 100;
        const offset = (page - 1) * limit;
        const { search, status } = req.query;
        
        // Build WHERE clause
        const conditions = [];
        const params = [];
        let paramIndex = 1;
        
        if (status && status !== 'all') {
            conditions.push(`status = $${paramIndex}`);
            params.push(status.toLowerCase());
            paramIndex++;
        }
        
        if (search) {
            conditions.push(`(LOWER(name) LIKE $${paramIndex} OR LOWER(description) LIKE $${paramIndex})`);
            params.push(`%${search.toLowerCase()}%`);
            paramIndex++;
        }
        
        const whereClause = conditions.length > 0 ? conditions.join(' AND ') : '';

        // Get total count first
        const countWhereClause = whereClause ? `WHERE ${whereClause}` : '';
        const countQuery = `SELECT COUNT(*) as total FROM templates ${countWhereClause}`;
        const countResult = await selectWithTimeout('templates', {
            rawQuery: countQuery,
            rawParams: params
        });
        const totalCount = parseInt(countResult[0]?.total || 0);

        // Fetch templates with pagination
        const templates = await selectWithTimeout('templates', {
            where: whereClause,
            params: params,
            orderBy: 'name ASC',
            limit: limit + 1,
            offset: offset
        });

        // Check if there are more records
        const hasMore = templates.length > limit;
        if (hasMore) {
            templates.pop();
        }

        const totalPages = Math.ceil(totalCount / limit);

        // Map to frontend format
        const mappedTemplates = templates.map(template => ({
            id: template.id,
            name: template.name,
            description: template.description,
            popular: template.popular || false,
            status: template.status || 'active',
            tags: template.tags || [],
            previewImage: template.preview_image_url || null,
            headerContent: template.header_content || '',
            templateContent: template.template_content,
            footerContent: template.footer_content || '',
            footerHeight: template.footer_height || 25,
            stylesheet: template.stylesheet || '',
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
            error: 'Failed to fetch templates',
            message: error.message 
        });
    }
});

// GET /api/templates/:id - Get template by ID
router.get('/:id', authenticateToken, validateParams('id'), async (req, res) => {
    try {
        const { id } = req.params;
        const template = await findWithTimeout('templates', id);
        
        // Map to frontend format
        const mappedTemplate = {
            id: template.id,
            name: template.name,
            description: template.description,
            popular: template.popular || false,
            status: template.status || 'active',
            tags: template.tags || [],
            previewImage: template.preview_image_url || null,
            headerContent: template.header_content || '',
            templateContent: template.template_content || '',
            footerContent: template.footer_content || '',
            footerHeight: template.footer_height || 25,
            stylesheet: template.stylesheet || '',
            lastUpdated: template.updated_at
        };
        
        res.json(mappedTemplate);
    } catch (error) {
        if (error.statusCode === 404) {
            return res.status(404).json({ error: 'Template not found' });
        }
        safeLog('error', 'Error fetching template', { error: error.message, templateId: req.params.id });
        return res.status(500).json({ 
            error: 'Failed to fetch template',
            message: error.message 
        });
    }
});

// POST /api/templates - Create template
router.post('/', authenticateToken, requireAdmin, validateBody(createTemplateSchema), async (req, res) => {
    try {
        templatesCache.invalidate('all_templates');
        
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
            stylesheet: req.body.Stylesheet || ''
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
            error: 'Failed to create template',
            message: error.message 
        });
    }
});

// PUT /api/templates/:id - Update template
router.put('/:id', authenticateToken, requireAdmin, validateParams('id'), async (req, res) => {
    try {
        templatesCache.invalidate('all_templates');
        
        const { id } = req.params;
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
            stylesheet: req.body.Stylesheet
        };

        // Remove undefined values
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
            error: 'Failed to update template',
            message: error.message 
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
            error: 'Failed to delete template',
            message: error.message 
        });
    }
});

export default router;
