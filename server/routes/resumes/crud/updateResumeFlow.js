import { processAnalysisTags } from '../../../utils/tagCleaner.js';
import {
    parseScore,
    stringifyIfNeeded
} from '../helpers.js';
import {
    hasSuggestionContent,
    parseSuggestionsPayload
} from './improvementHelpers.js';

function assignScore(updateData, key, value) {
    if (value !== undefined) {
        updateData[key] = parseScore(value);
    }
}

function assignStringified(updateData, key, value) {
    if (value !== undefined) {
        updateData[key] = stringifyIfNeeded(value);
    }
}

function assignJsonOrString(updateData, key, value) {
    if (value !== undefined) {
        updateData[key] = typeof value === 'string'
            ? value
            : JSON.stringify(value);
    }
}

function buildRawTags(normalizedBody) {
    return {
        skills: Array.isArray(normalizedBody.skills) ? normalizedBody.skills : [],
        industries: Array.isArray(normalizedBody.industries) ? normalizedBody.industries : [],
        tools: Array.isArray(normalizedBody.tools) ? normalizedBody.tools : [],
        softSkills: Array.isArray(normalizedBody.softSkills) ? normalizedBody.softSkills : []
    };
}

function applyCleanedTags(updateData, rawTags) {
    const { cleanedTags } = processAnalysisTags({ tags: rawTags });

    if (cleanedTags.skills.length > 0) updateData.skills_cleaned = JSON.stringify(cleanedTags.skills);
    if (cleanedTags.industries.length > 0) updateData.industries_cleaned = JSON.stringify(cleanedTags.industries);
    if (cleanedTags.tools.length > 0) updateData.tools_cleaned = JSON.stringify(cleanedTags.tools);
    if (cleanedTags.softSkills.length > 0) updateData.soft_skills_cleaned = JSON.stringify(cleanedTags.softSkills);

    return cleanedTags;
}

export function buildResumeUpdateData(normalizedBody) {
    const updateData = {};
    let cleanedTagsMetadata = null;

    if (normalizedBody.name !== undefined) updateData.name = normalizedBody.name;
    if (normalizedBody.title !== undefined) updateData.title = normalizedBody.title;
    if (normalizedBody.status !== undefined) updateData.status = String(normalizedBody.status).toLowerCase();
    if (normalizedBody.originalText !== undefined) updateData.original_text = normalizedBody.originalText;
    if (normalizedBody.improvedText !== undefined) updateData.improved_text = normalizedBody.improvedText;

    assignScore(updateData, 'global_rating', normalizedBody.globalRating);
    assignScore(updateData, 'skills_score', normalizedBody.skillsScore);
    assignScore(updateData, 'experience_score', normalizedBody.experienceScore);
    assignScore(updateData, 'education_score', normalizedBody.educationScore);
    assignScore(updateData, 'ats_score', normalizedBody.atsScore);
    assignScore(updateData, 'executive_summary_score', normalizedBody.executiveSummaryScore);
    assignScore(updateData, 'hobbies_languages_score', normalizedBody.hobbiesLanguagesScore);
    assignScore(updateData, 'improved_global_rating', normalizedBody.improvedGlobalRating);
    assignScore(updateData, 'improved_skills_score', normalizedBody.improvedSkillsScore);
    assignScore(updateData, 'improved_experience_score', normalizedBody.improvedExperienceScore);
    assignScore(updateData, 'improved_education_score', normalizedBody.improvedEducationScore);
    assignScore(updateData, 'improved_ats_score', normalizedBody.improvedAtsScore);
    assignScore(updateData, 'improved_executive_summary_score', normalizedBody.improvedExecutiveSummaryScore);
    assignScore(updateData, 'improved_hobbies_languages_score', normalizedBody.improvedHobbiesLanguagesScore);

    assignStringified(updateData, 'skills', normalizedBody.skills);
    assignStringified(updateData, 'industries', normalizedBody.industries);
    assignStringified(updateData, 'tools', normalizedBody.tools);
    assignStringified(updateData, 'soft_skills', normalizedBody.softSkills);
    assignStringified(updateData, 'skills_cleaned', normalizedBody.skillsCleaned);
    assignStringified(updateData, 'industries_cleaned', normalizedBody.industriesCleaned);
    assignStringified(updateData, 'tools_cleaned', normalizedBody.toolsCleaned);
    assignStringified(updateData, 'soft_skills_cleaned', normalizedBody.softSkillsCleaned);
    assignStringified(updateData, 'skills_esco', normalizedBody.skillsEsco);
    assignStringified(updateData, 'industries_esco', normalizedBody.industriesEsco);
    assignStringified(updateData, 'tools_esco', normalizedBody.toolsEsco);
    assignStringified(updateData, 'soft_skills_esco', normalizedBody.softSkillsEsco);
    assignStringified(updateData, 'improved_skills', normalizedBody.improvedSkills);
    assignStringified(updateData, 'improved_industries', normalizedBody.improvedIndustries);
    assignStringified(updateData, 'improved_tools', normalizedBody.improvedTools);
    assignStringified(updateData, 'improved_soft_skills', normalizedBody.improvedSoftSkills);

    assignJsonOrString(updateData, 'key_improvements', normalizedBody.keyImprovements);

    if (normalizedBody.improvedKeyImprovements !== undefined) {
        assignJsonOrString(updateData, 'improved_key_improvements', normalizedBody.improvedKeyImprovements);
        updateData.improvement_suggestions = updateData.improved_key_improvements;
    }

    if (normalizedBody.summary !== undefined) updateData.summary = normalizedBody.summary;
    if (normalizedBody.experienceYears !== undefined) updateData.experience_years = normalizedBody.experienceYears;
    if (normalizedBody.educationLevel !== undefined) updateData.education_level = normalizedBody.educationLevel;
    if (normalizedBody.certifications !== undefined) updateData.certifications = normalizedBody.certifications;
    if (normalizedBody.languages !== undefined) updateData.languages = normalizedBody.languages;
    if (normalizedBody.originalName !== undefined) updateData.original_name = normalizedBody.originalName;
    if (normalizedBody.analysisDate !== undefined) updateData.analyzed_at = new Date(normalizedBody.analysisDate);
    if (normalizedBody.lastImproved !== undefined) updateData.improvement_date = new Date(normalizedBody.lastImproved);

    if (normalizedBody.skills || normalizedBody.industries || normalizedBody.tools || normalizedBody.softSkills) {
        updateData.analyzed_at = new Date();
        const rawTags = buildRawTags(normalizedBody);
        const cleanedTags = applyCleanedTags(updateData, rawTags);
        cleanedTagsMetadata = { rawTags, cleanedTags };
    }

    return { updateData, cleanedTagsMetadata };
}

