/**
 * Profile Matching Service - PostgreSQL Version
 * Handles matching CVs to missions based on extracted keywords/tags
 * Optimized to minimize LLM usage by using pre-extracted CV tags
 */

import { selectWithTimeout, findWithTimeout, updateWithTimeout } from '../utils/postgresHelpers.js';
import { safeLog } from '../utils/logger.backend.js';
import { getLLMSettings } from './settings.service.js';
import { callBusinessChatCompletion } from './llmProvider.service.js';
import { MISSION_KEYWORDS_EXTRACTION_PROMPT, DETAILED_PROFILE_ANALYSIS_PROMPT } from '../config/prompts.backend.js';
import { normalizeUtf8Text, parseJsonFromLlmResponse } from './openai/textUtils.js';
import { PROFILE_MATCHING_LLM_PREFILTER_CAP } from '../config/constants.js';
import metrics, { buildLLMMetricLabel } from './metrics.service.js';
import { DEFAULT_WEIGHTS } from './profileMatching/constants.js';
import {
    parseJsonField,
    getProfileMatchingLocalRankingWeights,
    selectProfilesForLlm
} from './profileMatching/localRanking.js';
import {
    getExplanationProfileCount,
    normalizeExplanationItems
} from './profileMatching/explanations.js';
import {
    validateMissionKeywordsPayload,
    validateDetailedProfileAnalysisPayload
} from './profileMatching/contracts.js';
import {
    explainTopProfilesWithLLM,
    isRecoverableJsonOutputError,
    scoreBatchWithLLM
} from './profileMatching/llmScoring.js';

// Note: Fuzzy matching functions removed - all scoring is now done by LLM

async function emitProgress(progressCallback, payload) {
    if (typeof progressCallback !== 'function') {
        return;
    }
    await progressCallback(payload);
}

/**
 * Extract keywords from mission using LLM
 */
async function extractMissionKeywords(missionTitle, missionContent, model, userMetadata = null) {
    const prompt = MISSION_KEYWORDS_EXTRACTION_PROMPT
        .replace('{MISSION_TITLE}', missionTitle || '')
        .replace('{MISSION_CONTENT}', missionContent || '');
    
    safeLog('info', 'Extracting mission keywords via LLM', { missionTitle });
    
    const response = await callBusinessChatCompletion({
        model,
        messages: [
            { role: 'system', content: 'You are a JSON-only keyword extraction API. Respond with valid JSON only.' },
            { role: 'user', content: prompt }
        ],
        maxTokens: 1024,
        temperature: 0.2,
        userMetadata,
        operationType: 'Mission Keywords Extraction'
    });
    
    let keywords;
    try {
        keywords = validateMissionKeywordsPayload(
            parseJsonFromLlmResponse(response.choices[0].message.content)
        );
    } catch (parseError) {
        safeLog('error', 'Failed to parse mission keywords response as JSON', {
            error: parseError.message
        });
        throw new Error(normalizeUtf8Text("Erreur lors de l'extraction des mots-cl\u00e9s de la mission."));
}
    
    return keywords;
}

/**
 * Get or extract mission keywords (with caching in PostgreSQL)
 */
async function getMissionKeywords(missionId, missionRecord, userMetadata = null) {
    // Check if keywords are already cached
    const cachedKeywords = missionRecord.keywords;
    if (cachedKeywords) {
        try {
            const parsed = typeof cachedKeywords === 'string' ? JSON.parse(cachedKeywords) : cachedKeywords;
            if (parsed.skills || parsed.tools || parsed.industries || parsed.softSkills) {
                safeLog('info', 'Using cached mission keywords', { missionId });
                return validateMissionKeywordsPayload(parsed);
            }
        } catch {
            // Invalid cache, will re-extract
        }
    }
    
    // Extract keywords via LLM
    const settings = await getLLMSettings();
    const model = settings.llmModel;
    
    if (!model && settings.llmProvider !== 'ollama') {
        throw new Error('LLM model not configured in Settings.');
    }
    
    const keywords = await extractMissionKeywords(
        missionRecord.title,
        missionRecord.content,
        model,
        userMetadata
    );
    
    // Cache keywords in PostgreSQL
    try {
        await updateWithTimeout('missions', missionId, {
            keywords: keywords
        });
        safeLog('info', 'Mission keywords cached', { missionId });
    } catch (cacheError) {
        safeLog('warn', 'Failed to cache mission keywords', { error: cacheError.message });
    }
    
    return keywords;
}

