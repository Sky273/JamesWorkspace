/**
 * Deals Service
 * Manages deals (affaires) linked to clients/prospects and resumes
 * A deal can contain 0-N resumes, and a resume can be in 0-N deals
 */

import { query } from '../config/database.js';
import { safeLog } from '../utils/logger.backend.js';
import { assertSchemaRequirements } from './schemaVerification.service.js';

// Deal status constants
export const DEAL_STATUS = {
    OPEN: 'open',
    WON: 'won',
    LOST: 'lost',
    ON_HOLD: 'on_hold'
};

// Deal priority constants
export const DEAL_PRIORITY = {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    URGENT: 'urgent'
};

// Deal-Resume status constants
export const DEAL_RESUME_STATUS = {
    PROPOSED: 'proposed',
    SUBMITTED: 'submitted',
    SELECTED: 'selected',
    REJECTED: 'rejected'
};

/**
 * Verify the deals schema is present
 */
export async function initDealsTable() {
    try {
        await assertSchemaRequirements({
            context: 'deals',
            tables: ['deals', 'deal_resumes', 'missions'],
            columns: {
                deals: ['contact_id'],
                missions: ['deal_id']
            },
            indexes: [
                'idx_deals_firm_id',
                'idx_deals_client_id',
                'idx_deals_status',
                'idx_deals_priority',
                'idx_deal_resumes_deal_id',
                'idx_deal_resumes_resume_id',
                'idx_missions_deal_id'
            ]
        });

        safeLog('info', 'Deals schema verified successfully');
    } catch (error) {
        safeLog('error', 'Error verifying deals schema', { error: error.message });
        throw error;
    }
}

/**
 * Create a new deal
 * @param {Object} data - Deal data
 * @param {string} userId - Creator user ID
 * @param {string} firmId - Firm ID
 * @returns {Promise<Object>} Created deal
 */
export async function createDeal(data, userId, firmId) {
    try {
        const {
            title,
            description,
            client_id,
            contact_id,
            status = DEAL_STATUS.OPEN,
            expected_start_date,
            expected_end_date,
            budget_min,
            budget_max,
            priority = DEAL_PRIORITY.MEDIUM,
            tags = [],
            notes
        } = data;

        // Ensure empty strings are converted to null for UUID fields
        const cleanClientId = client_id && client_id.trim() !== '' ? client_id : null;
        const cleanContactId = contact_id && contact_id.trim() !== '' ? contact_id : null;

        safeLog('info', 'createDeal service - preparing insert', {
            firmId,
            client_id: client_id || null,
            contact_id: contact_id || null,
            title,
            status,
            priority
        });

        const result = await query(`
            INSERT INTO deals (
                firm_id, client_id, contact_id, title, description, status,
                expected_start_date, expected_end_date,
                budget_min, budget_max, priority, tags, notes, created_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            RETURNING *
        `, [
            firmId,
            cleanClientId,
            cleanContactId,
            title,
            description || null,
            status,
            expected_start_date || null,
            expected_end_date || null,
            budget_min || null,
            budget_max || null,
            priority,
            JSON.stringify(tags),
            notes || null,
            userId
        ]);

        safeLog('info', 'Deal created', { dealId: result.rows[0].id, title });
        return result.rows[0];
    } catch (error) {
        safeLog('error', 'Error creating deal in service', { error: error.message, stack: error.stack });
        throw error;
    }
}

/**
 * Update a deal
 * @param {string} dealId - Deal ID
 * @param {Object} data - Updated data
 * @returns {Promise<Object>} Updated deal
 */
export async function updateDeal(dealId, data) {
    try {
        const {
            title,
            description,
            client_id,
            contact_id,
            status,
            expected_start_date,
            expected_end_date,
            budget_min,
            budget_max,
            priority,
            tags,
            notes
        } = data;

        const result = await query(`
            UPDATE deals SET
                title = COALESCE($1, title),
                description = COALESCE($2, description),
                client_id = $3,
                contact_id = $4,
                status = COALESCE($5, status),
                expected_start_date = $6,
                expected_end_date = $7,
                budget_min = $8,
                budget_max = $9,
                priority = COALESCE($10, priority),
                tags = COALESCE($11, tags),
                notes = COALESCE($12, notes),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $13
            RETURNING *
        `, [
            title,
            description,
            client_id !== undefined ? client_id : null,
            contact_id !== undefined ? contact_id : null,
            status,
            expected_start_date !== undefined ? expected_start_date : null,
            expected_end_date !== undefined ? expected_end_date : null,
            budget_min !== undefined ? budget_min : null,
            budget_max !== undefined ? budget_max : null,
            priority,
            tags ? JSON.stringify(tags) : null,
            notes,
            dealId
        ]);

        if (result.rows.length === 0) {
            throw new Error('Deal not found');
        }

        safeLog('info', 'Deal updated', { dealId });
        return result.rows[0];
    } catch (error) {
        safeLog('error', 'Error updating deal', { error: error.message, dealId });
        throw error;
    }
}

