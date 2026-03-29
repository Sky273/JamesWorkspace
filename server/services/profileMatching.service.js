/**
 * Profile Matching Service - PostgreSQL Version
 * Handles matching CVs to missions based on extracted keywords/tags
 * Optimized to minimize LLM usage by using pre-extracted CV tags
 */

import { selectWithTimeout, findWithTimeout, updateWithTimeout } from '../utils/postgresHelpers.js';
import { safeLog } from '../utils/logger.backend.js';
import { callBusinessChatCompletion } from './llmProvider.service.js';
import { getLLMSettings } from './settings.service.js';
import { MISSION_KEYWORDS_EXTRACTION_PROMPT, DETAILED_PROFILE_ANALYSIS_PROMPT, BATCH_PROFILE_SCORING_PROMPT } from '../config/prompts.backend.js';
import { normalizeUtf8Text, parseJsonFromLlmResponse } from './openai/textUtils.js';
import { PROFILE_MATCHING_LLM_BATCH_SIZE, PROFILE_MATCHING_LLM_MAX_CONCURRENCY } from '../config/constants.js';
import metrics, { buildLLMMetricLabel } from './metrics.service.js';

/**
 * Default weights for scoring categories
 */
const DEFAULT_WEIGHTS = {
    skills: 40,
    tools: 25,
    industries: 20,
    softSkills: 15
};

// Note: Fuzzy matching functions removed - all scoring is now done by LLM

/**
 * Parse JSON field from resume record
 */
function parseJsonField(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }
    return [];
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
        keywords = parseJsonFromLlmResponse(response.choices[0].message.content);
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
                return parsed;
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
 * Split array into chunks of specified size
 */
function chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size));
    }
    return chunks;
}

function isRecoverableBatchScoringError(error) {
    const message = error?.message || '';
    return message.includes('Unexpected end of JSON input')
        || message.includes('Unterminated string in JSON')
        || message.includes('DeepSeek response truncated due to token limit');
}

function isRecoverableJsonOutputError(error) {
    return isRecoverableBatchScoringError(error);
}

/**
 * Score profiles using LLM for intelligent semantic matching
 * Processes profiles in batches for cost efficiency
 * @param {Array} profiles - Pre-filtered profiles with resume tags
 * @param {Object} missionKeywords - Extracted mission keywords
 * @param {Object} missionRecord - Full mission record
 * @param {Object} userMetadata - User metadata for LLM calls
 * @returns {Object} Map of resumeId -> { score, confidence, reason, keyStrengths, keyGaps }
 */
