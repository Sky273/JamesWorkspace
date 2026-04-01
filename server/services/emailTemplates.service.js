/**
 * Email Templates Service
 * Manages email templates with MJML compilation and keyword substitution
 * 
 * NOTE: mjml is loaded lazily to save ~15MB of memory at startup
 * The module is automatically unloaded after 10 minutes of inactivity
 */

import { query } from '../config/database.js';
import { safeLog } from '../utils/logger.backend.js';

// ============================================
// LAZY LOADING FOR MJML (~10MB with mjml-core)
// ============================================

let mjml2html = null;
let mjmlCoreModule = null;
let mjmlLastUsed = 0;
let mjmlUnloadTimer = null;
let mjmlComponentsRegistered = false;

// Unload mjml after 10 minutes of inactivity
const MJML_UNLOAD_TIMEOUT = 10 * 60 * 1000;

/**
 * Schedule unloading of mjml module after inactivity
 */
function scheduleMjmlUnload() {
    if (mjmlUnloadTimer) {
        clearTimeout(mjmlUnloadTimer);
    }
    
    mjmlUnloadTimer = setTimeout(() => {
        if (mjml2html && Date.now() - mjmlLastUsed >= MJML_UNLOAD_TIMEOUT) {
            unloadMjml();
        }
    }, MJML_UNLOAD_TIMEOUT + 1000);
    
    if (mjmlUnloadTimer.unref) {
        mjmlUnloadTimer.unref();
    }
}

/**
 * Unload mjml module to free memory (~10MB)
 * Note: ES modules remain in cache, but we release our references
 * to allow GC to collect any temporary data
 */
function unloadMjml() {
    if (mjml2html || mjmlCoreModule) {
        mjml2html = null;
        mjmlCoreModule = null;
        mjmlLastUsed = 0;
        // Keep mjmlComponentsRegistered = true since components stay registered in mjml-core's internal state
        // Re-registering would cause warnings, so we track this separately
        
        if (global.gc) {
            global.gc();
            safeLog('info', 'mjml-core references released and GC triggered (~10MB freed)');
        } else {
            safeLog('info', 'mjml-core references released (~10MB will be freed by GC)');
        }
    }
}

/**
 * Get mjml module (lazy load)
 */
async function getMjml() {
    mjmlLastUsed = Date.now();
    
    if (!mjml2html) {
        mjmlCoreModule = await import('mjml-core');
        
        // Register components only once (they persist in mjml-core's internal state)
        if (!mjmlComponentsRegistered) {
            const mjmlPreset = await import('mjml-preset-core');
            const preset = mjmlPreset.default;
            if (preset && preset.components) {
                for (const component of preset.components) {
                    mjmlCoreModule.registerComponent(component);
                }
            }
            mjmlComponentsRegistered = true;
            safeLog('info', 'mjml-core components registered');
        }
        
        // mjml-core exports the function at default.default
        mjml2html = mjmlCoreModule.default.default;
        safeLog('info', 'mjml-core module loaded lazily (~10MB)');
    }
    
    scheduleMjmlUnload();
    return mjml2html;
}

/**
 * Destroy mjml resources (for graceful shutdown)
 */
export function destroyMjml() {
    if (mjmlUnloadTimer) {
        clearTimeout(mjmlUnloadTimer);
        mjmlUnloadTimer = null;
    }
    unloadMjml();
}

/**
 * Get the base URL for the application
 * Used to construct absolute URLs for assets like logos
 */
function getBaseUrl() {
    return process.env.FRONTEND_URL || process.env.VITE_APP_URL || 'http://localhost:5173';
}

/**
 * Available keywords for template substitution
 */
export const TEMPLATE_KEYWORDS = {
    client: ['name', 'type', 'industry'],
    contact: ['name', 'firstName', 'role'],
    resume: ['name', 'title', 'version'],
    firm: ['name', 'logo'],
    user: ['name', 'email', 'jobTitle', 'phone'],
    date: ['today', 'todayLong']
};