export function getUpdateRequestLogContext(normalizedBody, rawBody) {
    return {
        bodyKeys: Object.keys(rawBody || {}),
        hasImprovedGlobalRating: normalizedBody.improvedGlobalRating !== undefined,
        improvedGlobalRatingValue: normalizedBody.improvedGlobalRating,
        improvedSkillsScoreValue: normalizedBody.improvedSkillsScore,
        improvedExperienceScoreValue: normalizedBody.improvedExperienceScore
    };
}

export function getPreparedUpdateLogContext(updateData) {
    return {
        fieldsToUpdate: Object.keys(updateData),
        hasGlobalRating: updateData.global_rating !== undefined,
        globalRatingMapped: updateData.global_rating
    };
}

export function getCleanedTagsLogContext(cleanedTagsMetadata) {
    if (!cleanedTagsMetadata) {
        return null;
    }

    const { rawTags, cleanedTags } = cleanedTagsMetadata;
    return {
        rawSkills: rawTags.skills.length,
        cleanedSkills: cleanedTags.skills.length,
        rawIndustries: rawTags.industries.length,
        cleanedIndustries: cleanedTags.industries.length
    };
}

export function resolveResumeChangeReason(normalizedBody, updateData) {
    if (!updateData.improved_text) {
        return 'manual_edit';
    }

    if (normalizedBody.status === 'Improved' || normalizedBody.status === 'improved' || normalizedBody.lastImproved) {
        return 'initial_improvement';
    }

    return 'manual_edit';
}

export function buildVersionPayload({ resumeId, updateData, userId, changeReason }) {
    return {
        resumeId,
        improvedText: updateData.improved_text,
        scores: {
            improvedGlobalRating: updateData.improved_global_rating,
            improvedSkillsScore: updateData.improved_skills_score,
            improvedExperienceScore: updateData.improved_experience_score,
            improvedEducationScore: updateData.improved_education_score,
            improvedAtsScore: updateData.improved_ats_score,
            improvedExecutiveSummaryScore: updateData.improved_executive_summary_score,
            improvedHobbiesLanguagesScore: updateData.improved_hobbies_languages_score
        },
        tags: {
            improvedSkills: updateData.improved_skills ? JSON.parse(updateData.improved_skills) : [],
            improvedIndustries: updateData.improved_industries ? JSON.parse(updateData.improved_industries) : [],
            improvedTools: updateData.improved_tools ? JSON.parse(updateData.improved_tools) : [],
            improvedSoftSkills: updateData.improved_soft_skills ? JSON.parse(updateData.improved_soft_skills) : []
        },
        keyImprovements: updateData.improved_key_improvements,
        userId,
        changeReason
    };
}

export function shouldInvalidateResumeTagsCache(updateData) {
    return Boolean(
        updateData.skills_cleaned ||
        updateData.industries_cleaned ||
        updateData.tools_cleaned ||
        updateData.soft_skills_cleaned
    );
}

export function buildDeferredPostAnalysisDecision(changeReason, updateData) {
    const improvedSuggestionsPayload = parseSuggestionsPayload(updateData.improved_key_improvements);
    const hasImmediatePostAnalysisPayload = Boolean(
        updateData.analysis_details ||
        updateData.summary ||
        updateData.experience_years !== undefined ||
        updateData.education_level !== undefined ||
        updateData.certifications !== undefined ||
        updateData.languages !== undefined
    );

    const shouldRunDeferredPostAnalysis = Boolean(
        changeReason === 'initial_improvement' &&
        updateData.improved_text &&
        (!hasSuggestionContent(improvedSuggestionsPayload) || !hasImmediatePostAnalysisPayload)
    );

    return {
        hasImmediateSuggestions: hasSuggestionContent(improvedSuggestionsPayload),
        hasImmediatePostAnalysisPayload,
        shouldRunDeferredPostAnalysis
    };
}
