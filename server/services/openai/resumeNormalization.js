import { safeLog } from '../../utils/logger.backend.js';
import { cleanupHtml } from './textUtils.js';
import { validateResumeAnalysisPayload, validateResumeImprovementEnvelope } from './contracts.js';
import {
    normalizeKeywordEvidenceArray,
    pickFirstNonEmptyArray,
    normalizeSuggestionsBySection
} from './resumeNormalizationCollections.js';

function _pickNumericScore(...values) {
    for (const value of values) {
        if (value === undefined || value === null || value === '') continue;
        if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value);
        const parsed = parseInt(String(value).replace('%', '').trim(), 10);
        if (!Number.isNaN(parsed)) return parsed;
    }
    return 0;
}

export function pickNumericScoreOrUndefined(...values) {
    for (const value of values) {
        if (value === undefined || value === null || value === '') continue;
        if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value);
        const parsed = parseInt(String(value).replace('%', '').trim(), 10);
        if (!Number.isNaN(parsed)) return parsed;
    }
    return undefined;
}

function extractStructuredSummaryText(summary) {
    if (typeof summary === 'string') return summary.trim() || '';
    if (!summary || typeof summary !== 'object') return '';

    const parts = [];
    const title = typeof summary.title === 'string' ? summary.title.trim() : '';
    const targetRole = typeof summary.targetRole === 'string' ? summary.targetRole.trim() : '';
    const highlights = Array.isArray(summary.profileHighlights)
        ? summary.profileHighlights.filter(Boolean).map(item => String(item).trim()).filter(Boolean)
        : [];

    if (title) parts.push(title);
    if (targetRole && targetRole !== title) parts.push(targetRole);
    if (highlights.length > 0) parts.push(highlights.join(' '));

    return parts.join(' - ').trim();
}

function looksLikeHtml(value) {
    return typeof value === 'string' && /<\/?[a-z][^>]*>/i.test(value);
}

function collectImprovementCandidates(...candidates) {
    return candidates
        .filter(candidate => typeof candidate === 'string')
        .map(candidate => candidate.trim())
        .filter(Boolean);
}

export function finalizeImprovedOutput({ sourceText, selectedText, htmlAlternatives = [], context = {} }) {
    const normalizedSelected = typeof selectedText === 'string' ? cleanupHtml(selectedText) : '';
    const normalizedAlternatives = collectImprovementCandidates(...htmlAlternatives).map(candidate => cleanupHtml(candidate));
    const bestHtmlAlternative = normalizedAlternatives.find(looksLikeHtml) || '';
    const sourceLooksLikeHtml = looksLikeHtml(sourceText);
    const selectedLooksLikeHtml = looksLikeHtml(normalizedSelected);

    if (!normalizedSelected) {
        return normalizedSelected;
    }

    if (!selectedLooksLikeHtml && bestHtmlAlternative) {
        safeLog('warn', 'LLM improvement output was flattened; using structured HTML alternative', {
            ...context,
            selectedLength: normalizedSelected.length,
            alternativeLength: bestHtmlAlternative.length
        });
        return bestHtmlAlternative;
    }

    if (!selectedLooksLikeHtml && sourceLooksLikeHtml) {
        safeLog('warn', 'LLM improvement output lost HTML structure with no structured fallback available', {
            ...context,
            selectedLength: normalizedSelected.length,
            sourceLength: sourceText.length
        });
    }

    return normalizedSelected;
}

