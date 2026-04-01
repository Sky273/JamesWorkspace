import { safeLog } from '../../../utils/logger.backend.js';
import { ITEM_STATUS, updateJobItemStatus } from '../../batchJobs.service.js';
import { executeResumeAdaptation } from '../../resumeAdaptation.service.js';
import { matchResumeWithMission } from '../../openai.service.js';
import { findResumeRecord, findMissionRecord } from '../../resumes.service.js';
import { getLLMSettings } from '../../settings.service.js';
import { DEFAULT_MATCH_ANALYSIS_PROMPT } from '../../../config/prompts.backend.js';
import { findMatchingProfiles, analyzeProfileForMission } from '../../profileMatching.service.js';

export async function processAdaptItem(item, job, options) {
    const missionId = options?.missionId;

    if (!item.resume_id) {
        throw new Error('Resume ID manquant');
    }

    if (!missionId) {
        throw new Error('Mission ID manquant');
    }

    await updateJobItemStatus(item.id, ITEM_STATUS.PROCESSING, { progress: 30 });

    const result = await executeResumeAdaptation({
        resumeId: item.resume_id,
        missionId,
        userMetadata: {
            source: 'batch-job',
            jobId: job.id,
            itemId: item.id
        }
    });

    await updateJobItemStatus(item.id, ITEM_STATUS.PROCESSING, {
        progress: 90,
        adaptation_id: result.adaptationRecord.id
    });

    safeLog('info', 'Adapt item processing completed', {
        itemId: item.id,
        resumeId: item.resume_id,
        missionId,
        adaptationId: result.adaptationRecord.id
    });
}

export async function processMatchItem(item, job, options) {
    const missionId = options?.missionId;

    if (!item.resume_id) {
        throw new Error('Resume ID manquant');
    }

    if (!missionId) {
        throw new Error('Mission ID manquant');
    }

    await updateJobItemStatus(item.id, ITEM_STATUS.PROCESSING, { progress: 30 });

    const [resumeRecord, missionRecord, settings] = await Promise.all([
        findResumeRecord(item.resume_id),
        findMissionRecord(missionId),
        getLLMSettings()
    ]);

    const resumeText = resumeRecord.improved_text || resumeRecord.original_text;
    if (!resumeText) {
        throw new Error('Resume has no text content');
    }

    const model = settings.llmModel;
    if (!model && settings.llmProvider !== 'ollama') {
        throw new Error('LLM model not configured in Settings.');
    }

    const matchPrompt = settings['Match Analysis Prompt'] || DEFAULT_MATCH_ANALYSIS_PROMPT;

    const matchAnalysis = await matchResumeWithMission(
        resumeText,
        missionRecord.title || '',
        missionRecord.content || '',
        model,
        matchPrompt,
        {
            source: 'batch-job',
            jobId: job.id,
            itemId: item.id
        }
    );

    await updateJobItemStatus(item.id, ITEM_STATUS.PROCESSING, {
        progress: 90,
        result_data: {
            missionId,
            matchAnalysis
        }
    });

    safeLog('info', 'Match item processing completed', {
        itemId: item.id,
        resumeId: item.resume_id,
        missionId,
        hasMatchAnalysis: !!matchAnalysis
    });
}

export async function processProfileSearchItem(item, job, options) {
    const missionId = options?.missionId;

    if (!missionId) {
        throw new Error('Mission ID manquant');
    }

    await updateJobItemStatus(item.id, ITEM_STATUS.PROCESSING, { progress: 25 });

    const results = await findMatchingProfiles(missionId, {
        limit: options?.limit ?? 0,
        minScore: options?.minScore ?? 0,
        status: options?.status ?? null,
        firm: options?.searchFirmId ?? job.firm_id ?? null,
        weights: options?.weights,
        dealId: options?.dealId ?? null,
        progressCallback: (details) => updateJobItemStatus(item.id, ITEM_STATUS.PROCESSING, {
            progress: details.progress,
            result_data: {
                progressDetails: details
            }
        })
    }, {
        source: 'batch-job',
        jobId: job.id,
        itemId: item.id,
        userId: job.user_id,
        firm: job.firm_id
    });

    await updateJobItemStatus(item.id, ITEM_STATUS.PROCESSING, {
        progress: 90,
        result_data: {
            progressDetails: {
                progress: 90,
                stage: 'completed',
                stageLabel: 'Recherche terminée',
                totalResumes: results?.totalResumesScanned || 0,
                profilesSentToLlm: results?.profilesSentToLlm || 0,
                profileCount: results?.profiles?.length || 0
            },
            profileMatchingResults: results
        }
    });

    safeLog('info', 'Profile matching search completed', {
        itemId: item.id,
        missionId,
        profileCount: results?.profiles?.length || 0
    });
}

export async function processProfileAnalysisItem(item, job, options) {
    const missionId = options?.missionId;

    if (!item.resume_id) {
        throw new Error('Resume ID manquant');
    }

    if (!missionId) {
        throw new Error('Mission ID manquant');
    }

    await updateJobItemStatus(item.id, ITEM_STATUS.PROCESSING, { progress: 30 });

    const analysisResponse = await analyzeProfileForMission(missionId, item.resume_id, {
        source: 'batch-job',
        jobId: job.id,
        itemId: item.id,
        userId: job.user_id,
        firm: job.firm_id,
        progressCallback: (details) => updateJobItemStatus(item.id, ITEM_STATUS.PROCESSING, {
            progress: details.progress,
            result_data: {
                progressDetails: details
            }
        })
    });

    await updateJobItemStatus(item.id, ITEM_STATUS.PROCESSING, {
        progress: 90,
        result_data: {
            progressDetails: {
                progress: 90,
                stage: 'completed',
                stageLabel: 'Analyse terminée',
                overallScore: analysisResponse?.analysis?.overallScore ?? null
            },
            detailedProfileAnalysis: analysisResponse
        }
    });

    safeLog('info', 'Detailed profile analysis item completed', {
        itemId: item.id,
        resumeId: item.resume_id,
        missionId
    });
}
