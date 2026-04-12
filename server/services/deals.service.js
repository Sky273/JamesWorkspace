/**
 * Deals Service
 * Manages deals (affaires) linked to clients/prospects and resumes
 * A deal can contain 0-N resumes, and a resume can be in 0-N deals
 */

import { query } from '../config/database.js';
import { safeLog } from '../utils/logger.backend.js';
import { assertSchemaRequirements } from './schemaVerification.service.js';
import { buildCreateDealInsertParams, buildDealUpdateStatement } from './deals.service.helpers.js';
import { invalidateDealsCaches, invalidateMissionsCaches } from './cache.service.js';
import { invalidateGroupedDealViews } from './viewCacheInvalidation.service.js';
import {
    INSERT_DEAL_SQL,
    UPSERT_DEAL_RESUME_SQL,
    UPDATE_DEAL_RESUME_STATUS_SQL
} from './deals.service.queries.js';

export {
    getDealById,
    getDeals,
    getDealsForResume,
    getResumesForDeal,
    getDealStats,
    getDealFirmId,
    getClientFirmId,
    getContactOwnership,
    getResumeFirmId,
    getMissionsForDeal,
    getDealsCountForClient
} from './deals.service.reads.js';

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
 */
export async function createDeal(data, userId, firmId) {
    try {
        const { title, client_id, contact_id } = data;
        const status = data.status || DEAL_STATUS.OPEN;
        const priority = data.priority || DEAL_PRIORITY.MEDIUM;

        safeLog('info', 'createDeal service - preparing insert', {
            firmId,
            client_id: client_id || null,
            contact_id: contact_id || null,
            title,
            status,
            priority
        });

        const params = buildCreateDealInsertParams(data, userId, firmId, {
            status: DEAL_STATUS.OPEN,
            priority: DEAL_PRIORITY.MEDIUM
        });

        const result = await query(INSERT_DEAL_SQL, params);

        safeLog('info', 'Deal created', { dealId: result.rows[0].id, title });
        await Promise.all([
            invalidateDealsCaches(),
            invalidateMissionsCaches(),
            invalidateGroupedDealViews(firmId)
        ]);
        return result.rows[0];
    } catch (error) {
        safeLog('error', 'Error creating deal in service', { error: error.message, stack: error.stack });
        throw error;
    }
}

/**
 * Update a deal
 */
export async function updateDeal(dealId, data) {
    try {
        const { assignments, params, paramIndex } = buildDealUpdateStatement(data);

        if (assignments.length === 0) {
            throw new Error('No deal fields provided for update');
        }

        assignments.push('updated_at = CURRENT_TIMESTAMP');
        params.push(dealId);

        const result = await query(`
            UPDATE deals SET
                ${assignments.join(', ')}
            WHERE id = $${paramIndex}
            RETURNING *
        `, params);

        if (result.rows.length === 0) {
            throw new Error('Deal not found');
        }

        safeLog('info', 'Deal updated', { dealId });
        await Promise.all([
            invalidateDealsCaches(),
            invalidateMissionsCaches(),
            invalidateGroupedDealViews(result.rows[0]?.firm_id || null)
        ]);
        return result.rows[0];
    } catch (error) {
        safeLog('error', 'Error updating deal', { error: error.message, dealId });
        throw error;
    }
}

/**
 * Delete a deal
 */
export async function deleteDeal(dealId) {
    try {
        const result = await query('DELETE FROM deals WHERE id = $1 RETURNING id, firm_id', [dealId]);

        if (result.rows.length === 0) {
            throw new Error('Deal not found');
        }

        safeLog('info', 'Deal deleted', { dealId });
        await Promise.all([
            invalidateDealsCaches(),
            invalidateMissionsCaches(),
            invalidateGroupedDealViews(result.rows[0]?.firm_id || null)
        ]);
        return true;
    } catch (error) {
        safeLog('error', 'Error deleting deal', { error: error.message, dealId });
        throw error;
    }
}

/**
 * Add a resume to a deal
 */
export async function addResumeToDeal(dealId, resumeId, userId, options = {}) {
    try {
        const { notes, status = DEAL_RESUME_STATUS.PROPOSED } = options;

        const result = await query(UPSERT_DEAL_RESUME_SQL, [dealId, resumeId, userId, notes || null, status]);

        safeLog('info', 'Resume added to deal', { dealId, resumeId });
        const firmResult = await query('SELECT firm_id FROM deals WHERE id = $1', [dealId]);
        await Promise.all([
            invalidateDealsCaches(),
            invalidateMissionsCaches(),
            invalidateGroupedDealViews(firmResult.rows[0]?.firm_id || null)
        ]);
        return result.rows[0];
    } catch (error) {
        safeLog('error', 'Error adding resume to deal', { error: error.message, dealId, resumeId });
        throw error;
    }
}

/**
 * Remove a resume from a deal
 */
export async function removeResumeFromDeal(dealId, resumeId) {
    try {
        const result = await query('DELETE FROM deal_resumes WHERE deal_id = $1 AND resume_id = $2 RETURNING id', [
            dealId,
            resumeId
        ]);

        if (result.rows.length === 0) {
            throw new Error('Resume not found in deal');
        }

        safeLog('info', 'Resume removed from deal', { dealId, resumeId });
        const firmResult = await query('SELECT firm_id FROM deals WHERE id = $1', [dealId]);
        await Promise.all([
            invalidateDealsCaches(),
            invalidateMissionsCaches(),
            invalidateGroupedDealViews(firmResult.rows[0]?.firm_id || null)
        ]);
        return true;
    } catch (error) {
        safeLog('error', 'Error removing resume from deal', { error: error.message, dealId, resumeId });
        throw error;
    }
}

/**
 * Update resume status in a deal
 */
export async function updateDealResumeStatus(dealId, resumeId, status, notes = null) {
    try {
        const result = await query(UPDATE_DEAL_RESUME_STATUS_SQL, [status, notes, dealId, resumeId]);

        if (result.rows.length === 0) {
            throw new Error('Resume not found in deal');
        }

        safeLog('info', 'Deal resume status updated', { dealId, resumeId, status });
        const firmResult = await query('SELECT firm_id FROM deals WHERE id = $1', [dealId]);
        await Promise.all([
            invalidateDealsCaches(),
            invalidateMissionsCaches(),
            invalidateGroupedDealViews(firmResult.rows[0]?.firm_id || null)
        ]);
        return result.rows[0];
    } catch (error) {
        safeLog('error', 'Error updating deal resume status', { error: error.message, dealId, resumeId });
        throw error;
    }
}