/**
 * Get all templates for a firm
 * @param {string} firmId - Firm ID
 * @param {boolean} includeSystemTemplates - Whether to include system templates (admin only)
 * @returns {Promise<Array>}
 */
export async function getTemplates(firmId, includeSystemTemplates = false) {
    let sql;
    let params;
    
    if (includeSystemTemplates) {
        if (firmId) {
            // Admin with firm: include firm templates AND system templates
            sql = `
                SELECT id, firm_id, name, description, subject_template, 
                       is_system, is_default, status, created_at, updated_at
                FROM email_templates
                WHERE (firm_id = $1 OR firm_id IS NULL)
                  AND status = 'active'
                ORDER BY is_system DESC, is_default DESC, name ASC
            `;
            params = [firmId];
        } else {
            // Admin without firm: cross-firm view over all active templates
            sql = `
                SELECT id, firm_id, name, description, subject_template, 
                       is_system, is_default, status, created_at, updated_at
                FROM email_templates
                WHERE status = 'active'
                ORDER BY is_system DESC, is_default DESC, name ASC
            `;
            params = [];
        }
    } else {
        // Non-admin: only firm templates (exclude system templates without firm_id)
        sql = `
            SELECT id, firm_id, name, description, subject_template, 
                   is_system, is_default, status, created_at, updated_at
            FROM email_templates
            WHERE firm_id = $1
              AND status = 'active'
            ORDER BY is_default DESC, name ASC
        `;
        params = [firmId];
    }
    
    const result = await query(sql, params);
    return result.rows;
}

/**
 * Get a single template by ID
 * @param {string} id - Template ID
 * @returns {Promise<Object|null>}
 */
export async function getTemplate(id) {
    const result = await query(`
        SELECT id, firm_id, name, description, subject_template, 
               mjml_content, html_content, is_system, is_default, 
               status, created_by, created_at, updated_at
        FROM email_templates
        WHERE id = $1
    `, [id]);
    
    return result.rows[0] || null;
}

/**
 * Get the default template for a firm (firm's default or system default)
 * @param {string} firmId - Firm ID
 * @returns {Promise<Object|null>}
 */
export async function getDefaultTemplate(firmId) {
    // First try to get firm's default template
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
    
    // Fall back to system default
    result = await query(`
        SELECT id, firm_id, name, description, subject_template, 
               mjml_content, html_content, is_system, is_default, status
        FROM email_templates
        WHERE is_system = true AND is_default = true AND status = 'active'
        LIMIT 1
    `);
    
    return result.rows[0] || null;
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
    
    return result.rows[0];
}

/**
 * Update a template
 * @param {string} id - Template ID
 * @param {Object} data - Template data
 * @returns {Promise<Object>}
 */
export async function updateTemplate(id, data) {
    // Check if template is system template
    const existing = await getTemplate(id);
    if (!existing) {
        throw new Error('Template not found');
    }
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
    // Check if template is system template
    const existing = await getTemplate(id);
    if (!existing) {
        throw new Error('Template not found');
    }
    if (existing.is_system && !isAdmin) {
        throw new Error('Cannot delete system template');
    }
    
    await query(`DELETE FROM email_templates WHERE id = $1`, [id]);
    
    safeLog('info', 'Email template deleted', { templateId: id, wasSystem: existing.is_system });
    
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
    const original = await getTemplate(id);
    if (!original) {
        throw new Error('Template not found');
    }
    
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
    
    return result.rows[0];
}

/**
 * Compile MJML content to HTML
 * @param {string} mjmlContent - MJML content
 * @returns {Promise<string>} - Compiled HTML
 */
export async function compileMjml(mjmlContent) {
    try {
        const mjml = await getMjml();
        const result = mjml(mjmlContent, {
            validationLevel: 'soft',
            minify: false
        });
        
        if (result.errors && result.errors.length > 0) {
            safeLog('warn', 'MJML compilation warnings', { errors: result.errors });
        }
        
        let html = result.html;
        
        // Ensure UTF-8 charset is present in the HTML head
        if (html && !html.includes('charset="UTF-8"') && !html.includes("charset='UTF-8'") && !html.includes('charset=UTF-8')) {
            // Add charset meta tag after <head>
            html = html.replace(/<head>/i, '<head>\n    <meta charset="UTF-8">');
        }
        
        return html;
    } catch (error) {
        safeLog('error', 'MJML compilation failed', { error: error.message });
        throw new Error(`MJML compilation failed: ${error.message}`);
    }
}

