/**
 * Resumes Service
 * Data access layer for resume CRUD operations
 * Extracted from resumes/crud.routes.js and resumes/helpers.js
 */

import { query } from '../config/database.js';
import { findWithTimeout, createWithTimeout } from '../utils/postgresHelpers.js';
import { invalidateDashboardAndGroupedViews } from './viewCacheInvalidation.service.js';
import { invalidateClientsCaches, invalidateDealsCaches } from './cache.service.js';

function resolveExecutor(executor) {
    if (typeof executor === 'function') {
        return executor;
    }

    if (executor && typeof executor.query === 'function') {
        return executor.query.bind(executor);
    }

    return query;
}

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
 * SQL columns to select for resume queries (excludes binary resume_file_data)
 */
export const RESUME_SELECT_COLUMNS = `
    id, name, title, file_name, resume_file_url, resume_file_size, resume_file_type,
    status, firm_id, firm_name, skills, industries, tools, soft_skills,
    skills_cleaned, industries_cleaned, tools_cleaned, soft_skills_cleaned,
    skills_esco, industries_esco, tools_esco, soft_skills_esco,
    key_improvements, summary, experience_years, education_level, certifications, languages,
    created_at, updated_at, analyzed_at, original_text, improved_text, original_name,
    global_rating, skills_score, experience_score, education_score, ats_score,
    executive_summary_score, hobbies_languages_score,
    improved_global_rating, improved_skills_score, improved_experience_score, improved_education_score,
    improved_ats_score, improved_executive_summary_score, improved_hobbies_languages_score,
    template_id, template_name, improvement_suggestions, analysis_details, improvement_date,
    trigram, improved_key_improvements, improved_skills, improved_industries, improved_tools, improved_soft_skills,
    profile_type, candidate_name, candidate_email, consent_status, consent_requested_at, consent_responded_at, consent_token_expires_at, retention_until
`.trim();

/**
 * Get resume by ID for access checking (lightweight - only id, firm_id, name)
 * @param {string} resumeId
 * @returns {Promise<Object|null>}
 */
export async function getResumeForAccessCheck(resumeId) {
    const result = await query(
        'SELECT id, firm_id, name FROM resumes WHERE id = $1',
        [resumeId]
    );
    return result.rows.length > 0 ? result.rows[0] : null;
}

/**
 * Get resume by ID (all columns except binary file data)
 * @param {string} id
 * @returns {Promise<Object|null>}
 */
export async function getResumeById(id) {
    const result = await query(
        `SELECT ${RESUME_SELECT_COLUMNS} FROM resumes WHERE id = $1`,
        [id]
    );
    return result.rows.length > 0 ? result.rows[0] : null;
}

/**
 * Get resume file data for download
 * @param {string} id
 * @returns {Promise<Object|null>}
 */
export async function getResumeFileForDownload(id) {
    const result = await query(
        `SELECT id, file_name, resume_file_data, resume_file_type, resume_file_size, firm_id, firm_name
         FROM resumes WHERE id = $1`,
        [id]
    );
    return result.rows.length > 0 ? result.rows[0] : null;
}

/**
 * Count resumes matching given filters
 * @param {Object} options
 * @returns {Promise<number>}
 */
export async function countResumes({ conditions = [], params = [], dealId, dealParamIndex }) {
    let sql;
    const countParams = [...params];

    if (dealId) {
        sql = `SELECT COUNT(DISTINCT r.id) as total FROM resumes r 
               INNER JOIN deal_resumes dr ON r.id = dr.resume_id 
               WHERE dr.deal_id = $${dealParamIndex}`;
        countParams.push(dealId);
        const whereClause = conditions.length > 0 ? conditions.join(' AND ') : '';
        if (whereClause) {
            sql = sql.replace('WHERE dr.deal_id', `WHERE ${whereClause.replace(/\b(firm_id|status|name|title|file_name)\b/g, 'r.$1')} AND dr.deal_id`);
        }
    } else {
        sql = 'SELECT COUNT(*) as total FROM resumes';
        if (conditions.length > 0) {
            sql += ` WHERE ${conditions.join(' AND ')}`;
        }
    }

    const result = await query(sql, countParams);
    return parseInt(result.rows[0]?.total || '0', 10);
}

/**
 * List resumes with pagination and filters
 * @param {Object} options
 * @returns {Promise<Array>}
 */