export function extractImprovementEnvelope(parsedInput) {
    const parsed = validateResumeImprovementEnvelope(parsedInput);
    const nestedImprovedCv = parsed?.improvedCV && typeof parsed.improvedCV === 'object' ? parsed.improvedCV : {};
    const nestedImprovedResume = parsed?.improvedResume && typeof parsed.improvedResume === 'object' ? parsed.improvedResume : {};
    const nestedResume = parsed?.resume && typeof parsed.resume === 'object' ? parsed.resume : {};
    const envelope = Object.keys(nestedImprovedCv).length > 0
        ? nestedImprovedCv
        : Object.keys(nestedImprovedResume).length > 0
            ? nestedImprovedResume
            : nestedResume;

    const htmlCandidates = collectImprovementCandidates(
        parsed?.structuredText,
        envelope?.structuredText,
        parsed?.html,
        envelope?.html,
        parsed?.improvedText,
        envelope?.improvedText,
        parsed?.content,
        envelope?.content,
        parsed?.text,
        envelope?.text
    ).filter(looksLikeHtml);

    const textCandidates = collectImprovementCandidates(
        parsed?.improvedText,
        envelope?.improvedText,
        parsed?.content,
        envelope?.content,
        parsed?.text,
        envelope?.text
    );

    return {
        parsed,
        envelope,
        improvedText: htmlCandidates[0] || textCandidates[0] || '',
        htmlAlternatives: htmlCandidates,
        summary: parsed?.summary || envelope?.summary || {},
        improvements: parsed?.improvements || parsed?.scores || parsed?.analysis || envelope?.improvements || envelope?.scores || envelope?.analysis || {},
        tags: {
            ...(parsed?.tags && typeof parsed.tags === 'object' ? parsed.tags : {}),
            ...(envelope?.tags && typeof envelope.tags === 'object' ? envelope.tags : {}),
            skills: pickFirstNonEmptyArray(
                parsed?.tags?.skills,
                envelope?.tags?.skills,
                parsed?.skills,
                envelope?.skills,
                parsed?.competencies,
                envelope?.competencies,
                parsed?.keywords,
                envelope?.keywords,
                parsed?.summary?.skills,
                envelope?.summary?.skills
            ),
            industries: pickFirstNonEmptyArray(
                parsed?.tags?.industries,
                envelope?.tags?.industries,
                parsed?.industries,
                envelope?.industries,
                parsed?.summary?.industries,
                envelope?.summary?.industries
            ),
            tools: pickFirstNonEmptyArray(
                parsed?.tags?.tools,
                envelope?.tags?.tools,
                parsed?.tools,
                envelope?.tools,
                parsed?.technologies,
                envelope?.technologies,
                parsed?.summary?.tools,
                envelope?.summary?.tools
            ),
            softSkills: pickFirstNonEmptyArray(
                parsed?.tags?.softSkills,
                envelope?.tags?.softSkills,
                parsed?.tags?.soft_skills,
                envelope?.tags?.soft_skills,
                parsed?.softSkills,
                envelope?.softSkills,
                parsed?.soft_skills,
                envelope?.soft_skills,
                parsed?.summary?.softSkills,
                envelope?.summary?.softSkills
            ),
            skillsEvidence: normalizeKeywordEvidenceArray(
                parsed?.tags?.skillsEvidence?.length ? parsed?.tags?.skillsEvidence : envelope?.tags?.skillsEvidence
            ),
            toolsEvidence: normalizeKeywordEvidenceArray(
                parsed?.tags?.toolsEvidence?.length ? parsed?.tags?.toolsEvidence : envelope?.tags?.toolsEvidence
            ),
            softSkillsEvidence: normalizeKeywordEvidenceArray(
                parsed?.tags?.softSkillsEvidence?.length ? parsed?.tags?.softSkillsEvidence : envelope?.tags?.softSkillsEvidence
            )
        },
        name: parsed?.name || envelope?.name || '',
        title: parsed?.title || envelope?.title || '',
        experienceYears: parsed?.experienceYears ?? parsed?.experience_years ?? envelope?.experienceYears ?? envelope?.experience_years,
        educationLevel: parsed?.educationLevel ?? parsed?.education_level ?? envelope?.educationLevel ?? envelope?.education_level,
        certifications: parsed?.certifications ?? envelope?.certifications,
        languages: parsed?.languages ?? envelope?.languages,
        suggestionsSource: parsed?.suggestions || parsed?.['Key Improvements'] || parsed?.keyImprovements || parsed?.recommendations || parsed?.sectionSuggestions || parsed?.section_improvements || envelope?.suggestions || envelope?.['Key Improvements'] || envelope?.keyImprovements || envelope?.recommendations || envelope?.sectionSuggestions || envelope?.section_improvements || null
    };
}

export function normalizeAnalysisResponse(analysisInput) {
    const analysis = validateResumeAnalysisPayload(analysisInput);
    const hobbiesRating = analysis.hobbiesLanguagesRating
        || analysis['Hobbies Languages']
        || analysis.hobbiesLanguages
        || analysis['Hobbies & Languages']
        || analysis.hobbies_languages
        || analysis['Languages & Hobbies']
        || analysis.languagesHobbiesRating
        || '0%';

    const normalizedSuggestions = normalizeSuggestionsBySection(analysis);

    const normalized = {
        name: analysis.name || analysis.Name || 'Candidat',
        title: analysis.title || analysis.Title || analysis['Professional Title'] || '',
        globalRating: analysis.globalRating || analysis['Global Rating'] || '0%',
        executiveSummaryRating: analysis.executiveSummaryRating || analysis['Executive Summary'] || '0%',
        skillsRating: analysis.skillsRating || analysis.Skills || '0%',
        experiencesRating: analysis.experiencesRating || analysis.Experience || '0%',
        educationRating: analysis.educationRating || analysis.Education || '0%',
        hobbiesLanguagesRating: hobbiesRating,
        atsOptimizationRating: analysis.atsOptimizationRating || analysis['ATS Compatibility'] || analysis.ATS || '0%',
        tags: {
            ...(analysis.tags || {}),
            skills: analysis.tags?.skills || analysis['Top Skills'] || [],
            industries: analysis.tags?.industries || analysis['Top Industries'] || [],
            tools: analysis.tags?.tools || analysis['Top Tools'] || [],
            softSkills: analysis.tags?.softSkills || analysis['Top Soft Skills'] || [],
            skillsEvidence: normalizeKeywordEvidenceArray(analysis.tags?.skillsEvidence),
            toolsEvidence: normalizeKeywordEvidenceArray(analysis.tags?.toolsEvidence),
            softSkillsEvidence: normalizeKeywordEvidenceArray(analysis.tags?.softSkillsEvidence)
        },
        suggestions: normalizedSuggestions
    };

    normalized['Global Rating'] = normalized.globalRating;
    normalized['Executive Summary'] = normalized.executiveSummaryRating;
    normalized.Skills = normalized.skillsRating;
    normalized.Experience = normalized.experiencesRating;
    normalized.Education = normalized.educationRating;
    normalized['Hobbies Languages'] = normalized.hobbiesLanguagesRating;
    normalized['ATS Compatibility'] = normalized.atsOptimizationRating;
    normalized['Top Skills'] = normalized.tags.skills;
    normalized['Top Industries'] = normalized.tags.industries;
    normalized['Top Tools'] = normalized.tags.tools;
    normalized['Top Soft Skills'] = normalized.tags.softSkills;
    normalized['Key Improvements'] = normalized.suggestions;
    normalized.Summary = analysis.Summary || analysis.summary || '';

    if (analysis.structuredText) {
        normalized.structuredText = analysis.structuredText;
    }

    return normalized;
}

