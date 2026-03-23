/**
 * Resume Routes - Shared Helper Functions
 * Contains utility functions used across resume route modules
 */

import { safeLog } from '../../utils/logger.backend.js';
import { getUserFirmId, isUserAdmin } from '../../utils/firmHelpers.js';
import * as resumesService from '../../services/resumes.service.js';

/**
 * Check if user has access to a specific resume
 * Admins can access all resumes, users can only access resumes from their firm
 * @param {Object} req - Express request object
 * @param {string} resumeId - Resume UUID
 * @returns {Promise<{hasAccess: boolean, resume: Object|null, error: string|null}>}
 */
export async function checkResumeAccess(req, resumeId) {
    try {
        const resume = await resumesService.getResumeForAccessCheck(resumeId);

        if (!resume) {
            return { hasAccess: false, resume: null, error: 'Resume not found' };
        }

        if (isUserAdmin(req)) {
            return { hasAccess: true, resume, error: null };
        }

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

export function parseScore(value) {
    if (value === undefined || value === null) return undefined;
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
        const cleaned = value.replace('%', '').trim();
        const parsed = parseInt(cleaned, 10);
        return Number.isNaN(parsed) ? undefined : parsed;
    }
    return undefined;
}

export function stringifyIfNeeded(value) {
    if (typeof value === 'string') {
        try {
            JSON.parse(value);
            return value;
        } catch {
            return JSON.stringify([value]);
        }
    }
    return JSON.stringify(value || []);
}

function getFirstDefinedValue(source, keys) {
    for (const key of keys) {
        if (source[key] !== undefined) {
            return source[key];
        }
    }
    return undefined;
}

export function normalizeResumeUpdatePayload(payload = {}) {
    return {
        name: getFirstDefinedValue(payload, ['name', 'Name']),
        title: getFirstDefinedValue(payload, ['title', 'Title']),
        status: getFirstDefinedValue(payload, ['status', 'Status']),
        originalText: getFirstDefinedValue(payload, ['originalText', 'original_text', 'Original Text']),
        improvedText: getFirstDefinedValue(payload, ['improvedText', 'improved_text', 'Improved Text']),
        globalRating: getFirstDefinedValue(payload, ['globalRating', 'global_rating', 'Global Rating']),
        skillsScore: getFirstDefinedValue(payload, ['skillsScore', 'skills_score', 'Skills Score']),
        experienceScore: getFirstDefinedValue(payload, ['experienceScore', 'experience_score', 'Experience Score']),
        educationScore: getFirstDefinedValue(payload, ['educationScore', 'education_score', 'Education Score']),
        atsScore: getFirstDefinedValue(payload, ['atsScore', 'ats_score', 'ATS Score']),
        executiveSummaryScore: getFirstDefinedValue(payload, ['executiveSummaryScore', 'executive_summary_score', 'Executive Summary Score']),
        hobbiesLanguagesScore: getFirstDefinedValue(payload, ['hobbiesLanguagesScore', 'hobbies_languages_score', 'Hobbies Languages Score']),
        improvedGlobalRating: getFirstDefinedValue(payload, ['improvedGlobalRating', 'improved_global_rating', 'Improved Global Rating']),
        improvedSkillsScore: getFirstDefinedValue(payload, ['improvedSkillsScore', 'improved_skills_score', 'Improved Skills Score']),
        improvedExperienceScore: getFirstDefinedValue(payload, ['improvedExperienceScore', 'improved_experience_score', 'Improved Experience Score']),
        improvedEducationScore: getFirstDefinedValue(payload, ['improvedEducationScore', 'improved_education_score', 'Improved Education Score']),
        improvedAtsScore: getFirstDefinedValue(payload, ['improvedAtsScore', 'improved_ats_score', 'Improved ATS Score']),
        improvedExecutiveSummaryScore: getFirstDefinedValue(payload, ['improvedExecutiveSummaryScore', 'improved_executive_summary_score', 'Improved Executive Summary Score']),
        improvedHobbiesLanguagesScore: getFirstDefinedValue(payload, ['improvedHobbiesLanguagesScore', 'improved_hobbies_languages_score', 'Improved Hobbies Languages Score']),
        skills: getFirstDefinedValue(payload, ['skills', 'Skills']),
        industries: getFirstDefinedValue(payload, ['industries', 'Industries']),
        tools: getFirstDefinedValue(payload, ['tools', 'Tools']),
        softSkills: getFirstDefinedValue(payload, ['softSkills', 'soft_skills', 'Soft Skills']),
        skillsCleaned: getFirstDefinedValue(payload, ['skillsCleaned', 'skills_cleaned', 'Skills_cleaned']),
        industriesCleaned: getFirstDefinedValue(payload, ['industriesCleaned', 'industries_cleaned', 'Industries_cleaned']),
        toolsCleaned: getFirstDefinedValue(payload, ['toolsCleaned', 'tools_cleaned', 'Tools_cleaned']),
        softSkillsCleaned: getFirstDefinedValue(payload, ['softSkillsCleaned', 'soft_skills_cleaned', 'Soft Skills_cleaned']),
        skillsEsco: getFirstDefinedValue(payload, ['skillsEsco', 'skills_esco', 'Skills_esco']),
        industriesEsco: getFirstDefinedValue(payload, ['industriesEsco', 'industries_esco', 'Industries_esco']),
        toolsEsco: getFirstDefinedValue(payload, ['toolsEsco', 'tools_esco', 'Tools_esco']),
        softSkillsEsco: getFirstDefinedValue(payload, ['softSkillsEsco', 'soft_skills_esco', 'Soft Skills_esco']),
        improvedSkills: getFirstDefinedValue(payload, ['improvedSkills', 'improved_skills', 'Improved Skills']),
        improvedIndustries: getFirstDefinedValue(payload, ['improvedIndustries', 'improved_industries', 'Improved Industries']),
        improvedTools: getFirstDefinedValue(payload, ['improvedTools', 'improved_tools', 'Improved Tools']),
        improvedSoftSkills: getFirstDefinedValue(payload, ['improvedSoftSkills', 'improved_soft_skills', 'Improved Soft Skills']),
        keyImprovements: getFirstDefinedValue(payload, ['keyImprovements', 'key_improvements', 'Key Improvements']),
        improvedKeyImprovements: getFirstDefinedValue(payload, ['improvedKeyImprovements', 'improved_key_improvements', 'Improved Key Improvements']),
        summary: getFirstDefinedValue(payload, ['summary', 'Summary']),
        experienceYears: getFirstDefinedValue(payload, ['experienceYears', 'experience_years', 'Experience Years']),
        educationLevel: getFirstDefinedValue(payload, ['educationLevel', 'education_level', 'Education Level']),
        certifications: getFirstDefinedValue(payload, ['certifications', 'Certifications']),
        languages: getFirstDefinedValue(payload, ['languages', 'Languages']),
        originalName: getFirstDefinedValue(payload, ['originalName', 'original_name', 'Original Name']),
        analysisDate: getFirstDefinedValue(payload, ['analysisDate', 'analyzedAt', 'analyzed_at', 'Analysis Date']),
        lastImproved: getFirstDefinedValue(payload, ['lastImproved', 'Last Improved'])
    };
}

const buildResumeFile = (record) => (
    record.resume_file_url ? [{
        id: record.id,
        filename: record.file_name,
        size: record.resume_file_size,
        type: record.resume_file_type,
        url: record.resume_file_url
    }] : []
);

export function mapResumeToFrontend(record) {
    const resumeFile = buildResumeFile(record);

    return {
        id: record.id,
        Name: record.name,
        name: record.name,
        Title: record.title,
        title: record.title,
        'File Name': record.file_name,
        fileName: record.file_name,
        file_name: record.file_name,
        'Resume File': resumeFile,
        resumeFile,
        Status: record.status,
        status: record.status,
        FirmName: record.firm_name,
        firmName: record.firm_name,
        CustomerName: record.firm_name,
        customerName: record.firm_name,
        'Global Rating': record.global_rating,
        globalRating: record.global_rating,
        'Skills Score': record.skills_score,
        skillsScore: record.skills_score,
        'Experience Score': record.experience_score,
        experienceScore: record.experience_score,
        'Education Score': record.education_score,
        educationScore: record.education_score,
        'ATS Score': record.ats_score,
        atsScore: record.ats_score,
        'Executive Summary Score': record.executive_summary_score,
        executiveSummaryScore: record.executive_summary_score,
        'Hobbies Languages Score': record.hobbies_languages_score,
        hobbiesLanguagesScore: record.hobbies_languages_score,
        'Improved Global Rating': record.improved_global_rating,
        improvedGlobalRating: record.improved_global_rating,
        'Improved Skills Score': record.improved_skills_score,
        improvedSkillsScore: record.improved_skills_score,
        'Improved Experience Score': record.improved_experience_score,
        improvedExperienceScore: record.improved_experience_score,
        'Improved Education Score': record.improved_education_score,
        improvedEducationScore: record.improved_education_score,
        'Improved ATS Score': record.improved_ats_score,
        improvedAtsScore: record.improved_ats_score,
        'Improved Executive Summary Score': record.improved_executive_summary_score,
        improvedExecutiveSummaryScore: record.improved_executive_summary_score,
        'Improved Hobbies Languages Score': record.improved_hobbies_languages_score,
        improvedHobbiesLanguagesScore: record.improved_hobbies_languages_score,
        Skills: record.skills,
        skills: record.skills,
        Industries: record.industries,
        industries: record.industries,
        Tools: record.tools,
        tools: record.tools,
        'Soft Skills': record.soft_skills,
        softSkills: record.soft_skills,
        'Skills_cleaned': record.skills_cleaned,
        skillsCleaned: record.skills_cleaned,
        'Industries_cleaned': record.industries_cleaned,
        industriesCleaned: record.industries_cleaned,
        'Tools_cleaned': record.tools_cleaned,
        toolsCleaned: record.tools_cleaned,
        'Soft Skills_cleaned': record.soft_skills_cleaned,
        softSkillsCleaned: record.soft_skills_cleaned,
        'Skills_esco': record.skills_esco,
        skillsEsco: record.skills_esco,
        'Industries_esco': record.industries_esco,
        industriesEsco: record.industries_esco,
        'Tools_esco': record.tools_esco,
        toolsEsco: record.tools_esco,
        'Soft Skills_esco': record.soft_skills_esco,
        softSkillsEsco: record.soft_skills_esco,
        'Improved Skills': record.improved_skills,
        improvedSkills: record.improved_skills,
        'Improved Industries': record.improved_industries,
        improvedIndustries: record.improved_industries,
        'Improved Tools': record.improved_tools,
        improvedTools: record.improved_tools,
        'Improved Soft Skills': record.improved_soft_skills,
        improvedSoftSkills: record.improved_soft_skills,
        'Key Improvements': record.key_improvements,
        keyImprovements: record.key_improvements,
        'Improved Key Improvements': record.improved_key_improvements,
        improvedKeyImprovements: record.improved_key_improvements,
        Summary: record.summary,
        summary: record.summary,
        'Experience Years': record.experience_years,
        experienceYears: record.experience_years,
        'Education Level': record.education_level,
        educationLevel: record.education_level,
        Certifications: record.certifications,
        certifications: record.certifications,
        Languages: record.languages,
        languages: record.languages,
        'Original Text': record.original_text,
        originalText: record.original_text,
        original_text: record.original_text,
        'Improved Text': record.improved_text,
        improvedText: record.improved_text,
        improved_text: record.improved_text,
        'Original Name': record.original_name,
        originalName: record.original_name,
        'Created At': record.created_at,
        createdAt: record.created_at,
        'Analyzed At': record.analyzed_at,
        analyzedAt: record.analyzed_at,
        'Updated At': record.updated_at,
        updatedAt: record.updated_at,
        'Current Version': record.current_version || 0,
        currentVersion: record.current_version || 0,
        profile_type: record.profile_type,
        profileType: record.profile_type,
        candidate_name: record.candidate_name,
        candidateName: record.candidate_name,
        candidate_email: record.candidate_email,
        candidateEmail: record.candidate_email,
        consent_status: record.consent_status,
        consentStatus: record.consent_status,
        consent_requested_at: record.consent_requested_at,
        consentRequestedAt: record.consent_requested_at,
        consent_responded_at: record.consent_responded_at,
        consentRespondedAt: record.consent_responded_at,
        consent_token_expires_at: record.consent_token_expires_at,
        consentTokenExpiresAt: record.consent_token_expires_at,
        retention_until: record.retention_until,
        retentionUntil: record.retention_until
    };
}

export { RESUME_SELECT_COLUMNS } from '../../services/resumes.service.js';
