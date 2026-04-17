/**
 * Email Templates Service
 * Manages email templates with MJML compilation and keyword substitution
 * 
 * NOTE: mjml is loaded lazily to save ~15MB of memory at startup
 * The module is automatically unloaded after 10 minutes of inactivity
 */

import { query } from '../config/database.js';
import { safeLog } from '../utils/logger.backend.js';
import { CACHE_KEYS, emailTemplatesCache, invalidateEmailTemplatesCaches } from './cache.service.js';
import { TEMPLATE_KEYWORDS, substituteKeywords } from './emailTemplatesKeywords.service.js';
import { compileMjml, destroyMjml } from './emailTemplatesMjml.service.js';

export { TEMPLATE_KEYWORDS, substituteKeywords, compileMjml, destroyMjml };

/**
 * Get all templates for a firm
 * @param {string} firmId - Firm ID
 * @param {boolean} includeSystemTemplates - Whether to include system templates (admin only)
 * @returns {Promise<Array>}
 */
export async function getTemplates(firmId, includeSystemTemplates = false, { bypassCache = false } = {}) {
    const cacheKey = `list:${firmId || 'all'}:system:${includeSystemTemplates ? '1' : '0'}`;
    if (bypassCache) {
        let sql;
        let params;
        
        if (includeSystemTemplates) {
            sql = `
                SELECT et.id, et.firm_id, et.name, et.description, et.subject_template,
                       et.is_system, et.is_default, et.status, et.created_at, et.updated_at,
                       f.name AS firm_name
                FROM email_templates et
                LEFT JOIN firms f ON f.id = et.firm_id
                WHERE et.status = 'active'
                ORDER BY et.is_system DESC, et.is_default DESC, et.name ASC
            `;
            params = [];
        } else {
            sql = `
                SELECT et.id, et.firm_id, et.name, et.description, et.subject_template,
                       et.is_system, et.is_default, et.status, et.created_at, et.updated_at,
                       f.name AS firm_name
                FROM email_templates et
                LEFT JOIN firms f ON f.id = et.firm_id
                WHERE et.firm_id = $1
                  AND et.status = 'active'
                ORDER BY et.is_default DESC, et.name ASC
            `;
            params = [firmId];
        }

        const result = await query(sql, params);
        return result.rows;
    }

    return emailTemplatesCache.getOrLoad(cacheKey, async () => {
        let sql;
        let params;
        
        if (includeSystemTemplates) {
            sql = `
                SELECT et.id, et.firm_id, et.name, et.description, et.subject_template,
                       et.is_system, et.is_default, et.status, et.created_at, et.updated_at,
                       f.name AS firm_name
                FROM email_templates et
                LEFT JOIN firms f ON f.id = et.firm_id
                WHERE et.status = 'active'
                ORDER BY et.is_system DESC, et.is_default DESC, et.name ASC
            `;
            params = [];
        } else {
            sql = `
                SELECT et.id, et.firm_id, et.name, et.description, et.subject_template,
                       et.is_system, et.is_default, et.status, et.created_at, et.updated_at,
                       f.name AS firm_name
                FROM email_templates et
                LEFT JOIN firms f ON f.id = et.firm_id
                WHERE et.firm_id = $1
                  AND et.status = 'active'
                ORDER BY et.is_default DESC, et.name ASC
            `;
            params = [firmId];
        }
        
        const result = await query(sql, params);
        return result.rows;
    }, {
        scope: CACHE_KEYS.emailTemplates.ALL
    });
}

/**
 * Get a single template by ID
 * @param {string} id - Template ID
 * @returns {Promise<Object|null>}
 */
