/**
 * GDPR Audit Log Service
 * Manages logging of all GDPR-related actions for compliance tracking
 */

import { query } from '../config/database.js';
import { safeLog } from '../utils/logger.backend.js';
import { assertSchemaRequirements } from './schemaVerification.service.js';

// GDPR Action Types
export const GDPR_ACTIONS = {
    // Consent actions
    CONSENT_REQUEST_SENT: 'consent_request_sent',
    CONSENT_REMINDER_SENT: 'consent_reminder_sent',
    CONSENT_GRANTED: 'consent_granted',
    CONSENT_REFUSED: 'consent_refused',
    CONSENT_EXPIRED: 'consent_expired',
    CONSENT_WITHDRAWN: 'consent_withdrawn',
    
    // Data actions
    DATA_EXPORTED: 'data_exported',
    DATA_DELETED: 'data_deleted',
    DATA_ANONYMIZED: 'data_anonymized',
    DATA_RETENTION_EXTENDED: 'data_retention_extended',
    
    // CV actions
    CV_UPLOADED: 'cv_uploaded',
    CV_PROCESSED: 'cv_processed',
    CV_PURGED: 'cv_purged',
    CV_ACCESSED: 'cv_accessed',
    
    // Automated actions
    AUTO_PURGE_EXECUTED: 'auto_purge_executed',
    AUTO_REMINDER_SENT: 'auto_reminder_sent',
    AUTO_CONSENT_EXPIRED: 'auto_consent_expired',
    
    // Admin actions
    SETTINGS_UPDATED: 'settings_updated',
    DPO_SETTINGS_UPDATED: 'dpo_settings_updated',
    RETENTION_POLICY_CHANGED: 'retention_policy_changed'
};

// Action categories for filtering
export const GDPR_CATEGORIES = {
    CONSENT: 'consent',
    DATA: 'data',
    CV: 'cv',
    AUTOMATED: 'automated',
    ADMIN: 'admin'
};

// Map actions to categories
const ACTION_CATEGORY_MAP = {
    [GDPR_ACTIONS.CONSENT_REQUEST_SENT]: GDPR_CATEGORIES.CONSENT,
    [GDPR_ACTIONS.CONSENT_REMINDER_SENT]: GDPR_CATEGORIES.CONSENT,
    [GDPR_ACTIONS.CONSENT_GRANTED]: GDPR_CATEGORIES.CONSENT,
    [GDPR_ACTIONS.CONSENT_REFUSED]: GDPR_CATEGORIES.CONSENT,
    [GDPR_ACTIONS.CONSENT_EXPIRED]: GDPR_CATEGORIES.CONSENT,
    [GDPR_ACTIONS.CONSENT_WITHDRAWN]: GDPR_CATEGORIES.CONSENT,
    [GDPR_ACTIONS.DATA_EXPORTED]: GDPR_CATEGORIES.DATA,
    [GDPR_ACTIONS.DATA_DELETED]: GDPR_CATEGORIES.DATA,
    [GDPR_ACTIONS.DATA_ANONYMIZED]: GDPR_CATEGORIES.DATA,
    [GDPR_ACTIONS.DATA_RETENTION_EXTENDED]: GDPR_CATEGORIES.DATA,
    [GDPR_ACTIONS.CV_UPLOADED]: GDPR_CATEGORIES.CV,
    [GDPR_ACTIONS.CV_PROCESSED]: GDPR_CATEGORIES.CV,
    [GDPR_ACTIONS.CV_PURGED]: GDPR_CATEGORIES.CV,
    [GDPR_ACTIONS.CV_ACCESSED]: GDPR_CATEGORIES.CV,
    [GDPR_ACTIONS.AUTO_PURGE_EXECUTED]: GDPR_CATEGORIES.AUTOMATED,
    [GDPR_ACTIONS.AUTO_REMINDER_SENT]: GDPR_CATEGORIES.AUTOMATED,
    [GDPR_ACTIONS.AUTO_CONSENT_EXPIRED]: GDPR_CATEGORIES.AUTOMATED,
    [GDPR_ACTIONS.SETTINGS_UPDATED]: GDPR_CATEGORIES.ADMIN,
    [GDPR_ACTIONS.DPO_SETTINGS_UPDATED]: GDPR_CATEGORIES.ADMIN,
    [GDPR_ACTIONS.RETENTION_POLICY_CHANGED]: GDPR_CATEGORIES.ADMIN
};

/**
 * Verify the GDPR audit log schema is present
 */
export async function initGdprAuditTable() {
    try {
        await assertSchemaRequirements({
            context: 'GDPR audit log',
            tables: ['gdpr_audit_log'],
            indexes: [
                'idx_gdpr_audit_action',
                'idx_gdpr_audit_category',
                'idx_gdpr_audit_firm_id',
                'idx_gdpr_audit_created_at',
                'idx_gdpr_audit_target_email',
                'idx_gdpr_audit_is_automated'
            ]
        });

        safeLog('info', 'GDPR audit log schema verified');
        return true;
    } catch (error) {
        safeLog('error', 'Failed to verify GDPR audit log schema', {
            error: error.message
        });
        throw error;
    }
}

