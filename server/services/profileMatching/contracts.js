import { normalizeExplanationItems } from './explanations.js';

const ALLOWED_CONFIDENCE_LEVELS = new Set(['low', 'medium', 'high']);
const ALLOWED_SEVERITY_LEVELS = new Set(['low', 'medium', 'high', 'important', 'critical']);

function normalizeString(value, fallback = null) {
    if (value === undefined || value === null) {
        return fallback;
    }

    const normalized = String(value).trim();
    return normalized || fallback;
}

function normalizeScore(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        return 0;
    }

    return Math.max(0, Math.min(100, Math.round(numeric)));
}

function normalizeConfidence(value) {
    const normalized = normalizeString(value, 'medium')?.toLowerCase();
    return ALLOWED_CONFIDENCE_LEVELS.has(normalized) ? normalized : 'medium';
}

function normalizeAnalysisList(value, mapper) {
    if (!Array.isArray(value)) {
        return [];
    }

    return value
        .map(mapper)
        .filter(Boolean);
}

export function validateMissionKeywordsPayload(payload = {}) {
    return {
        skills: normalizeExplanationItems(payload.skills),
        tools: normalizeExplanationItems(payload.tools),
        industries: normalizeExplanationItems(payload.industries),
        softSkills: normalizeExplanationItems(payload.softSkills),
        experienceLevel: normalizeString(payload.experienceLevel, 'Non spécifié')
    };
}

export function validateBatchProfileScoringPayload(payload = {}, provider = null) {
    const rawScores = payload?.scores && typeof payload.scores === 'object' ? payload.scores : {};
    const scores = {};
    let normalizationCount = 0;

    for (const [resumeId, rawScore] of Object.entries(rawScores)) {
        if (!rawScore || typeof rawScore !== 'object') {
            continue;
        }

        const normalizedKeyStrengths = normalizeExplanationItems(rawScore.keyStrengths);
        const normalizedKeyGaps = normalizeExplanationItems(rawScore.keyGaps);

        if (!Array.isArray(rawScore.keyStrengths)) {
            normalizationCount++;
        }
        if (!Array.isArray(rawScore.keyGaps)) {
            normalizationCount++;
        }

        scores[resumeId] = {
            score: normalizeScore(rawScore.score),
            confidence: normalizeConfidence(rawScore.confidence),
            reason: normalizeString(rawScore.reason),
            keyStrengths: normalizedKeyStrengths,
            keyGaps: normalizedKeyGaps
        };
    }

    return {
        scores,
        metadata: {
            provider,
            normalizationCount
        }
    };
}

export function validateDetailedProfileAnalysisPayload(payload = {}) {
    return {
        overallScore: normalizeScore(payload.overallScore),
        verdict: normalizeString(payload.verdict),
        summary: normalizeString(payload.summary),
        strengths: normalizeAnalysisList(payload.strengths, item => {
            if (!item || typeof item !== 'object') {
                return null;
            }
            return {
                category: normalizeString(item.category, 'unknown'),
                item: normalizeString(item.item, 'unknown'),
                explanation: normalizeString(item.explanation)
            };
        }),
        gaps: normalizeAnalysisList(payload.gaps, item => {
            if (!item || typeof item !== 'object') {
                return null;
            }
            const severity = normalizeString(item.severity, 'medium')?.toLowerCase();
            return {
                category: normalizeString(item.category, 'unknown'),
                item: normalizeString(item.item, 'unknown'),
                severity: ALLOWED_SEVERITY_LEVELS.has(severity) ? severity : 'medium',
                explanation: normalizeString(item.explanation)
            };
        }),
        recommendations: normalizeAnalysisList(payload.recommendations, item => {
            if (!item || typeof item !== 'object') {
                return null;
            }
            return {
                type: normalizeString(item.type, 'general'),
                suggestion: normalizeString(item.suggestion)
            };
        }),
        interviewQuestions: normalizeExplanationItems(payload.interviewQuestions, null).slice(0, 5),
        riskAssessment: payload?.riskAssessment && typeof payload.riskAssessment === 'object'
            ? {
                level: normalizeString(payload.riskAssessment.level, 'medium')?.toLowerCase(),
                factors: normalizeExplanationItems(payload.riskAssessment.factors, null)
            }
            : {
                level: 'medium',
                factors: []
            }
    };
}