/**
 * Find best matching profiles for a mission
 */
export async function findMatchingProfiles(missionId, options = {}, userMetadata = null) {
    const {
        limit = 0,
        minScore = 0,
        status = null,
        firm = null,
        weights = DEFAULT_WEIGHTS,
        dealId = null,
        progressCallback = null
    } = options;
    
    const firmFilter = firm;
    safeLog('info', 'Finding matching profiles', { missionId, limit, minScore, status, firm: firmFilter, dealId });
    
    // 1. Get mission record
    const missionRecord = await findWithTimeout('missions', missionId);
    
    if (!missionRecord) {
        throw new Error('Mission not found');
    }
    await emitProgress(progressCallback, {
        progress: 35,
        stage: 'mission-loaded',
        stageLabel: 'Mission chargée'
    });
    
    // 2. Get or extract mission keywords
    const missionKeywords = await getMissionKeywords(missionId, missionRecord, userMetadata);
    const currentSettings = await getLLMSettings();
    const localRankingWeights = getProfileMatchingLocalRankingWeights(currentSettings);
    const metricsProvider = buildLLMMetricLabel(currentSettings.llmProvider || 'unknown', currentSettings.llmModel || '');
    await emitProgress(progressCallback, {
        progress: 45,
        stage: 'mission-keywords-ready',
        stageLabel: 'Mots-clés mission prêts'
    });
    
    // 3. Build query for resumes
    // Include all resumes regardless of status so every CV gets scored
    const conditions = [];
    const params = [];
    let paramIndex = 1;
    
    if (status) {
        conditions.push(`LOWER(r.status) = LOWER($${paramIndex})`);
        params.push(status);
        paramIndex++;
    }
    
    if (firmFilter) {
        conditions.push(`r.firm_id = $${paramIndex}`);
        params.push(firmFilter);
        paramIndex++;
    }
    
    // Filter by deal: only consider resumes linked to this deal via deal_resumes
    let dealJoin = '';
    if (dealId) {
        dealJoin = `INNER JOIN deal_resumes dr ON r.id = dr.resume_id AND dr.deal_id = $${paramIndex}`;
        params.push(dealId);
        paramIndex++;
    }
    
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    
    // 4. Fetch all resumes
    // Use cleaned tags (skills_cleaned, etc.) for better matching accuracy
    // Fall back to raw tags if cleaned are not available
    const query = `
        SELECT r.id, r.name, r.title, r.status, r.global_rating, 
               r.skills, r.tools, r.industries, r.soft_skills,
               r.skills_cleaned, r.tools_cleaned, r.industries_cleaned, r.soft_skills_cleaned,
               r.improved_skills, r.improved_tools, r.improved_industries, r.improved_soft_skills,
               r.firm_id, r.firm_name, r.created_at
        FROM resumes r
        ${dealJoin}
        ${whereClause}
    `;
    
    const resumeRecords = await selectWithTimeout('resumes', {
        rawQuery: query,
        rawParams: params
    });
    
    safeLog('info', 'Fetched resumes for matching', { count: resumeRecords.length });
    await emitProgress(progressCallback, {
        progress: 55,
        stage: 'resumes-fetched',
        stageLabel: 'CV récupérés',
        totalResumes: resumeRecords.length
    });
    
    // Debug: Log first few resumes to check tags
    if (resumeRecords.length > 0) {
        const sampleResume = resumeRecords[0];
        safeLog('debug', 'Sample resume tags check', {
            id: sampleResume.id,
            name: sampleResume.name,
            status: sampleResume.status,
            hasSkills: !!sampleResume.skills,
            skillsType: typeof sampleResume.skills,
            skillsPreview: JSON.stringify(sampleResume.skills)?.substring(0, 200),
            hasTools: !!sampleResume.tools,
            hasIndustries: !!sampleResume.industries,
            hasSoftSkills: !!sampleResume.soft_skills
        });
    }
    
    // 5. Prepare all profiles for LLM scoring (no text-based pre-filtering)
    // Prioritize cleaned tags over raw tags for better matching accuracy
    const allProfiles = resumeRecords.map(record => {
        // Use improved tags when status is 'improved', otherwise use original/analyzed tags
        const isImproved = record.status && record.status.toLowerCase() === 'improved';
        const resumeTags = isImproved ? {
            skills: parseJsonField(record.improved_skills) || parseJsonField(record.skills_cleaned) || parseJsonField(record.skills),
            tools: parseJsonField(record.improved_tools) || parseJsonField(record.tools_cleaned) || parseJsonField(record.tools),
            industries: parseJsonField(record.improved_industries) || parseJsonField(record.industries_cleaned) || parseJsonField(record.industries),
            softSkills: parseJsonField(record.improved_soft_skills) || parseJsonField(record.soft_skills_cleaned) || parseJsonField(record.soft_skills)
        } : {
            skills: parseJsonField(record.skills_cleaned) || parseJsonField(record.skills),
            tools: parseJsonField(record.tools_cleaned) || parseJsonField(record.tools),
            industries: parseJsonField(record.industries_cleaned) || parseJsonField(record.industries),
            softSkills: parseJsonField(record.soft_skills_cleaned) || parseJsonField(record.soft_skills)
        };
        
        return {
            resumeId: record.id,
            name: record.name || 'Sans nom',
            title: record.title || '',
            status: record.status,
            globalRating: record.global_rating || 0,
            firmName: record.firm_name,
            createdAt: record.created_at,
            resumeTags
        };
    });
    
    // 6. Pre-rank locally to avoid sending the entire firm portfolio to the LLM.
    const profilesToScore = selectProfilesForLlm(
        allProfiles,
        missionKeywords,
        missionRecord.title,
        limit,
        localRankingWeights,
        PROFILE_MATCHING_LLM_PREFILTER_CAP
    );
    
    safeLog('info', 'Sending profiles to LLM for scoring', {
        totalProfiles: allProfiles.length,
        profilesToScore: profilesToScore.length,
        prefilterApplied: profilesToScore.length !== allProfiles.length
    });
    await emitProgress(progressCallback, {
        progress: 65,
        stage: 'llm-prefilter-ready',
        stageLabel: 'Présélection terminée',
        totalProfiles: allProfiles.length,
        profilesToScore: profilesToScore.length,
        prefilterApplied: profilesToScore.length !== allProfiles.length
    });
    
    if (profilesToScore.length === 0) {
        safeLog('info', 'No resumes available for profile matching after filters', {
            missionId,
            dealId,
            status,
            firm: firmFilter
        });

        return {
            missionId,
            missionTitle: missionRecord.title,
            missionKeywords,
            totalResumesScanned: 0,
            profiles: [],
            weights,
            llmScoringApplied: false,
            llmScoringFailed: false,
            titleRefinementApplied: false
        };
    }

    // 7. Score profiles using LLM for intelligent semantic matching
    let llmScoringApplied = false;
    let llmScoringFailed = false;
    
    const llmResult = await scoreBatchWithLLM(
        profilesToScore,
        missionKeywords,
        missionRecord,
        userMetadata
    );
    await emitProgress(progressCallback, {
        progress: 85,
        stage: 'llm-scoring-complete',
        stageLabel: 'Scoring LLM terminé',
        profilesScored: Object.keys(llmResult.scores || {}).length,
        partial: llmResult.partial || false
    });
    
    // 8. Apply LLM scores - LLM is the only source of scoring
    let finalProfiles;
    
    if (llmResult.success && Object.keys(llmResult.scores).length > 0) {
        llmScoringApplied = true;
        llmScoringFailed = llmResult.partial || false;
        
        // Only include profiles that were scored by LLM
        finalProfiles = profilesToScore
            .map(profile => {
                const llmScore = llmResult.scores[profile.resumeId];
                
                if (llmScore) {
                    return {
                        ...profile,
                        matchScore: llmScore.score || 0,
                        llmScored: true,
                        confidence: llmScore.confidence || 'medium',
                        reason: llmScore.reason || null,
                        keyStrengths: normalizeExplanationItems(llmScore.keyStrengths, {
                            provider: metricsProvider,
                            source: 'batch-scoring',
                            field: 'keyStrengths',
                            resumeId: profile.resumeId
                        }),
                        keyGaps: normalizeExplanationItems(llmScore.keyGaps, {
                            provider: metricsProvider,
                            source: 'batch-scoring',
                            field: 'keyGaps',
                            resumeId: profile.resumeId
                        })
                    };
                }
                return null; // Exclude profiles not scored by LLM
            })
            .filter(p => p !== null);
        
        safeLog('info', 'LLM scoring applied', {
            totalProfiles: profilesToScore.length,
            llmScored: finalProfiles.length,
            partial: llmResult.partial
        });
    } else {
        // LLM scoring failed completely - return empty results
        llmScoringFailed = true;
        safeLog('error', 'LLM scoring failed completely - no profiles can be scored');
        finalProfiles = [];
    }
    
    // 9. Final filter and sort
    // Always include profiles even with score 0 when minScore is 0
    const sortedProfiles = finalProfiles
        .filter(p => minScore === 0 ? true : p.matchScore >= minScore)
        .sort((a, b) => b.matchScore - a.matchScore);
    const filteredProfiles = limit > 0 ? sortedProfiles.slice(0, limit) : sortedProfiles;

    const profilesToExplain = filteredProfiles.slice(0, getExplanationProfileCount(limit, filteredProfiles.length));
    const shouldRunExplanationPass = llmScoringApplied
        && profilesToExplain.length > 0
        && (profilesToScore.length > profilesToExplain.length || filteredProfiles.length > profilesToExplain.length);
    const explanationMap = shouldRunExplanationPass
        ? await explainTopProfilesWithLLM(profilesToExplain, missionKeywords, missionRecord, userMetadata)
        : {};
    const enrichedProfiles = filteredProfiles.map(profile => {
        const explanation = explanationMap[profile.resumeId];
        if (!explanation) {
            return profile;
        }

        return {
            ...profile,
            reason: explanation.reason || profile.reason || null,
            keyStrengths: explanation.keyStrengths?.length ? explanation.keyStrengths : (profile.keyStrengths || []),
            keyGaps: explanation.keyGaps?.length ? explanation.keyGaps : (profile.keyGaps || [])
        };
    });
    await emitProgress(progressCallback, {
        progress: 95,
        stage: 'llm-explanations-complete',
        stageLabel: 'Explications top profils terminées',
        profileCount: enrichedProfiles.length,
        profilesExplained: Object.keys(explanationMap).length
    });
    
    safeLog('info', 'Profile matching completed', {
        totalResumes: resumeRecords.length,
        matchingProfiles: enrichedProfiles.length,
        topScore: enrichedProfiles[0]?.matchScore || 0,
        llmScoringApplied,
        llmScoringFailed,
        profilesExplained: Object.keys(explanationMap).length
    });

    const completionSettings = await getLLMSettings();
    metrics.trackProfileMatchingActivity({
        provider: buildLLMMetricLabel(completionSettings.llmProvider || 'unknown', completionSettings.llmModel || ''),
        event: 'complete',
        profilesReturned: enrichedProfiles.length,
        profilesExplained: Object.keys(explanationMap).length,
        metadata: {
            totalResumes: resumeRecords.length,
            profilesSentToLlm: profilesToScore.length
        }
    });
    
    return {
        missionId,
        missionTitle: missionRecord.title,
        missionKeywords,
        totalResumesScanned: resumeRecords.length,
        profilesSentToLlm: profilesToScore.length,
        profilesExplained: Object.keys(explanationMap).length,
        profiles: enrichedProfiles,
        weights,
        llmScoringApplied,
        llmScoringFailed,
        titleRefinementApplied: !llmScoringApplied && !llmScoringFailed // Legacy field for backward compatibility
    };
}

