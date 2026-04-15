import { findResumeRecord, findMissionRecord, createAdaptation } from './resumes.service.js';
import { matchResumeWithMission, adaptResumeToMission } from './openai.service.js';
import { getLLMSettings } from './settings.service.js';
import { getAcceptedIndustriesString } from './industry.service.js';
import {
    DEFAULT_MATCH_ANALYSIS_PROMPT,
    DEFAULT_ADAPTATION_PROMPT,
    ANONYMIZATION_RULES_ANONYMOUS,
    ANONYMIZATION_RULES_NOMINATIVE
} from '../config/prompts.backend.js';
import { buildPromptExecutionMetadata } from '../config/llmGovernance.js';
import { safeLog } from '../utils/logger.backend.js';
import {
    executeAiWorkflowWithCredits,
    runAiActionWithCredits,
    workflowReservationCoversAction
} from './aiCredits.service.js';

function isExternalLlmDisabledForE2E() {
    return process.env.E2E_DISABLE_EXTERNAL_LLM === 'true';
}

function buildMockMatchAnalysis(missionTitle) {
    return {
        matchScore: '84',
        summary: `Profil aligné avec la mission ${missionTitle || 'cible'}.`,
        strengths: ['Compétences techniques compatibles', 'Expérience pertinente'],
        risks: [],
        recommendations: ['Mettre en avant les réalisations les plus proches de la mission']
    };
}

function parseMatchScore(matchAnalysis) {
    if (!matchAnalysis?.matchScore) {
        return null;
    }

    const parsed = parseFloat(String(matchAnalysis.matchScore).replace('%', ''));
    return Number.isNaN(parsed) ? null : parsed;
}