export function buildImprovementAnalysisResult(improvementPayload, analysis = {}) {
    const improvements = improvementPayload.improvements || {};
    const summary = improvementPayload.summary || {};
    const tags = improvementPayload.tags || {};
    const normalizedSuggestions = normalizeSuggestionsBySection(improvementPayload.suggestionsSource);

    const analysisResult = {
        suggestions: normalizedSuggestions,
        tags: {
            skills: pickFirstNonEmptyArray(tags.skills, summary.skills),
            industries: pickFirstNonEmptyArray(tags.industries, summary.industries),
            tools: pickFirstNonEmptyArray(tags.tools, summary.tools),
            softSkills: pickFirstNonEmptyArray(tags.softSkills, tags.soft_skills, summary.softSkills),
            skillsEvidence: normalizeKeywordEvidenceArray(tags.skillsEvidence),
            toolsEvidence: normalizeKeywordEvidenceArray(tags.toolsEvidence),
            softSkillsEvidence: normalizeKeywordEvidenceArray(tags.softSkillsEvidence)
        },
        name: improvementPayload.name || summary.name || analysis?.name || '',
        title: summary.targetRole || summary.title || improvementPayload.title || analysis?.title || '',
        summary: extractStructuredSummaryText(summary),
        experienceYears: improvementPayload.experienceYears,
        educationLevel: improvementPayload.educationLevel,
        certifications: improvementPayload.certifications,
        languages: improvementPayload.languages
    };

    const globalRating = pickNumericScoreOrUndefined(improvements.overall, improvements.globalRating, improvements.global);
    const executiveSummaryRating = pickNumericScoreOrUndefined(improvements.executiveSummary, improvements.executive_summary, improvements.executiveSummaryRating, improvements.summary);
    const skillsRating = pickNumericScoreOrUndefined(improvements.skills, improvements.skillsRating, improvements.competencies);
    const experiencesRating = pickNumericScoreOrUndefined(improvements.experience, improvements.experiences, improvements.experienceRating, improvements.experiencesRating);
    const educationRating = pickNumericScoreOrUndefined(improvements.education, improvements.educationRating, improvements.formation);
    const atsOptimizationRating = pickNumericScoreOrUndefined(improvements.atsOptimization, improvements.ats, improvements.atsOptimizationRating);
    const hobbiesLanguagesRating = pickNumericScoreOrUndefined(improvements.languagesInterests, improvements.hobbiesLanguages, improvements.languages, improvements.hobbiesLanguagesRating);

    if (globalRating !== undefined) analysisResult.globalRating = globalRating;
    if (executiveSummaryRating !== undefined) analysisResult.executiveSummaryRating = executiveSummaryRating;
    if (skillsRating !== undefined) analysisResult.skillsRating = skillsRating;
    if (experiencesRating !== undefined) analysisResult.experiencesRating = experiencesRating;
    if (educationRating !== undefined) analysisResult.educationRating = educationRating;
    if (atsOptimizationRating !== undefined) analysisResult.atsOptimizationRating = atsOptimizationRating;
    if (hobbiesLanguagesRating !== undefined) analysisResult.hobbiesLanguagesRating = hobbiesLanguagesRating;

    return analysisResult;
}

export function buildEmptyImprovementAnalysis() {
    return {
        globalRating: 0,
        executiveSummaryRating: 0,
        skillsRating: 0,
        experiencesRating: 0,
        educationRating: 0,
        atsOptimizationRating: 0,
        hobbiesLanguagesRating: 0,
        suggestions: {},
        tags: { skills: [], industries: [], tools: [], softSkills: [], skillsEvidence: [], toolsEvidence: [], softSkillsEvidence: [] },
        name: '',
        title: ''
    };
}