/**
 * Clear cached keywords for a mission
 */
export async function clearMissionKeywordsCache(missionId) {
    try {
        await updateWithTimeout('missions', missionId, {
            keywords: null
        });
        safeLog('info', 'Mission keywords cache cleared', { missionId });
        return true;
    } catch (error) {
        safeLog('error', 'Failed to clear mission keywords cache', { error: error.message });
        throw error;
    }
}

/**
 * Perform detailed LLM analysis of a specific profile against a mission
 */
export async function analyzeProfileForMission(missionId, resumeId, userMetadata = null) {
    safeLog('info', 'Starting detailed profile analysis', { resumeId, missionId });
    const progressCallback = userMetadata?.progressCallback || null;
    
    // 1. Get resume record
    const resumeRecord = await findWithTimeout('resumes', resumeId);
    if (!resumeRecord) {
        throw new Error('Resume not found');
    }
    await emitProgress(progressCallback, {
        progress: 45,
        stage: 'resume-loaded',
        stageLabel: 'Profil chargé'
    });
    
    // 2. Get mission record and keywords
    const missionRecord = await findWithTimeout('missions', missionId);
    if (!missionRecord) {
        throw new Error('Mission not found');
    }
    
    // 3. Get or extract mission keywords
    const missionKeywords = await getMissionKeywords(missionId, missionRecord, userMetadata);
    await emitProgress(progressCallback, {
        progress: 60,
        stage: 'analysis-keywords-ready',
        stageLabel: 'Contexte mission prêt'
    });
    
    // 4. Get LLM settings
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
    
    // 5. Prepare profile data
    const candidateSkills = parseJsonField(resumeRecord.skills);
    const candidateTools = parseJsonField(resumeRecord.tools);
    const candidateIndustries = parseJsonField(resumeRecord.industries);
    const candidateSoftSkills = parseJsonField(resumeRecord.soft_skills);
    
    // 6. Build prompt
    const prompt = DETAILED_PROFILE_ANALYSIS_PROMPT
        .replace('{CANDIDATE_NAME}', resumeRecord.name || normalizeUtf8Text('Non sp\u00e9cifi\u00e9'))
        .replace('{CANDIDATE_TITLE}', resumeRecord.title || normalizeUtf8Text('Non sp\u00e9cifi\u00e9'))
        .replace('{CANDIDATE_SKILLS}', candidateSkills.join(', ') || normalizeUtf8Text('Non sp\u00e9cifi\u00e9'))
        .replace('{CANDIDATE_TOOLS}', candidateTools.join(', ') || normalizeUtf8Text('Non sp\u00e9cifi\u00e9'))
        .replace('{CANDIDATE_INDUSTRIES}', candidateIndustries.join(', ') || normalizeUtf8Text('Non sp\u00e9cifi\u00e9'))
        .replace('{CANDIDATE_SOFT_SKILLS}', candidateSoftSkills.join(', ') || normalizeUtf8Text('Non sp\u00e9cifi\u00e9'))
        .replace('{CANDIDATE_RATING}', resumeRecord.global_rating || normalizeUtf8Text('Non \u00e9valu\u00e9'))
        .replace('{MISSION_TITLE}', missionRecord.title || '')
        .replace('{MISSION_CONTENT}', missionRecord.content || '')
        .replace('{MISSION_SKILLS}', (missionKeywords.skills || []).join(', ') || normalizeUtf8Text('Non sp\u00e9cifi\u00e9'))
        .replace('{MISSION_TOOLS}', (missionKeywords.tools || []).join(', ') || normalizeUtf8Text('Non sp\u00e9cifi\u00e9'))
        .replace('{MISSION_INDUSTRIES}', (missionKeywords.industries || []).join(', ') || normalizeUtf8Text('Non sp\u00e9cifi\u00e9'))
        .replace('{MISSION_SOFT_SKILLS}', (missionKeywords.softSkills || []).join(', ') || normalizeUtf8Text('Non sp\u00e9cifi\u00e9'));

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
                error: error.message
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
                    error: retryError.message
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
                error: error.message
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

export default {
    findMatchingProfiles,
    clearMissionKeywordsCache,
    analyzeProfileForMission,
    DEFAULT_WEIGHTS
};