/**
 * Delete a deal
 * @param {string} dealId - Deal ID
 * @returns {Promise<boolean>} Success
 */
export async function deleteDeal(dealId) {
    try {
        const result = await query('DELETE FROM deals WHERE id = $1 RETURNING id', [dealId]);
        
        if (result.rows.length === 0) {
            throw new Error('Deal not found');
        }

        safeLog('info', 'Deal deleted', { dealId });
        return true;
    } catch (error) {
        safeLog('error', 'Error deleting deal', { error: error.message, dealId });
        throw error;
    }
}

/**
 * Get a deal by ID with client info and resume count
 * @param {string} dealId - Deal ID
 * @returns {Promise<Object|null>} Deal or null
 */
export async function getDealById(dealId) {
    try {
        const result = await query(`
            SELECT d.*,
                   c.name as client_name,
                   c.type as client_type,
                   cc.name as contact_name,
                   cc.email as contact_email,
                   cc.phone as contact_phone,
                   cc.role as contact_role,
                   u.name as created_by_name,
                   (SELECT COUNT(*) FROM deal_resumes dr WHERE dr.deal_id = d.id) as resumes_count,
                   (SELECT COUNT(*) FROM missions m WHERE m.deal_id = d.id) as missions_count
            FROM deals d
            LEFT JOIN clients c ON d.client_id = c.id
            LEFT JOIN client_contacts cc ON d.contact_id = cc.id
            LEFT JOIN users u ON d.created_by = u.id
            WHERE d.id = $1
        `, [dealId]);

        return result.rows[0] || null;
    } catch (error) {
        safeLog('error', 'Error fetching deal', { error: error.message, dealId });
        throw error;
    }
}

/**
 * Get deals with pagination and filters
 * @param {string} firmId - Firm ID for segregation
 * @param {Object} filters - Filter options
 * @param {Object} pagination - Pagination options
 * @returns {Promise<{data: Array, pagination: Object}>}
 */
export async function getDeals(firmId, filters = {}, pagination = {}) {
    try {
        const { clientId, status, priority, search } = filters;
        const page = parseInt(pagination.page) || 1;
        const limit = Math.min(parseInt(pagination.limit) || 20, 100);
        const offset = (page - 1) * limit;

        // Build WHERE conditions
        const conditions = ['d.firm_id = $1'];
        const params = [firmId];
        let paramIndex = 2;

        if (clientId) {
            conditions.push(`d.client_id = $${paramIndex}`);
            params.push(clientId);
            paramIndex++;
        }

        if (status && status !== 'all') {
            conditions.push(`d.status = $${paramIndex}`);
            params.push(status);
            paramIndex++;
        }

        if (priority && priority !== 'all') {
            conditions.push(`d.priority = $${paramIndex}`);
            params.push(priority);
            paramIndex++;
        }

        if (search) {
            conditions.push(`(d.title ILIKE $${paramIndex} OR d.description ILIKE $${paramIndex})`);
            params.push(`%${search}%`);
            paramIndex++;
        }

        const whereClause = `WHERE ${conditions.join(' AND ')}`;

        // Count total
        const countResult = await query(
            `SELECT COUNT(*) as total FROM deals d ${whereClause}`,
            params
        );
        const totalCount = parseInt(countResult.rows[0].total);

        // Fetch deals
        const dataParams = [...params, limit, offset];
        const result = await query(`
            SELECT d.*,
                   c.name as client_name,
                   c.type as client_type,
                   cc.name as contact_name,
                   cc.email as contact_email,
                   cc.role as contact_role,
                   (SELECT COUNT(*) FROM deal_resumes dr WHERE dr.deal_id = d.id) as resumes_count,
                   (SELECT COUNT(*) FROM missions m WHERE m.deal_id = d.id) as missions_count
            FROM deals d
            LEFT JOIN clients c ON d.client_id = c.id
            LEFT JOIN client_contacts cc ON d.contact_id = cc.id
            ${whereClause}
            ORDER BY 
                CASE d.priority 
                    WHEN 'urgent' THEN 1 
                    WHEN 'high' THEN 2 
                    WHEN 'medium' THEN 3 
                    WHEN 'low' THEN 4 
                END,
                d.updated_at DESC
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `, dataParams);

        return {
            data: result.rows,
            pagination: {
                page,
                limit,
                totalCount,
                totalPages: Math.ceil(totalCount / limit),
                hasMore: offset + result.rows.length < totalCount
            }
        };
    } catch (error) {
        safeLog('error', 'Error fetching deals', { error: error.message, firmId });
        throw error;
    }
}

