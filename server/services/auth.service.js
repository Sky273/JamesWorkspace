/**
 * Auth Service
 * Data access layer for authentication operations
 * Extracted from auth/signin.routes.js and auth/google.routes.js
 */

import { query } from '../config/database.js';
import { selectWithTimeout, createWithTimeout } from '../utils/postgresHelpers.js';

/**
 * Find user with firm logo by email (case-insensitive)
 * @param {string} normalizedEmail - Lowercase email
 * @returns {Promise<Object|null>}
 */
export async function findUserWithFirmByEmail(normalizedEmail) {
    const users = await selectWithTimeout('users', {
        rawQuery: `
            SELECT u.*, f.logo_url as firm_logo
            FROM users u
            LEFT JOIN firms f ON u.firm_id = f.id
            WHERE LOWER(u.email) = $1
            LIMIT 1
        `,
        rawParams: [normalizedEmail]
    });
    return users.length > 0 ? users[0] : null;
}

/**
 * Find user with firm logo by ID
 * @param {string} userId
 * @returns {Promise<Object|null>}
 */
export async function findUserWithFirmById(userId) {
    const users = await selectWithTimeout('users', {
        rawQuery: `
            SELECT u.*, f.logo_url as firm_logo
            FROM users u
            LEFT JOIN firms f ON u.firm_id = f.id
            WHERE u.id = $1
            LIMIT 1
        `,
        rawParams: [userId]
    });
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
    const records = await createWithTimeout('users', [{
        fields: userData
    }]);
    return records[0];
}

/**
 * Register a new user via Google OAuth
 * @param {Object} data - { email, name, googleId, googleEmail }
 * @returns {Promise<Object>} Created user record
 */
export async function registerGoogleUser({ email, name, googleId, googleEmail }) {
    const result = await query(
        `INSERT INTO users (email, password, name, role, status, google_id, google_email, google_linked_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
         RETURNING *`,
        [email, '', name, 'user', 'pending', googleId, googleEmail]
    );
    return result.rows[0];
}
