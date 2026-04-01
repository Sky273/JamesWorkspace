/**
 * Templates Service
 * Data access layer for CV templates
 * Extracted from templates/crud.routes.js for separation of concerns
 */

import { query } from '../config/database.js';
import { escapeLike } from '../utils/postgresHelpers.js';

/**
 * Allowed column names for dynamic INSERT/UPDATE on the templates table.
 * Any key not in this set is silently dropped to prevent SQL injection.
 */
const ALLOWED_COLUMNS = new Set([
    'name', 'description', 'popular', 'status', 'tags', 'preview_image_url',
    'header_content', 'template_content', 'footer_content', 'footer_height',
    'stylesheet', 'firm_id'
]);

/**
 * List templates with pagination and filters
 * @param {Object} options
 * @param {boolean} options.isAdmin
 * @param {string|null} options.userFirmId
 * @param {string} [options.search]
 * @param {string} [options.status]
 * @param {number} [options.page=1]
 * @param {number} [options.limit=100]
 * @returns {Promise<{templates: Array, totalCount: number, hasMore: boolean}>}
 */
export async function listTemplates({ isAdmin, userFirmId, search, status, page = 1, limit = 100 }) {
    const offset = (page - 1) * limit;
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    // Firm filter: non-admins see only their firm's templates + global templates
    if (!isAdmin) {
        if (userFirmId) {
            conditions.push(`(t.firm_id = $${paramIndex} OR t.firm_id IS NULL)`);
            params.push(userFirmId);
            paramIndex++;
        } else {
            conditions.push('t.firm_id IS NULL');
        }
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

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Count total
    const countResult = await query(
        `SELECT COUNT(*) as total FROM templates t ${whereClause}`,
        params
    );
    const totalCount = parseInt(countResult.rows[0]?.total || 0);

    // Fetch with firm name join
    const dataResult = await query(
        `SELECT t.*, f.name as firm_name
         FROM templates t
         LEFT JOIN firms f ON t.firm_id = f.id
         ${whereClause}
         ORDER BY t.name ASC
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...params, limit + 1, offset]
    );

    const hasMore = dataResult.rows.length > limit;
    const templates = hasMore ? dataResult.rows.slice(0, limit) : dataResult.rows;

    return { templates, totalCount, hasMore };
}

/**
 * Get a template by ID
 * @param {string} id
 * @returns {Promise<Object>}
 * @throws {Object} error with statusCode 404
 */
export async function getTemplateById(id) {
    const result = await query('SELECT * FROM templates WHERE id = $1', [id]);
    if (result.rows.length === 0) {
        const err = new Error('Template not found');
        err.statusCode = 404;
        throw err;
    }
    return result.rows[0];
}

/**
 * Check if a firm exists and return its id/name
 * @param {string} firmId
 * @returns {Promise<{id: string, name: string}|null>}
 */
export async function getFirmIfExists(firmId) {
    const result = await query('SELECT id, name FROM firms WHERE id = $1', [firmId]);
    return result.rows.length > 0 ? result.rows[0] : null;
}

/**
 * Create a template
 * @param {Object} templateData
 * @returns {Promise<Object>} created template
 */
export async function createTemplate(templateData) {
    const fields = [];
    const values = [];
    const placeholders = [];
    let idx = 1;

    for (const [key, value] of Object.entries(templateData)) {
        if (value !== undefined && ALLOWED_COLUMNS.has(key)) {
            fields.push(key);
            values.push(value);
            placeholders.push(`$${idx}`);
            idx++;
        }
    }

    const result = await query(
        `INSERT INTO templates (${fields.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
        values
    );
    return result.rows[0];
}

/**
 * Update a template
 * @param {string} id
 * @param {Object} templateData
 * @returns {Promise<Object>} updated template
 * @throws {Object} error with statusCode 404
 */
export async function updateTemplate(id, templateData) {
    const setClauses = [];
    const params = [];
    let idx = 1;

    for (const [key, value] of Object.entries(templateData)) {
        if (value !== undefined && ALLOWED_COLUMNS.has(key)) {
            setClauses.push(`${key} = $${idx}`);
            params.push(value);
            idx++;
        }
    }

    if (setClauses.length === 0) {
        return getTemplateById(id);
    }

    setClauses.push(`updated_at = CURRENT_TIMESTAMP`);
    params.push(id);

    const result = await query(
        `UPDATE templates SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`,
        params
    );

    if (result.rows.length === 0) {
        const err = new Error('Template not found');
        err.statusCode = 404;
        throw err;
    }
    return result.rows[0];
}

/**
 * Delete a template
 * @param {string} id
 * @returns {Promise<boolean>}
 * @throws {Object} error with statusCode 404
 */
export async function deleteTemplate(id) {
    const result = await query('DELETE FROM templates WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
        const err = new Error('Template not found');
        err.statusCode = 404;
        throw err;
    }
    return true;
}