export async function executeResumeAdaptation({
    resumeId,
    missionId,
    userMetadata = null,
    creditReservation = null,
    onCreditConsumed = null
}) {
    if (!creditReservation) {
        return executeAiWorkflowWithCredits({
            firmId: userMetadata?.firmId || null,
            userId: userMetadata?.userId || null,
            workflowActionType: 'resume.adaptation',
            steps: [{ actionType: 'resume.adaptation' }],
            metadata: {
                ...(userMetadata || {}),
                resumeId,
                missionId
            }
        }, ({ workflowReservation }) => executeResumeAdaptation({
            resumeId,
            missionId,
            userMetadata,
            creditReservation: workflowReservation,
            onCreditConsumed
        }));
    }

    if (!missionId) {
        throw new Error('Mission ID is required');
    }

    const resumeRecord = await findResumeRecord(resumeId);
    const missionRecord = await findMissionRecord(missionId);

    const resumeText = resumeRecord.improved_text || resumeRecord.original_text;
    const missionTitle = missionRecord.title || '';
    const missionContent = missionRecord.content || '';

    if (!resumeText) {
        throw new Error('Resume has no text content');
    }

    const settings = await getLLMSettings();
    const model = settings.llmModel;
    const cvMode = settings.cvMode || 'nominative';

    if (!model && settings.llmProvider !== 'ollama') {
        throw new Error('LLM model not configured in Settings.');
    }

    const originalFileName = resumeRecord.original_file_name || resumeRecord.name || null;
    const fileNameValue = originalFileName || 'Non disponible';

    const acceptedIndustries = await getAcceptedIndustriesString();
    let adaptationPrompt = settings['Adaptation Prompt'] || DEFAULT_ADAPTATION_PROMPT;
    const adaptationPromptMeta = buildPromptExecutionMetadata('DEFAULT_ADAPTATION_PROMPT', settings['Adaptation Prompt'] ? 'settings' : 'default');
    adaptationPrompt = adaptationPrompt.replace('{ACCEPTED_INDUSTRIES}', acceptedIndustries);

    let anonymizationRules = cvMode === 'anonymous' ? ANONYMIZATION_RULES_ANONYMOUS : ANONYMIZATION_RULES_NOMINATIVE;
    anonymizationRules = anonymizationRules.replace(/{FILENAME}/g, fileNameValue);
    adaptationPrompt = adaptationPrompt.replace('{ANONYMIZATION_RULES}', anonymizationRules);
    adaptationPrompt = adaptationPrompt.replace('{FILENAME}', fileNameValue);

    const matchPrompt = settings['Match Analysis Prompt'] || DEFAULT_MATCH_ANALYSIS_PROMPT;
    const matchPromptMeta = buildPromptExecutionMetadata('DEFAULT_MATCH_ANALYSIS_PROMPT', settings['Match Analysis Prompt'] ? 'settings' : 'default');
    const matchUserMetadata = { ...userMetadata, promptMetadata: matchPromptMeta };
    const adaptationUserMetadata = { ...userMetadata, promptMetadata: adaptationPromptMeta };

    const { matchAnalysis, adaptationResult } = await runAiActionWithCredits({
        firmId: resumeRecord.firm_id || missionRecord.firm_id || userMetadata?.firmId || null,
        userId: userMetadata?.userId || null,
        actionType: 'resume.adaptation',
        metadata: {
            resumeId: resumeRecord.id,
            missionId: missionRecord.id,
            source: userMetadata?.source || 'direct'
        },
        reservation: workflowReservationCoversAction(creditReservation, 'resume.adaptation')
            ? creditReservation
            : null,
        markReservedConsumption: onCreditConsumed
    }, async (actionConfig = {}) => {
        const { maxTokens } = actionConfig;
        const matchAnalysisResult = isExternalLlmDisabledForE2E()
            ? buildMockMatchAnalysis(missionTitle)
            : await matchResumeWithMission(
                resumeText,
                missionTitle,
                missionContent,
                model,
                matchPrompt,
                matchUserMetadata,
                { maxTokens }
            );

        const adaptationResultValue = isExternalLlmDisabledForE2E()
            ? {
                adaptedText: `${resumeText}\n\n<p><strong>Adaptation E2E:</strong> ${missionTitle || 'Mission cible'}</p>`,
                adaptedTitle: missionTitle || resumeRecord.title || 'Mission adaptée',
                structuredData: {
                    adaptationNotes: ['Adaptation simulée pour les tests E2E']
                }
            }
            : await adaptResumeToMission({
                resumeText,
                missionTitle,
                missionContent,
                matchAnalysis: matchAnalysisResult,
                model,
                adaptationPrompt,
                userMetadata: adaptationUserMetadata,
                maxTokens
            });

        return {
            matchAnalysis: matchAnalysisResult,
            adaptationResult: adaptationResultValue
        };
    });

    const adaptedText = typeof adaptationResult === 'string' ? adaptationResult : adaptationResult.adaptedText;
    const adaptedTitle = typeof adaptationResult === 'string' ? null : (adaptationResult.adaptedTitle || null);
    const structuredData = typeof adaptationResult === 'string' ? null : (adaptationResult.structuredData || null);
    const adaptationNotes = structuredData?.adaptationNotes
        ? JSON.stringify(structuredData.adaptationNotes)
        : null;

    const adaptationRecord = await createAdaptation({
        resume_id: resumeRecord.id,
        mission_id: missionRecord.id,
        resume_name: resumeRecord.name || null,
        candidate_name: resumeRecord.candidate_name || null,
        adapted_title: adaptedTitle,
        mission_title: missionTitle || null,
        mission_content: missionContent || null,
        firm: resumeRecord.firm_name || null,
        adapted_text: adaptedText,
        adaptation_notes: adaptationNotes,
        match_score: parseMatchScore(matchAnalysis),
        match_analysis: matchAnalysis ? JSON.stringify(matchAnalysis) : null,
        status: 'completed'
    });

    safeLog('info', 'Resume adaptation created', {
        resumeId: resumeRecord.id,
        missionId: missionRecord.id,
        adaptationId: adaptationRecord.id,
        model,
        matchPrompt: matchPromptMeta,
        adaptationPrompt: adaptationPromptMeta
    });

    return {
        resumeRecord,
        missionRecord,
        adaptationRecord,
        matchAnalysis,
        adaptedText,
        adaptedTitle,
        structuredAdaptation: structuredData,
        adaptationNotes: structuredData?.adaptationNotes || null
    };
}
