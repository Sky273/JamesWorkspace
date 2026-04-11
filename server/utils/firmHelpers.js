/**
 * Firm Helpers
 * Centralized functions for firm-related operations
 */

import { query } from '../config/database.js';
import { safeLog } from './logger.backend.js';

// Helper to validate UUID format
export const isValidUUID = (str) => {
    if (!str || typeof str !== 'string') return false;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
};

export const getUserFirmIdFromUser = (user) => {
    if (!user || typeof user !== 'object') {
        return null;
    }

    return user.firm_id ?? user.firmId ?? null;
};

export const getUserFirmNameFromUser = (user) => {
    if (!user || typeof user !== 'object') {
        return null;
    }

    return user.firmName ?? user.firm_name ?? null;
};

function getNormalizedUserRole(req) {
    return req?.user?.role?.toLowerCase().trim() || '';
}

/**
 * Get user's firm_id from request
 * Uses only firm_id (UUID) - no fallback to firm name
 * @param {Object} req - Express request object
 * @returns {string|null} - firm_id UUID or null
 */
export const getUserFirmId = async (req) => {
    const firmId = getUserFirmIdFromUser(req?.user);

    if (firmId && isValidUUID(firmId)) {
        return firmId;
    }
    
    // If no valid firm_id, log warning and return null
    // We do NOT fallback to firm name lookup to avoid mismatches
    if (firmId) {
        safeLog('warn', 'Invalid firm_id format in user token', { 
            firmId, 
            userId: req.user?.id 
        });
    }
    
    return null;
};

/**
 * Get user's firm name from request
 * @param {Object} req - Express request object
 * @returns {string|null} - firm name or null
 */
export const getUserFirmName = (req) => {
    return getUserFirmNameFromUser(req?.user);
};

/**
 * Get firm details by ID
 * @param {string} firmId - firm UUID
 * @returns {Object|null} - { id, name } or null
 */
export const getFirmById = async (firmId) => {
    if (!firmId || !isValidUUID(firmId)) {
        return null;
    }
    
    try {
        const result = await query('SELECT id, name FROM firms WHERE id = $1', [firmId]);
        if (result.rows.length > 0) {
            return result.rows[0];
        }
    } catch (error) {
        safeLog('error', 'Error fetching firm by ID', { firmId, error: error.message });
    }
    
    return null;
};

export function isUserAdmin(req) {
    return getNormalizedUserRole(req) === 'admin';
}

export function isUserLocalAdmin(req) {
    return getNormalizedUserRole(req) === 'localadmin';
}

export function isUserManager(req) {
    const role = getNormalizedUserRole(req);
    return role === 'admin' || role === 'localadmin';
}
