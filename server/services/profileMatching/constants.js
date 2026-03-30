import {
    PROFILE_MATCHING_LOCAL_SKILL_WEIGHT,
    PROFILE_MATCHING_LOCAL_TOOL_WEIGHT,
    PROFILE_MATCHING_LOCAL_INDUSTRY_WEIGHT,
    PROFILE_MATCHING_LOCAL_SOFTSKILL_WEIGHT,
    PROFILE_MATCHING_LOCAL_TITLE_EXACT_WEIGHT,
    PROFILE_MATCHING_LOCAL_TITLE_TOKEN_WEIGHT,
    PROFILE_MATCHING_LOCAL_COVERAGE_MULTIPLIER
} from '../../config/constants.js';

export const DEFAULT_WEIGHTS = {
    skills: 40,
    tools: 25,
    industries: 20,
    softSkills: 15
};

export const PROFILE_MATCHING_MAX_EXPLANATIONS = 5;
export const PROFILE_MATCHING_EXPLANATION_MAX_CONCURRENCY = 5;
export const PROFILE_MATCHING_EXPLANATION_PROMPT = `You are a JSON-only HR explanation API.
Return a compact JSON object with exactly this structure:
{
  "reason": "short string",
  "keyStrengths": ["string"],
  "keyGaps": ["string"]
}

Rules:
- Reason must stay under 220 characters.
- keyStrengths: 1 to 3 short items.
- keyGaps: 0 to 3 short items.
- No markdown.
- No text outside JSON.`;

export const DEFAULT_LOCAL_RANKING_WEIGHTS = {
    skillWeight: PROFILE_MATCHING_LOCAL_SKILL_WEIGHT,
    toolWeight: PROFILE_MATCHING_LOCAL_TOOL_WEIGHT,
    industryWeight: PROFILE_MATCHING_LOCAL_INDUSTRY_WEIGHT,
    softSkillWeight: PROFILE_MATCHING_LOCAL_SOFTSKILL_WEIGHT,
    titleExactWeight: PROFILE_MATCHING_LOCAL_TITLE_EXACT_WEIGHT,
    titleTokenWeight: PROFILE_MATCHING_LOCAL_TITLE_TOKEN_WEIGHT,
    coverageMultiplier: PROFILE_MATCHING_LOCAL_COVERAGE_MULTIPLIER
};
