/**
 * Missions Service
 * Data access layer for missions
 * Extracted from missions.routes.js for separation of concerns
 */

import { query } from '../config/database.js';
import { safeLog } from '../utils/logger.backend.js';
import { selectRawWithTimeout, selectWithTimeout, findWithTimeout, createWithTimeout, updateWithTimeout, destroyWithTimeout, escapeLike } from '../utils/postgresHelpers.js';
import {
    buildGroupedViewScopeKey,
    CACHE_KEYS,
    getNamedCacheStats,
    invalidateDealsCaches,
    invalidateMissionsCaches,
    invalidateMissionGroupedViewCaches,
    missionsCache,
    missionGroupedViewCache
} from './cache.service.js';
import { invalidateGroupedDealViews } from './viewCacheInvalidation.service.js';
import { buildGroupedMissionsView } from './missionsGroupedView.service.js';

// ============================================
// MAPPING HELPERS
// ============================================

/**
 * Map a raw DB mission row (with joins) to the API response format
 */
export function mapMissionRecord(record) {
    const adaptationsCount = Number(record.adaptations_count || 0);
    const submissionsCount = Number(record.submissions_count || 0);
    const pipelineCount = Number(record.pipeline_count || 0);

    return {
        id: record.id,
        Title: record.title,
        Content: record.content,
        Firm: record.firm,
        'Firm ID': record.firm_id,
        Status: record.status,
        Keywords: record.keywords,
        'Required Skills': record.required_skills,
        'Preferred Skills': record.preferred_skills,
        'Created At': record.created_at,
        'Updated At': record.updated_at,
        'Client ID': record.client_id,
        'Client Name': record.client_name,
        'Client Type': record.client_type,
        'Contact ID': record.contact_id,
        'Contact Name': record.contact_name,
        'Contact Email': record.contact_email,
        'Contact Role': record.contact_role,
        'Deal ID': record.deal_id,
        'Deal Title': record.deal_title,
        'Deal Status': record.deal_status,
        'Adaptations Count': adaptationsCount,
        'Submissions Count': submissionsCount,
        'Pipeline Count': pipelineCount,
        'Has Attachments': adaptationsCount > 0 || submissionsCount > 0 || pipelineCount > 0
    };
}

/** SQL fragment for fetching a mission with all joins */
const MISSION_WITH_JOINS_SELECT = `
    SELECT m.*, 
           c.name as client_name, c.type as client_type,
           cc.name as contact_name, cc.email as contact_email, cc.role as contact_role,
           d.title as deal_title, d.status as deal_status,
           (SELECT COUNT(*) FROM resume_adaptations ra WHERE ra.mission_id = m.id) as adaptations_count,
           (SELECT COUNT(*) FROM resume_submissions rs WHERE rs.mission_id = m.id) as submissions_count,
           (SELECT COUNT(*) FROM candidate_pipeline cp WHERE cp.mission_id = m.id) as pipeline_count
    FROM missions m
    LEFT JOIN clients c ON m.client_id = c.id
    LEFT JOIN client_contacts cc ON m.contact_id = cc.id
    LEFT JOIN deals d ON m.deal_id = d.id
`;

/**
 * Fetch a single mission with all joins by ID
 * @param {string} id
 * @returns {Promise<Object|null>}
 */
export async function getMissionWithJoins(id, { bypassCache = false } = {}) {
    const loadMission = async () => {
        const result = await query(`${MISSION_WITH_JOINS_SELECT} WHERE m.id = $1`, [id]);
        return result.rows.length > 0 ? result.rows[0] : null;
    };

    if (bypassCache) {
        return loadMission();
    }

    return missionsCache.getOrLoad(`detail:${id}`, loadMission, {
        scope: CACHE_KEYS.missions.ALL_MISSIONS
    });
}

// ============================================
// LIST MISSIONS
// ============================================

/**
 * List missions with pagination, filters, and firm segregation
 * @param {Object} options
 * @param {number} options.page
 * @param {number} options.limit
 * @param {string} [options.search]
 * @param {string} [options.status]
 * @param {string} [options.dealId]
 * @param {string} [options.firmId] - null for admin (no filter)
 * @returns {Promise<{data: Array, pagination: Object}>}
 */
