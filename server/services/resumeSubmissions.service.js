/**
 * Resume Submissions Service
 * Data access layer for resume submissions
 * Extracted from resumeSubmissions.routes.js for separation of concerns
 */

import { query } from '../config/database.js';
import { invalidateClientsCaches } from './cache.service.js';
import {
    countSubmissionRows,
    createSubmissionRow,
    deleteSubmissionRow,
    deleteSubmissionRowsByResumeId,
    findSubmissionRow,
    getSubmissionRowById,
    getSubmissionStatsRow,
    getSubmissionWithJoinsById,
    listSubmissionRows,
    updateSubmissionRow
} from './resumeSubmissionsPersistence.service.js';

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
    const {
        rows,
        normalizedPage,
        normalizedLimit,
        whereClause,
        countParams
    } = await listSubmissionRows({ page, limit, clientId, resumeId, missionId, status, firmId });
    const submissions = [...rows];

    const hasMore = submissions.length > normalizedLimit;
    if (hasMore) {
        submissions.pop();
    }

    // Get total count only on page 1
    let totalCount = null;
    if (normalizedPage === 1) {
        totalCount = await countSubmissionRows(whereClause, countParams);
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
    return getSubmissionRowById(id);
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
    const createdSubmission = await createSubmissionRow(data);
    const fullSubmission = await getSubmissionWithJoinsById(createdSubmission.id);
    await invalidateClientsCaches();
    return fullSubmission;
}

/**
 * Find a submission by ID (raw, no joins)
 * @param {string} id
 * @returns {Promise<Object|null>}
 */
export async function findSubmission(id) {
    return findSubmissionRow(id);
}

/**
 * Update a submission's status and/or notes
 * @param {string} id
 * @param {Object} updates - { status, notes }
 * @returns {Promise<Object>}
 */
export async function updateSubmission(id, { status, notes }) {
    const result = await updateSubmissionRow(id, { status, notes });
    await invalidateClientsCaches();
    return result;
}

/**
 * Delete a submission by ID
 * @param {string} id
 */
export async function deleteSubmission(id) {
    await deleteSubmissionRow(id);
    await invalidateClientsCaches();
}

export async function deleteSubmissionsByResumeId(resumeId, { executor } = {}) {
    const run = typeof executor === 'function'
        ? executor
        : executor && typeof executor.query === 'function'
            ? executor.query.bind(executor)
            : query;

    await deleteSubmissionRowsByResumeId(resumeId, run);
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
    return getSubmissionStatsRow(firmId);
}
