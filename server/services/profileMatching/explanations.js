import metrics from '../metrics.service.js';
import { normalizeUtf8Text } from '../openai/textUtils.js';
import {
    PROFILE_MATCHING_EXPLANATION_PROMPT,
    PROFILE_MATCHING_MAX_EXPLANATIONS
} from './constants.js';
import { buildCandidateDataFromProfile } from './localRanking.js';

export function buildProfileExplanationPrompt(profile, missionRecord, missionKeywords) {
    const candidate = buildCandidateDataFromProfile(profile);

    return `${PROFILE_MATCHING_EXPLANATION_PROMPT}

MISSION
- Title: ${missionRecord.title || ''}
- Content: ${missionRecord.content || normalizeUtf8Text('Non spécifié')}
- Skills: ${(missionKeywords.skills || []).join(', ') || normalizeUtf8Text('Non spécifié')}
- Tools: ${(missionKeywords.tools || []).join(', ') || normalizeUtf8Text('Non spécifié')}
- Industries: ${(missionKeywords.industries || []).join(', ') || normalizeUtf8Text('Non spécifié')}
- Soft skills: ${(missionKeywords.softSkills || []).join(', ') || normalizeUtf8Text('Non spécifié')}

CANDIDATE
- Name: ${candidate.name}
- Title: ${candidate.title}
- Rating: ${candidate.globalRating}
- Skills: ${candidate.skills.join(', ') || normalizeUtf8Text('Non spécifié')}
- Tools: ${candidate.tools.join(', ') || normalizeUtf8Text('Non spécifié')}
- Industries: ${candidate.industries.join(', ') || normalizeUtf8Text('Non spécifié')}
- Soft skills: ${candidate.softSkills.join(', ') || normalizeUtf8Text('Non spécifié')}`;
}

export function normalizeExplanationItems(value, context = null) {
    const trackedContext = context && context.provider
        ? {
            provider: context.provider,
            event: 'normalization',
            normalizationEvents: 1,
            metadata: {
                field: context.field || 'unknown',
                source: context.source || 'unknown',
                inputType: Array.isArray(value) ? 'array' : typeof value,
                ...(context.resumeId ? { resumeId: context.resumeId } : {})
            }
        }
        : null;

    if (Array.isArray(value)) {
        return value
            .map(item => String(item || '').trim())
            .filter(Boolean)
            .slice(0, 3);
    }

    if (typeof value === 'string') {
        if (trackedContext) {
            metrics.trackProfileMatchingActivity(trackedContext);
        }
        return value
            .split(/\r?\n|[;,]/)
            .map(item => item.trim())
            .filter(Boolean)
            .slice(0, 3);
    }

    if (value && typeof value === 'object') {
        if (trackedContext) {
            metrics.trackProfileMatchingActivity(trackedContext);
        }
        return Object.values(value)
            .map(item => String(item || '').trim())
            .filter(Boolean)
            .slice(0, 3);
    }

    return [];
}

export function buildExplanationPayload(explanation = {}, normalizationContext = null) {
    return {
        reason: explanation.reason || null,
        keyStrengths: normalizeExplanationItems(explanation.keyStrengths, {
            ...normalizationContext,
            field: 'keyStrengths'
        }),
        keyGaps: normalizeExplanationItems(explanation.keyGaps, {
            ...normalizationContext,
            field: 'keyGaps'
        })
    };
}

export function getExplanationProfileCount(limit = 0, totalProfiles = 0) {
    if (totalProfiles === 0) {
        return 0;
    }

    if (limit > 0) {
        return Math.min(limit, PROFILE_MATCHING_MAX_EXPLANATIONS, totalProfiles);
    }

    return Math.min(PROFILE_MATCHING_MAX_EXPLANATIONS, totalProfiles);
}