export async function getTemplate(id, { bypassCache = false } = {}) {
    if (bypassCache) {
        const result = await query(`
            SELECT id, firm_id, name, description, subject_template, 
                   mjml_content, html_content, is_system, is_default, 
                   status, created_by, created_at, updated_at
            FROM email_templates
            WHERE id = $1
        `, [id]);
        
        return result.rows[0] || null;
    }

    return emailTemplatesCache.getOrLoad(`detail:${id}`, async () => {
        const result = await query(`
            SELECT id, firm_id, name, description, subject_template, 
                   mjml_content, html_content, is_system, is_default, 
                   status, created_by, created_at, updated_at
            FROM email_templates
            WHERE id = $1
        `, [id]);
        
        return result.rows[0] || null;
    }, {
        scope: CACHE_KEYS.emailTemplates.ALL
    });
}

async function getTemplateOrThrow(id, { bypassCache = false } = {}) {
    const template = await getTemplate(id, { bypassCache });
    if (!template) {
        throw new Error('Template not found');
    }
    return template;
}

/**
 * Get the default template for a firm (firm's default or system default)
 * @param {string} firmId - Firm ID
 * @returns {Promise<Object|null>}
 */
export async function getDefaultTemplate(firmId) {
    return emailTemplatesCache.getOrLoad(`default:${firmId}`, async () => {
        let result = await query(`
            SELECT id, firm_id, name, description, subject_template, 
                   mjml_content, html_content, is_system, is_default, status
            FROM email_templates
            WHERE firm_id = $1 AND is_default = true AND status = 'active'
            LIMIT 1
        `, [firmId]);
        
        if (result.rows.length > 0) {
            return result.rows[0];
        }
        
        result = await query(`
            SELECT id, firm_id, name, description, subject_template, 
                   mjml_content, html_content, is_system, is_default, status
            FROM email_templates
            WHERE is_system = true AND is_default = true AND status = 'active'
            LIMIT 1
        `);
        
        return result.rows[0] || null;
    }, {
        scope: CACHE_KEYS.emailTemplates.ALL
    });
}

/**
 * Create a new template
 * @param {string} firmId - Firm ID
 * @param {Object} data - Template data
 * @param {string} userId - Creator user ID
 * @returns {Promise<Object>}
 */
export async function createTemplate(firmId, data, userId) {
    const { name, description, subjectTemplate, mjmlContent, isDefault } = data;
    
    // Compile MJML to HTML (async due to lazy loading)
    const htmlContent = await compileMjml(mjmlContent);
    
    // If setting as default, unset other defaults for this firm
    if (isDefault) {
        await query(`
            UPDATE email_templates 
            SET is_default = false 
            WHERE firm_id = $1 AND is_default = true
        `, [firmId]);
    }
    
    const result = await query(`
        INSERT INTO email_templates 
        (firm_id, name, description, subject_template, mjml_content, html_content, is_default, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
    `, [firmId, name, description, subjectTemplate, mjmlContent, htmlContent, isDefault || false, userId]);
    
    safeLog('info', 'Email template created', { templateId: result.rows[0].id, firmId, name });
    await invalidateEmailTemplatesCaches();
    return result.rows[0];
}

/**
 * Update a template
 * @param {string} id - Template ID
 * @param {Object} data - Template data
 * @returns {Promise<Object>}
 */
export async function updateTemplate(id, data) {
    const existing = await getTemplateOrThrow(id);
    if (existing.is_system) {
        throw new Error('Cannot modify system template');
    }
    
    const { name, description, subjectTemplate, mjmlContent, isDefault } = data;
    
    // Compile MJML to HTML (async due to lazy loading)
    const htmlContent = await compileMjml(mjmlContent);
    
    // If setting as default, unset other defaults for this firm
    if (isDefault && existing.firm_id) {
        await query(`
            UPDATE email_templates 
            SET is_default = false 
            WHERE firm_id = $1 AND is_default = true AND id != $2
        `, [existing.firm_id, id]);
    }
    
    const result = await query(`
        UPDATE email_templates 
        SET name = $1, description = $2, subject_template = $3, 
            mjml_content = $4, html_content = $5, is_default = $6,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $7
        RETURNING *
    `, [name, description, subjectTemplate, mjmlContent, htmlContent, isDefault || false, id]);
    
    safeLog('info', 'Email template updated', { templateId: id });
    await invalidateEmailTemplatesCaches();
    return result.rows[0];
}

