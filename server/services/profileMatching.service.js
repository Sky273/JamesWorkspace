/**
 * Profile Matching Service - PostgreSQL Version
 * Handles matching CVs to missions based on extracted keywords/tags
 * Optimized to minimize LLM usage by using pre-extracted CV tags
 */

import { findWithTimeout, selectRawWithTimeout } from '../utils/postgresHelpers.js';
import { safeLog } from '../utils/logger.backend.js';
import { getLLMSettings } from './settings.service.js';
import { PROFILE_MATCHING_LLM_PREFILTER_CAP } from '../config/constants.js';
import { metrics, buildLLMMetricLabel } from './metrics.service.js';
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
    explainTopProfilesWithLLM,
    scoreBatchWithLLM
} from './profileMatching/llmScoring.js';
import {
    getMissionKeywords
} from './profileMatching/missionKeywords.js';
import { analyzeProfileForMission as runDetailedProfileAnalysis } from './profileMatching/detailedAnalysis.js';

export { DEFAULT_WEIGHTS };

async function emitProgress(progressCallback, payload) {
    if (typeof progressCallback !== 'function') {
        return;
    }
    await progressCallback(payload);
}

function parseResumeTags(record) {
    const readFirstParsedField = (fieldNames) => {
        for (const fieldName of fieldNames) {
            const parsed = parseJsonField(record[fieldName]);
            if (parsed.length > 0) {
                return parsed;
            }
        }
        return [];
    };

    const sourceTags = record.status && record.status.toLowerCase() === 'improved'
        ? {
            skills: ['improved_skills', 'skills_cleaned', 'skills'],
            tools: ['improved_tools', 'tools_cleaned', 'tools'],
            industries: ['improved_industries', 'industries_cleaned', 'industries'],
            softSkills: ['improved_soft_skills', 'soft_skills_cleaned', 'soft_skills']
        }
        : {
            skills: ['skills_cleaned', 'skills'],
            tools: ['tools_cleaned', 'tools'],
            industries: ['industries_cleaned', 'industries'],
            softSkills: ['soft_skills_cleaned', 'soft_skills']
        };

    return {
        skills: readFirstParsedField(sourceTags.skills),
        tools: readFirstParsedField(sourceTags.tools),
        industries: readFirstParsedField(sourceTags.industries),
        softSkills: readFirstParsedField(sourceTags.softSkills)
    };
}

function mapProfileRecord(record) {
    return {
        resumeId: record.id,
        name: record.name || 'Sans nom',
        title: record.title || '',
        status: record.status,
        globalRating: record.global_rating || 0,
        firmName: record.firm_name,
        createdAt: record.created_at,
        resumeTags: parseResumeTags(record)
    };
}

export async function findMatchingProfiles(missionId, options = {}, userMetadata = null) {
    const {
        limit = 0,
        minScore = 0,
        status = null,
        firmId = null,
        firm = undefined,
        weights = DEFAULT_WEIGHTS,
        dealId = null,
        progressCallback = null
    } = options;

    const firmFilter = firmId || firm || null;
    safeLog('info', 'Finding matching profiles', { missionId, limit, minScore, status, firmId: firmFilter, dealId });

    const missionRecord = await findWithTimeout('missions', missionId);
    if (!missionRecord) {
        throw new Error('Mission not found');
    }
    await emitProgress(progressCallback, {
        progress: 35,
        stage: 'mission-loaded',
        stageLabel: 'Mission chargée'
    });

    const missionKeywords = await getMissionKeywords(missionId, missionRecord, userMetadata);
    const currentSettings = await getLLMSettings();
    const localRankingWeights = getProfileMatchingLocalRankingWeights(currentSettings);
    const metricsProvider = buildLLMMetricLabel(currentSettings.llmProvider || 'unknown', currentSettings.llmModel || '');
    await emitProgress(progressCallback, {
        progress: 45,
        stage: 'mission-keywords-ready',
        stageLabel: 'Mots-clés mission prêts'
    });

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

    let dealJoin = '';
    if (dealId) {
        dealJoin = `INNER JOIN deal_resumes dr ON r.id = dr.resume_id AND dr.deal_id = $${paramIndex}`;
        params.push(dealId);
        paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
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

    const resumeRecords = await selectRawWithTimeout(query, params, { context: 'profileMatching.findMatchingProfiles' });

    safeLog('info', 'Fetched resumes for matching', { count: resumeRecords.length });
    await emitProgress(progressCallback, {
        progress: 55,
        stage: 'resumes-fetched',
        stageLabel: 'CV récupérés',
        totalResumes: resumeRecords.length
    });

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

    const allProfiles = resumeRecords.map(mapProfileRecord);

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
            firmId: firmFilter
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

    let finalProfiles;
    if (llmResult.success && Object.keys(llmResult.scores).length > 0) {
        llmScoringApplied = true;
        llmScoringFailed = llmResult.partial || false;

        finalProfiles = profilesToScore
            .map((profile) => {
                const llmScore = llmResult.scores[profile.resumeId];
                if (!llmScore) {
                    return null;
                }
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
            })
            .filter((profile) => profile !== null);

        safeLog('info', 'LLM scoring applied', {
            totalProfiles: profilesToScore.length,
            llmScored: finalProfiles.length,
            partial: llmResult.partial
        });
    } else {
        llmScoringFailed = true;
        safeLog('error', 'LLM scoring failed completely - no profiles can be scored');
        finalProfiles = [];
    }

    const sortedProfiles = finalProfiles
        .filter((profile) => (minScore === 0 ? true : profile.matchScore >= minScore))
        .sort((a, b) => b.matchScore - a.matchScore);
    const filteredProfiles = limit > 0 ? sortedProfiles.slice(0, limit) : sortedProfiles;

    const profilesToExplain = filteredProfiles.slice(0, getExplanationProfileCount(limit, filteredProfiles.length));
    const shouldRunExplanationPass = llmScoringApplied
        && profilesToExplain.length > 0
        && (profilesToScore.length > profilesToExplain.length || filteredProfiles.length > profilesToExplain.length);
    const explanationMap = shouldRunExplanationPass
        ? await explainTopProfilesWithLLM(profilesToExplain, missionKeywords, missionRecord, userMetadata)
        : {};
    const enrichedProfiles = filteredProfiles.map((profile) => {
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
        titleRefinementApplied: !llmScoringApplied && !llmScoringFailed
    };
}

export async function analyzeProfileForMission(missionId, resumeId, userMetadata = null) {
    return runDetailedProfileAnalysis(missionId, resumeId, emitProgress, userMetadata);
}
