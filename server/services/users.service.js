/**
 * Users Service
 * Data access layer for user profile operations
 * Extracted from routes/users.routes.js
 */

import { query } from '../config/database.js';
import { selectWithTimeout, escapeLike } from '../utils/postgresHelpers.js';

/**
 * List users with pagination and filters
 * @param {Object} options - { search, role, status, page, limit }
 * @returns {Promise<{ users: Object[], hasMore: boolean }>}
 */
export async function listUsers({ search, role, status, page = 1, limit = 100 } = {}) {
    const offset = (page - 1) * limit;
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (search) {
        conditions.push(`(LOWER(name) LIKE $${paramIndex} OR LOWER(email) LIKE $${paramIndex})`);
        params.push(`%${escapeLike(search.toLowerCase())}%`);
        paramIndex++;
    }

    if (role && role !== 'all') {
        conditions.push(`role = $${paramIndex}`);
        params.push(role.toLowerCase());
        paramIndex++;
    }

    if (status && status !== 'all') {
        conditions.push(`status = $${paramIndex}`);
        params.push(status.toLowerCase());
        paramIndex++;
    }

    const whereClause = conditions.length > 0 ? conditions.join(' AND ') : '';

    const users = await selectWithTimeout('users', {
        where: whereClause,
        params: params,
        orderBy: 'name ASC',
        limit: limit + 1,
        offset: offset
    });

    const hasMore = users.length > limit;
    if (hasMore) {
        users.pop();
    }

    return { users, hasMore };
}

/**
 * Update user profile with dynamic fields
 * @param {string} id - User ID
 * @param {Object} fields - Fields to update (name, jobTitle, phone, role, status, firm_id)
 * @param {boolean} isAdmin - Whether the caller is an admin
 * @returns {Promise<Object|null>} Updated user or null if not found
 */
export async function updateUserProfile(id, fields, isAdmin) {
    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (fields.name !== undefined) {
        updates.push(`name = $${paramIndex++}`);
        params.push(fields.name);
    }

    if (fields.jobTitle !== undefined) {
        updates.push(`job_title = $${paramIndex++}`);
        params.push(fields.jobTitle);
    }

    if (fields.phone !== undefined) {
        updates.push(`phone = $${paramIndex++}`);
        params.push(fields.phone);
    }

    // Admin-only fields
    if (isAdmin) {
        if (fields.role !== undefined) {
            updates.push(`role = $${paramIndex++}`);
            params.push(fields.role.toLowerCase());
        }

        if (fields.status !== undefined) {
            updates.push(`status = $${paramIndex++}`);
            params.push(fields.status.toLowerCase());
        }

        if (fields.firm_id !== undefined) {
            updates.push(`firm_id = $${paramIndex++}`);
            params.push(fields.firm_id);
        }
    }

    if (updates.length === 0) {
        return { noFields: true };
    }

    // Add updated_at
    updates.push(`updated_at = CURRENT_TIMESTAMP`);

    // Add user ID to params
    params.push(id);

    const result = await query(
        `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
        params
    );

    return result.rows.length > 0 ? result.rows[0] : null;
}
