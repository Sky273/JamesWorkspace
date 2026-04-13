/**
 * Clients Service
 * Data access layer for clients and client contacts
 * Extracted from clients.routes.js for separation of concerns
 */

import { query } from '../config/database.js';
import { escapeLike } from '../utils/postgresHelpers.js';
import {
    CACHE_KEYS,
    clientsCache,
    invalidateClientsCaches,
    invalidateDealsCaches,
    invalidateMissionsCaches
} from './cache.service.js';

// ============================================
// CLIENTS
// ============================================

/**
 * List clients with pagination, search, type filter and firm segregation
 * @param {Object} options
 * @param {number} options.page
 * @param {number} options.limit
 * @param {string} [options.search]
 * @param {string} [options.type]
 * @param {string} [options.firmId] - null for admin (no filter)
 * @returns {Promise<{data: Array, pagination: Object}>}
 */
export async function listClients({ page = 1, limit = 20, search, type, firmId, bypassCache = false }) {
    page = Number.isInteger(page) && page > 0 ? page : 1;
    limit = Number.isInteger(limit) ? Math.min(Math.max(limit, 1), 100) : 20;
    const cacheKey = JSON.stringify({ page, limit, search: search || '', type: type || '', firmId: firmId || null });

    const loader = async () => {
        const offset = (page - 1) * limit;
        const conditions = [];
        const params = [];
        let paramIndex = 1;

        if (firmId) {
            conditions.push(`c.firm_id = $${paramIndex}`);
            params.push(firmId);
            paramIndex++;
        }

        if (search) {
            conditions.push(`(LOWER(c.name) LIKE $${paramIndex} OR LOWER(c.industry) LIKE $${paramIndex})`);
            params.push(`%${escapeLike(search.toLowerCase())}%`);
            paramIndex++;
        }

        if (type && ['client', 'prospect'].includes(type)) {
            conditions.push(`c.type = $${paramIndex}`);
            params.push(type);
            paramIndex++;
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        const clientsQuery = `
            SELECT c.*, f.name as firm_name,
                (SELECT COUNT(*) FROM client_contacts cc WHERE cc.client_id = c.id) as contacts_count,
                (SELECT COUNT(*) FROM resume_submissions rs WHERE rs.client_id = c.id) as submissions_count
            FROM clients c
            LEFT JOIN firms f ON c.firm_id = f.id
            ${whereClause}
            ORDER BY c.name ASC
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `;
        params.push(limit + 1, offset);

        const result = await query(clientsQuery, params);
        const clients = result.rows;

        const hasMore = clients.length > limit;
        if (hasMore) {
            clients.pop();
        }

        let totalCount = null;
        if (page === 1) {
            const countParams = params.slice(0, -2);
            const countQuery = `SELECT COUNT(*) as count FROM clients c ${whereClause}`;
            const countResult = await query(countQuery, countParams);
            totalCount = parseInt(countResult.rows[0].count);
        }

        return {
            data: clients,
            pagination: {
                page,
                limit,
                hasMore,
                totalCount,
                nextPage: hasMore ? page + 1 : null
            }
        };
    };

    if (bypassCache) {
        return loader();
    }

    return clientsCache.getOrLoad(cacheKey, loader, {
        scope: CACHE_KEYS.clients.ALL_CLIENTS
    });
}

/**
 * Get distinct industries from industry_aliases
 * @returns {Promise<string[]>}
 */
export async function listIndustries() {
    return clientsCache.getOrLoad(CACHE_KEYS.clients.INDUSTRIES, async () => {
        const result = await query(
            `SELECT DISTINCT canonical_name 
             FROM industry_aliases 
             ORDER BY canonical_name ASC`
        );
        return result.rows.map(row => row.canonical_name);
    }, {
        scope: CACHE_KEYS.clients.INDUSTRIES
    });
}

/**
 * Get a client by ID with contacts and recent submissions
 * @param {string} id
 * @returns {Promise<Object|null>}
 */
export async function getClientById(id, { bypassCache = false } = {}) {
    const loader = async () => {
        const clientResult = await query(
            `SELECT c.*, f.name as firm_name
             FROM clients c
             LEFT JOIN firms f ON c.firm_id = f.id
             WHERE c.id = $1`,
            [id]
        );

        if (clientResult.rows.length === 0) {
            return null;
        }

        const client = clientResult.rows[0];

        const contactsResult = await query(
            `SELECT * FROM client_contacts WHERE client_id = $1 ORDER BY is_primary DESC, name ASC`,
            [id]
        );

        const submissionsResult = await query(
            `SELECT rs.*, r.name as resume_name, r.title as resume_title,
                    cc.name as contact_name, m.title as mission_title,
                    u.name as sent_by_name
             FROM resume_submissions rs
             LEFT JOIN resumes r ON rs.resume_id = r.id
             LEFT JOIN client_contacts cc ON rs.contact_id = cc.id
             LEFT JOIN missions m ON rs.mission_id = m.id
             LEFT JOIN users u ON rs.sent_by = u.id
             WHERE rs.client_id = $1
             ORDER BY rs.sent_at DESC
             LIMIT 10`,
            [id]
        );

        return {
            ...client,
            contacts: contactsResult.rows,
            recentSubmissions: submissionsResult.rows
        };
    };

    if (bypassCache) {
        return loader();
    }

    return clientsCache.getOrLoad(`detail:${id}`, loader, {
        scope: CACHE_KEYS.clients.ALL_CLIENTS
    });
}

/**
 * Validate that a firm exists
 * @param {string} firmId
 * @returns {Promise<{id: string, name: string}|null>}
 */
export async function validateFirm(firmId) {
    const result = await query('SELECT id, name FROM firms WHERE id = $1', [firmId]);
    return result.rows.length > 0 ? result.rows[0] : null;
}

/**
 * Create a new client
 * @param {Object} data
 * @param {string} data.firmId
 * @param {string} data.name
 * @param {string} [data.type]
 * @param {string} [data.status]
 * @param {string} [data.address]
 * @param {string} [data.website]
 * @param {string} [data.industry]
 * @param {string} [data.notes]
 * @param {string} [data.createdBy]
 * @returns {Promise<Object>}
 */
export async function createClient({ firmId, name, type, status, address, website, industry, notes, createdBy }) {
    const result = await query(
        `INSERT INTO clients (firm_id, name, type, status, address, website, industry, notes, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
            firmId,
            name,
            type || 'prospect',
            status || 'active',
            address || null,
            website || null,
            industry || null,
            notes || null,
            createdBy
        ]
    );
    await Promise.all([
        invalidateClientsCaches(),
        invalidateDealsCaches(),
        invalidateMissionsCaches()
    ]);
    return result.rows[0];
}

/**
 * Find a client by ID (lightweight, for access checks)
 * @param {string} id
 * @returns {Promise<Object|null>}
 */
export async function findClient(id) {
    const result = await query('SELECT * FROM clients WHERE id = $1', [id]);
    return result.rows.length > 0 ? result.rows[0] : null;
}

/**
 * Update a client
 * @param {string} id
 * @param {Object} data
 * @returns {Promise<Object>}
 */
export async function updateClient(id, { name, type, status, address, website, industry, notes, firmId }) {
    const result = await query(
        `UPDATE clients 
         SET name = COALESCE($1, name),
             type = COALESCE($2, type),
             status = COALESCE($3, status),
             address = $4,
             website = $5,
             industry = $6,
             notes = $7,
             firm_id = $8,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $9
         RETURNING *`,
        [name, type, status, address, website, industry, notes, firmId, id]
    );
    if (result.rows.length === 0) {
        const err = new Error('Client not found');
        err.statusCode = 404;
        throw err;
    }
    await Promise.all([
        invalidateClientsCaches(),
        invalidateDealsCaches(),
        invalidateMissionsCaches()
    ]);
    return result.rows[0];
}

/**
 * Count submissions for a client
 * @param {string} clientId
 * @returns {Promise<number>}
 */
export async function countClientSubmissions(clientId) {
    const result = await query(
        'SELECT COUNT(*) as count FROM resume_submissions WHERE client_id = $1',
        [clientId]
    );
    return parseInt(result.rows[0].count);
}

/**
 * Delete a client by ID
 * @param {string} id
 */
export async function deleteClient(id) {
    const result = await query('DELETE FROM clients WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
        const err = new Error('Client not found');
        err.statusCode = 404;
        throw err;
    }
    await Promise.all([
        invalidateClientsCaches(),
        invalidateDealsCaches(),
        invalidateMissionsCaches()
    ]);
}

// ============================================
// CONTACTS
// ============================================

/**
 * Check client exists and return its firm_id (for access checks)
 * @param {string} clientId
 * @returns {Promise<{firm_id: string}|null>}
 */
export async function getClientFirmId(clientId) {
    const result = await query('SELECT firm_id FROM clients WHERE id = $1', [clientId]);
    return result.rows.length > 0 ? result.rows[0] : null;
}

/**
 * List contacts for a client
 * @param {string} clientId
 * @returns {Promise<Array>}
 */
export async function listContacts(clientId, { bypassCache = false } = {}) {
    const loader = async () => {
        const result = await query(
            `SELECT * FROM client_contacts WHERE client_id = $1 ORDER BY is_primary DESC, name ASC`,
            [clientId]
        );
        return result.rows;
    };

    if (bypassCache) {
        return loader();
    }

    return clientsCache.getOrLoad(`contacts:${clientId}`, loader, {
        scope: CACHE_KEYS.clients.ALL_CLIENTS
    });
}

/**
 * Create a contact for a client
 * @param {string} clientId
 * @param {Object} data
 * @returns {Promise<Object>}
 */
export async function createContact(clientId, { name, role, email, phone, is_primary }) {
    // If setting as primary, unset other primaries
    if (is_primary) {
        await query('UPDATE client_contacts SET is_primary = false WHERE client_id = $1', [clientId]);
    }

    const result = await query(
        `INSERT INTO client_contacts (client_id, name, role, email, phone, is_primary)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [clientId, name, role || null, email || null, phone || null, is_primary || false]
    );
    await Promise.all([
        invalidateClientsCaches(),
        invalidateDealsCaches(),
        invalidateMissionsCaches()
    ]);
    return result.rows[0];
}

/**
 * Update a contact
 * @param {string} contactId
 * @param {string} clientId
 * @param {Object} data
 * @returns {Promise<Object|null>}
 */
export async function updateContact(contactId, clientId, { name, role, email, phone, is_primary }) {
    // If setting as primary, unset other primaries
    if (is_primary) {
        await query('UPDATE client_contacts SET is_primary = false WHERE client_id = $1 AND id != $2', [clientId, contactId]);
    }

    const result = await query(
        `UPDATE client_contacts 
         SET name = COALESCE($1, name),
             role = $2,
             email = $3,
             phone = $4,
             is_primary = COALESCE($5, is_primary),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $6 AND client_id = $7
         RETURNING *`,
        [name, role, email, phone, is_primary, contactId, clientId]
    );
    if (result.rows.length === 0) {
        return null;
    }
    await Promise.all([
        invalidateClientsCaches(),
        invalidateDealsCaches(),
        invalidateMissionsCaches()
    ]);
    return result.rows[0];
}

/**
 * Count submissions for a contact
 * @param {string} contactId
 * @returns {Promise<number>}
 */
export async function countContactSubmissions(contactId) {
    const result = await query(
        'SELECT COUNT(*) as count FROM resume_submissions WHERE contact_id = $1',
        [contactId]
    );
    return parseInt(result.rows[0].count);
}

/**
 * Delete a contact
 * @param {string} contactId
 * @param {string} clientId
 * @returns {Promise<boolean>} true if deleted, false if not found
 */
export async function deleteContact(contactId, clientId) {
    const result = await query(
        'DELETE FROM client_contacts WHERE id = $1 AND client_id = $2 RETURNING id',
        [contactId, clientId]
    );
    if (result.rows.length === 0) {
        return false;
    }
    await Promise.all([
        invalidateClientsCaches(),
        invalidateDealsCaches(),
        invalidateMissionsCaches()
    ]);
    return true;
}
