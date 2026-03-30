import { PROFILE_MATCHING_LLM_PREFILTER_CAP } from '../../config/constants.js';
import { normalizeUtf8Text } from '../openai/textUtils.js';
import { DEFAULT_LOCAL_RANKING_WEIGHTS } from './constants.js';

export function parseJsonField(value) {
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

export function normalizeTag(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase();
}

export function buildNormalizedTagSet(values = []) {
    return new Set((values || []).map(normalizeTag).filter(Boolean));
}

export function tokenizeText(value) {
    return String(value || '')
        .split(/[^a-zA-Z0-9+.#-]+/)
        .map(normalizeTag)
        .filter(token => token && token.length > 1);
}

export function computeCoverageScore(matches, missionValues = []) {
    const totalTargets = (missionValues || []).filter(Boolean).length;
    if (totalTargets === 0) {
        return 0;
    }

    return matches / totalTargets;
}

export function countMatches(candidateValues = [], missionSet = new Set()) {
    let matches = 0;
    for (const value of candidateValues || []) {
        if (missionSet.has(normalizeTag(value))) {
            matches += 1;
        }
    }
    return matches;
}

export function getProfileMatchingLocalRankingWeights(settings = {}) {
    return {
        skillWeight: Number(settings['Profile Matching Local Skill Weight'] ?? DEFAULT_LOCAL_RANKING_WEIGHTS.skillWeight),
        toolWeight: Number(settings['Profile Matching Local Tool Weight'] ?? DEFAULT_LOCAL_RANKING_WEIGHTS.toolWeight),
        industryWeight: Number(settings['Profile Matching Local Industry Weight'] ?? DEFAULT_LOCAL_RANKING_WEIGHTS.industryWeight),
        softSkillWeight: Number(settings['Profile Matching Local Soft Skill Weight'] ?? DEFAULT_LOCAL_RANKING_WEIGHTS.softSkillWeight),
        titleExactWeight: Number(settings['Profile Matching Local Title Exact Weight'] ?? DEFAULT_LOCAL_RANKING_WEIGHTS.titleExactWeight),
        titleTokenWeight: Number(settings['Profile Matching Local Title Token Weight'] ?? DEFAULT_LOCAL_RANKING_WEIGHTS.titleTokenWeight),
        coverageMultiplier: Number(settings['Profile Matching Local Coverage Multiplier'] ?? DEFAULT_LOCAL_RANKING_WEIGHTS.coverageMultiplier)
    };
}

export function scoreProfileHeuristically(profile, missionKeywords, rankingWeights = DEFAULT_LOCAL_RANKING_WEIGHTS) {
    const missionSkillSet = buildNormalizedTagSet(missionKeywords.skills);
    const missionToolSet = buildNormalizedTagSet(missionKeywords.tools);
    const missionIndustrySet = buildNormalizedTagSet(missionKeywords.industries);
    const missionSoftSkillSet = buildNormalizedTagSet(missionKeywords.softSkills);

    const skillMatches = countMatches(profile.resumeTags?.skills, missionSkillSet);
    const toolMatches = countMatches(profile.resumeTags?.tools, missionToolSet);
    const industryMatches = countMatches(profile.resumeTags?.industries, missionIndustrySet);
    const softSkillMatches = countMatches(profile.resumeTags?.softSkills, missionSoftSkillSet);

    const title = normalizeTag(profile.title);
    const missionTitle = normalizeTag(profile.missionTitle || '');
    const titleBoost = title && missionTitle && (title.includes(missionTitle) || missionTitle.includes(title)) ? 5 : 0;
    const missionTitleTokens = buildNormalizedTagSet(tokenizeText(profile.missionTitle || ''));
    const profileTitleTokens = tokenizeText(profile.title || '');
    const titleTokenMatches = countMatches(profileTitleTokens, missionTitleTokens);
    const qualityBoost = Math.min(Math.max(Number(profile.globalRating) || 0, 0), 100) / 20;
    const skillCoverage = computeCoverageScore(skillMatches, missionKeywords.skills);
    const toolCoverage = computeCoverageScore(toolMatches, missionKeywords.tools);
    const industryCoverage = computeCoverageScore(industryMatches, missionKeywords.industries);
    const softSkillCoverage = computeCoverageScore(softSkillMatches, missionKeywords.softSkills);
    const coverageBoost =
        (skillCoverage * rankingWeights.skillWeight * rankingWeights.coverageMultiplier) +
        (toolCoverage * rankingWeights.toolWeight * rankingWeights.coverageMultiplier) +
        (industryCoverage * rankingWeights.industryWeight * rankingWeights.coverageMultiplier) +
        (softSkillCoverage * rankingWeights.softSkillWeight * rankingWeights.coverageMultiplier);

    return {
        skillMatches,
        toolMatches,
        industryMatches,
        softSkillMatches,
        titleTokenMatches,
        skillCoverage,
        toolCoverage,
        industryCoverage,
        softSkillCoverage,
        heuristicScore:
            (skillMatches * rankingWeights.skillWeight) +
            (toolMatches * rankingWeights.toolWeight) +
            (industryMatches * rankingWeights.industryWeight) +
            (softSkillMatches * rankingWeights.softSkillWeight) +
            ((titleBoost > 0 ? 1 : 0) * rankingWeights.titleExactWeight) +
            (titleTokenMatches * rankingWeights.titleTokenWeight) +
            coverageBoost +
            qualityBoost
    };
}

export function buildCandidateDataFromProfile(profile) {
    return {
        name: profile.name || normalizeUtf8Text('Non spécifié'),
        title: profile.title || normalizeUtf8Text('Non spécifié'),
        globalRating: profile.globalRating || normalizeUtf8Text('Non évalué'),
        skills: (profile.resumeTags?.skills || []).slice(0, 8),
        tools: (profile.resumeTags?.tools || []).slice(0, 6),
        industries: (profile.resumeTags?.industries || []).slice(0, 4),
        softSkills: (profile.resumeTags?.softSkills || []).slice(0, 5)
    };
}

export function selectProfilesForLlm(
    allProfiles,
    missionKeywords,
    missionTitle,
    limit = 0,
    rankingWeights = DEFAULT_LOCAL_RANKING_WEIGHTS,
    prefilterCap = PROFILE_MATCHING_LLM_PREFILTER_CAP
) {
    if (prefilterCap === 0 || allProfiles.length <= prefilterCap) {
        return allProfiles;
    }

    const candidateCount = limit > 0
        ? Math.min(Math.max(limit * 5, 50), prefilterCap)
        : prefilterCap;

    return allProfiles
        .map(profile => ({
            ...profile,
            missionTitle,
            ...scoreProfileHeuristically({ ...profile, missionTitle }, missionKeywords, rankingWeights)
        }))
        .sort((a, b) => {
            if (b.heuristicScore !== a.heuristicScore) {
                return b.heuristicScore - a.heuristicScore;
            }
            return (b.globalRating || 0) - (a.globalRating || 0);
        })
        .slice(0, candidateCount)
        .map(({
            missionTitle: _missionTitle,
            heuristicScore: _heuristicScore,
            skillMatches: _skillMatches,
            toolMatches: _toolMatches,
            industryMatches: _industryMatches,
            softSkillMatches: _softSkillMatches,
            titleTokenMatches: _titleTokenMatches,
            skillCoverage: _skillCoverage,
            toolCoverage: _toolCoverage,
            industryCoverage: _industryCoverage,
            softSkillCoverage: _softSkillCoverage,
            ...profile
        }) => profile);
}
