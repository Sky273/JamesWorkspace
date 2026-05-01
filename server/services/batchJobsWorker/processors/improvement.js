import { safeLog } from '../../../utils/logger.backend.js';
import { query } from '../../../config/database.js';
import { ITEM_STATUS, updateJobItemStatus } from '../../batchJobs.service.js';
import { improveResumeWithLLM } from '../llmIntegration.js';
import { runAiActionWithCredits } from '../../aiCredits.service.js';
import { getBatchJobActionCreditReservation, markBatchJobActionCreditConsumed } from '../../batchJobCredits.service.js';
import {
    isNonRetryableImprovementError,
    normalizeImprovementExecutionError,
    resolveImprovedAnalysisWithFallback
} from './improvementAnalysis.js';
import { saveImprovedData } from './improvementPersistence.js';

async function executeImprovementWithRetries({
    item,
    resumeId,
    text,
    analysis,
    job,
    reservationSource,
    logSuffix = ''
}) {
    let improvedResult;
    const maxImproveRetries = 2;
    let lastImproveError = null;

    for (let attempt = 1; attempt <= maxImproveRetries; attempt++) {
        try {
            safeLog('info', `Improvement attempt ${attempt}/${maxImproveRetries}${logSuffix}`, {
                itemId: item.id,
                resumeId
            });
            improvedResult = await runAiActionWithCredits({
                firmId: job.firm_id,
                userId: job.user_id || null,
                actionType: 'resume.improvement',
                metadata: {
                    source: 'batch-job',
                    jobId: job.id,
                    itemId: item.id,
                    resumeId
                },
                reservation: reservationSource(),
                markReservedConsumption: () => markBatchJobActionCreditConsumed(item.id, 'resume.improvement')
            }, (actionConfig = {}) => improveResumeWithLLM(
                text,
                analysis,
                job.firm_id,
                item.file_name,
                { maxTokens: actionConfig.maxTokens }
            ));
            break;
        } catch (improveError) {
            lastImproveError = normalizeImprovementExecutionError(improveError);
            safeLog('warn', `CV improvement attempt ${attempt} failed${logSuffix}`, {
                itemId: item.id,
                resumeId,
                attempt,
                maxRetries: maxImproveRetries,
                error: lastImproveError.message
            });

            if (isNonRetryableImprovementError(lastImproveError)) {
                break;
            }

            if (attempt < maxImproveRetries) {
                await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
            }
        }
    }

    if (!improvedResult && lastImproveError) {
        safeLog('error', `CV improvement failed after all retries${logSuffix}`, {
            itemId: item.id,
            resumeId,
            error: lastImproveError.message
        });
        if (isNonRetryableImprovementError(lastImproveError)) {
            throw lastImproveError;
        }
        throw new Error(`Échec de l'amélioration du CV après ${maxImproveRetries} tentatives: ${lastImproveError.message}`);
    }

    return improvedResult;
}

function assertImprovementText(improvedResult, item, resumeId, logSuffix = '') {
    if (improvedResult && improvedResult.text && improvedResult.text.trim().length > 0) {
        return;
    }

    safeLog('error', `Improvement returned empty or no result after successful call${logSuffix}`, {
        itemId: item.id,
        resumeId,
        hasResult: !!improvedResult,
        hasText: !!improvedResult?.text,
        textLength: improvedResult?.text?.length || 0
    });

    throw new Error("L'amélioration a retourné un texte vide. Le CV n'a pas pu être amélioré.");
}

async function persistImprovementResult(item, resumeId, improvedResult, job, logSuffix = '') {
    safeLog('info', `Starting post-improvement analysis${logSuffix}`, { itemId: item.id, resumeId });
    await updateJobItemStatus(item.id, ITEM_STATUS.PROCESSING, { progress: 80 });

    const improvedAnalysis = await resolveImprovedAnalysisWithFallback(improvedResult, improvedResult.text, job, item);

    await updateJobItemStatus(item.id, ITEM_STATUS.PROCESSING, { progress: 90 });

    await saveImprovedData(item, resumeId, {
        ...improvedResult,
        analysis: improvedAnalysis
    });
}

export async function processImprovement(item, resumeId, text, analysis, job, options = {}) {
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

    const improvedResult = await executeImprovementWithRetries({
        item,
        resumeId,
        text: textForImprovement,
        analysis,
        job,
        reservationSource: () => getBatchJobActionCreditReservation(options, 'resume.improvement')
    });

    assertImprovementText(improvedResult, item, resumeId);
    await persistImprovementResult(item, resumeId, improvedResult, job);
}

export { saveImprovedData };

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

    const improvedResult = await executeImprovementWithRetries({
        item,
        resumeId: item.resume_id,
        text,
        analysis,
        job,
        reservationSource: () => getBatchJobActionCreditReservation(job, 'resume.improvement'),
        logSuffix: ' (improve job)'
    });

    assertImprovementText(improvedResult, item, item.resume_id, ' (improve job)');
    await persistImprovementResult(item, item.resume_id, improvedResult, job, ' (improve job)');

    safeLog('info', 'Improve item processing completed', { itemId: item.id, resumeId: item.resume_id });
    await updateJobItemStatus(item.id, ITEM_STATUS.PROCESSING, { progress: 95 });
}
