/**
 * Users Service
 * Data access layer for user profile operations
 * Extracted from routes/users.routes.js
 */

import { query } from '../config/database.js';
import { selectWithTimeout, escapeLike, createWithTimeout, updateWithTimeout, destroyWithTimeout } from '../utils/postgresHelpers.js';

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

// ============================================
// Admin CRUD operations (from auth/users.routes.js)
// ============================================

/**
 * Find existing user by email (case-insensitive)
 * @param {string} normalizedEmail - Lowercase email
 * @returns {Promise<Object|null>}
 */
export async function findUserByEmail(normalizedEmail) {
    const users = await selectWithTimeout('users', {
        where: 'LOWER(email) = $1',
        params: [normalizedEmail],
        limit: 1
    });
    return users.length > 0 ? users[0] : null;
}

/**
 * Find firm by name
 * @param {string} firmName
 * @returns {Promise<Object|null>}
 */
export async function findFirmByName(firmName) {
    const firms = await selectWithTimeout('firms', {
        where: 'name = $1',
        params: [firmName],
        limit: 1
    });
    return firms.length > 0 ? firms[0] : null;
}

/**
 * Create a user (admin CRUD)
 * @param {Object} userData - Fields for the new user record
 * @returns {Promise<Object>} Created user record
 */
export async function createAdminUser(userData) {
    const records = await createWithTimeout('users', [{
        fields: userData
    }]);
    return records[0];
}

/**
 * Find user by ID
 * @param {string} id
 * @returns {Promise<Object|null>}
 */
export async function findUserById(id) {
    const users = await selectWithTimeout('users', {
        where: 'id = $1',
        params: [id],
        limit: 1
    });
    return users.length > 0 ? users[0] : null;
}

/**
 * Update user by ID (admin CRUD)
 * @param {string} id - User ID
 * @param {Object} fields - Fields to update
 * @returns {Promise<Object>} Updated user record
 */
export async function updateAdminUser(id, fields) {
    const records = await updateWithTimeout('users', [{
        id,
        fields
    }]);
    return records[0];
}

/**
 * Delete user by ID
 * @param {string} id
 * @returns {Promise<string[]>} Deleted IDs
 */
export async function deleteUser(id) {
    return destroyWithTimeout('users', [id]);
}

/**
 * List all users (no filters, for admin overview)
 * @returns {Promise<Object[]>}
 */
export async function listAllUsers() {
    return selectWithTimeout('users', {});
}