/**
 * Add a resume to a deal
 * @param {string} dealId - Deal ID
 * @param {string} resumeId - Resume ID
 * @param {string} userId - User adding the resume
 * @param {Object} options - Additional options (notes, status)
 * @returns {Promise<Object>} Created link
 */
export async function addResumeToDeal(dealId, resumeId, userId, options = {}) {
    try {
        const { notes, status = DEAL_RESUME_STATUS.PROPOSED } = options;

        const result = await query(`
            INSERT INTO deal_resumes (deal_id, resume_id, added_by, notes, status)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (deal_id, resume_id) DO UPDATE SET
                notes = COALESCE(EXCLUDED.notes, deal_resumes.notes),
                status = COALESCE(EXCLUDED.status, deal_resumes.status)
            RETURNING *
        `, [dealId, resumeId, userId, notes || null, status]);

        safeLog('info', 'Resume added to deal', { dealId, resumeId });
        return result.rows[0];
    } catch (error) {
        safeLog('error', 'Error adding resume to deal', { error: error.message, dealId, resumeId });
        throw error;
    }
}

/**
 * Remove a resume from a deal
 * @param {string} dealId - Deal ID
 * @param {string} resumeId - Resume ID
 * @returns {Promise<boolean>} Success
 */
export async function removeResumeFromDeal(dealId, resumeId) {
    try {
        const result = await query(
            'DELETE FROM deal_resumes WHERE deal_id = $1 AND resume_id = $2 RETURNING id',
            [dealId, resumeId]
        );

        if (result.rows.length === 0) {
            throw new Error('Resume not found in deal');
        }

        safeLog('info', 'Resume removed from deal', { dealId, resumeId });
        return true;
    } catch (error) {
        safeLog('error', 'Error removing resume from deal', { error: error.message, dealId, resumeId });
        throw error;
    }
}

/**
 * Update resume status in a deal
 * @param {string} dealId - Deal ID
 * @param {string} resumeId - Resume ID
 * @param {string} status - New status
 * @param {string} notes - Optional notes
 * @returns {Promise<Object>} Updated link
 */
export async function updateDealResumeStatus(dealId, resumeId, status, notes = null) {
    try {
        const result = await query(`
            UPDATE deal_resumes SET
                status = $1,
                notes = COALESCE($2, notes)
            WHERE deal_id = $3 AND resume_id = $4
            RETURNING *
        `, [status, notes, dealId, resumeId]);

        if (result.rows.length === 0) {
            throw new Error('Resume not found in deal');
        }

        safeLog('info', 'Deal resume status updated', { dealId, resumeId, status });
        return result.rows[0];
    } catch (error) {
        safeLog('error', 'Error updating deal resume status', { error: error.message, dealId, resumeId });
        throw error;
    }
}

/**
 * Get all deals for a specific resume
 * @param {string} resumeId - Resume ID
 * @param {string} firmId - Firm ID for segregation
 * @returns {Promise<Array>} List of deals
 */
export async function getDealsForResume(resumeId, firmId) {
    try {
        const result = await query(`
            SELECT d.id as deal_id, 
                   d.title as deal_title,
                   d.status,
                   d.priority,
                   dr.status as resume_status,
                   dr.notes as resume_notes,
                   dr.added_at,
                   c.name as client_name,
                   c.type as client_type,
                   cc.name as contact_name
            FROM deals d
            INNER JOIN deal_resumes dr ON d.id = dr.deal_id
            LEFT JOIN clients c ON d.client_id = c.id
            LEFT JOIN client_contacts cc ON d.contact_id = cc.id
            WHERE dr.resume_id = $1 AND d.firm_id = $2
            ORDER BY dr.added_at DESC
        `, [resumeId, firmId]);

        return result.rows;
    } catch (error) {
        safeLog('error', 'Error fetching deals for resume', { error: error.message, resumeId });
        throw error;
    }
}

