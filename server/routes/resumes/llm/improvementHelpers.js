import { analyzeResume, cleanupText } from '../../../services/openai.service.js';
import { updateResume } from '../../../services/resumes.service.js';
import { safeLog } from '../../../utils/logger.backend.js';
import { calculateWeightedGlobalRating } from '../../../services/settings.service.js';
import { getIndustryMappingString } from '../../../services/industry.service.js';
import { DEFAULT_ANALYSIS_PROMPT } from '../../../config/prompts.backend.js';
import { createVersion } from '../../../services/resumeVersions.service.js';

function parseScoreValue(value) {
    if (value === undefined || value === null || value === '') return 0;
    if (typeof value === 'number') return Number.isFinite(value) ? Math.round(value) : 0;
    const parsed = parseInt(String(value).replace('%', '').trim(), 10);
    return Number.isNaN(parsed) ? 0 : parsed;
}

function hasSuggestionContent(suggestions) {
    if (!suggestions || typeof suggestions !== 'object') return false;
    return Object.values(suggestions).some((value) => Array.isArray(value) ? value.length > 0 : Boolean(value));
}

function stringifyJsonField(value, fallback = null) {
    if (value === undefined) return undefined;
    if (value === null) return fallback;
    return JSON.stringify(value);
}

function extractSummaryText(analysis) {
    const summary = analysis?.summary ?? analysis?.Summary;
    if (typeof summary === 'string') {
        return summary.trim() || null;
    }
    if (summary && typeof summary === 'object') {
        const highlights = Array.isArray(summary.profileHighlights) ? summary.profileHighlights.filter(Boolean).map(String) : [];
        if (highlights.length > 0) {
            return highlights.join(' ');
        }
    }
    return null;
}

function buildImprovementVersionPayload(improvedText, analysis) {
    const improvedTags = analysis?.tags || {};
    return {
        improvedText,
        scores: {
            improvedGlobalRating: parseScoreValue(analysis?.globalRating || analysis?.['Global Rating']),
            improvedSkillsScore: parseScoreValue(analysis?.skillsRating || analysis?.['Skills']),
            improvedExperienceScore: parseScoreValue(analysis?.experiencesRating || analysis?.['Experience']),
            improvedEducationScore: parseScoreValue(analysis?.educationRating || analysis?.['Education']),
            improvedAtsScore: parseScoreValue(analysis?.atsOptimizationRating || analysis?.['ATS Compatibility']),
            improvedExecutiveSummaryScore: parseScoreValue(analysis?.executiveSummaryRating || analysis?.['Executive Summary']),
            improvedHobbiesLanguagesScore: parseScoreValue(analysis?.hobbiesLanguagesRating || analysis?.['Hobbies Languages'])
        },
        tags: {
            improvedSkills: improvedTags.skills || [],
            improvedIndustries: improvedTags.industries || [],
            improvedTools: improvedTags.tools || [],
            improvedSoftSkills: improvedTags.softSkills || []
        },
        keyImprovements: JSON.stringify(analysis?.suggestions || {})
    };
}

function buildImprovedResumeUpdateData(improvedText, analysis) {
    const improvedTags = analysis?.tags || {};
    const summaryText = extractSummaryText(analysis);
    return {
        improved_text: improvedText,
        improved_global_rating: parseScoreValue(analysis?.globalRating || analysis?.['Global Rating']),
        improved_skills_score: parseScoreValue(analysis?.skillsRating || analysis?.['Skills']),
        improved_experience_score: parseScoreValue(analysis?.experiencesRating || analysis?.['Experience']),
        improved_education_score: parseScoreValue(analysis?.educationRating || analysis?.['Education']),
        improved_ats_score: parseScoreValue(analysis?.atsOptimizationRating || analysis?.['ATS Compatibility']),
        improved_executive_summary_score: parseScoreValue(analysis?.executiveSummaryRating || analysis?.['Executive Summary']),
        improved_hobbies_languages_score: parseScoreValue(analysis?.hobbiesLanguagesRating || analysis?.['Hobbies Languages']),
        improved_skills: JSON.stringify(improvedTags.skills || []),
        improved_industries: JSON.stringify(improvedTags.industries || []),
        improved_tools: JSON.stringify(improvedTags.tools || []),
        improved_soft_skills: JSON.stringify(improvedTags.softSkills || []),
        improved_key_improvements: JSON.stringify(analysis?.suggestions || {}),
        improvement_suggestions: JSON.stringify(analysis?.suggestions || {}),
        analysis_details: analysis,
        summary: summaryText ?? undefined,
        title: analysis?.title || analysis?.Title || undefined,
        experience_years: analysis?.experienceYears ?? analysis?.experience_years,
        education_level: analysis?.educationLevel ?? analysis?.education_level,
        certifications: stringifyJsonField(analysis?.certifications),
        languages: stringifyJsonField(analysis?.languages),
        status: 'improved',
        improvement_date: new Date()
    };
}

async function persistPostImprovementAnalysis({
    resumeId,
    improvedText,
    model,
    settings,
    acceptedIndustries,
    anonymizationRules,
    originalFileName,
    userMetadata,
    userId,
    shouldCreateVersion
}) {
    let analysisPrompt = settings['Analysis Prompt'] || DEFAULT_ANALYSIS_PROMPT;
    const industryMapping = await getIndustryMappingString();
    analysisPrompt = analysisPrompt.replace('{ACCEPTED_INDUSTRIES}', acceptedIndustries);
    analysisPrompt = analysisPrompt.replace('{INDUSTRY_MAPPING}', industryMapping);
    analysisPrompt = analysisPrompt.replace('{ANONYMIZATION_RULES}', anonymizationRules);

    let postImprovementAnalysis = await analyzeResume(
        cleanupText(improvedText),
        model,
        analysisPrompt,
        userMetadata,
        true,
        originalFileName || null
    );

    postImprovementAnalysis = await calculateWeightedGlobalRating(postImprovementAnalysis, settings);
    const updatedRecord = await updateResume(
        resumeId,
        buildImprovedResumeUpdateData(improvedText, postImprovementAnalysis)
    );

    let createdVersionNumber = null;
    if (shouldCreateVersion) {
        const versionPayload = buildImprovementVersionPayload(improvedText, postImprovementAnalysis);
        const versionData = await createVersion({
            resumeId,
            improvedText: versionPayload.improvedText,
            scores: versionPayload.scores,
            tags: versionPayload.tags,
            keyImprovements: versionPayload.keyImprovements,
            userId,
            changeReason: 'initial_improvement'
        });
        createdVersionNumber = versionData.versionNumber;
    }

    safeLog('info', 'Post-improvement analysis saved', {
        resumeId,
        improvedGlobalRating: updatedRecord.improved_global_rating,
        hasSuggestions: hasSuggestionContent(postImprovementAnalysis.suggestions),
        suggestionsKeys: Object.keys(postImprovementAnalysis.suggestions || {}),
        createdVersionNumber
    });

    return {
        updatedRecord,
        postImprovementAnalysis,
        createdVersionNumber
    };
}

export {
    buildImprovedResumeUpdateData,
    hasSuggestionContent,
    parseScoreValue,
    persistPostImprovementAnalysis
};
