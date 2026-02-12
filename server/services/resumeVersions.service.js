/**
 * Resume Versions Service
 * Manages versioning of improved CV text
 */

import { query } from './database.service.js';
import { createModuleLogger } from '../utils/logger.backend.js';

const log = createModuleLogger('resumeVersions');

// ============================================
// VERSION MANAGEMENT
// ============================================

/**
 * Get the latest version number for a resume
 * @param {string} resumeId - Resume UUID
 * @returns {Promise<number>} - Latest version number (0 if no versions exist)
 */
export async function getLatestVersionNumber(resumeId) {
    const result = await query(
        `SELECT COALESCE(MAX(version_number), 0) as latest_version 
         FROM resume_versions 
         WHERE resume_id = $1`,
        [resumeId]
    );
    return result.rows[0]?.latest_version || 0;
}

/**
 * Create a new version of a resume's improved text
 * @param {Object} params - Version parameters
 * @param {string} params.resumeId - Resume UUID
 * @param {string} params.improvedText - The improved text content
 * @param {Object} params.scores - Improved scores object
 * @param {Object} params.tags - Improved tags object
 * @param {string} params.userId - User UUID who created the version
 * @param {string} params.changeReason - Reason for version creation
 * @returns {Promise<Object>} - Created version record
 */
export async function createVersion({
    resumeId,
    improvedText,
    scores = {},
    tags = {},
    keyImprovements = null,
    userId = null,
    changeReason = 'manual_edit'
}) {
    // Get next version number
    const latestVersion = await getLatestVersionNumber(resumeId);
    const newVersionNumber = latestVersion + 1;

    log.info('Creating new resume version', {
        resumeId,
        newVersionNumber,
        changeReason,
        textLength: improvedText?.length || 0
    });

    // Insert new version
    const result = await query(
        `INSERT INTO resume_versions (
            resume_id,
            version_number,
            improved_text,
            improved_global_rating,
            improved_skills_score,
            improved_experience_score,
            improved_education_score,
            improved_ats_score,
            improved_executive_summary_score,
            improved_hobbies_languages_score,
            improved_skills,
            improved_industries,
            improved_tools,
            improved_soft_skills,
            improved_key_improvements,
            created_by,
            change_reason
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        RETURNING *`,
        [
            resumeId,
            newVersionNumber,
            improvedText,
            scores.improvedGlobalRating || scores.improved_global_rating || null,
            scores.improvedSkillsScore || scores.improved_skills_score || null,
            scores.improvedExperienceScore || scores.improved_experience_score || null,
            scores.improvedEducationScore || scores.improved_education_score || null,
            scores.improvedAtsScore || scores.improved_ats_score || null,
            scores.improvedExecutiveSummaryScore || scores.improved_executive_summary_score || null,
            scores.improvedHobbiesLanguagesScore || scores.improved_hobbies_languages_score || null,
            JSON.stringify(tags.improvedSkills || tags.improved_skills || []),
            JSON.stringify(tags.improvedIndustries || tags.improved_industries || []),
            JSON.stringify(tags.improvedTools || tags.improved_tools || []),
            JSON.stringify(tags.improvedSoftSkills || tags.improved_soft_skills || []),
            keyImprovements,
            userId,
            changeReason
        ]
    );

    // Update current_version on the resume
    await query(
        `UPDATE resumes SET current_version = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [newVersionNumber, resumeId]
    );

    log.info('Resume version created successfully', {
        resumeId,
        versionNumber: newVersionNumber,
        versionId: result.rows[0].id
    });

    return formatVersion(result.rows[0]);
}

/**
 * Get all versions for a resume
 * @param {string} resumeId - Resume UUID
 * @param {Object} options - Query options
 * @param {number} options.limit - Max versions to return
 * @param {number} options.offset - Offset for pagination
 * @returns {Promise<Object>} - Versions list with pagination info
 */
export async function getVersions(resumeId, { limit = 50, offset = 0 } = {}) {
    // Get total count
    const countResult = await query(
        `SELECT COUNT(*) as total FROM resume_versions WHERE resume_id = $1`,
        [resumeId]
    );
    const total = parseInt(countResult.rows[0].total, 10);

    // Get versions
    const result = await query(
        `SELECT rv.*, u.name as created_by_name, u.email as created_by_email
         FROM resume_versions rv
         LEFT JOIN users u ON rv.created_by = u.id
         WHERE rv.resume_id = $1
         ORDER BY rv.version_number DESC
         LIMIT $2 OFFSET $3`,
        [resumeId, limit, offset]
    );

    return {
        versions: result.rows.map(formatVersion),
        total,
        limit,
        offset,
        hasMore: offset + result.rows.length < total
    };
}

/**
 * Get a specific version by version number
 * @param {string} resumeId - Resume UUID
 * @param {number} versionNumber - Version number to retrieve
 * @returns {Promise<Object|null>} - Version record or null
 */
export async function getVersion(resumeId, versionNumber) {
    const result = await query(
        `SELECT rv.*, u.name as created_by_name, u.email as created_by_email
         FROM resume_versions rv
         LEFT JOIN users u ON rv.created_by = u.id
         WHERE rv.resume_id = $1 AND rv.version_number = $2`,
        [resumeId, versionNumber]
    );

    if (result.rows.length === 0) {
        return null;
    }

    return formatVersion(result.rows[0]);
}

/**
 * Restore a previous version (creates a new version with the old content)
 * @param {string} resumeId - Resume UUID
 * @param {number} versionNumber - Version number to restore
 * @param {string} userId - User UUID performing the restore
 * @returns {Promise<Object>} - New version created from restore
 */
export async function restoreVersion(resumeId, versionNumber, userId) {
    // Get the version to restore
    const versionToRestore = await getVersion(resumeId, versionNumber);
    
    if (!versionToRestore) {
        throw new Error(`Version ${versionNumber} not found for resume ${resumeId}`);
    }

    log.info('Restoring resume version', {
        resumeId,
        fromVersion: versionNumber,
        userId
    });

    // Create a new version with the restored content
    const newVersion = await createVersion({
        resumeId,
        improvedText: versionToRestore.improvedText,
        scores: {
            improvedGlobalRating: versionToRestore.improvedGlobalRating,
            improvedSkillsScore: versionToRestore.improvedSkillsScore,
            improvedExperienceScore: versionToRestore.improvedExperienceScore,
            improvedEducationScore: versionToRestore.improvedEducationScore,
            improvedAtsScore: versionToRestore.improvedAtsScore,
            improvedExecutiveSummaryScore: versionToRestore.improvedExecutiveSummaryScore,
            improvedHobbiesLanguagesScore: versionToRestore.improvedHobbiesLanguagesScore
        },
        tags: {
            improvedSkills: versionToRestore.improvedSkills,
            improvedIndustries: versionToRestore.improvedIndustries,
            improvedTools: versionToRestore.improvedTools,
            improvedSoftSkills: versionToRestore.improvedSoftSkills
        },
        keyImprovements: versionToRestore.improvedKeyImprovements,
        userId,
        changeReason: `restore_from_v${versionNumber}`
    });

    // Update the resume's improved_text with the restored content
    await query(
        `UPDATE resumes SET 
            improved_text = $1,
            improved_global_rating = $2,
            improved_skills_score = $3,
            improved_experience_score = $4,
            improved_education_score = $5,
            improved_ats_score = $6,
            improved_executive_summary_score = $7,
            improved_hobbies_languages_score = $8,
            improved_skills = $9,
            improved_industries = $10,
            improved_tools = $11,
            improved_soft_skills = $12,
            improved_key_improvements = $13,
            updated_at = CURRENT_TIMESTAMP
         WHERE id = $14`,
        [
            versionToRestore.improvedText,
            versionToRestore.improvedGlobalRating,
            versionToRestore.improvedSkillsScore,
            versionToRestore.improvedExperienceScore,
            versionToRestore.improvedEducationScore,
            versionToRestore.improvedAtsScore,
            versionToRestore.improvedExecutiveSummaryScore,
            versionToRestore.improvedHobbiesLanguagesScore,
            JSON.stringify(versionToRestore.improvedSkills || []),
            JSON.stringify(versionToRestore.improvedIndustries || []),
            JSON.stringify(versionToRestore.improvedTools || []),
            JSON.stringify(versionToRestore.improvedSoftSkills || []),
            versionToRestore.improvedKeyImprovements,
            resumeId
        ]
    );

    log.info('Resume version restored successfully', {
        resumeId,
        restoredFromVersion: versionNumber,
        newVersion: newVersion.versionNumber
    });

    return newVersion;
}

/**
 * Check if improved text has changed compared to current version
 * @param {string} resumeId - Resume UUID
 * @param {string} newImprovedText - New improved text to compare
 * @returns {Promise<boolean>} - True if text has changed
 */
export async function hasImprovedTextChanged(resumeId, newImprovedText) {
    const result = await query(
        `SELECT improved_text FROM resumes WHERE id = $1`,
        [resumeId]
    );

    if (result.rows.length === 0) {
        return true; // Resume not found, treat as changed
    }

    const currentText = result.rows[0].improved_text || '';
    const newText = newImprovedText || '';

    // Normalize whitespace for comparison
    const normalizedCurrent = currentText.trim().replace(/\s+/g, ' ');
    const normalizedNew = newText.trim().replace(/\s+/g, ' ');

    return normalizedCurrent !== normalizedNew;
}

// ============================================
// HELPERS
// ============================================

/**
 * Format a version record for API response
 * @param {Object} row - Database row
 * @returns {Object} - Formatted version object
 */
function formatVersion(row) {
    return {
        id: row.id,
        resumeId: row.resume_id,
        versionNumber: row.version_number,
        improvedText: row.improved_text,
        improvedGlobalRating: row.improved_global_rating,
        improvedSkillsScore: row.improved_skills_score,
        improvedExperienceScore: row.improved_experience_score,
        improvedEducationScore: row.improved_education_score,
        improvedAtsScore: row.improved_ats_score,
        improvedExecutiveSummaryScore: row.improved_executive_summary_score,
        improvedHobbiesLanguagesScore: row.improved_hobbies_languages_score,
        improvedSkills: row.improved_skills || [],
        improvedIndustries: row.improved_industries || [],
        improvedTools: row.improved_tools || [],
        improvedSoftSkills: row.improved_soft_skills || [],
        improvedKeyImprovements: row.improved_key_improvements,
        createdAt: row.created_at,
        createdBy: row.created_by,
        createdByName: row.created_by_name || null,
        createdByEmail: row.created_by_email || null,
        changeReason: row.change_reason
    };
}

export default {
    getLatestVersionNumber,
    createVersion,
    getVersions,
    getVersion,
    restoreVersion,
    hasImprovedTextChanged
};