/**
 * Log a GDPR action
 * @param {Object} params - Action parameters
 * @param {string} params.action - Action type from GDPR_ACTIONS
 * @param {string} [params.firmId] - Firm/cabinet UUID
 * @param {string} [params.firmName] - Firm/cabinet name
 * @param {string} [params.userId] - User who performed the action
 * @param {string} [params.userName] - User name
 * @param {string} [params.targetType] - Type of target (candidate, cv, consent, etc.)
 * @param {string} [params.targetId] - Target UUID
 * @param {string} [params.targetName] - Target name (e.g., candidate name)
 * @param {string} [params.targetEmail] - Target email
 * @param {Object} [params.details] - Additional details as JSON
 * @param {string} [params.ipAddress] - IP address of the request
 * @param {string} [params.userAgent] - User agent string
 * @param {boolean} [params.isAutomated] - Whether this is an automated action
 * @returns {Promise<Object>} Created log entry
 */
export async function logGdprAction({
    action,
    firmId = null,
    firmName = null,
    userId = null,
    userName = null,
    targetType = null,
    targetId = null,
    targetName = null,
    targetEmail = null,
    details = {},
    ipAddress = null,
    userAgent = null,
    isAutomated = false
}) {
    try {
        // Validate action
        if (!Object.values(GDPR_ACTIONS).includes(action)) {
            safeLog('warn', 'Unknown GDPR action type', { action });
        }

        // Get category from action
        const category = ACTION_CATEGORY_MAP[action] || 'unknown';

        const result = await query(`
            INSERT INTO gdpr_audit_log (
                action, category, firm_id, firm_name, user_id, user_name,
                target_type, target_id, target_name, target_email,
                details, ip_address, user_agent, is_automated
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            RETURNING *
        `, [
            action,
            category,
            firmId,
            firmName,
            userId,
            userName,
            targetType,
            targetId,
            targetName,
            targetEmail,
            JSON.stringify(details),
            ipAddress,
            userAgent,
            isAutomated
        ]);

        safeLog('debug', 'GDPR action logged', {
            action,
            category,
            firmId,
            targetType,
            isAutomated
        });

        return result.rows[0];
    } catch (error) {
        safeLog('error', 'Failed to log GDPR action', {
            error: error.message,
            action,
            firmId
        });
        // Don't throw - logging should not break the main flow
        return null;
    }
}

/**
 * Get GDPR audit logs with filtering and pagination
 * @param {Object} filters - Filter options
 * @param {string} [filters.firmId] - Filter by firm
 * @param {string} [filters.action] - Filter by specific action
 * @param {string} [filters.category] - Filter by category
 * @param {string} [filters.userId] - Filter by user
 * @param {string} [filters.targetEmail] - Filter by target email
 * @param {boolean} [filters.isAutomated] - Filter by automated/manual
 * @param {Date} [filters.startDate] - Filter from date
 * @param {Date} [filters.endDate] - Filter to date
 * @param {number} [filters.page] - Page number (1-indexed)
 * @param {number} [filters.limit] - Items per page
 * @param {string} [filters.sortBy] - Sort field
 * @param {string} [filters.sortOrder] - Sort order (asc/desc)
 * @returns {Promise<Object>} Paginated results with logs and metadata
 */
export async function getGdprAuditLogs({
    firmId = null,
    action = null,
    category = null,
    userId = null,
    targetEmail = null,
    isAutomated = null,
    startDate = null,
    endDate = null,
    page = 1,
    limit = 50,
    sortBy = 'created_at',
    sortOrder = 'desc'
} = {}) {
    try {
        const conditions = [];
        const params = [];
        let paramIndex = 1;

        // Build WHERE conditions
        if (firmId) {
            conditions.push(`firm_id = $${paramIndex++}`);
            params.push(firmId);
        }
        if (action) {
            conditions.push(`action = $${paramIndex++}`);
            params.push(action);
        }
        if (category) {
            conditions.push(`category = $${paramIndex++}`);
            params.push(category);
        }
        if (userId) {
            conditions.push(`user_id = $${paramIndex++}`);
            params.push(userId);
        }
        if (targetEmail) {
            conditions.push(`target_email ILIKE $${paramIndex++}`);
            params.push(`%${targetEmail}%`);
        }
        if (isAutomated !== null) {
            conditions.push(`is_automated = $${paramIndex++}`);
            params.push(isAutomated);
        }
        if (startDate) {
            conditions.push(`created_at >= $${paramIndex++}`);
            params.push(startDate);
        }
        if (endDate) {
            conditions.push(`created_at <= $${paramIndex++}`);
            params.push(endDate);
        }

        const whereClause = conditions.length > 0 
            ? `WHERE ${conditions.join(' AND ')}` 
            : '';

        // Validate sort parameters
        const allowedSortFields = ['created_at', 'action', 'category', 'firm_name', 'user_name', 'target_name'];
        const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';
        const safeSortOrder = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

        // Get total count
        const countResult = await query(
            `SELECT COUNT(*) as total FROM gdpr_audit_log ${whereClause}`,
            params
        );
        const total = parseInt(countResult.rows[0].total, 10);

        // Calculate pagination
        const offset = (page - 1) * limit;
        const totalPages = Math.ceil(total / limit);

        // Get logs
        const logsResult = await query(`
            SELECT * FROM gdpr_audit_log
            ${whereClause}
            ORDER BY ${safeSortBy} ${safeSortOrder}
            LIMIT $${paramIndex++} OFFSET $${paramIndex++}
        `, [...params, limit, offset]);

        return {
            logs: logsResult.rows,
            pagination: {
                page,
                limit,
                total,
                totalPages,
                hasNext: page < totalPages,
                hasPrev: page > 1
            }
        };
    } catch (error) {
        safeLog('error', 'Failed to get GDPR audit logs', {
            error: error.message
        });
        throw error;
    }
}

