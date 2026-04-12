import { safeLog } from '../../../utils/logger.backend.js';
import { query } from '../../../config/database.js';
import { ITEM_STATUS, updateJobItemStatus } from '../../batchJobs.service.js';
import { parseScore } from '../helpers.js';
import { analyzeImprovedResumeWithLLM, improveResumeWithLLM } from '../llmIntegration.js';
import { getLLMSettings } from '../../settings.service.js';
import { extractSummaryText, stringifyJsonField } from './shared.js';
import { updateResume } from '../../resumes.service.js';

export async function processImprovement(item, resumeId, text, analysis, job) {
    safeLog('info', 'Improving CV with LLM', { itemId: item.id, resumeId });
    await updateJobItemStatus(item.id, ITEM_STATUS.PROCESSING, { progress: 75 });

    let textForImprovement = text;
    if (analysis.structuredText && analysis.structuredText.trim().length > 100) {
        textForImprovement = analysis.structuredText;
        safeLog('debug', 'Using structuredText for improvement', {
            itemId: item.id,
            structuredTextLength: analysis.structuredText.length
        });
    } else {
        safeLog('debug', 'Using original text for improvement (structuredText empty or too short)', {
            itemId: item.id,
            originalTextLength: text.length,
            structuredTextLength: analysis.structuredText?.length || 0
        });
    }

    let improvedResult;
    const maxImproveRetries = 2;
    let lastImproveError = null;

    for (let attempt = 1; attempt <= maxImproveRetries; attempt++) {
        try {
            safeLog('info', `Improvement attempt ${attempt}/${maxImproveRetries}`, { itemId: item.id, resumeId });
            improvedResult = await improveResumeWithLLM(
                textForImprovement,
                analysis,
                job.firm_id,
                item.file_name
            );
            break;
        } catch (improveError) {
            lastImproveError = improveError;
            safeLog('warn', `CV improvement attempt ${attempt} failed`, {
                itemId: item.id,
                resumeId,
                attempt,
                maxRetries: maxImproveRetries,
                error: improveError.message
            });

            if (attempt < maxImproveRetries) {
                await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
            }
        }
    }

    if (!improvedResult && lastImproveError) {
        safeLog('error', 'CV improvement failed after all retries', {
            itemId: item.id,
            resumeId,
            error: lastImproveError.message
        });
        throw new Error(`Échec de l'amélioration du CV après ${maxImproveRetries} tentatives: ${lastImproveError.message}`);
    }

    if (improvedResult && improvedResult.text && improvedResult.text.trim().length > 0) {
        safeLog('info', 'Starting post-improvement analysis', { itemId: item.id, resumeId });
        await updateJobItemStatus(item.id, ITEM_STATUS.PROCESSING, { progress: 80 });
        const improvedAnalysis = await analyzeImprovedResumeWithLLM(improvedResult.text, job.firm_id, item.file_name);
        await updateJobItemStatus(item.id, ITEM_STATUS.PROCESSING, { progress: 90 });
        await saveImprovedData(item, resumeId, {
            ...improvedResult,
            analysis: improvedAnalysis
        });
    } else {
        safeLog('error', 'Improvement returned empty or no result after successful call', {
            itemId: item.id,
            resumeId,
            hasResult: !!improvedResult,
            hasText: !!improvedResult?.text,
            textLength: improvedResult?.text?.length || 0
        });

        throw new Error("L'amélioration a retourné un texte vide. Le CV n'a pas pu être amélioré.");
    }
}

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

    const totalWeight = Object.values(weights).reduce((sum, w) => sum + w, 0);

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

    safeLog('info', 'CV improvement saved successfully', { itemId: item.id, resumeId });
}

export async function processImproveItem(item, job) {
    if (!item.resume_id) {
        throw new Error('Resume ID manquant');
    }

    const resumeResult = await query(`
        SELECT id, original_text, global_rating, skills_score, experience_score,
               education_score, ats_score, executive_summary_score, hobbies_languages_score,
               key_improvements, name, title
        FROM resumes WHERE id = $1
    `, [item.resume_id]);

    if (resumeResult.rows.length === 0) {
        throw new Error('CV non trouvé');
    }

    const resume = resumeResult.rows[0];
    const text = resume.original_text;

    if (!text) {
        throw new Error('Texte du CV manquant');
    }

    await updateJobItemStatus(item.id, ITEM_STATUS.PROCESSING, { progress: 30 });

    const analysis = {
        globalRating: resume.global_rating,
        skillsRating: resume.skills_score,
        experiencesRating: resume.experience_score,
        educationRating: resume.education_score,
        atsOptimizationRating: resume.ats_score,
        executiveSummaryRating: resume.executive_summary_score,
        hobbiesLanguagesRating: resume.hobbies_languages_score,
        suggestions: resume.key_improvements ? (typeof resume.key_improvements === 'string' ? JSON.parse(resume.key_improvements) : resume.key_improvements) : {},
        name: resume.name,
        title: resume.title
    };

    await updateJobItemStatus(item.id, ITEM_STATUS.PROCESSING, { progress: 50 });

    let improvedResult;
    const maxImproveRetries = 2;
    let lastImproveError = null;

    for (let attempt = 1; attempt <= maxImproveRetries; attempt++) {
        try {
            safeLog('info', `Improvement attempt ${attempt}/${maxImproveRetries} (improve job)`, {
                itemId: item.id,
                resumeId: item.resume_id
            });
            improvedResult = await improveResumeWithLLM(text, analysis, job.firm_id, item.file_name);
            break;
        } catch (improveError) {
            lastImproveError = improveError;
            safeLog('warn', `CV improvement attempt ${attempt} failed (improve job)`, {
                itemId: item.id,
                resumeId: item.resume_id,
                attempt,
                maxRetries: maxImproveRetries,
                error: improveError.message
            });

            if (attempt < maxImproveRetries) {
                await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
            }
        }
    }

    if (!improvedResult && lastImproveError) {
        safeLog('error', 'CV improvement failed after all retries (improve job)', {
            itemId: item.id,
            resumeId: item.resume_id,
            error: lastImproveError.message
        });
        throw new Error(`Échec de l'amélioration du CV après ${maxImproveRetries} tentatives: ${lastImproveError.message}`);
    }

    if (!improvedResult || !improvedResult.text || improvedResult.text.trim().length === 0) {
        safeLog('error', 'Improvement returned empty result (improve job)', {
            itemId: item.id,
            resumeId: item.resume_id,
            hasResult: !!improvedResult,
            hasText: !!improvedResult?.text,
            textLength: improvedResult?.text?.length || 0
        });
        throw new Error("L'amélioration a retourné un texte vide. Le CV n'a pas pu être amélioré.");
    }

    safeLog('info', 'Starting post-improvement analysis (improve job)', { itemId: item.id, resumeId: item.resume_id });
    await updateJobItemStatus(item.id, ITEM_STATUS.PROCESSING, { progress: 80 });

    const improvedAnalysis = await analyzeImprovedResumeWithLLM(improvedResult.text, job.firm_id, item.file_name);

    await updateJobItemStatus(item.id, ITEM_STATUS.PROCESSING, { progress: 90 });

    await saveImprovedData(item, item.resume_id, {
        ...improvedResult,
        analysis: improvedAnalysis
    });

    safeLog('info', 'Improve item processing completed', { itemId: item.id, resumeId: item.resume_id });
    await updateJobItemStatus(item.id, ITEM_STATUS.PROCESSING, { progress: 95 });
}
