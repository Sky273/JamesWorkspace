/**
 * Profile Matching Service - PostgreSQL Version
 * Handles matching CVs to missions based on extracted keywords/tags
 * Optimized to minimize LLM usage by using pre-extracted CV tags
 */

import { selectWithTimeout, findWithTimeout, updateWithTimeout } from '../utils/postgresHelpers.js';
import { safeLog } from '../utils/logger.backend.js';
import { callOpenAI } from './openai.service.js';
import { getLLMSettings } from './settings.service.js';
import { MISSION_KEYWORDS_EXTRACTION_PROMPT, DETAILED_PROFILE_ANALYSIS_PROMPT, BATCH_PROFILE_SCORING_PROMPT } from '../config/prompts.backend.js';

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
    
    const response = await callOpenAI({
        model,
        messages: [
            { role: 'system', content: 'You are a JSON-only keyword extraction API. Respond with valid JSON only.' },
            { role: 'user', content: prompt }
        ],
        maxTokens: 1024,
        temperature: 0.2,
        responseFormat: { type: "json_object" },
        userMetadata,
        operationType: 'Mission Keywords Extraction'
    });
    
    let keywords;
    try {
        keywords = JSON.parse(response.choices[0].message.content);
    } catch (parseError) {
        safeLog('error', 'Failed to parse mission keywords response as JSON', {
            error: parseError.message
        });
        throw new Error('Erreur lors de l\'extraction des mots-clés de la mission.');
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
    
    if (!model) {
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

    if (!model) {
        safeLog('warn', 'LLM model not configured, skipping LLM scoring');
        return { scores: {}, success: false, error: 'LLM model not configured' };
    }

    const BATCH_SIZE = 12; // Optimal batch size for token efficiency
    const batches = chunkArray(profiles, BATCH_SIZE);
    const allScores = {};
    let hasErrors = false;

    safeLog('info', 'Starting LLM batch scoring', { 
        totalProfiles: profiles.length, 
        batchCount: batches.length,
        batchSize: BATCH_SIZE 
    });

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        
        // Prepare compact candidate data for the prompt
        const candidatesData = batch.map(p => ({
            id: p.resumeId,
            title: p.title || 'Non spécifié',
            skills: (p.resumeTags?.skills || []).slice(0, 10),
            tools: (p.resumeTags?.tools || []).slice(0, 8),
            industries: (p.resumeTags?.industries || []).slice(0, 3),
            softSkills: (p.resumeTags?.softSkills || []).slice(0, 5)
        }));

        const candidatesJson = JSON.stringify(candidatesData, null, 2);

        // Build the prompt
        const prompt = BATCH_PROFILE_SCORING_PROMPT
            .replace('{MISSION_TITLE}', missionRecord.title || '')
            .replace('{MISSION_SKILLS}', (missionKeywords.skills || []).join(', ') || 'Non spécifié')
            .replace('{MISSION_TOOLS}', (missionKeywords.tools || []).join(', ') || 'Non spécifié')
            .replace('{MISSION_INDUSTRIES}', (missionKeywords.industries || []).join(', ') || 'Non spécifié')
            .replace('{MISSION_SOFT_SKILLS}', (missionKeywords.softSkills || []).join(', ') || 'Non spécifié')
            .replace('{EXPERIENCE_LEVEL}', missionKeywords.experienceLevel || 'Non spécifié')
            .replace('{CANDIDATES_JSON}', candidatesJson);

        try {
            const response = await callOpenAI({
                model,
                messages: [
                    { role: 'system', content: 'You are a JSON-only HR analysis API specialized in IT/IS profile matching. Respond with valid JSON only.' },
                    { role: 'user', content: prompt }
                ],
                maxTokens: 2048,
                temperature: 0.3,
                responseFormat: { type: "json_object" },
                userMetadata,
                operationType: 'Batch Profile Scoring'
            });

            let result;
            try {
                result = JSON.parse(response.choices[0].message.content);
            } catch (parseError) {
                safeLog('error', 'Failed to parse LLM scoring response', { 
                    batchIndex, 
                    error: parseError.message,
                    content: response.choices[0].message.content?.substring(0, 200)
                });
                hasErrors = true;
                continue;
            }

            // Merge batch scores into allScores
            if (result.scores) {
                Object.assign(allScores, result.scores);
            }

            safeLog('debug', 'Batch scoring completed', { 
                batchIndex: batchIndex + 1, 
                totalBatches: batches.length,
                scoresReturned: Object.keys(result.scores || {}).length
            });

        } catch (error) {
            safeLog('error', 'LLM scoring batch failed', { 
                batchIndex, 
                error: error.message 
            });
            hasErrors = true;
        }
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
        limit = 10,
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
    // Use LOWER() for case-insensitive status comparison (PostgreSQL stores lowercase)
    const conditions = ["(LOWER(r.status) = 'analyzed' OR LOWER(r.status) = 'improved')"];
    const params = [];
    let paramIndex = 1;
    
    if (status) {
        conditions.push(`LOWER(r.status) = LOWER($${paramIndex})`);
        params.push(status);
        paramIndex++;
    }
    
    if (firmFilter) {
        conditions.push(`r.firm_name = $${paramIndex}`);
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
    
    const whereClause = conditions.join(' AND ');
    
    // 4. Fetch all resumes
    // Use cleaned tags (skills_cleaned, etc.) for better matching accuracy
    // Fall back to raw tags if cleaned are not available
    const query = `
        SELECT r.id, r.name, r.title, r.status, r.global_rating, 
               r.skills, r.tools, r.industries, r.soft_skills,
               r.skills_cleaned, r.tools_cleaned, r.industries_cleaned, r.soft_skills_cleaned,
               r.firm_name, r.created_at
        FROM resumes r
        ${dealJoin}
        WHERE ${whereClause}
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
        const resumeTags = {
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
    const profilesToScore = limit > 0 ? allProfiles.slice(0, limit * 5) : allProfiles;
    
    safeLog('info', 'Sending profiles to LLM for scoring', {
        totalProfiles: allProfiles.length,
        profilesToScore: profilesToScore.length
    });
    
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
    
    if (!model) {
        throw new Error('LLM model not configured in Settings.');
    }
    
    // 5. Prepare profile data
    const candidateSkills = parseJsonField(resumeRecord.skills);
    const candidateTools = parseJsonField(resumeRecord.tools);
    const candidateIndustries = parseJsonField(resumeRecord.industries);
    const candidateSoftSkills = parseJsonField(resumeRecord.soft_skills);
    
    // 6. Build prompt
    const prompt = DETAILED_PROFILE_ANALYSIS_PROMPT
        .replace('{CANDIDATE_NAME}', resumeRecord.name || 'Non spécifié')
        .replace('{CANDIDATE_TITLE}', resumeRecord.title || 'Non spécifié')
        .replace('{CANDIDATE_SKILLS}', candidateSkills.join(', ') || 'Non spécifié')
        .replace('{CANDIDATE_TOOLS}', candidateTools.join(', ') || 'Non spécifié')
        .replace('{CANDIDATE_INDUSTRIES}', candidateIndustries.join(', ') || 'Non spécifié')
        .replace('{CANDIDATE_SOFT_SKILLS}', candidateSoftSkills.join(', ') || 'Non spécifié')
        .replace('{CANDIDATE_RATING}', resumeRecord.global_rating || 'Non évalué')
        .replace('{MISSION_TITLE}', missionRecord.title || '')
        .replace('{MISSION_CONTENT}', missionRecord.content || '')
        .replace('{MISSION_SKILLS}', (missionKeywords.skills || []).join(', ') || 'Non spécifié')
        .replace('{MISSION_TOOLS}', (missionKeywords.tools || []).join(', ') || 'Non spécifié')
        .replace('{MISSION_INDUSTRIES}', (missionKeywords.industries || []).join(', ') || 'Non spécifié')
        .replace('{MISSION_SOFT_SKILLS}', (missionKeywords.softSkills || []).join(', ') || 'Non spécifié');
    
    // 7. Call LLM
    const response = await callOpenAI({
        model,
        messages: [
            { role: 'system', content: 'You are a JSON-only HR analysis API. Respond with valid JSON only.' },
            { role: 'user', content: prompt }
        ],
        maxTokens: 2048,
        temperature: 0.3,
        responseFormat: { type: "json_object" },
        userMetadata,
        operationType: 'Detailed Profile Analysis'
    });
    
    let analysis;
    try {
        analysis = JSON.parse(response.choices[0].message.content);
    } catch (_parseError) {
        throw new Error('Erreur lors de l\'analyse détaillée du profil.');
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