/**
 * Extract first name from full name
 * @param {string} fullName - Full name
 * @returns {string}
 */
function extractFirstName(fullName) {
    if (!fullName) return '';
    const parts = fullName.trim().split(/\s+/);
    return parts[0] || '';
}

/**
 * Format date in French
 * @param {Date} date - Date object
 * @returns {Object} - { today, todayLong }
 */
function formatDate(date = new Date()) {
    const months = [
        'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
        'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'
    ];
    
    const day = date.getDate();
    const month = date.getMonth();
    const year = date.getFullYear();
    
    return {
        today: `${day.toString().padStart(2, '0')}/${(month + 1).toString().padStart(2, '0')}/${year}`,
        todayLong: `${day} ${months[month]} ${year}`
    };
}

/**
 * Substitute keywords in content
 * @param {string} content - Content with {{keyword}} placeholders
 * @param {Object} context - Context data for substitution
 * @returns {string}
 */
export function substituteKeywords(content, context) {
    const { client, contact, resume, firm, user } = context;
    const dateValues = formatDate();
    
    // Build absolute URL for logo if it's a relative path
    let logoUrl = firm?.logo || '';
    if (logoUrl && logoUrl.startsWith('/')) {
        logoUrl = `${getBaseUrl()}${logoUrl}`;
    }
    
    const replacements = {
        'client.name': client?.name || '',
        'client.type': client?.type === 'client' ? 'Client' : 'Prospect',
        'client.industry': client?.industry || '',
        'contact.name': contact?.name || '',
        'contact.firstName': extractFirstName(contact?.name),
        'contact.role': contact?.role || '',
        'resume.name': resume?.name || '',
        'resume.title': resume?.title || '',
        'resume.version': resume?.version?.toString() || '1',
        'firm.name': firm?.name || '',
        'firm.logo': logoUrl,
        'user.name': user?.name || '',
        'user.email': user?.email || '',
        'user.jobTitle': user?.jobTitle || '',
        'user.phone': user?.phone || '',
        'date.today': dateValues.today,
        'date.todayLong': dateValues.todayLong
    };
    
    let result = content;
    for (const [key, value] of Object.entries(replacements)) {
        const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
        result = result.replace(regex, value);
    }
    
    return result;
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
    
    // Debug: log user context
    safeLog('debug', 'EmailTemplates: renderTemplate context.user', { user: context?.user });
    
    // Get or compile HTML (async due to lazy loading)
    let html = template.html_content;
    if (!html) {
        html = await compileMjml(template.mjml_content);
    }
    
    // Substitute keywords
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
    // Use sample data if no context provided
    const sampleContext = context || {
        client: { name: 'Entreprise ABC', type: 'prospect', industry: 'Technologies' },
        contact: { name: 'Jean Dupont', role: 'Directeur RH' },
        resume: { name: 'Marie Martin', title: 'Développeur Full Stack', version: 3 },
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
    const result = await query(
        'SELECT firm_id FROM users WHERE id = $1',
        [userId]
    );
    return result.rows.length > 0 ? result.rows[0].firm_id : null;
}

/**
 * Get firm ID by firm name
 * @param {string} firmName
 * @returns {Promise<string|null>}
 */
export async function getFirmIdByName(firmName) {
    const result = await query(
        'SELECT id FROM firms WHERE name = $1',
        [firmName]
    );
    return result.rows.length > 0 ? result.rows[0].id : null;
}

export default {
    TEMPLATE_KEYWORDS,
    getTemplates,
    getTemplate,
    getDefaultTemplate,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    duplicateTemplate,
    compileMjml,
    substituteKeywords,
    renderTemplate,
    previewTemplate,
    getUserFirmId,
    getFirmIdByName
};
