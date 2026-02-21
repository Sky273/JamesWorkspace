/**
 * Profile Matching Service - PostgreSQL Version
 * Handles matching CVs to missions based on extracted keywords/tags
 * Optimized to minimize LLM usage by using pre-extracted CV tags
 */

import { selectWithTimeout, findWithTimeout, updateWithTimeout } from '../utils/postgresHelpers.js';
import { safeLog } from '../utils/logger.backend.js';
import { callOpenAI } from './openai.service.js';
import { getLLMSettings } from './settings.service.js';
import { MISSION_KEYWORDS_EXTRACTION_PROMPT, DETAILED_PROFILE_ANALYSIS_PROMPT, TITLE_MATCHING_REFINEMENT_PROMPT } from '../config/prompts.backend.js';

/**
 * Default weights for scoring categories
 */
const DEFAULT_WEIGHTS = {
    skills: 40,
    tools: 25,
    industries: 20,
    softSkills: 15
};

/**
 * Normalize a string for comparison (lowercase, trim, remove accents)
 */
function normalizeString(str) {
    if (!str || typeof str !== 'string') return '';
    return str
        .toLowerCase()
        .trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Check if two strings match (with fuzzy matching for common variations)
 */
function fuzzyMatch(str1, str2) {
    const norm1 = normalizeString(str1);
    const norm2 = normalizeString(str2);
    
    if (norm1 === norm2) return true;
    if (norm1.includes(norm2) || norm2.includes(norm1)) return true;
    
    const variations = {
        'reactjs': ['react', 'react.js'],
        'nodejs': ['node', 'node.js'],
        'vuejs': ['vue', 'vue.js'],
        'angularjs': ['angular'],
        'javascript': ['js'],
        'typescript': ['ts'],
        'postgresql': ['postgres'],
        'mongodb': ['mongo'],
        'kubernetes': ['k8s'],
        'amazon web services': ['aws'],
        'google cloud platform': ['gcp'],
        'microsoft azure': ['azure'],
        'ci/cd': ['cicd', 'ci cd'],
        'devops': ['dev ops'],
        'machine learning': ['ml'],
        'artificial intelligence': ['ai'],
        'natural language processing': ['nlp']
    };
    
    for (const [key, values] of Object.entries(variations)) {
        const allVariants = [key, ...values];
        const hasStr1 = allVariants.some(v => norm1.includes(v) || v.includes(norm1));
        const hasStr2 = allVariants.some(v => norm2.includes(v) || v.includes(norm2));
        if (hasStr1 && hasStr2) return true;
    }
    
    return false;
}

/**
 * Calculate match score for a single category
 */
function calculateCategoryScore(resumeItems, missionItems) {
    if (!missionItems || missionItems.length === 0) {
        return { score: 100, matches: [], missing: [] };
    }
    
    const resumeNormalized = (resumeItems || []).map(item => ({
        original: item,
        normalized: normalizeString(item)
    }));
    
    const matches = [];
    const missing = [];
    
    for (const missionItem of missionItems) {
        const found = resumeNormalized.find(r => fuzzyMatch(r.original, missionItem));
        if (found) {
            matches.push(missionItem);
        } else {
            missing.push(missionItem);
        }
    }
    
    const score = missionItems.length > 0 
        ? Math.round((matches.length / missionItems.length) * 100)
        : 100;
    
    return { score, matches, missing };
}

/**
 * Calculate overall match score for a resume against mission keywords
 */
function calculateMatchScore(resumeTags, missionKeywords, weights = DEFAULT_WEIGHTS) {
    const results = {
        skills: calculateCategoryScore(resumeTags.skills, missionKeywords.skills),
        tools: calculateCategoryScore(resumeTags.tools, missionKeywords.tools),
        industries: calculateCategoryScore(resumeTags.industries, missionKeywords.industries),
        softSkills: calculateCategoryScore(resumeTags.softSkills, missionKeywords.softSkills)
    };
    
    const totalWeight = weights.skills + weights.tools + weights.industries + weights.softSkills;
    const weightedScore = (
        results.skills.score * weights.skills +
        results.tools.score * weights.tools +
        results.industries.score * weights.industries +
        results.softSkills.score * weights.softSkills
    ) / totalWeight;
    
    return {
        totalScore: Math.round(weightedScore),
        categoryScores: {
            skills: results.skills.score,
            tools: results.tools.score,
            industries: results.industries.score,
            softSkills: results.softSkills.score
        },
        matches: {
            skills: results.skills.matches,
            tools: results.tools.matches,
            industries: results.industries.matches,
            softSkills: results.softSkills.matches
        },
        missing: {
            skills: results.skills.missing,
            tools: results.tools.missing,
            industries: results.industries.missing,
            softSkills: results.softSkills.missing
        }
    };
}

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
 * Refine match scores using LLM analysis of candidate titles
 */
async function refineTitleScores(profiles, missionRecord, missionKeywords, userMetadata = null) {
    if (!profiles || profiles.length === 0) {
        return {};
    }

    const settings = await getLLMSettings();
    const model = settings.llmModel;

    if (!model) {
        safeLog('warn', 'LLM model not configured, skipping title refinement');
        return {};
    }

    const candidatesList = profiles
        .map(p => `${p.resumeId}: ${p.title || 'Sans titre'}`)
        .join('\n');

    const missionSummary = (missionRecord.content || '')
        .substring(0, 500)
        .replace(/\n/g, ' ')
        .trim();

    const experienceLevel = missionKeywords.experienceLevel || 'Non spécifié';

    const prompt = TITLE_MATCHING_REFINEMENT_PROMPT
        .replace('{MISSION_TITLE}', missionRecord.title || '')
        .replace('{MISSION_SUMMARY}', missionSummary)
        .replace('{EXPERIENCE_LEVEL}', experienceLevel)
        .replace('{CANDIDATES_LIST}', candidatesList);

    try {
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
            operationType: 'Title Score Refinement'
        });

        let result;
        try {
            result = JSON.parse(response.choices[0].message.content);
        } catch (parseError) {
            return {};
        }

        return result.adjustments || {};
    } catch (error) {
        safeLog('error', 'Failed to refine title scores', { error: error.message });
        return {};
    }
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
        weights = DEFAULT_WEIGHTS
    } = options;
    
    const firmFilter = firm;
    safeLog('info', 'Finding matching profiles', { missionId, limit, minScore, status, firm: firmFilter });
    
    // 1. Get mission record
    const missionRecord = await findWithTimeout('missions', missionId);
    
    if (!missionRecord) {
        throw new Error('Mission not found');
    }
    
    // 2. Get or extract mission keywords
    const missionKeywords = await getMissionKeywords(missionId, missionRecord, userMetadata);
    
    // 3. Build query for resumes
    // Use LOWER() for case-insensitive status comparison (PostgreSQL stores lowercase)
    const conditions = ["(LOWER(status) = 'analyzed' OR LOWER(status) = 'improved')"];
    const params = [];
    let paramIndex = 1;
    
    if (status) {
        conditions.push(`LOWER(status) = LOWER($${paramIndex})`);
        params.push(status);
        paramIndex++;
    }
    
    if (firmFilter) {
        conditions.push(`firm_name = $${paramIndex}`);
        params.push(firmFilter);
        paramIndex++;
    }
    
    const whereClause = conditions.join(' AND ');
    
    // 4. Fetch all resumes
    // Use cleaned tags (skills_cleaned, etc.) for better matching accuracy
    // Fall back to raw tags if cleaned are not available
    const query = `
        SELECT id, name, title, status, global_rating, 
               skills, tools, industries, soft_skills,
               skills_cleaned, tools_cleaned, industries_cleaned, soft_skills_cleaned,
               firm_name, created_at
        FROM resumes
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
    
    // 5. Score each resume
    // Prioritize cleaned tags over raw tags for better matching accuracy
    const scoredProfiles = resumeRecords.map(record => {
        const resumeTags = {
            skills: parseJsonField(record.skills_cleaned) || parseJsonField(record.skills),
            tools: parseJsonField(record.tools_cleaned) || parseJsonField(record.tools),
            industries: parseJsonField(record.industries_cleaned) || parseJsonField(record.industries),
            softSkills: parseJsonField(record.soft_skills_cleaned) || parseJsonField(record.soft_skills)
        };
        
        const matchResult = calculateMatchScore(resumeTags, missionKeywords, weights);
        
        return {
            resumeId: record.id,
            name: record.name || 'Sans nom',
            title: record.title || '',
            status: record.status,
            globalRating: record.global_rating || 0,
            firmName: record.firm_name,
            createdAt: record.created_at,
            matchScore: matchResult.totalScore,
            categoryScores: matchResult.categoryScores,
            matchedTags: matchResult.matches,
            missingTags: matchResult.missing,
            resumeTags
        };
    });
    
    // Debug: Log scoring distribution
    safeLog('debug', 'Scoring distribution', {
        totalScored: scoredProfiles.length,
        withScore0: scoredProfiles.filter(p => p.matchScore === 0).length,
        withScoreAbove0: scoredProfiles.filter(p => p.matchScore > 0).length,
        withScoreAbove50: scoredProfiles.filter(p => p.matchScore >= 50).length,
        topScores: scoredProfiles.slice(0, 5).map(p => ({ name: p.name, score: p.matchScore }))
    });
    
    // 6. Filter by minimum score and sort
    // Include all profiles with score >= 0 to show results even with low matches
    const preliminaryProfiles = scoredProfiles
        .filter(p => p.matchScore >= Math.max(0, minScore - 15))
        .sort((a, b) => b.matchScore - a.matchScore)
        .slice(0, Math.min(limit * 2, 30));
    
    // 7. Refine scores using LLM analysis of titles
    const titleAdjustments = await refineTitleScores(
        preliminaryProfiles, 
        missionRecord, 
        missionKeywords, 
        userMetadata
    );
    
    // 8. Apply title adjustments
    const refinedProfiles = preliminaryProfiles.map(profile => {
        const adjustment = titleAdjustments[profile.resumeId];
        const titleAdjustment = adjustment?.adjustment || 0;
        const titleReason = adjustment?.reason || null;
        
        const refinedScore = Math.max(0, Math.min(100, profile.matchScore + titleAdjustment));
        
        return {
            ...profile,
            matchScore: refinedScore,
            baseScore: profile.matchScore,
            titleAdjustment,
            titleReason
        };
    });
    
    // 9. Final filter and sort
    // Always include profiles even with score 0 when minScore is 0
    // This ensures we show all CVs sorted by relevance
    const filteredProfiles = refinedProfiles
        .filter(p => minScore === 0 ? true : p.matchScore >= minScore)
        .sort((a, b) => b.matchScore - a.matchScore)
        .slice(0, limit);
    
    safeLog('info', 'Profile matching completed', {
        totalResumes: resumeRecords.length,
        matchingProfiles: filteredProfiles.length,
        topScore: filteredProfiles[0]?.matchScore || 0
    });
    
    return {
        missionId,
        missionTitle: missionRecord.title,
        missionKeywords,
        totalResumesScanned: resumeRecords.length,
        profiles: filteredProfiles,
        weights,
        titleRefinementApplied: Object.keys(titleAdjustments).length > 0
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
    } catch (parseError) {
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
    calculateMatchScore,
    DEFAULT_WEIGHTS
};