export async function listResumes({ conditions = [], params = [], dealId, dealParamIndex, limit, offset }) {
    const normalizedLimit = Math.max(1, Math.min(Number.isFinite(limit) ? limit : 50, 100));
    const normalizedOffset = Math.max(0, Number.isFinite(offset) ? offset : 0);
    let sql;
    const queryParams = [...params];

    if (dealId) {
        sql = `SELECT DISTINCT r.${RESUME_SELECT_COLUMNS.split(',').map(c => c.trim()).join(', r.')}
            FROM resumes r
            INNER JOIN deal_resumes dr ON r.id = dr.resume_id
            WHERE dr.deal_id = $${dealParamIndex}`;
        queryParams.push(dealId);
        const whereClause = conditions.length > 0 ? conditions.join(' AND ') : '';
        if (whereClause) {
            sql = sql.replace('WHERE dr.deal_id', `WHERE ${whereClause.replace(/\b(firm_id|status|name|title|file_name)\b/g, 'r.$1')} AND dr.deal_id`);
        }
        const limitIdx = queryParams.length + 1;
        const offsetIdx = queryParams.length + 2;
        sql += ` ORDER BY LOWER(r.name) ASC, r.created_at DESC LIMIT $${limitIdx} OFFSET $${offsetIdx}`;
        queryParams.push(normalizedLimit + 1, normalizedOffset);
    } else {
        sql = `SELECT ${RESUME_SELECT_COLUMNS} FROM resumes`;
        if (conditions.length > 0) {
            sql += ` WHERE ${conditions.join(' AND ')}`;
        }
        const limitIdx = queryParams.length + 1;
        const offsetIdx = queryParams.length + 2;
        sql += ` ORDER BY LOWER(name) ASC, created_at DESC LIMIT $${limitIdx} OFFSET $${offsetIdx}`;
        queryParams.push(normalizedLimit + 1, normalizedOffset);
    }

    const result = await query(sql, queryParams);
    return result.rows;
}

/**
 * Update a resume
 * @param {string} id
 * @param {Object} updateData - field/value pairs
 * @returns {Promise<Object>} updated resume
 */
export async function updateResume(id, updateData) {
    const setClauses = [];
    const params = [];
    let idx = 1;

    for (const [key, value] of Object.entries(updateData)) {
        if (value !== undefined && ALLOWED_COLUMNS.has(key)) {
            setClauses.push(`${key} = $${idx}`);
            params.push(value);
            idx++;
        }
    }

    if (setClauses.length === 0) {
        return getResumeById(id);
    }

    setClauses.push(`updated_at = CURRENT_TIMESTAMP`);
    params.push(id);

    const result = await query(
        `UPDATE resumes SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`,
        params
    );

    if (result.rows.length === 0) {
        const err = new Error('Resume not found');
        err.statusCode = 404;
        throw err;
    }
    await Promise.all([
        invalidateDashboardAndGroupedViews(result.rows[0].firm_id || null),
        invalidateClientsCaches(),
        invalidateDealsCaches()
    ]);
    return result.rows[0];
}

/**
 * Insert a resume record with file metadata.
 * Kept for compatibility with older service callers and tests.
 * @param {Object} data
 * @returns {Promise<Object>}
 */
export async function insertResume(data) {
    const executor = resolveExecutor(data.executor);
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
            data.name,
            data.title,
            data.fileName,
            data.relativePath || null,
            data.fileBuffer,
            data.fileSize,
            data.mimeType,
            data.fileUrl,
            data.status,
            data.firmId,
            data.firmName,
            data.profileType || null,
            data.candidateName || null,
            data.candidateEmail || null,
            data.consentStatus || null,
            data.consentToken || null,
            data.tokenExpiresAt || null,
            data.consentRequestedAt || null,
            data.retentionUntil || null
        ]
    );

    if (data.invalidateCaches !== false) {
        await Promise.all([
            invalidateDashboardAndGroupedViews(result.rows[0]?.firm_id || data.firmId || null),
            invalidateClientsCaches(),
            invalidateDealsCaches()
        ]);
    }
    return result.rows[0];
}

/**
 * Update stored file URL for a resume.
 * @param {string} id
 * @param {string} fileUrl
 * @returns {Promise<void>}
 */
