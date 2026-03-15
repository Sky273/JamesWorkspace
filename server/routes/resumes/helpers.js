/**
 * Resume Routes - Shared Helper Functions
 * Contains utility functions used across resume route modules
 */

import { query } from '../../config/database.js';
import { safeLog } from '../../utils/logger.backend.js';
import { getUserFirmId, isUserAdmin } from '../../utils/firmHelpers.js';

/**
 * Check if user has access to a specific resume
 * Admins can access all resumes, users can only access resumes from their firm
 * @param {Object} req - Express request object
 * @param {string} resumeId - Resume UUID
 * @returns {Promise<{hasAccess: boolean, resume: Object|null, error: string|null}>}
 */
export async function checkResumeAccess(req, resumeId) {
    try {
        // Fetch resume with firm_id
        const result = await query(
            'SELECT id, firm_id, name FROM resumes WHERE id = $1',
            [resumeId]
        );
        
        if (result.rows.length === 0) {
            return { hasAccess: false, resume: null, error: 'Resume not found' };
        }
        
        const resume = result.rows[0];
        
        // Admins can access all resumes
        if (isUserAdmin(req)) {
            return { hasAccess: true, resume, error: null };
        }
        
        // Non-admin users can only access resumes from their firm
        const userFirmId = await getUserFirmId(req);
        
        if (!userFirmId) {
            safeLog('warn', 'User has no valid firm_id', { userId: req.user?.id });
            return { hasAccess: false, resume: null, error: 'User has no valid firm association' };
        }
        
        if (resume.firm_id !== userFirmId) {
            safeLog('warn', 'Access denied: user tried to access resume from different firm', {
                userId: req.user?.id,
                userFirmId,
                resumeFirmId: resume.firm_id,
                resumeId
            });
            return { hasAccess: false, resume, error: 'Access denied' };
        }
        
        return { hasAccess: true, resume, error: null };
    } catch (error) {
        safeLog('error', 'Error checking resume access', { error: error.message, resumeId });
        return { hasAccess: false, resume: null, error: 'Failed to verify access' };
    }
}

/**
 * Parse score values - handles "75%", 75, "75" formats
 * @param {*} value - Score value in various formats
 * @returns {number|undefined} Parsed score or undefined
 */
export function parseScore(value) {
    if (value === undefined || value === null) return undefined;
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
        // Remove % and parse as integer
        const cleaned = value.replace('%', '').trim();
        const parsed = parseInt(cleaned, 10);
        return isNaN(parsed) ? undefined : parsed;
    }
    return undefined;
}

/**
 * Stringify value if needed for JSONB fields
 * @param {*} value - Value to stringify
 * @returns {string} JSON string
 */
export function stringifyIfNeeded(value) {
    if (typeof value === 'string') {
        // Already a string, check if it's valid JSON
        try {
            JSON.parse(value);
            return value; // Already valid JSON string
        } catch {
            return JSON.stringify([value]); // Single string, wrap in array
        }
    }
    return JSON.stringify(value || []);
}

/**
 * Map database resume record to frontend format
 * @param {Object} record - Database record
 * @returns {Object} Frontend-formatted resume
 */
export function mapResumeToFrontend(record) {
    return {
        id: record.id,
        Name: record.name,
        Title: record.title,
        'File Name': record.file_name,
        'Resume File': record.resume_file_url ? [{
            id: record.id,
            filename: record.file_name,
            size: record.resume_file_size,
            type: record.resume_file_type,
            url: record.resume_file_url
        }] : [],
        Status: record.status,
        FirmName: record.firm_name,
        CustomerName: record.firm_name,
        // Analysis scores
        'Global Rating': record.global_rating,
        'Skills Score': record.skills_score,
        'Experience Score': record.experience_score,
        'Education Score': record.education_score,
        'ATS Score': record.ats_score,
        'Executive Summary Score': record.executive_summary_score,
        'Hobbies Languages Score': record.hobbies_languages_score,
        // Improved scores
        'Improved Global Rating': record.improved_global_rating,
        'Improved Skills Score': record.improved_skills_score,
        'Improved Experience Score': record.improved_experience_score,
        'Improved Education Score': record.improved_education_score,
        'Improved ATS Score': record.improved_ats_score,
        'Improved Executive Summary Score': record.improved_executive_summary_score,
        'Improved Hobbies Languages Score': record.improved_hobbies_languages_score,
        // Tags
        Skills: record.skills,
        Industries: record.industries,
        Tools: record.tools,
        'Soft Skills': record.soft_skills,
        'Skills_cleaned': record.skills_cleaned,
        'Industries_cleaned': record.industries_cleaned,
        'Tools_cleaned': record.tools_cleaned,
        'Soft Skills_cleaned': record.soft_skills_cleaned,
        'Skills_esco': record.skills_esco,
        'Industries_esco': record.industries_esco,
        'Tools_esco': record.tools_esco,
        'Soft Skills_esco': record.soft_skills_esco,
        // Improved tags
        'Improved Skills': record.improved_skills,
        'Improved Industries': record.improved_industries,
        'Improved Tools': record.improved_tools,
        'Improved Soft Skills': record.improved_soft_skills,
        'Key Improvements': record.key_improvements,
        'Improved Key Improvements': record.improved_key_improvements,
        Summary: record.summary,
        'Experience Years': record.experience_years,
        'Education Level': record.education_level,
        Certifications: record.certifications,
        Languages: record.languages,
        // Text fields
        'Original Text': record.original_text,
        'Improved Text': record.improved_text,
        'Original Name': record.original_name,
        // Dates
        'Created At': record.created_at,
        'Analyzed At': record.analyzed_at,
        'Updated At': record.updated_at,
        // GDPR consent fields
        profile_type: record.profile_type,
        candidate_name: record.candidate_name,
        candidate_email: record.candidate_email,
        consent_status: record.consent_status,
        consent_requested_at: record.consent_requested_at,
        consent_responded_at: record.consent_responded_at,
        consent_token_expires_at: record.consent_token_expires_at,
        retention_until: record.retention_until
    };
}

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
