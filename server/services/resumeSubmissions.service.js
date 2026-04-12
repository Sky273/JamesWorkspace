/**
 * Resume Submissions Service
 * Data access layer for resume submissions
 * Extracted from resumeSubmissions.routes.js for separation of concerns
 */

import { query } from '../config/database.js';
import { invalidateClientsCaches } from './cache.service.js';

// ============================================
// SQL FRAGMENTS
// ============================================

const SUBMISSION_WITH_JOINS_SELECT = `
    SELECT rs.*,
           r.name as resume_name, r.title as resume_title,
           c.name as client_name, c.type as client_type,
           cc.name as contact_name, cc.email as contact_email,
           m.title as mission_title,
           u.name as sent_by_name,
           f.name as firm_name
    FROM resume_submissions rs
    LEFT JOIN resumes r ON rs.resume_id = r.id
    LEFT JOIN clients c ON rs.client_id = c.id
    LEFT JOIN client_contacts cc ON rs.contact_id = cc.id
    LEFT JOIN missions m ON rs.mission_id = m.id
    LEFT JOIN users u ON rs.sent_by = u.id
    LEFT JOIN firms f ON rs.firm_id = f.id
`;

const SUBMISSION_BY_ID_SELECT = `
    SELECT rs.*,
           r.name as resume_name, r.title as resume_title,
           c.name as client_name, c.type as client_type,
           cc.name as contact_name, cc.email as contact_email, cc.phone as contact_phone,
           m.title as mission_title,
           u.name as sent_by_name,
           f.name as firm_name
    FROM resume_submissions rs
    LEFT JOIN resumes r ON rs.resume_id = r.id
    LEFT JOIN clients c ON rs.client_id = c.id
    LEFT JOIN client_contacts cc ON rs.contact_id = cc.id
    LEFT JOIN missions m ON rs.mission_id = m.id
    LEFT JOIN users u ON rs.sent_by = u.id
    LEFT JOIN firms f ON rs.firm_id = f.id
    WHERE rs.id = $1
`;

// ============================================
// LIST SUBMISSIONS
// ============================================

/**
 * List submissions with pagination, filters, and firm segregation
 * @param {Object} options
 * @param {number} options.page
 * @param {number} options.limit
 * @param {string} [options.clientId]
 * @param {string} [options.resumeId]
 * @param {string} [options.missionId]
 * @param {string} [options.status]
 * @param {string} [options.firmId] - null for admin (no filter)
 * @returns {Promise<{data: Array, pagination: Object}>}
 */
