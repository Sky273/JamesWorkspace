/**
 * Resumes Service
 * Data access layer for resume CRUD operations
 * Extracted from resumes/crud.routes.js and resumes/helpers.js
 */

import { query } from '../config/database.js';
import {
    resolveResumeExecutor,
    sanitizeResumePersistenceValue,
    buildResumeUpdateStatement
} from './resumesPersistence.service.js';
import {
    invalidateResumeCollectionViews,
    invalidateResumeMutationViews
} from './resumesInvalidation.service.js';
export {
    RESUME_SELECT_COLUMNS,
    countResumes,
    createAdaptation,
    findMissionRecord,
    findResumeRecord,
    getResumeAuditInfo,
    getResumeById,
    getResumeFileForDownload,
    getResumeForAccessCheck,
    listResumes
} from './resumesReads.service.js';
export {
    expirePendingConsents,
    expireRetentionConsents,
    initializeResumeConsent,
    markResumeConsentError,
    markResumeConsentRequested,
    recordConsentReminderSent,
    recordResumeConsentResponse,
    resetResumeConsentForResend,
    updateConsentStatus
} from './resumesConsent.service.js';
import { getResumeById } from './resumesReads.service.js';

/**
 * Allowed column names for dynamic UPDATE on the resumes table.
 * Any key not in this set is silently dropped to prevent SQL injection.
 */
const ALLOWED_COLUMNS = new Set([
    'name', 'title', 'status', 'original_text', 'improved_text', 'original_name',
    'file_name', 'resume_file_url', 'resume_file_size', 'resume_file_type', 'resume_file_data', 'relative_path',
    'firm_id', 'firm_name', 'template_id', 'template_name',
    'skills', 'industries', 'tools', 'soft_skills',
    'skills_cleaned', 'industries_cleaned', 'tools_cleaned', 'soft_skills_cleaned',
    'skills_esco', 'industries_esco', 'tools_esco', 'soft_skills_esco',
    'improved_skills', 'improved_industries', 'improved_tools', 'improved_soft_skills',
    'key_improvements', 'improved_key_improvements', 'summary',
    'experience_years', 'education_level', 'certifications', 'languages',
    'global_rating', 'skills_score', 'experience_score', 'education_score',
    'ats_score', 'executive_summary_score', 'hobbies_languages_score',
    'improved_global_rating', 'improved_skills_score', 'improved_experience_score',
    'improved_education_score', 'improved_ats_score', 'improved_executive_summary_score',
    'improved_hobbies_languages_score',
    'improvement_suggestions', 'analysis_details', 'improvement_date', 'trigram',
    'analyzed_at', 'profile_type', 'candidate_name', 'candidate_email',
    'consent_status', 'consent_requested_at', 'consent_responded_at',
    'consent_token_expires_at', 'retention_until'
]);

/**
 * Update a resume
 * @param {string} id
 * @param {Object} updateData - field/value pairs
 * @returns {Promise<Object>} updated resume
 */
export async function updateResume(id, updateData) {
    const { setClauses, params, idParamIndex } = buildResumeUpdateStatement(updateData, ALLOWED_COLUMNS);
    if (setClauses.length === 0) {
        return getResumeById(id);
    }
    setClauses.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);

    const result = await query(
        `UPDATE resumes SET ${setClauses.join(', ')} WHERE id = $${idParamIndex} RETURNING *`,
        params
    );

    if (result.rows.length === 0) {
        const err = new Error('Resume not found');
        err.statusCode = 404;
        throw err;
    }
    await invalidateResumeMutationViews(id, result.rows[0].firm_id || null);
    return result.rows[0];
}

/**
 * Insert a resume record with file metadata.
 * Kept for compatibility with older service callers and tests.
 * @param {Object} data
 * @returns {Promise<Object>}
 */
export async function insertResume(data) {
    const executor = resolveResumeExecutor(data.executor) || query;
    const result = await executor(
        `INSERT INTO resumes (
            name, title, file_name, relative_path, resume_file_data, resume_file_size, resume_file_type,
            resume_file_url, status, firm_id, firm_name, profile_type, candidate_name,
            candidate_email, consent_status, consent_token, consent_token_expires_at,
            consent_requested_at, retention_until
        ) VALUES (
            $1, $2, $3, $4, $5, $6, $7,
            $8, $9, $10, $11, $12, $13,
            $14, $15, $16, $17, $18, $19
        ) RETURNING *`,
        [
            sanitizeResumePersistenceValue(data.name),
            sanitizeResumePersistenceValue(data.title),
            sanitizeResumePersistenceValue(data.fileName),
            sanitizeResumePersistenceValue(data.relativePath) || null,
            data.fileBuffer,
            data.fileSize,
            sanitizeResumePersistenceValue(data.mimeType),
            sanitizeResumePersistenceValue(data.fileUrl),
            sanitizeResumePersistenceValue(data.status),
            data.firmId,
            sanitizeResumePersistenceValue(data.firmName),
            sanitizeResumePersistenceValue(data.profileType) || null,
            sanitizeResumePersistenceValue(data.candidateName) || null,
            sanitizeResumePersistenceValue(data.candidateEmail) || null,
            sanitizeResumePersistenceValue(data.consentStatus) || null,
            sanitizeResumePersistenceValue(data.consentToken) || null,
            data.tokenExpiresAt || null,
            data.consentRequestedAt || null,
            data.retentionUntil || null
        ]
    );
    const row = result.rows[0];

    if (data.invalidateCaches !== false) {
        await invalidateResumeCollectionViews(row?.firm_id || data.firmId || null);
    }
    return row;
}

/**
 * Update stored file URL for a resume.
 * @param {string} id
 * @param {string} fileUrl
 * @returns {Promise<void>}
 */
export async function updateResumeFileUrl(id, fileUrl, { executor } = {}) {
    const run = resolveResumeExecutor(executor) || query;
    await run(
        'UPDATE resumes SET resume_file_url = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [fileUrl, id]
    );
}

/**
 * Delete a resume
 * @param {string} id
 * @returns {Promise<boolean>}
 */
export async function deleteResume(id) {
    const options = arguments[1] || {};
    const executor = resolveResumeExecutor(options.executor) || query;
    const result = await executor('DELETE FROM resumes WHERE id = $1 RETURNING id, firm_id', [id]);
    if (result.rows.length === 0) {
        const err = new Error('Resume not found');
        err.statusCode = 404;
        throw err;
    }
    if (options.invalidateCaches !== false) {
        await invalidateResumeMutationViews(id, result.rows[0].firm_id || null);
    }
    return true;
}
