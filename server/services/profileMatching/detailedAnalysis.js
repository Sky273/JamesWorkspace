import { findWithTimeout } from '../../utils/postgresHelpers.js';
import { safeLog } from '../../utils/logger.backend.js';
import { getLLMSettings } from '../settings.service.js';
import { callBusinessChatCompletion } from '../llmProvider.service.js';
import { DETAILED_PROFILE_ANALYSIS_PROMPT } from '../../config/prompts.backend.js';
import { buildPromptExecutionMetadata } from '../../config/llmGovernance.js';
import { normalizeUtf8Text, parseJsonFromLlmResponse } from '../openai/textUtils.js';
import { parseJsonField } from './localRanking.js';
import { validateDetailedProfileAnalysisPayload } from './contracts.js';
import { isRecoverableJsonOutputError } from './llmScoring.js';
import { getMissionKeywords } from './missionKeywords.js';

async function analyzeProfileForMission(missionId, resumeId, emitProgress, userMetadata = null) {
    safeLog('info', 'Starting detailed profile analysis', { resumeId, missionId });
    const progressCallback = userMetadata?.progressCallback || null;

    const resumeRecord = await findWithTimeout('resumes', resumeId);
    if (!resumeRecord) {
        throw new Error('Resume not found');
    }
    await emitProgress(progressCallback, {
        progress: 45,
        stage: 'resume-loaded',
        stageLabel: 'Profil chargé'
    });

    const missionRecord = await findWithTimeout('missions', missionId);
    if (!missionRecord) {
        throw new Error('Mission not found');
    }

    const missionKeywords = await getMissionKeywords(missionId, missionRecord, userMetadata);
    await emitProgress(progressCallback, {
        progress: 60,
        stage: 'analysis-keywords-ready',
        stageLabel: 'Contexte mission prêt'
    });

    const settings = await getLLMSettings();
    const model = settings.llmModel;
    const isDeepSeekProvider = settings.llmProvider === 'deepseek';
    const isDeepSeekReasoner = isDeepSeekProvider && model === 'deepseek-reasoner';
    const supportsStructuredJsonResponse = isDeepSeekProvider;
    const detailedAnalysisMaxTokens = isDeepSeekReasoner ? 8192 : (isDeepSeekProvider ? 4096 : 3072);

    if (!model && settings.llmProvider !== 'ollama') {
        throw new Error('LLM model not configured in Settings.');
    }
    await emitProgress(progressCallback, {
        progress: 75,
        stage: 'analysis-llm-request',
        stageLabel: 'Analyse LLM en cours'
    });

    const candidateSkills = parseJsonField(resumeRecord.skills);
    const candidateTools = parseJsonField(resumeRecord.tools);
    const candidateIndustries = parseJsonField(resumeRecord.industries);
    const candidateSoftSkills = parseJsonField(resumeRecord.soft_skills);

    const promptMeta = buildPromptExecutionMetadata('DETAILED_PROFILE_ANALYSIS_PROMPT');
    const prompt = DETAILED_PROFILE_ANALYSIS_PROMPT
        .replace('{CANDIDATE_NAME}', resumeRecord.name || normalizeUtf8Text('Non spécifié'))
        .replace('{CANDIDATE_TITLE}', resumeRecord.title || normalizeUtf8Text('Non spécifié'))
        .replace('{CANDIDATE_SKILLS}', candidateSkills.join(', ') || normalizeUtf8Text('Non spécifié'))
        .replace('{CANDIDATE_TOOLS}', candidateTools.join(', ') || normalizeUtf8Text('Non spécifié'))
        .replace('{CANDIDATE_INDUSTRIES}', candidateIndustries.join(', ') || normalizeUtf8Text('Non spécifié'))
        .replace('{CANDIDATE_SOFT_SKILLS}', candidateSoftSkills.join(', ') || normalizeUtf8Text('Non spécifié'))
        .replace('{CANDIDATE_RATING}', resumeRecord.global_rating || normalizeUtf8Text('Non évalué'))
        .replace('{MISSION_TITLE}', missionRecord.title || '')
        .replace('{MISSION_CONTENT}', missionRecord.content || '')
        .replace('{MISSION_SKILLS}', (missionKeywords.skills || []).join(', ') || normalizeUtf8Text('Non spécifié'))
        .replace('{MISSION_TOOLS}', (missionKeywords.tools || []).join(', ') || normalizeUtf8Text('Non spécifié'))
        .replace('{MISSION_INDUSTRIES}', (missionKeywords.industries || []).join(', ') || normalizeUtf8Text('Non spécifié'))
        .replace('{MISSION_SOFT_SKILLS}', (missionKeywords.softSkills || []).join(', ') || normalizeUtf8Text('Non spécifié'));

    async function requestDetailedAnalysis(compactRetry = false) {
        const response = await callBusinessChatCompletion({
            model,
            messages: [
                { role: 'system', content: 'You are a JSON-only HR analysis API. Respond with valid JSON only.' },
                {
                    role: 'user',
                    content: compactRetry
                        ? `${prompt}\n\nRéponse attendue: JSON compact uniquement, sans texte additionnel, sans markdown, sans commentaires.`
                        : prompt
                }
            ],
            maxTokens: detailedAnalysisMaxTokens,
            temperature: 0.3,
            responseFormat: supportsStructuredJsonResponse ? { type: 'json_object' } : undefined,
            userMetadata,
            operationType: 'Detailed Profile Analysis'
        });

        return validateDetailedProfileAnalysisPayload(
            parseJsonFromLlmResponse(response.choices[0].message.content)
        );
    }

    let analysis;
    try {
        analysis = await requestDetailedAnalysis(false);
    } catch (error) {
        if (isRecoverableJsonOutputError(error)) {
            safeLog('warn', 'Detailed profile analysis returned malformed JSON, retrying once with compact JSON instruction', {
                missionId,
                resumeId,
                provider: settings.llmProvider,
                model,
                maxTokens: detailedAnalysisMaxTokens,
                error: error.message,
                ...promptMeta
            });

            try {
                analysis = await requestDetailedAnalysis(true);
            } catch (retryError) {
                safeLog('error', 'Detailed profile analysis retry failed', {
                    missionId,
                    resumeId,
                    provider: settings.llmProvider,
                    model,
                    maxTokens: detailedAnalysisMaxTokens,
                    error: retryError.message,
                    ...promptMeta
                });
                throw new Error(normalizeUtf8Text("Erreur lors de l'analyse détaillée du profil."));
            }
        } else {
            safeLog('error', 'Detailed profile analysis failed', {
                missionId,
                resumeId,
                provider: settings.llmProvider,
                model,
                maxTokens: detailedAnalysisMaxTokens,
                error: error.message,
                ...promptMeta
            });
            throw new Error(normalizeUtf8Text("Erreur lors de l'analyse détaillée du profil."));
        }
    }

    safeLog('info', 'Detailed profile analysis completed', {
        resumeId,
        missionId,
        overallScore: analysis.overallScore
    });
    await emitProgress(progressCallback, {
        progress: 90,
        stage: 'analysis-complete',
        stageLabel: 'Analyse détaillée terminée',
        overallScore: analysis.overallScore
    });

    return {
        resumeId,
        missionId,
        candidateName: resumeRecord.name,
        candidateTitle: resumeRecord.title,
        missionTitle: missionRecord.title,
        analysis
    };
}

export { analyzeProfileForMission };
