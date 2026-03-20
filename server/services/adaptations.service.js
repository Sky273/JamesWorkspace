/**
 * Adaptations Service
 * Data access layer for resume adaptations
 * Extracted from adaptations.routes.js for separation of concerns
 */

import { query } from '../config/database.js';
import { safeLog } from '../utils/logger.backend.js';
import { escapeLike } from '../utils/postgresHelpers.js';

/**
 * Allowed column names for dynamic UPDATE on the resume_adaptations table.
 * Any key not in this set is silently dropped to prevent SQL injection.
 */
const ALLOWED_COLUMNS = new Set([
    'adapted_text', 'adapted_title', 'status', 'match_score', 'match_analysis'
]);

/**
 * List adaptations with pagination and filters
 * @param {Object} options
 * @param {string|null} options.userFirm - Firm name filter (null for admin)
 * @param {string} [options.resumeId]
 * @param {string} [options.missionId]
 * @param {string} [options.status]
 * @param {string} [options.search]
 * @param {number} [options.page=1]
 * @param {number} [options.limit=20]
 * @returns {Promise<{records: Array, totalCount: number}>}
 */
export async function listAdaptations({ userFirm, resumeId, missionId, status, search, page = 1, limit = 20 }) {
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    // Firm filter (non-admin users)
    if (userFirm) {
        conditions.push(`firm = $${paramIndex}`);
        params.push(userFirm);
        paramIndex++;
    }

    // Resume filter
    if (resumeId) {
        conditions.push(`resume_id = $${paramIndex}`);
        params.push(resumeId);
        paramIndex++;
    }

    // Mission filter
    if (missionId) {
        conditions.push(`mission_id = $${paramIndex}`);
        params.push(missionId);
        paramIndex++;
    }

    // Status filter
    if (status && status !== 'all') {
        conditions.push(`status = $${paramIndex}`);
        params.push(status);
        paramIndex++;
    }

    // Search filter
    if (search) {
        conditions.push(`(mission_title ILIKE $${paramIndex} OR adapted_text ILIKE $${paramIndex})`);
        params.push(`%${escapeLike(search)}%`);
        paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (page - 1) * limit;

    // Count total records
    const countResult = await query(
        `SELECT COUNT(*) as total FROM resume_adaptations ${whereClause}`,
        params
    );
    const totalCount = parseInt(countResult.rows[0]?.total || 0);

    // Fetch paginated records
    const dataResult = await query(
        `SELECT * FROM resume_adaptations ${whereClause} ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...params, limit, offset]
    );

    return { records: dataResult.rows, totalCount };
}

/**
 * Get adaptations grouped by deal > mission
 * @param {Object} options
 * @param {string} options.firmId
 * @param {boolean} options.isAdmin
 * @returns {Promise<Object>}
 */
export async function getAdaptationsGroupedByDeal({ firmId, isAdmin }) {
    // Query 1: Get all deals for this firm
    const dealsResult = await query(`
        SELECT d.id, d.title, d.status, d.priority,
               c.name as client_name, c.type as client_type,
               cc.name as contact_name
        FROM deals d
        LEFT JOIN clients c ON d.client_id = c.id
        LEFT JOIN client_contacts cc ON d.contact_id = cc.id
        WHERE d.firm_id = $1
        ORDER BY
            CASE d.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 4 END,
            d.title ASC
    `, [firmId]);

    const dealIds = dealsResult.rows.map(d => d.id);

    // Query 2: Get missions that belong to these deals AND have adaptations
    let missionsByDeal = new Map();
    let allMissionIds = [];
    if (dealIds.length > 0) {
        const missionsResult = await query(`
            SELECT DISTINCT m.id, m.title, m.status, m.deal_id,
                   m.client_id, m.contact_id,
                   c.name as client_name,
                   cc.name as contact_name
            FROM missions m
            INNER JOIN resume_adaptations ra ON ra.mission_id = m.id
            LEFT JOIN clients c ON m.client_id = c.id
            LEFT JOIN client_contacts cc ON m.contact_id = cc.id
            WHERE m.deal_id = ANY($1)
            ORDER BY m.deal_id, m.title ASC
        `, [dealIds]);

        for (const mission of missionsResult.rows) {
            const dealId = mission.deal_id;
            if (!missionsByDeal.has(dealId)) {
                missionsByDeal.set(dealId, []);
            }
            missionsByDeal.get(dealId).push(mission);
            allMissionIds.push(mission.id);
        }
    }

    // Query 3: Batch fetch adaptations for all deal-linked missions
    let adaptationsByMission = new Map();
    if (allMissionIds.length > 0) {
        const adaptResult = await query(`
            SELECT ra.id, ra.mission_id, ra.resume_id,
                   ra.resume_name, ra.candidate_name,
                   ra.adapted_title, ra.match_score,
                   ra.status, ra.created_at
            FROM resume_adaptations ra
            WHERE ra.mission_id = ANY($1)
            ORDER BY ra.created_at DESC
        `, [allMissionIds]);

        for (const adapt of adaptResult.rows) {
            const mid = adapt.mission_id;
            if (!adaptationsByMission.has(mid)) {
                adaptationsByMission.set(mid, []);
            }
            adaptationsByMission.get(mid).push(adapt);
        }
    }

    // Assemble deals with missions and their adaptations
    const deals = dealsResult.rows
        .map(deal => {
            const missions = (missionsByDeal.get(deal.id) || []).map(mission => {
                const adaptations = adaptationsByMission.get(mission.id) || [];
                return {
                    id: mission.id,
                    title: mission.title,
                    status: mission.status,
                    client_name: mission.client_name,
                    contact_name: mission.contact_name,
                    adaptations,
                    adaptations_count: adaptations.length
                };
            });

            const totalAdaptations = missions.reduce((sum, m) => sum + m.adaptations_count, 0);

            return {
                ...deal,
                missions,
                missions_count: missions.length,
                adaptations_count: totalAdaptations
            };
        })
        .filter(deal => deal.adaptations_count > 0); // Only show deals that have adaptations

    // Query 4: Get adaptations for missions WITHOUT a deal
    const firmFilter = !isAdmin ? 'AND ra.firm = (SELECT name FROM firms WHERE id = $1)' : '';
    const firmParams = !isAdmin ? [firmId] : [];

    const unassignedResult = await query(`
        SELECT DISTINCT m.id as mission_id, m.title as mission_title, m.status as mission_status,
               c.name as client_name, cc.name as contact_name
        FROM missions m
        INNER JOIN resume_adaptations ra ON ra.mission_id = m.id
        LEFT JOIN clients c ON m.client_id = c.id
        LEFT JOIN client_contacts cc ON m.contact_id = cc.id
        WHERE m.deal_id IS NULL ${firmFilter}
        ORDER BY m.title ASC
    `, firmParams);

    const unassignedMissionIds = unassignedResult.rows.map(m => m.mission_id);
    let unassignedAdaptationsMap = new Map();
    if (unassignedMissionIds.length > 0) {
        const uaResult = await query(`
            SELECT ra.id, ra.mission_id, ra.resume_id,
                   ra.resume_name, ra.candidate_name,
                   ra.adapted_title, ra.match_score,
                   ra.status, ra.created_at
            FROM resume_adaptations ra
            WHERE ra.mission_id = ANY($1)
            ORDER BY ra.created_at DESC
        `, [unassignedMissionIds]);

        for (const adapt of uaResult.rows) {
            const mid = adapt.mission_id;
            if (!unassignedAdaptationsMap.has(mid)) {
                unassignedAdaptationsMap.set(mid, []);
            }
            unassignedAdaptationsMap.get(mid).push(adapt);
        }
    }

    const unassigned = unassignedResult.rows.map(m => {
        const adaptations = unassignedAdaptationsMap.get(m.mission_id) || [];
        return {
            id: m.mission_id,
            title: m.mission_title,
            status: m.mission_status,
            client_name: m.client_name,
            contact_name: m.contact_name,
            adaptations,
            adaptations_count: adaptations.length
        };
    });

    const totalAssigned = deals.reduce((sum, d) => sum + d.adaptations_count, 0);
    const totalUnassigned = unassigned.reduce((sum, m) => sum + m.adaptations_count, 0);

    return {
        deals,
        unassigned,
        totalDeals: deals.length,
        totalAssigned,
        totalUnassigned
    };
}

/**
 * Get a single adaptation by ID
 * @param {string} id
 * @returns {Promise<Object>} adaptation record
 * @throws {Object} error with statusCode 404 if not found
 */
export async function getAdaptationById(id) {
    const result = await query('SELECT * FROM resume_adaptations WHERE id = $1', [id]);
    if (result.rows.length === 0) {
        const err = new Error('Adaptation not found');
        err.statusCode = 404;
        throw err;
    }
    return result.rows[0];
}

/**
 * Get mission client/contact IDs for a given mission
 * @param {string} missionId
 * @returns {Promise<{client_id: string|null, contact_id: string|null}>}
 */
export async function getMissionClientContact(missionId) {
    const result = await query(
        'SELECT client_id, contact_id FROM missions WHERE id = $1',
        [missionId]
    );
    if (result.rows.length > 0) {
        return { client_id: result.rows[0].client_id, contact_id: result.rows[0].contact_id };
    }
    return { client_id: null, contact_id: null };
}

/**
 * Update an adaptation
 * @param {string} id
 * @param {Object} updates - fields to update
 * @returns {Promise<Object>} updated record
 * @throws {Object} error with statusCode 404 if not found
 */
export async function updateAdaptation(id, updates) {
    const setClauses = [];
    const params = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
        if (ALLOWED_COLUMNS.has(key)) {
            setClauses.push(`${key} = $${paramIndex}`);
            params.push(value);
            paramIndex++;
        }
    }

    if (setClauses.length === 0) {
        // Nothing to update, just return the existing record
        return getAdaptationById(id);
    }

    setClauses.push(`updated_at = CURRENT_TIMESTAMP`);
    params.push(id);

    const result = await query(
        `UPDATE resume_adaptations SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
        params
    );

    if (result.rows.length === 0) {
        const err = new Error('Adaptation not found');
        err.statusCode = 404;
        throw err;
    }

    return result.rows[0];
}

/**
 * Delete an adaptation
 * @param {string} id
 * @returns {Promise<boolean>}
 * @throws {Object} error with statusCode 404 if not found
 */
export async function deleteAdaptation(id) {
    const result = await query(
        'DELETE FROM resume_adaptations WHERE id = $1 RETURNING id',
        [id]
    );
    if (result.rows.length === 0) {
        const err = new Error('Adaptation not found');
        err.statusCode = 404;
        throw err;
    }
    return true;
}
