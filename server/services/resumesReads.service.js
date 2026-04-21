import { query } from '../config/database.js';
import { findWithTimeout, createWithTimeout } from '../utils/postgresHelpers.js';
import { resumesCache } from './cache.service.js';
import { invalidateResumeCollectionViews } from './resumesInvalidation.service.js';

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

function qualifyResumeConditions(conditions = []) {
    const whereClause = conditions.length > 0 ? conditions.join(' AND ') : '';
    if (!whereClause) {
        return '';
    }

    return whereClause.replace(/\b(firm_id|status|name|title|file_name)\b/g, 'r.$1');
}

export async function getResumeForAccessCheck(resumeId, { bypassCache = false } = {}) {
    const loadResume = async () => {
        const result = await query(
            'SELECT id, firm_id, name FROM resumes WHERE id = $1',
            [resumeId]
        );
        return result.rows.length > 0 ? result.rows[0] : null;
    };

    if (bypassCache) {
        return loadResume();
    }

    return resumesCache.getOrLoad(`access:${resumeId}`, loadResume, {
        scope: `detail:${resumeId}`
    });
}

export async function getResumeById(id, { bypassCache = false } = {}) {
    const loadResume = async () => {
        const result = await query(
            `SELECT ${RESUME_SELECT_COLUMNS} FROM resumes WHERE id = $1`,
            [id]
        );
        return result.rows.length > 0 ? result.rows[0] : null;
    };

    if (bypassCache) {
        return loadResume();
    }

    return resumesCache.getOrLoad(`detail:${id}`, loadResume, {
        scope: `detail:${id}`
    });
}

export async function getResumeFileForDownload(id) {
    const result = await query(
        `SELECT id, file_name, resume_file_data, resume_file_type, resume_file_size, firm_id, firm_name
         FROM resumes WHERE id = $1`,
        [id]
    );
    return result.rows.length > 0 ? result.rows[0] : null;
}

export async function countResumes({ conditions = [], params = [], dealId, dealParamIndex }) {
    let sql;
    const countParams = [...params];

    if (dealId) {
        sql = `SELECT COUNT(DISTINCT r.id) as total FROM resumes r
               INNER JOIN deal_resumes dr ON r.id = dr.resume_id
               WHERE dr.deal_id = $${dealParamIndex}`;
        countParams.push(dealId);
        const qualifiedWhereClause = qualifyResumeConditions(conditions);
        if (qualifiedWhereClause) {
            sql = sql.replace('WHERE dr.deal_id', `WHERE ${qualifiedWhereClause} AND dr.deal_id`);
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

export async function listResumes({ conditions = [], params = [], dealId, dealParamIndex, limit, offset }) {
    const normalizedLimit = Math.max(1, Math.min(Number.isFinite(limit) ? limit : 50, 100));
    const normalizedOffset = Math.max(0, Number.isFinite(offset) ? offset : 0);
    let sql;
    const queryParams = [...params];

    if (dealId) {
        sql = `SELECT DISTINCT r.${RESUME_SELECT_COLUMNS.split(',').map((column) => column.trim()).join(', r.')}
            FROM resumes r
            INNER JOIN deal_resumes dr ON r.id = dr.resume_id
            WHERE dr.deal_id = $${dealParamIndex}`;
        queryParams.push(dealId);
        const qualifiedWhereClause = qualifyResumeConditions(conditions);
        if (qualifiedWhereClause) {
            sql = sql.replace('WHERE dr.deal_id', `WHERE ${qualifiedWhereClause} AND dr.deal_id`);
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

export async function getResumeAuditInfo(resumeId) {
    return resumesCache.getOrLoad(`audit:${resumeId}`, async () => {
        const result = await query(`
            SELECT id, firm_id, firm_name, candidate_name, candidate_email, consent_status
            FROM resumes WHERE id = $1
        `, [resumeId]);
        return result.rows[0] || null;
    }, {
        scope: `detail:${resumeId}`
    });
}

export async function findResumeRecord(id) {
    return findWithTimeout('resumes', id);
}

export async function findMissionRecord(id) {
    return findWithTimeout('missions', id);
}

export async function createAdaptation(data) {
    const record = await createWithTimeout('resume_adaptations', data);
    await invalidateResumeCollectionViews(record.firm_id || data.firm_id || null);
    return record;
}