/**
 * Get GDPR audit statistics
 * @param {string} [firmId] - Filter by firm
 * @param {number} [days] - Number of days to look back (default 30)
 * @returns {Promise<Object>} Statistics object
 */
export async function getGdprAuditStats(firmId = null, days = 30) {
    try {
        const firmCondition = firmId ? 'AND firm_id = $2' : '';
        const params = firmId ? [days, firmId] : [days];

        // Actions by category
        const categoryStats = await query(`
            SELECT category, COUNT(*) as count
            FROM gdpr_audit_log
            WHERE created_at >= NOW() - INTERVAL '1 day' * $1 ${firmCondition}
            GROUP BY category
            ORDER BY count DESC
        `, params);

        // Actions by type
        const actionStats = await query(`
            SELECT action, COUNT(*) as count
            FROM gdpr_audit_log
            WHERE created_at >= NOW() - INTERVAL '1 day' * $1 ${firmCondition}
            GROUP BY action
            ORDER BY count DESC
            LIMIT 10
        `, params);

        // Automated vs manual
        const automatedStats = await query(`
            SELECT is_automated, COUNT(*) as count
            FROM gdpr_audit_log
            WHERE created_at >= NOW() - INTERVAL '1 day' * $1 ${firmCondition}
            GROUP BY is_automated
        `, params);

        // Daily activity
        const dailyStats = await query(`
            SELECT DATE(created_at) as date, COUNT(*) as count
            FROM gdpr_audit_log
            WHERE created_at >= NOW() - INTERVAL '1 day' * $1 ${firmCondition}
            GROUP BY DATE(created_at)
            ORDER BY date DESC
        `, params);

        // Total counts
        const totalResult = await query(`
            SELECT COUNT(*) as total
            FROM gdpr_audit_log
            WHERE created_at >= NOW() - INTERVAL '1 day' * $1 ${firmCondition}
        `, params);

        return {
            period: `${days} days`,
            total: parseInt(totalResult.rows[0].total, 10),
            byCategory: categoryStats.rows.reduce((acc, row) => {
                acc[row.category] = parseInt(row.count, 10);
                return acc;
            }, {}),
            byAction: actionStats.rows.map(row => ({
                action: row.action,
                count: parseInt(row.count, 10)
            })),
            automated: {
                automated: parseInt(automatedStats.rows.find(r => r.is_automated)?.count || 0, 10),
                manual: parseInt(automatedStats.rows.find(r => !r.is_automated)?.count || 0, 10)
            },
            dailyActivity: dailyStats.rows.map(row => ({
                date: row.date,
                count: parseInt(row.count, 10)
            }))
        };
    } catch (error) {
        safeLog('error', 'Failed to get GDPR audit stats', {
            error: error.message
        });
        throw error;
    }
}

/**
 * Get list of firms with GDPR activity
 * @returns {Promise<Array>} List of firms
 */
export async function getGdprFirms() {
    try {
        const result = await query(`
            SELECT DISTINCT firm_id, firm_name, COUNT(*) as action_count
            FROM gdpr_audit_log
            WHERE firm_id IS NOT NULL
            GROUP BY firm_id, firm_name
            ORDER BY firm_name
        `);
        return result.rows;
    } catch (error) {
        safeLog('error', 'Failed to get GDPR firms', {
            error: error.message
        });
        throw error;
    }
}

/**
 * Export GDPR audit logs for a specific target (for data portability)
 * @param {string} targetEmail - Target email to export logs for
 * @returns {Promise<Array>} All logs related to the target
 */
export async function exportTargetLogs(targetEmail) {
    try {
        const result = await query(`
            SELECT 
                action, category, firm_name, user_name,
                target_type, target_name, details,
                is_automated, created_at
            FROM gdpr_audit_log
            WHERE target_email = $1
            ORDER BY created_at DESC
        `, [targetEmail]);

        return result.rows;
    } catch (error) {
        safeLog('error', 'Failed to export target logs', {
            error: error.message,
            targetEmail
        });
        throw error;
    }
}