async function scoreBatchWithLLM(profiles, missionKeywords, missionRecord, userMetadata = null) {
    if (!profiles || profiles.length === 0) {
        return { scores: {}, success: true };
    }

    const settings = await getLLMSettings();
    const model = settings.llmModel;

    if (!model && settings.llmProvider !== 'ollama') {
        safeLog('warn', 'LLM model not configured, skipping LLM scoring');
        return { scores: {}, success: false, error: 'LLM model not configured' };
    }

    const isMiniMaxProvider = settings.llmProvider === 'minimax';
    const isDeepSeekProvider = settings.llmProvider === 'deepseek';
    const isDeepSeekReasoner = isDeepSeekProvider && model === 'deepseek-reasoner';
    const supportsStructuredJsonResponse = settings.llmProvider === 'deepseek';
    const providerDefaultBatchSize = isDeepSeekProvider ? 4 : (isMiniMaxProvider ? 6 : 12);
    const BATCH_SIZE = PROFILE_MATCHING_LLM_BATCH_SIZE > 0
        ? Math.min(PROFILE_MATCHING_LLM_BATCH_SIZE, 100)
        : providerDefaultBatchSize;
    const providerDefaultConcurrency = isDeepSeekReasoner ? 2 : (isMiniMaxProvider ? 3 : 5);
    const MAX_CONCURRENCY = PROFILE_MATCHING_LLM_MAX_CONCURRENCY > 0
        ? Math.min(PROFILE_MATCHING_LLM_MAX_CONCURRENCY, 100)
        : providerDefaultConcurrency;
    const scoringMaxTokens = isDeepSeekReasoner ? 8192 : (isDeepSeekProvider ? 4096 : 2048);
    const batches = chunkArray(profiles, BATCH_SIZE);
    const allScores = {};
    let hasErrors = false;
    const metricsProvider = buildLLMMetricLabel(settings.llmProvider || 'unknown', model || '');

    metrics.trackProfileMatchingActivity({
        provider: metricsProvider,
        event: 'search',
        profilesRequested: profiles.length,
        batchesStarted: batches.length,
        metadata: {
            batchCount: batches.length,
            batchSize: BATCH_SIZE,
            maxConcurrency: MAX_CONCURRENCY
        }
    });

        safeLog('info', 'Starting LLM batch scoring', { 
            totalProfiles: profiles.length, 
            batchCount: batches.length,
            batchSize: BATCH_SIZE,
            maxConcurrency: MAX_CONCURRENCY,
            providerDefaultBatchSize,
            providerDefaultConcurrency,
            scoringMaxTokens
        });

    // Process a single batch and return its scores
    async function processBatch(batch, batchIndex, depth = 0) {
        const candidatesData = batch.map(p => ({
            id: p.resumeId,
            title: p.title || normalizeUtf8Text('Non sp\u00e9cifi\u00e9'),
            skills: (p.resumeTags?.skills || []).slice(0, 6),
            tools: (p.resumeTags?.tools || []).slice(0, 5),
            industries: (p.resumeTags?.industries || []).slice(0, 3),
            softSkills: (p.resumeTags?.softSkills || []).slice(0, 4)
        }));

        const candidatesJson = JSON.stringify(candidatesData);

        const prompt = BATCH_PROFILE_SCORING_PROMPT
            .replace('{MISSION_TITLE}', missionRecord.title || '')
            .replace('{MISSION_SKILLS}', (missionKeywords.skills || []).join(', ') || normalizeUtf8Text('Non sp\u00e9cifi\u00e9'))
            .replace('{MISSION_TOOLS}', (missionKeywords.tools || []).join(', ') || normalizeUtf8Text('Non sp\u00e9cifi\u00e9'))
            .replace('{MISSION_INDUSTRIES}', (missionKeywords.industries || []).join(', ') || normalizeUtf8Text('Non sp\u00e9cifi\u00e9'))
            .replace('{MISSION_SOFT_SKILLS}', (missionKeywords.softSkills || []).join(', ') || normalizeUtf8Text('Non sp\u00e9cifi\u00e9'))
            .replace('{EXPERIENCE_LEVEL}', missionKeywords.experienceLevel || normalizeUtf8Text('Non sp\u00e9cifi\u00e9'))
            .replace('{CANDIDATES_JSON}', candidatesJson);

        try {
            const response = await callBusinessChatCompletion({
                model,
                messages: [
                    { role: 'system', content: 'You are a JSON-only HR analysis API specialized in IT/IS profile matching. Respond with valid JSON only.' },
                    { role: 'user', content: prompt }
                ],
                maxTokens: scoringMaxTokens,
                temperature: 0.3,
                responseFormat: supportsStructuredJsonResponse ? { type: 'json_object' } : undefined,
                userMetadata,
                operationType: 'Batch Profile Scoring'
            });

            const result = parseJsonFromLlmResponse(response.choices[0].message.content);
            safeLog('debug', 'Batch scoring completed', {
                batchIndex: batchIndex + 1,
                totalBatches: batches.length,
                batchDepth: depth,
                scoresReturned: Object.keys(result.scores || {}).length
            });
            return result.scores || {};
        } catch (error) {
            if (batch.length > 1 && isRecoverableBatchScoringError(error)) {
                const midpoint = Math.ceil(batch.length / 2);
                const leftBatch = batch.slice(0, midpoint);
                const rightBatch = batch.slice(midpoint);

                safeLog('warn', 'LLM scoring batch returned malformed JSON, retrying with smaller sub-batches', {
                    batchIndex,
                    batchSize: batch.length,
                    leftBatchSize: leftBatch.length,
                    rightBatchSize: rightBatch.length,
                    batchDepth: depth,
                    error: error.message
                });

                metrics.trackProfileMatchingActivity({
                    provider: metricsProvider,
                    event: 'retry',
                    batchesRetried: 1,
                    metadata: {
                        batchIndex,
                        batchDepth: depth,
                        batchSize: batch.length,
                        leftBatchSize: leftBatch.length,
                        rightBatchSize: rightBatch.length
                    }
                });

                const [leftScores, rightScores] = await Promise.all([
                    processBatch(leftBatch, batchIndex, depth + 1),
                    processBatch(rightBatch, batchIndex, depth + 1)
                ]);

                return {
                    ...leftScores,
                    ...rightScores
                };
            }

            throw error;
        }
    }

    // Process batches in waves of MAX_CONCURRENCY
    for (let waveStart = 0; waveStart < batches.length; waveStart += MAX_CONCURRENCY) {
        const wave = batches.slice(waveStart, waveStart + MAX_CONCURRENCY);
        const wavePromises = wave.map((batch, i) => 
            processBatch(batch, waveStart + i).catch(error => {
                safeLog('error', 'LLM scoring batch failed', { 
                    batchIndex: waveStart + i, 
                    error: error.message 
                });
                hasErrors = true;
                return {}; // Return empty scores on failure
            })
        );

        const waveResults = await Promise.all(wavePromises);
        for (const scores of waveResults) {
            Object.assign(allScores, scores);
        }

        const waveScored = waveResults.reduce((total, scores) => total + Object.keys(scores).length, 0);
        const failedBatchCount = waveResults.filter(scores => Object.keys(scores).length === 0).length;
        metrics.trackProfileMatchingActivity({
            provider: metricsProvider,
            event: 'wave',
            profilesScored: waveScored,
            batchesFailed: failedBatchCount
        });

        safeLog('info', 'Scoring wave completed', {
            waveStart,
            waveSize: wave.length,
            totalScored: Object.keys(allScores).length
        });
    }

    safeLog('info', 'LLM batch scoring completed', { 
        totalScored: Object.keys(allScores).length,
        totalProfiles: profiles.length,
        hasErrors
    });

    return { 
        scores: allScores, 
        success: Object.keys(allScores).length > 0,
        partial: hasErrors && Object.keys(allScores).length > 0
    };
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
        dealId = null
    } = options;
    
    const firmFilter = firm;
    safeLog('info', 'Finding matching profiles', { missionId, limit, minScore, status, firm: firmFilter, dealId });
    
    // 1. Get mission record
    const missionRecord = await findWithTimeout('missions', missionId);
    
    if (!missionRecord) {
        throw new Error('Mission not found');
    }
    
    // 2. Get or extract mission keywords
    const missionKeywords = await getMissionKeywords(missionId, missionRecord, userMetadata);
    
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
    
    // 6. Score all profiles (limit=0 means all)
    const profilesToScore = allProfiles;
    
    safeLog('info', 'Sending profiles to LLM for scoring', {
        totalProfiles: allProfiles.length,
        profilesToScore: profilesToScore.length
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
                        keyStrengths: llmScore.keyStrengths || [],
                        keyGaps: llmScore.keyGaps || []
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
    
    safeLog('info', 'Profile matching completed', {
        totalResumes: resumeRecords.length,
        matchingProfiles: filteredProfiles.length,
        topScore: filteredProfiles[0]?.matchScore || 0,
        llmScoringApplied,
        llmScoringFailed
    });
    
    return {
        missionId,
        missionTitle: missionRecord.title,
        missionKeywords,
        totalResumesScanned: resumeRecords.length,
        profiles: filteredProfiles,
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
    
    // 1. Get resume record
    const resumeRecord = await findWithTimeout('resumes', resumeId);
    if (!resumeRecord) {
        throw new Error('Resume not found');
    }
    
    // 2. Get mission record and keywords
    const missionRecord = await findWithTimeout('missions', missionId);
    if (!missionRecord) {
        throw new Error('Mission not found');
    }
    
    // 3. Get or extract mission keywords
    const missionKeywords = await getMissionKeywords(missionId, missionRecord, userMetadata);
    
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

        return parseJsonFromLlmResponse(response.choices[0].message.content);
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



