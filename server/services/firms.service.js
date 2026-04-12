/**
 * Firms Service
 * Data access layer for firms (cabinets)
 * Extracted from firms.routes.js for separation of concerns
 */

import { query } from '../config/database.js';
import { escapeLike } from '../utils/postgresHelpers.js';
import {
    firmsCache,
    CACHE_KEYS,
    invalidateClientsCaches,
    invalidateDealsCaches,
    invalidateFirmsCaches,
    invalidateMissionsCaches
} from './cache.service.js';

/**
 * Allowed column names for dynamic INSERT/UPDATE on the firms table.
 * Any key not in this set is silently dropped to prevent SQL injection.
 */
const ALLOWED_COLUMNS = new Set(['name', 'status', 'logo_url']);

/**
 * List firms with pagination and optional search
 * @param {Object} options
 * @param {string} [options.search]
 * @param {number} [options.page=1]
 * @param {number} [options.limit=100]
 * @returns {Promise<{firms: Array, hasMore: boolean, totalCount: number|null}>}
 */
export async function listFirms({ search, page = 1, limit = 100, bypassCache = false } = {}) {
    const cacheKey = JSON.stringify({
        search: search || '',
        page,
        limit
    });

    const loader = async () => {
        const offset = (page - 1) * limit;
        const conditions = [];
        const params = [];
        let paramIndex = 1;

        if (search) {
            conditions.push(`LOWER(name) LIKE $${paramIndex}`);
            params.push(`%${escapeLike(search.toLowerCase())}%`);
            paramIndex++;
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        const dataResult = await query(
            `SELECT * FROM firms ${whereClause} ORDER BY name ASC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
            [...params, limit + 1, offset]
        );

        const hasMore = dataResult.rows.length > limit;
        const firms = hasMore ? dataResult.rows.slice(0, limit) : dataResult.rows;

        let totalCount = null;
        if (page === 1) {
            const countResult = await query(
                `SELECT COUNT(*) as count FROM firms ${whereClause}`,
                params
            );
            totalCount = parseInt(countResult.rows[0].count, 10);
        }

        return { firms, hasMore, totalCount };
    };

    if (bypassCache) {
        return loader();
    }

    return firmsCache.getOrLoad(cacheKey, loader, {
        scope: CACHE_KEYS.firms.ALL_FIRMS
    });
}

/**
 * Get a firm by ID
 * @param {string} id
 * @returns {Promise<Object>}
 * @throws {Object} error with statusCode 404
 */
export async function getFirmById(id) {
    return firmsCache.getOrLoad(`detail:${id}`, async () => {
        const result = await query('SELECT * FROM firms WHERE id = $1', [id]);
        if (result.rows.length === 0) {
            const err = new Error('Firm not found');
            err.statusCode = 404;
            throw err;
        }
        return result.rows[0];
    }, {
        scope: CACHE_KEYS.firms.ALL_FIRMS
    });
}

/**
 * Create a firm
 * @param {Object} firmData - { name, status, logo_url }
 * @returns {Promise<Object>} created firm
 */
export async function createFirm(firmData) {
    const fields = [];
    const values = [];
    const placeholders = [];
    let idx = 1;

    for (const [key, value] of Object.entries(firmData)) {
        if (value !== undefined && ALLOWED_COLUMNS.has(key)) {
            fields.push(key);
            values.push(value);
            placeholders.push(`$${idx}`);
            idx++;
        }
    }

    const result = await query(
        `INSERT INTO firms (${fields.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
        values
    );
    await Promise.all([
        invalidateFirmsCaches(),
        invalidateClientsCaches(),
        invalidateDealsCaches(),
        invalidateMissionsCaches()
    ]);
    return result.rows[0];
}

/**
 * Update a firm
 * @param {string} id
 * @param {Object} firmData - fields to update
 * @returns {Promise<Object>} updated firm
 * @throws {Object} error with statusCode 404
 */
export async function updateFirm(id, firmData) {
    const setClauses = [];
    const params = [];
    let idx = 1;

    for (const [key, value] of Object.entries(firmData)) {
        if (value !== undefined && ALLOWED_COLUMNS.has(key)) {
            setClauses.push(`${key} = $${idx}`);
            params.push(value);
            idx++;
        }
    }

    if (setClauses.length === 0) {
        return getFirmById(id);
    }

    setClauses.push(`updated_at = CURRENT_TIMESTAMP`);
    params.push(id);

    const result = await query(
        `UPDATE firms SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`,
        params
    );

    if (result.rows.length === 0) {
        const err = new Error('Firm not found');
        err.statusCode = 404;
        throw err;
    }
    await Promise.all([
        invalidateFirmsCaches(),
        invalidateClientsCaches(),
        invalidateDealsCaches(),
        invalidateMissionsCaches()
    ]);
    return result.rows[0];
}

/**
 * Check if a firm has associated users
 * @param {string} firmId
 * @returns {Promise<number>} count of associated users
 */
export async function getAssociatedUsersCount(firmId) {
    const result = await query('SELECT COUNT(*) as count FROM users WHERE firm_id = $1', [firmId]);
    return parseInt(result.rows[0].count);
}

/**
 * Delete a firm
 * @param {string} id
 * @returns {Promise<boolean>}
 * @throws {Object} error with statusCode 404
 */
export async function deleteFirm(id) {
    const result = await query('DELETE FROM firms WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
        const err = new Error('Firm not found');
        err.statusCode = 404;
        throw err;
    }
    await Promise.all([
        invalidateFirmsCaches(),
        invalidateClientsCaches(),
        invalidateDealsCaches(),
        invalidateMissionsCaches()
    ]);
    return true;
}

/**
 * Upload logo data to a firm
 * @param {string} firmId
 * @param {Buffer} logoData
 * @param {string} logoMimeType
 * @returns {Promise<string>} logo URL
 */
export async function uploadFirmLogo(firmId, logoData, logoMimeType) {
    const logoUrl = `/api/firms/${firmId}/logo/image`;
    await query(
        'UPDATE firms SET logo_data = $1, logo_mime_type = $2, logo_url = $3 WHERE id = $4',
        [logoData, logoMimeType, logoUrl, firmId]
    );
    await invalidateFirmsCaches();
    return logoUrl;
}

/**
 * Get logo data for a firm
 * @param {string} firmId
 * @returns {Promise<{logo_data: Buffer, logo_mime_type: string}|null>}
 */
export async function getFirmLogo(firmId) {
    const result = await query(
        'SELECT logo_data, logo_mime_type FROM firms WHERE id = $1',
        [firmId]
    );
    if (result.rows.length === 0 || !result.rows[0].logo_data) {
        return null;
    }
    return result.rows[0];
}

/**
 * Delete logo data from a firm
 * @param {string} firmId
 * @returns {Promise<void>}
 */
export async function deleteFirmLogo(firmId) {
    await query(
        'UPDATE firms SET logo_data = NULL, logo_mime_type = NULL, logo_url = NULL WHERE id = $1',
        [firmId]
    );
    await invalidateFirmsCaches();
}
