/**
 * Auth Service
 * Data access layer for authentication operations
 * Extracted from auth/signin.routes.js and auth/google.routes.js
 */

import { getClient, query } from '../config/database.js';
import { createWithTimeout, selectRawWithTimeout, selectWithTimeout } from '../utils/postgresHelpers.js';
import { safeLog } from '../utils/logger.backend.js';
import { getLLMSettings } from './settings.service.js';
import { getInitialFirmCredits } from '../config/aiCredits.js';

const DEFAULT_SELF_SERVICE_FIRM_NAME = 'Public Registration';
const AUTO_APPROVED_SELF_SERVICE_FIRM_NAME = 'Cabinet test';
const MAX_AUTO_APPROVED_FIRM_NAME_ATTEMPTS = 100;

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

export async function registerSelfServiceUser({ email, password = '', name, googleId = null, googleEmail = null }) {
    const registrationSettings = await resolveSelfServiceRegistrationSettings();

    if (registrationSettings.allowWithoutApproval) {
        const user = await createAutoApprovedSelfServiceUser({
            email,
            password,
            name,
            googleId,
            googleEmail,
            settings: registrationSettings.settings
        });

        return {
            user,
            autoApproved: true
        };
    }

    if (googleId) {
        const user = await registerGoogleUser({
            email,
            name,
            googleId,
            googleEmail
        });

        return {
            user,
            autoApproved: false
        };
    }

    const user = await createUser({
        email,
        password,
        name,
        role: 'user',
        status: 'pending'
    });

    return {
        user,
        autoApproved: false
    };
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

async function resolveSelfServiceRegistrationSettings() {
    try {
        const settings = await getLLMSettings();
        return {
            settings,
            allowWithoutApproval: settings?.allowUserRegistrationWithoutApproval === true
        };
    } catch (error) {
        safeLog('warn', 'Self-service registration settings unavailable, using approval workflow', {
            error: error.message
        });
        return {
            settings: null,
            allowWithoutApproval: false
        };
    }
}

async function createAutoApprovedSelfServiceUser({ email, password, name, googleId, googleEmail, settings }) {
    const client = await getClient();

    try {
        await client.query('BEGIN');

        const credits = getInitialFirmCredits(settings);
        const firm = await createDedicatedAutoApprovedFirm(client, credits);
        const userResult = await client.query(
            `INSERT INTO users (
                email, password, name, role, status, google_id, google_email, google_linked_at, firm_id, firm_name
             ) VALUES (
                $1, $2, $3, 'user', 'active', $4, $5, $6, $7, $8
             )
             RETURNING *`,
            [email, password, name, googleId, googleEmail, googleId ? new Date() : null, firm.id, firm.name]
        );

        await client.query('COMMIT');
        return userResult.rows[0];
    } catch (error) {
        await client.query('ROLLBACK');
        safeLog('error', 'Auto-approved self-service registration failed', {
            email,
            error: error.message,
            code: error.code,
            detail: error.detail,
            constraint: error.constraint
        });
        throw error;
    } finally {
        client.release();
    }
}

async function createDedicatedAutoApprovedFirm(client, credits) {
    for (let attempt = 0; attempt < MAX_AUTO_APPROVED_FIRM_NAME_ATTEMPTS; attempt++) {
        const firmName = attempt === 0
            ? AUTO_APPROVED_SELF_SERVICE_FIRM_NAME
            : `${AUTO_APPROVED_SELF_SERVICE_FIRM_NAME} ${attempt + 1}`;
        const savepointName = `auto_approved_firm_name_${attempt}`;

        await client.query(`SAVEPOINT ${savepointName}`);

        try {
            const firmResult = await client.query(
                `INSERT INTO firms (name, status, credits)
                 VALUES ($1, 'active', $2)
                 RETURNING id, name`,
                [firmName, credits]
            );

            await client.query(`RELEASE SAVEPOINT ${savepointName}`);
            return firmResult.rows[0];
        } catch (error) {
            if (error?.code === '23505') {
                await client.query(`ROLLBACK TO SAVEPOINT ${savepointName}`);
                continue;
            }
            await client.query(`ROLLBACK TO SAVEPOINT ${savepointName}`).catch(() => {});
            throw error;
        }
    }

    throw new Error('Unable to allocate a dedicated test firm name');
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
