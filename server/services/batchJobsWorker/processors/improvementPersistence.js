import { safeLog } from '../../../utils/logger.backend.js';
import { parseScore } from '../helpers.js';
import { getLLMSettings } from '../../settings.service.js';
import { extractSummaryText, stringifyJsonField } from './shared.js';
import { updateResume } from '../../resumes.service.js';
import { persistResumeSkillEvidence } from '../../skillEvidence.service.js';

export async function saveImprovedData(item, resumeId, improvedResult) {
    const improvedAnalysis = improvedResult.analysis || {};
    const improvedTags = improvedAnalysis.tags || {};

    safeLog('debug', 'Improved result details', {
        hasText: !!improvedResult.text,
        textLength: improvedResult.text?.length,
        textPreview: improvedResult.text?.substring(0, 150),
        analysisKeys: Object.keys(improvedAnalysis),
        tagsKeys: Object.keys(improvedTags),
        skillsCount: improvedTags.skills?.length,
        industriesCount: improvedTags.industries?.length
    });

    const skillsScore = parseScore(improvedAnalysis.skillsRating);
    const experienceScore = parseScore(improvedAnalysis.experiencesRating);
    const educationScore = parseScore(improvedAnalysis.educationRating);
    const atsScore = parseScore(improvedAnalysis.atsOptimizationRating);
    const executiveSummaryScore = parseScore(improvedAnalysis.executiveSummaryRating);
    const hobbiesLanguagesScore = parseScore(improvedAnalysis.hobbiesLanguagesRating);

    const llmSettings = await getLLMSettings();

    const weights = {
        executiveSummary: llmSettings['Executive Summary Weight'] || llmSettings.executiveSummaryWeight || 20,
        skills: llmSettings['Skills Weight'] || llmSettings.skillsWeight || 20,
        experience: llmSettings['Experience Weight'] || llmSettings.experienceWeight || 20,
        education: llmSettings['Education Weight'] || llmSettings.educationWeight || 15,
        ats: llmSettings['ATS Weight'] || llmSettings.atsWeight || 15,
        hobbiesLanguages: llmSettings['Hobbies Languages Weight'] || llmSettings.hobbiesLanguagesWeight || 10
    };

    const totalWeight = Object.values(weights).reduce((sum, weight) => sum + weight, 0);

    const globalRating = Math.round(
        ((executiveSummaryScore || 0) * weights.executiveSummary +
         (skillsScore || 0) * weights.skills +
         (experienceScore || 0) * weights.experience +
         (educationScore || 0) * weights.education +
         (atsScore || 0) * weights.ats +
         (hobbiesLanguagesScore || 0) * weights.hobbiesLanguages) / totalWeight
    );

    safeLog('debug', 'Calculated improved global rating', {
        weights,
        totalWeight,
        scores: { skillsScore, experienceScore, educationScore, atsScore, executiveSummaryScore, hobbiesLanguagesScore },
        globalRating
    });

    safeLog('info', 'Saving improved CV data', {
        itemId: item.id,
        resumeId,
        hasImprovedText: !!improvedResult.text,
        improvedGlobalRating: globalRating,
        skillsScore,
        experienceScore,
        educationScore,
        atsScore,
        executiveSummaryScore,
        hobbiesLanguagesScore
    });

    const summaryText = extractSummaryText(improvedAnalysis);

    await updateResume(resumeId, {
        improved_text: improvedResult.text,
        improved_global_rating: globalRating,
        improved_skills_score: skillsScore,
        improved_experience_score: experienceScore,
        improved_education_score: educationScore,
        improved_ats_score: atsScore,
        improved_executive_summary_score: executiveSummaryScore,
        improved_hobbies_languages_score: hobbiesLanguagesScore,
        improved_skills: JSON.stringify(improvedTags.skills || []),
        improved_industries: JSON.stringify(improvedTags.industries || []),
        improved_tools: JSON.stringify(improvedTags.tools || []),
        improved_soft_skills: JSON.stringify(improvedTags.softSkills || []),
        improved_key_improvements: JSON.stringify(improvedAnalysis.suggestions || {}),
        improvement_suggestions: JSON.stringify(improvedAnalysis.suggestions || {}),
        analysis_details: JSON.stringify(improvedAnalysis),
        summary: summaryText,
        title: improvedAnalysis.title || null,
        experience_years: improvedAnalysis.experienceYears ?? improvedAnalysis.experience_years ?? null,
        education_level: improvedAnalysis.educationLevel ?? improvedAnalysis.education_level ?? null,
        certifications: stringifyJsonField(improvedAnalysis.certifications),
        languages: stringifyJsonField(improvedAnalysis.languages),
        status: 'improved',
        improvement_date: new Date().toISOString()
    });

    await persistResumeSkillEvidence({
        candidateId: resumeId,
        analysis: improvedAnalysis,
        phase: 'improved'
    });

    safeLog('info', 'CV improvement saved successfully', { itemId: item.id, resumeId });
}
