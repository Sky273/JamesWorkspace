/**
 * Batch Export Service
 * Data access layer for batch export operations
 * Extracted from batchExport.routes.js
 */

import { query } from '../config/database.js';

/**
 * Get template by ID
 * @param {string} templateId
 * @returns {Promise<Object|null>}
 */
export async function getTemplateById(templateId) {
    const result = await query('SELECT * FROM templates WHERE id = $1', [templateId]);
    return result.rows.length > 0 ? result.rows[0] : null;
}

/**
 * Get resume by ID (all columns)
 * @param {string} resumeId
 * @returns {Promise<Object|null>}
 */
export async function getResumeById(resumeId) {
    const result = await query('SELECT * FROM resumes WHERE id = $1', [resumeId]);
    return result.rows.length > 0 ? result.rows[0] : null;
}

export async function getTemplateByIdForExport(templateId, { isAdmin, userFirmId }) {
    const template = await getTemplateById(templateId);
    if (!template) {
        return null;
    }

    if (isAdmin) {
        return template;
    }

    if (!userFirmId) {
        return null;
    }

    if (template.firm_id !== null && template.firm_id !== userFirmId) {
        return null;
    }

    return template;
}

export async function getResumeByIdForExport(resumeId, { isAdmin, userFirmId }) {
    const resume = await getResumeById(resumeId);
    if (!resume) {
        return null;
    }

    if (isAdmin) {
        return resume;
    }

    if (!userFirmId) {
        return null;
    }

    if (resume.firm_id !== userFirmId) {
        return null;
    }

    return resume;
}

export async function getResumesByIdsForExport(resumeIds, { isAdmin, userFirmId }) {
    if (!Array.isArray(resumeIds) || resumeIds.length === 0) {
        return [];
    }

    const params = [resumeIds];
    let sql = 'SELECT * FROM resumes WHERE id = ANY($1::uuid[])';

    if (!isAdmin) {
        if (!userFirmId) {
            return [];
        }
        params.push(userFirmId);
        sql += ' AND firm_id = $2';
    }

    const result = await query(sql, params);
    return result.rows;
}