export async function listMissions({ page = 1, limit = 20, search, status, dealId, firmId, bypassCache = false }) {
    page = Number.isInteger(page) && page > 0 ? page : 1;
    limit = Number.isInteger(limit) ? Math.min(Math.max(limit, 1), 100) : 20;
    const cacheKey = JSON.stringify({ page, limit, search: search || '', status: status || 'all', dealId: dealId || null, firmId: firmId || null });

    const loadMissions = async () => {
        const offset = (page - 1) * limit;
        const conditions = [];
        const params = [];
        let paramIndex = 1;

        if (firmId) {
            conditions.push(`m.firm_id = $${paramIndex}`);
            params.push(firmId);
            paramIndex++;
        }

        if (status && status !== 'all') {
            conditions.push(`m.status = $${paramIndex}`);
            params.push(status);
            paramIndex++;
        }

        if (search) {
            conditions.push(`(m.title ILIKE $${paramIndex} OR m.firm ILIKE $${paramIndex})`);
            params.push(`%${escapeLike(search)}%`);
            paramIndex++;
        }

        if (dealId) {
            if (dealId === 'none') {
                conditions.push('m.deal_id IS NULL');
            } else {
                conditions.push(`m.deal_id = $${paramIndex}`);
                params.push(dealId);
                paramIndex++;
            }
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        safeLog('info', 'Missions GET - query debug', { whereClause, params, conditions });

        const countQuery = `SELECT COUNT(*) as total FROM missions m ${whereClause}`;
        const countResult = await selectRawWithTimeout(countQuery, params, { context: 'missions.list.count' });
        const totalCount = parseInt(countResult[0]?.total || 0);

        const dataQuery = `
            ${MISSION_WITH_JOINS_SELECT}
            ${whereClause}
            ORDER BY m.created_at DESC
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `;
        const dataParams = [...params, limit, offset];
        const result = await query(dataQuery, dataParams);

        const missions = result.rows.map(mapMissionRecord);
        const totalPages = Math.ceil(totalCount / limit);
        const hasMore = page < totalPages;

        return {
            data: missions,
            pagination: { page, limit, totalCount, totalPages, hasMore }
        };
    };

    if (bypassCache) {
        return loadMissions();
    }

    return missionsCache.getOrLoad(cacheKey, loadMissions, {
        scope: CACHE_KEYS.missions.ALL_MISSIONS
    });
}

// ============================================
// GROUPED BY DEAL
// ============================================

/**
 * Get missions grouped by deal (for "Par affaire" view)
 * @param {Object} options
 * @param {string} options.firmId
 * @param {boolean} options.isAdmin
 * @returns {Promise<Object>}
 */
export async function getMissionsGroupedByDeal({ firmId, isAdmin, bypassCache = false }) {
    const scopeKey = buildGroupedViewScopeKey({ firmId, isAdmin });

    const loadGroupedMissions = () => buildGroupedMissionsView({ firmId, isAdmin });

    if (bypassCache) {
        return loadGroupedMissions();
    }

    return missionGroupedViewCache.getOrLoad(scopeKey, loadGroupedMissions, { scope: scopeKey });
}

export async function invalidateGroupedMissionsCache(firmId = null) {
    const scopeKey = firmId ? buildGroupedViewScopeKey({ firmId }) : null;
    await invalidateMissionGroupedViewCaches(scopeKey);
}

export async function getMissionsGroupedViewCacheStats() {
    return getNamedCacheStats('missionGroupedViews');
}

// ============================================
// VALIDATION HELPERS
// ============================================

/**
 * Validate that a firm exists and return its data
 * @param {string} firmId
 * @returns {Promise<{id: string, name: string}|null>}
 */
export async function validateFirm(firmId) {
    const result = await query('SELECT id, name FROM firms WHERE id = $1', [firmId]);
    return result.rows.length > 0 ? result.rows[0] : null;
}

/**
 * Validate that a client exists and belongs to the expected firm
 * @param {string} clientId
 * @param {string} expectedFirmId
 * @returns {Promise<{exists: boolean, firmMatch: boolean}>}
 */
export async function validateClient(clientId, expectedFirmId) {
    const result = await query('SELECT firm_id FROM clients WHERE id = $1', [clientId]);
    if (result.rows.length === 0) return { exists: false, firmMatch: false };
    return { exists: true, firmMatch: result.rows[0].firm_id === expectedFirmId };
}

/**
 * Validate that a contact exists and belongs to the expected client
 * @param {string} contactId
 * @param {string} clientId
 * @returns {Promise<boolean>}
 */
export async function validateContact(contactId, clientId) {
    const result = await query('SELECT id FROM client_contacts WHERE id = $1 AND client_id = $2', [contactId, clientId]);
    return result.rows.length > 0;
}

/**
 * Validate that a deal exists and belongs to the expected firm
 * @param {string} dealId
 * @param {string} expectedFirmId
 * @returns {Promise<{exists: boolean, firmMatch: boolean, clientId: string|null}>}
 */
export async function validateDeal(dealId, expectedFirmId) {
    const result = await query('SELECT firm_id, client_id FROM deals WHERE id = $1', [dealId]);
    if (result.rows.length === 0) return { exists: false, firmMatch: false, clientId: null };
    return {
        exists: true,
        firmMatch: result.rows[0].firm_id === expectedFirmId,
        clientId: result.rows[0].client_id || null
    };
}

export async function validateMissionAssociations({ clientId, contactId, dealId, expectedFirmId }) {
    if (clientId) {
        const clientCheck = await validateClient(clientId, expectedFirmId);
        if (!clientCheck.exists) {
            return { ok: false, status: 400, error: 'Client not found' };
        }
        if (!clientCheck.firmMatch) {
            return { ok: false, status: 403, error: 'Client does not belong to the target firm' };
        }
    }

    if (contactId) {
        if (!clientId) {
            return { ok: false, status: 400, error: 'Contact requires a client association' };
        }

        const contactValid = await validateContact(contactId, clientId);
        if (!contactValid) {
            return { ok: false, status: 400, error: 'Contact not found or does not belong to this client' };
        }
    }

    if (dealId) {
        const dealCheck = await validateDeal(dealId, expectedFirmId);
        if (!dealCheck.exists) {
            return { ok: false, status: 400, error: 'Deal not found' };
        }
        if (!dealCheck.firmMatch) {
            return { ok: false, status: 403, error: 'Deal does not belong to the target firm' };
        }
        if (clientId && dealCheck.clientId && dealCheck.clientId !== clientId) {
            return { ok: false, status: 400, error: 'Deal does not belong to this client' };
        }
    }

    return { ok: true };
}

export async function getMissionAttachmentCounts(id) {
    const result = await query(`
        SELECT
            (SELECT COUNT(*) FROM resume_adaptations WHERE mission_id = $1) as adaptations_count,
            (SELECT COUNT(*) FROM resume_submissions WHERE mission_id = $1) as submissions_count,
            (SELECT COUNT(*) FROM candidate_pipeline WHERE mission_id = $1) as pipeline_count
    `, [id]);

    const row = result.rows[0] || {};
    return {
        adaptationsCount: Number(row.adaptations_count || 0),
        submissionsCount: Number(row.submissions_count || 0),
        pipelineCount: Number(row.pipeline_count || 0)
    };
}

function buildMissionDeleteBlockedError(counts) {
    const error = new Error('Cannot delete mission because linked elements are still attached');
    error.statusCode = 409;
    error.code = 'MISSION_DELETE_BLOCKED';
    error.details = counts;
    return error;
}

// ============================================
// CRUD
// ============================================

/**
 * Create a mission and return it with full join data
 * @param {Object} data - mission fields
 * @returns {Promise<Object>} mapped mission record
 */
export async function createMission(data) {
    const newMission = await createWithTimeout('missions', data);
    const record = await getMissionWithJoins(newMission.id, { bypassCache: true });
    await Promise.all([
        invalidateMissionsCaches(),
        invalidateDealsCaches(),
        invalidateGroupedDealViews(record?.firm_id || data.firm_id || null)
    ]);
    return record;
}

/**
 * Find a mission by ID (using postgresHelpers, throws 404 if not found)
 * @param {string} id
 * @returns {Promise<Object>}
 */
export async function findMission(id) {
    return await findWithTimeout('missions', id);
}

/**
 * Update a mission and return it with full join data
 * @param {string} id
 * @param {Object} updates
 * @returns {Promise<Object>} raw DB record with joins
 */
export async function updateMission(id, updates) {
    const previousMission = await findMission(id);
    const updated = await updateWithTimeout('missions', id, updates);
    const record = await getMissionWithJoins(updated.id, { bypassCache: true });
    await Promise.all([
        invalidateMissionsCaches(),
        invalidateDealsCaches(),
        invalidateGroupedDealViews(previousMission?.firm_id || null),
        invalidateGroupedDealViews(record?.firm_id || updated?.firm_id || updates?.firm_id || null)
    ]);
    return record;
}

/**
 * Delete a mission by ID
 * @param {string} id
 */
export async function deleteMission(id) {
    const mission = await findMission(id);
    const attachmentCounts = await getMissionAttachmentCounts(id);
    if (attachmentCounts.adaptationsCount > 0 || attachmentCounts.submissionsCount > 0 || attachmentCounts.pipelineCount > 0) {
        throw buildMissionDeleteBlockedError(attachmentCounts);
    }

    await destroyWithTimeout('missions', id);
    await Promise.all([
        invalidateMissionsCaches(),
        invalidateDealsCaches(),
        invalidateGroupedDealViews(mission?.firm_id || null)
    ]);
}

/**
 * List adaptations for a mission
 * @param {string} missionId
 * @returns {Promise<Array>}
 */
export async function listMissionAdaptations(missionId) {
    const records = await selectWithTimeout('resume_adaptations', {
        where: 'mission_id = $1',
        params: [missionId],
        orderBy: 'created_at DESC'
    });

    return records.map(record => ({
        id: record.id,
        'Resume ID': record.resume_id,
        'Mission ID': record.mission_id,
        'Resume Name': record.resume_name,
        'Candidate Name': record.candidate_name,
        'Adapted Title': record.adapted_title,
        'Mission Title': record.mission_title,
        'Adapted Text': record.adapted_text,
        'Match Score': record.match_score,
        'Match Analysis': record.match_analysis,
        Status: record.status,
        'Created At': record.created_at,
        'Updated At': record.updated_at
    }));
}
