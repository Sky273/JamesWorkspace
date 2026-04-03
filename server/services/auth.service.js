/**
 * Auth Service
 * Data access layer for authentication operations
 * Extracted from auth/signin.routes.js and auth/google.routes.js
 */

import { query } from '../config/database.js';
import { createWithTimeout, selectRawWithTimeout, selectWithTimeout } from '../utils/postgresHelpers.js';

const DEFAULT_SELF_SERVICE_FIRM_NAME = 'Public Registration';

/**
 * Find user with firm logo by email (case-insensitive)
 * @param {string} normalizedEmail - Lowercase email
 * @returns {Promise<Object|null>}
 */
export async function findUserWithFirmByEmail(normalizedEmail) {
    const users = await selectRawWithTimeout(
        `
            SELECT u.*, f.logo_url as firm_logo
            FROM users u
            LEFT JOIN firms f ON u.firm_id = f.id
            WHERE LOWER(u.email) = $1
            LIMIT 1
        `,
        [normalizedEmail],
        { context: 'auth.findUserWithFirmByEmail' }
    );
    return users.length > 0 ? users[0] : null;
}

/**
 * Find user with firm logo by ID
 * @param {string} userId
 * @returns {Promise<Object|null>}
 */
export async function findUserWithFirmById(userId) {
    const users = await selectRawWithTimeout(
        `
            SELECT u.*, f.logo_url as firm_logo
            FROM users u
            LEFT JOIN firms f ON u.firm_id = f.id
            WHERE u.id = $1
            LIMIT 1
        `,
        [userId],
        { context: 'auth.findUserWithFirmById' }
    );
    return users.length > 0 ? users[0] : null;
}

/**
 * Update last login timestamp for a user
 * @param {string} userId
 * @returns {Promise<void>}
 */
export async function updateLastLogin(userId) {
    await query(
        'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
        [userId]
    );
}

/**
 * Check if a user with the given email already exists
 * @param {string} normalizedEmail - Lowercase email
 * @returns {Promise<Object|null>}
 */
export async function findExistingUserByEmail(normalizedEmail) {
    const users = await selectWithTimeout('users', {
        where: 'LOWER(email) = $1',
        params: [normalizedEmail],
        limit: 1
    });
    return users.length > 0 ? users[0] : null;
}

/**
 * Create a new user (standard registration)
 * @param {Object} userData - { email, password, name, role, status }
 * @returns {Promise<Object>} Created user record
 */
export async function createUser(userData) {
    const firmAssignment = await resolveFirmAssignment(userData);

    const records = await createWithTimeout('users', [{
        fields: {
            ...userData,
            firm_id: firmAssignment.firm_id,
            firm_name: firmAssignment.firm_name
        }
    }]);
    return records[0];
}

/**
 * Register a new user via Google OAuth
 * @param {Object} data - { email, name, googleId, googleEmail }
 * @returns {Promise<Object>} Created user record
 */
export async function registerGoogleUser({ email, name, googleId, googleEmail, firmId, firmName }) {
    const firmAssignment = await resolveFirmAssignment({
        firm_id: firmId,
        firm_name: firmName
    });

    const result = await query(
        `INSERT INTO users (email, password, name, role, status, google_id, google_email, google_linked_at, firm_id, firm_name)
         VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, $8, $9)
         RETURNING *`,
        [email, '', name, 'user', 'pending', googleId, googleEmail, firmAssignment.firm_id, firmAssignment.firm_name]
    );
    return result.rows[0];
}

async function resolveFirmAssignment(userData) {
    if (userData?.firm_id && userData?.firm_name) {
        return {
            firm_id: userData.firm_id,
            firm_name: userData.firm_name
        };
    }

    const existingFirm = await query(
        `SELECT id, name
         FROM firms
         WHERE LOWER(name) = LOWER($1)
         ORDER BY created_at ASC
         LIMIT 1`,
        [DEFAULT_SELF_SERVICE_FIRM_NAME]
    );

    if (existingFirm.rows[0]) {
        return {
            firm_id: existingFirm.rows[0].id,
            firm_name: existingFirm.rows[0].name
        };
    }

    const createdFirm = await query(
        `INSERT INTO firms (name, status)
         VALUES ($1, 'active')
         RETURNING id, name`,
        [DEFAULT_SELF_SERVICE_FIRM_NAME]
    );

    return {
        firm_id: createdFirm.rows[0].id,
        firm_name: createdFirm.rows[0].name
    };
}