/**
 * Delete a template
 * @param {string} id - Template ID
 * @param {Object} [options] - Options
 * @param {boolean} [options.isAdmin=false] - Whether the caller is an admin (can delete system templates)
 * @returns {Promise<boolean>}
 */
export async function deleteTemplate(id, { isAdmin = false } = {}) {
    const existing = await getTemplateOrThrow(id);
    if (existing.is_system && !isAdmin) {
        throw new Error('Cannot delete system template');
    }
    
    await query(`DELETE FROM email_templates WHERE id = $1`, [id]);
    
    safeLog('info', 'Email template deleted', { templateId: id, wasSystem: existing.is_system });
    await invalidateEmailTemplatesCaches();
    return true;
}

/**
 * Duplicate a template
 * @param {string} id - Template ID to duplicate
 * @param {string} firmId - Target firm ID
 * @param {string} userId - User ID
 * @returns {Promise<Object>}
 */
export async function duplicateTemplate(id, firmId, userId) {
    const original = await getTemplateOrThrow(id);
    
    const result = await query(`
        INSERT INTO email_templates 
        (firm_id, name, description, subject_template, mjml_content, html_content, is_default, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, false, $7)
        RETURNING *
    `, [
        firmId, 
        `${original.name} (copie)`, 
        original.description, 
        original.subject_template, 
        original.mjml_content, 
        original.html_content,
        userId
    ]);
    
    safeLog('info', 'Email template duplicated', { originalId: id, newId: result.rows[0].id, firmId });
    await invalidateEmailTemplatesCaches();
    return result.rows[0];
}

/**
 * Render a template with context data
 * @param {string} templateId - Template ID
 * @param {Object} context - Context data for substitution
 * @returns {Promise<Object>} - { subject, html }
 */
export async function renderTemplate(templateId, context) {
    const template = await getTemplate(templateId);
    if (!template) {
        throw new Error('Template not found');
    }

    safeLog('debug', 'EmailTemplates: renderTemplate context.user', { user: context?.user });

    let html = template.html_content;
    if (!html) {
        html = await compileMjml(template.mjml_content);
    }

    const subject = substituteKeywords(template.subject_template, context);
    const body = substituteKeywords(html, context);

    return { subject, html: body };
}

/**
 * Preview a template with sample data
 * @param {string} mjmlContent - MJML content
 * @param {string} subjectTemplate - Subject template
 * @param {Object} context - Context data (optional, uses sample data if not provided)
 * @returns {Object} - { subject, html }
 */
export async function previewTemplate(mjmlContent, subjectTemplate, context = null) {
    const sampleContext = context || {
        client: { name: 'Entreprise ABC', type: 'prospect', industry: 'Technologies' },
        contact: { name: 'Jean Dupont', role: 'Directeur RH' },
        resume: { name: 'Marie Martin', title: 'DÃ©veloppeur Full Stack', version: 3 },
        firm: { name: 'Mon Cabinet' },
        user: { name: 'Pierre Durand' }
    };

    const html = await compileMjml(mjmlContent);
    const subject = substituteKeywords(subjectTemplate, sampleContext);
    const body = substituteKeywords(html, sampleContext);

    return { subject, html: body };
}

/**
 * Get firm_id for a user by user ID
 * @param {string} userId
 * @returns {Promise<string|null>}
 */
export async function getUserFirmId(userId) {
    return emailTemplatesCache.getOrLoad(`user-firm:${userId}`, async () => {
        const result = await query(
            'SELECT firm_id FROM users WHERE id = $1',
            [userId]
        );
        return result.rows.length > 0 ? result.rows[0].firm_id : null;
    }, {
        scope: CACHE_KEYS.emailTemplates.ALL
    });
}

export async function getFirmById(firmId) {
    const result = await query(
        'SELECT id, name FROM firms WHERE id = $1',
        [firmId]
    );
    return result.rows[0] || null;
}