export async function listSubmissions({ page = 1, limit = 20, clientId, resumeId, missionId, status, firmId }) {
    const normalizedPage = Math.max(1, page);
    const normalizedLimit = Math.max(1, Math.min(limit, 100));
    const offset = (normalizedPage - 1) * normalizedLimit;
    const whereConditions = [];
    const params = [];
    let paramIndex = 1;

    // Firm segregation
    if (firmId) {
        whereConditions.push(`rs.firm_id = $${paramIndex}`);
        params.push(firmId);
        paramIndex++;
    }

    if (clientId) {
        whereConditions.push(`rs.client_id = $${paramIndex}`);
        params.push(clientId);
        paramIndex++;
    }

    if (resumeId) {
        whereConditions.push(`rs.resume_id = $${paramIndex}`);
        params.push(resumeId);
        paramIndex++;
    }

    if (missionId) {
        whereConditions.push(`rs.mission_id = $${paramIndex}`);
        params.push(missionId);
        paramIndex++;
    }

    if (status) {
        whereConditions.push(`rs.status = $${paramIndex}`);
        params.push(status);
        paramIndex++;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Fetch submissions with limit+1 to detect hasMore
    const submissionsQuery = `
        ${SUBMISSION_WITH_JOINS_SELECT}
        ${whereClause}
        ORDER BY rs.sent_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    params.push(normalizedLimit + 1, offset);

    const result = await query(submissionsQuery, params);
    const submissions = result.rows;

    const hasMore = submissions.length > normalizedLimit;
    if (hasMore) {
        submissions.pop();
    }

    // Get total count only on page 1
    let totalCount = null;
    if (normalizedPage === 1) {
        const countParams = params.slice(0, -2);
        const countQuery = `SELECT COUNT(*) as count FROM resume_submissions rs ${whereClause}`;
        const countResult = await query(countQuery, countParams);
        totalCount = parseInt(countResult.rows[0].count);
    }

    return {
        data: submissions,
        pagination: {
            page: normalizedPage,
            limit: normalizedLimit,
            hasMore,
            totalCount,
            nextPage: hasMore ? normalizedPage + 1 : null
        }
    };
}

// ============================================
// GET BY ID
// ============================================

/**
 * Get a single submission by ID with all joins
 * @param {string} id
 * @returns {Promise<Object|null>}
 */
export async function getSubmissionById(id) {
    const result = await query(SUBMISSION_BY_ID_SELECT, [id]);
    return result.rows.length > 0 ? result.rows[0] : null;
}

// ============================================
// VALIDATION HELPERS
// ============================================

/**
 * Validate that a resume exists
 * @param {string} resumeId
 * @returns {Promise<boolean>}
 */
export async function validateResume(resumeId, expectedFirmId = null) {
    const result = await query('SELECT firm_id FROM resumes WHERE id = $1', [resumeId]);
    if (result.rows.length === 0) {
        return { exists: false, firmMatch: false };
    }

    if (!expectedFirmId) {
        return { exists: true, firmMatch: true };
    }

    return { exists: true, firmMatch: result.rows[0].firm_id === expectedFirmId };
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
 * Validate that a mission exists
 * @param {string} missionId
 * @returns {Promise<boolean>}
 */
export async function validateMission(missionId, expectedFirmId = null) {
    const result = await query('SELECT firm_id FROM missions WHERE id = $1', [missionId]);
    if (result.rows.length === 0) {
        return { exists: false, firmMatch: false };
    }

    if (!expectedFirmId) {
        return { exists: true, firmMatch: true };
    }

    return { exists: true, firmMatch: result.rows[0].firm_id === expectedFirmId };
}

// ============================================
// CRUD
// ============================================

/**
 * Create a submission and return it with full join data
 * @param {Object} data
 * @returns {Promise<Object>}
 */
export async function createSubmission(data) {
    const { resume_id, client_id, contact_id, mission_id, firm_id, sent_by, notes, sent_at, status } = data;

    const result = await query(
        `INSERT INTO resume_submissions (resume_id, client_id, contact_id, mission_id, firm_id, sent_by, notes, sent_at, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
            resume_id,
            client_id,
            contact_id,
            mission_id || null,
            firm_id,
            sent_by,
            notes || null,
            sent_at || new Date().toISOString(),
            status || 'sent'
        ]
    );

    // Fetch full submission with joins
    const fullResult = await query(
        `${SUBMISSION_WITH_JOINS_SELECT} WHERE rs.id = $1`,
        [result.rows[0].id]
    );

    await invalidateClientsCaches();
    return fullResult.rows[0];
}

/**
 * Find a submission by ID (raw, no joins)
 * @param {string} id
 * @returns {Promise<Object|null>}
 */
export async function findSubmission(id) {
    const result = await query('SELECT * FROM resume_submissions WHERE id = $1', [id]);
    return result.rows.length > 0 ? result.rows[0] : null;
}

/**
 * Update a submission's status and/or notes
 * @param {string} id
 * @param {Object} updates - { status, notes }
 * @returns {Promise<Object>}
 */
export async function updateSubmission(id, { status, notes }) {
    const result = await query(
        `UPDATE resume_submissions 
         SET status = COALESCE($1, status),
             notes = COALESCE($2, notes)
         WHERE id = $3
         RETURNING *`,
        [status, notes, id]
    );
    await invalidateClientsCaches();
    return result.rows[0];
}

/**
 * Delete a submission by ID
 * @param {string} id
 */
export async function deleteSubmission(id) {
    await query('DELETE FROM resume_submissions WHERE id = $1', [id]);
    await invalidateClientsCaches();
}

export async function deleteSubmissionsByResumeId(resumeId, { executor } = {}) {
    const run = typeof executor === 'function'
        ? executor
        : executor && typeof executor.query === 'function'
            ? executor.query.bind(executor)
            : query;

    await run('DELETE FROM resume_submissions WHERE resume_id = $1', [resumeId]);
    if (!executor) {
        await invalidateClientsCaches();
    }
}

// ============================================
// STATS
// ============================================

/**
 * Get submission statistics
 * @param {string|null} firmId - null for admin (no filter)
 * @returns {Promise<Object>}
 */
export async function getStatsSummary(firmId) {
    let firmFilter = '';
    let params = [];

    if (firmId) {
        firmFilter = 'WHERE firm_id = $1';
        params = [firmId];
    }

    const statsQuery = `
        SELECT 
            COUNT(*) as total_submissions,
            COUNT(CASE WHEN status = 'sent' THEN 1 END) as sent,
            COUNT(CASE WHEN status = 'viewed' THEN 1 END) as viewed,
            COUNT(CASE WHEN status = 'accepted' THEN 1 END) as accepted,
            COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected,
            COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
            COUNT(DISTINCT client_id) as unique_clients,
            COUNT(DISTINCT resume_id) as unique_resumes
        FROM resume_submissions
        ${firmFilter}
    `;

    const result = await query(statsQuery, params);
    return result.rows[0];
}