export async function updateResumeFileUrl(id, fileUrl, { executor } = {}) {
    const run = resolveExecutor(executor);
    await run(
        'UPDATE resumes SET resume_file_url = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [fileUrl, id]
    );
}

/**
 * Update consent status for a resume.
 * @param {string} id
 * @param {string} consentStatus
 * @returns {Promise<void>}
 */
export async function updateConsentStatus(id, consentStatus, { executor } = {}) {
    const run = resolveExecutor(executor);
    await run(
        'UPDATE resumes SET consent_status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [consentStatus, id]
    );
}

/**
 * Delete a resume
 * @param {string} id
 * @returns {Promise<boolean>}
 */
export async function deleteResume(id) {
    const options = arguments[1] || {};
    const executor = resolveExecutor(options.executor);
    const result = await executor('DELETE FROM resumes WHERE id = $1 RETURNING id, firm_id', [id]);
    if (result.rows.length === 0) {
        const err = new Error('Resume not found');
        err.statusCode = 404;
        throw err;
    }
    if (options.invalidateCaches !== false) {
        await Promise.all([
            invalidateDashboardAndGroupedViews(result.rows[0].firm_id || null),
            invalidateClientsCaches(),
            invalidateDealsCaches()
        ]);
    }
    return true;
}

export async function expirePendingConsents() {
    const result = await query(`
        UPDATE resumes 
        SET consent_status = 'expired',
            updated_at = CURRENT_TIMESTAMP
        WHERE consent_status = 'pending_consent'
          AND consent_token_expires_at IS NOT NULL
          AND consent_token_expires_at < CURRENT_TIMESTAMP
        RETURNING id, firm_id
    `);
    await Promise.all([...new Set(result.rows.map((row) => row.firm_id).filter(Boolean))]
        .flatMap((firmId) => [
            invalidateDashboardAndGroupedViews(firmId),
            invalidateClientsCaches(),
            invalidateDealsCaches()
        ]));
    return result;
}

export async function expireRetentionConsents() {
    const result = await query(`
        UPDATE resumes 
        SET consent_status = 'expired',
            updated_at = CURRENT_TIMESTAMP
        WHERE consent_status = 'active'
          AND retention_until IS NOT NULL
          AND retention_until < CURRENT_TIMESTAMP
        RETURNING id, firm_id
    `);
    await Promise.all([...new Set(result.rows.map((row) => row.firm_id).filter(Boolean))]
        .flatMap((firmId) => [
            invalidateDashboardAndGroupedViews(firmId),
            invalidateClientsCaches(),
            invalidateDealsCaches()
        ]));
    return result;
}

export async function recordConsentReminderSent(resumeId) {
    const result = await query(`
        UPDATE resumes 
        SET consent_reminder_sent_at = CURRENT_TIMESTAMP,
            consent_reminder_count = consent_reminder_count + 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING id, firm_id
    `, [resumeId]);
    if (result.rows[0]?.firm_id) {
        await Promise.all([
            invalidateDashboardAndGroupedViews(result.rows[0].firm_id),
            invalidateClientsCaches(),
            invalidateDealsCaches()
        ]);
    }
    return result;
}

export async function getResumeAuditInfo(resumeId) {
    const result = await query(`
        SELECT id, firm_id, firm_name, candidate_name, candidate_email, consent_status
        FROM resumes WHERE id = $1
    `, [resumeId]);
    return result.rows[0] || null;
}

/**
 * Find a resume record by ID (full record via findWithTimeout)
 * @param {string} id
 * @returns {Promise<Object>} Resume record (throws if not found)
 */
export async function findResumeRecord(id) {
    return findWithTimeout('resumes', id);
}

/**
 * Find a mission record by ID
 * @param {string} id
 * @returns {Promise<Object>} Mission record (throws if not found)
 */
export async function findMissionRecord(id) {
    return findWithTimeout('missions', id);
}

/**
 * Create a resume adaptation record
 * @param {Object} data - Adaptation fields
 * @returns {Promise<Object>} Created adaptation record
 */
export async function createAdaptation(data) {
    const record = await createWithTimeout('resume_adaptations', data);
    await Promise.all([
        invalidateDashboardAndGroupedViews(record.firm_id || data.firm_id || null),
        invalidateClientsCaches(),
        invalidateDealsCaches()
    ]);
    return record;
}