/**
 * Get all resumes for a specific deal
 * @param {string} dealId - Deal ID
 * @returns {Promise<Array>} List of resumes with deal info
 */
export async function getResumesForDeal(dealId) {
    try {
        const result = await query(`
            SELECT r.id, r.name, r.title, r.global_rating, r.industries, r.skills,
                   dr.status as deal_status,
                   dr.notes as deal_notes,
                   dr.added_at,
                   u.name as added_by_name
            FROM resumes r
            INNER JOIN deal_resumes dr ON r.id = dr.resume_id
            LEFT JOIN users u ON dr.added_by = u.id
            WHERE dr.deal_id = $1
            ORDER BY 
                CASE dr.status 
                    WHEN 'selected' THEN 1 
                    WHEN 'submitted' THEN 2 
                    WHEN 'proposed' THEN 3 
                    WHEN 'rejected' THEN 4 
                END,
                dr.added_at DESC
        `, [dealId]);

        return result.rows;
    } catch (error) {
        safeLog('error', 'Error fetching resumes for deal', { error: error.message, dealId });
        throw error;
    }
}

/**
 * Get deal statistics for a firm
 * @param {string} firmId - Firm ID
 * @returns {Promise<Object>} Statistics
 */
export async function getDealStats(firmId) {
    try {
        const result = await query(`
            SELECT 
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE status = 'open') as open_count,
                COUNT(*) FILTER (WHERE status = 'won') as won_count,
                COUNT(*) FILTER (WHERE status = 'lost') as lost_count,
                COUNT(*) FILTER (WHERE status = 'on_hold') as on_hold_count,
                COUNT(*) FILTER (WHERE priority = 'urgent') as urgent_count,
                COUNT(*) FILTER (WHERE priority = 'high') as high_priority_count
            FROM deals
            WHERE firm_id = $1
        `, [firmId]);

        return result.rows[0];
    } catch (error) {
        safeLog('error', 'Error fetching deal stats', { error: error.message, firmId });
        throw error;
    }
}

/**
 * Get a deal's firm_id (for access checks)
 * @param {string} dealId - Deal ID
 * @returns {Promise<string|null>} firm_id or null if not found
 */
export async function getDealFirmId(dealId) {
    const result = await query('SELECT firm_id FROM deals WHERE id = $1', [dealId]);
    return result.rows.length > 0 ? result.rows[0].firm_id : null;
}

/**
 * Get a client's firm_id (for validation)
 * @param {string} clientId - Client ID
 * @returns {Promise<string|null>} firm_id or null if not found
 */
export async function getClientFirmId(clientId) {
    const result = await query('SELECT firm_id FROM clients WHERE id = $1', [clientId]);
    return result.rows.length > 0 ? result.rows[0].firm_id : null;
}

/**
 * Get a resume's firm_id (for validation)
 * @param {string} resumeId - Resume ID
 * @returns {Promise<string|null>} firm_id or null if not found
 */
export async function getResumeFirmId(resumeId) {
    const result = await query('SELECT firm_id FROM resumes WHERE id = $1', [resumeId]);
    return result.rows.length > 0 ? result.rows[0].firm_id : null;
}

/**
 * Get missions for a deal with client/contact joins
 * @param {string} dealId - Deal ID
 * @returns {Promise<Array>} List of missions
 */
export async function getMissionsForDeal(dealId) {
    const result = await query(`
        SELECT m.id, m.title, m.status, m.created_at, m.updated_at,
               m.client_id, m.contact_id, m.deal_id,
               c.name as client_name,
               cc.name as contact_name,
               (SELECT COUNT(*) FROM resume_adaptations ra WHERE ra.mission_id = m.id) as adaptations_count
        FROM missions m
        LEFT JOIN clients c ON m.client_id = c.id
        LEFT JOIN client_contacts cc ON m.contact_id = cc.id
        WHERE m.deal_id = $1
        ORDER BY m.created_at DESC
    `, [dealId]);
    return result.rows;
}

/**
 * Get deals count for a client
 * @param {string} clientId - Client ID
 * @returns {Promise<number>} Count
 */
export async function getDealsCountForClient(clientId) {
    try {
        const result = await query(
            'SELECT COUNT(*) as count FROM deals WHERE client_id = $1',
            [clientId]
        );
        return parseInt(result.rows[0].count);
    } catch (error) {
        safeLog('error', 'Error fetching deals count for client', { error: error.message, clientId });
        throw error;
    }
}
