/**
 * Resumes Service
 * Data access layer for resume CRUD operations
 * Extracted from resumes/crud.routes.js, resumes/upload.routes.js, and resumes/helpers.js
 */

import { query } from '../config/database.js';
import { findWithTimeout, createWithTimeout, escapeLike } from '../utils/postgresHelpers.js';
import { safeLog } from '../utils/logger.backend.js';

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
        queryParams.push(limit + 1, offset);
    } else {
        sql = `SELECT ${RESUME_SELECT_COLUMNS} FROM resumes`;
        if (conditions.length > 0) {
            sql += ` WHERE ${conditions.join(' AND ')}`;
        }
        const limitIdx = queryParams.length + 1;
        const offsetIdx = queryParams.length + 2;
        sql += ` ORDER BY LOWER(name) ASC, created_at DESC LIMIT $${limitIdx} OFFSET $${offsetIdx}`;
        queryParams.push(limit + 1, offset);
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
    return result.rows[0];
}

/**
 * Delete a resume
 * @param {string} id
 * @returns {Promise<boolean>}
 */
export async function deleteResume(id) {
    const result = await query('DELETE FROM resumes WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
        const err = new Error('Resume not found');
        err.statusCode = 404;
        throw err;
    }
    return true;
}

/**
 * Insert a new resume (upload)
 * @param {Object} data
 * @returns {Promise<Object>} created resume
 */
export async function insertResume(data) {
    const result = await query(
        `INSERT INTO resumes (
            name, title, file_name, resume_file_data, resume_file_size, resume_file_type, 
            resume_file_url, status, firm_id, firm_name,
            profile_type, candidate_name, candidate_email, consent_status,
            consent_token, consent_token_expires_at, consent_requested_at, retention_until
        )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
         RETURNING *`,
        [
            data.name, data.title, data.fileName, data.fileBuffer, data.fileSize,
            data.mimeType, data.fileUrl, data.status, data.firmId, data.firmName,
            data.profileType, data.candidateName, data.candidateEmail, data.consentStatus,
            data.consentToken, data.tokenExpiresAt, data.consentRequestedAt, data.retentionUntil
        ]
    );
    return result.rows[0];
}

/**
 * Update resume file URL after insert
 * @param {string} id
 * @param {string} url
 */
export async function updateResumeFileUrl(id, url) {
    await query(
        `UPDATE resumes SET resume_file_url = $1 WHERE id = $2`,
        [url, id]
    );
}

/**
 * Update resume consent status
 * @param {string} id
 * @param {string} status
 */
export async function updateConsentStatus(id, status) {
    await query(`
        UPDATE resumes 
        SET consent_status = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
    `, [status, id]);
}

// ============================================
// LLM handler helpers (from resumes/llm.handlers.js)
// ============================================

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
    return createWithTimeout('resume_adaptations', data);
}
