import { analyzeResume, cleanupText } from '../../../services/openai.service.js';
import { getLLMSettings, calculateWeightedGlobalRating } from '../../../services/settings.service.js';
import { getAcceptedIndustriesString, getIndustryMappingString } from '../../../services/industry.service.js';
import { DEFAULT_ANALYSIS_PROMPT, ANONYMIZATION_RULES_ANONYMOUS, ANONYMIZATION_RULES_NOMINATIVE } from '../../../config/prompts.backend.js';
import { safeLog } from '../../../utils/logger.backend.js';
import { parseScore } from '../helpers.js';
import * as resumesService from '../../../services/resumes.service.js';
import { persistResumeSkillEvidence } from '../../../services/skillEvidence.service.js';
import { updateVersionPostAnalysis } from '../../../services/resumeVersions.service.js';
import {
    executeAiWorkflowWithCredits,
    runAiActionWithCredits,
    workflowReservationCoversAction
} from '../../../services/aiCredits.service.js';

function hasSuggestionContent(suggestions) {
    if (!suggestions || typeof suggestions !== 'object') return false;
    return Object.values(suggestions).some((value) => Array.isArray(value) ? value.length > 0 : Boolean(value));
}

function parseSuggestionsPayload(rawSuggestions) {
    if (!rawSuggestions) return {};
    if (typeof rawSuggestions === 'string') {
        try {
            return JSON.parse(rawSuggestions);
        } catch {
            return {};
        }
    }
    return rawSuggestions;
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

function buildImprovedResumeUpdateData(improvedText, analysis) {
    const improvedTags = analysis?.tags || {};
    const summaryText = extractSummaryText(analysis);
    return {
        improved_text: improvedText,
        improved_global_rating: parseScore(analysis?.globalRating || analysis?.['Global Rating']) || 0,
        improved_skills_score: parseScore(analysis?.skillsRating || analysis?.['Skills']) || 0,
        improved_experience_score: parseScore(analysis?.experiencesRating || analysis?.['Experience']) || 0,
        improved_education_score: parseScore(analysis?.educationRating || analysis?.['Education']) || 0,
        improved_ats_score: parseScore(analysis?.atsOptimizationRating || analysis?.['ATS Compatibility']) || 0,
        improved_executive_summary_score: parseScore(analysis?.executiveSummaryRating || analysis?.['Executive Summary']) || 0,
        improved_hobbies_languages_score: parseScore(analysis?.hobbiesLanguagesRating || analysis?.['Hobbies Languages']) || 0,
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

async function updateResumeVersionWithPostAnalysis(resumeId, versionNumber, analysis) {
    await updateVersionPostAnalysis(resumeId, versionNumber, analysis);
}

async function persistDeferredPostImprovementAnalysisInternal({
    resumeId,
    improvedText,
    fileName,
    userMetadata,
    currentVersion,
    workflowReservation = null
}) {
    const settings = await getLLMSettings();
    const model = settings.llmModel;
    const cvMode = settings.cvMode || 'nominative';
    let analysisPrompt = settings['Analysis Prompt'] || DEFAULT_ANALYSIS_PROMPT;
    const acceptedIndustries = await getAcceptedIndustriesString();
    const industryMapping = await getIndustryMappingString();
    analysisPrompt = analysisPrompt.replace('{ACCEPTED_INDUSTRIES}', acceptedIndustries);
    analysisPrompt = analysisPrompt.replace('{INDUSTRY_MAPPING}', industryMapping);

    let anonymizationRules = cvMode === 'anonymous' ? ANONYMIZATION_RULES_ANONYMOUS : ANONYMIZATION_RULES_NOMINATIVE;
    anonymizationRules = anonymizationRules.replace(/{FILENAME}/g, fileName || 'Non disponible');
    analysisPrompt = analysisPrompt.replace('{ANONYMIZATION_RULES}', anonymizationRules);

    let improvedAnalysis = await runAiActionWithCredits({
        firmId: userMetadata?.firmId || null,
        userId: userMetadata?.userId || null,
        actionType: 'resume.improvement',
        metadata: {
            ...(userMetadata || {}),
            resumeId
        },
        reservation: workflowReservationCoversAction(workflowReservation, 'resume.improvement')
            ? workflowReservation
            : null
    }, (actionConfig = {}) => analyzeResume(
        cleanupText(improvedText),
        model,
        analysisPrompt,
        userMetadata,
        true,
        fileName || null,
        { maxTokens: actionConfig.maxTokens }
    ));
    improvedAnalysis = await calculateWeightedGlobalRating(improvedAnalysis, settings);

    const updatedResume = await resumesService.updateResume(resumeId, buildImprovedResumeUpdateData(improvedText, improvedAnalysis));
    await persistResumeSkillEvidence({
        candidateId: resumeId,
        analysis: improvedAnalysis,
        phase: 'improved'
    });

    if (currentVersion) {
        await updateResumeVersionWithPostAnalysis(resumeId, currentVersion, improvedAnalysis);
    }

    safeLog('info', 'Deferred post-improvement analysis saved from PUT flow', {
        resumeId,
        currentVersion,
        hasSuggestions: hasSuggestionContent(improvedAnalysis.suggestions),
        suggestionsKeys: Object.keys(improvedAnalysis.suggestions || {})
    });

    return {
        updatedResume,
        improvedAnalysis
    };
}

async function persistDeferredPostImprovementAnalysis({
    resumeId,
    improvedText,
    fileName,
    userMetadata,
    currentVersion,
    workflowReservation = null
}) {
    if (workflowReservation) {
        return persistDeferredPostImprovementAnalysisInternal({
            resumeId,
            improvedText,
            fileName,
            userMetadata,
            currentVersion,
            workflowReservation
        });
    }

    return executeAiWorkflowWithCredits({
        firmId: userMetadata?.firmId || null,
        userId: userMetadata?.userId || null,
        workflowActionType: 'resume.improvement',
        steps: [{ actionType: 'resume.improvement' }],
        metadata: {
            ...(userMetadata || {}),
            resumeId,
            source: 'resume-update'
        }
    }, ({ workflowReservation: reservedWorkflow }) => persistDeferredPostImprovementAnalysisInternal({
        resumeId,
        improvedText,
        fileName,
        userMetadata,
        currentVersion,
        workflowReservation: reservedWorkflow
    }));
}

export {
    buildImprovedResumeUpdateData,
    hasSuggestionContent,
    parseSuggestionsPayload,
    persistDeferredPostImprovementAnalysis,
    updateResumeVersionWithPostAnalysis
};
