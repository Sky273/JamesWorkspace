export function toTrimmedString(value, fallback = '') {
    if (value === null || value === undefined) {
        return fallback;
    }

    const normalized = String(value).trim();
    return normalized || fallback;
}

export function toStrictString(value, fallback = '') {
    if (typeof value !== 'string') {
        return fallback;
    }

    const normalized = value.trim();
    return normalized || fallback;
}

function extractStrings(value) {
    if (value === null || value === undefined) {
        return [];
    }

    if (typeof value === 'string') {
        return value
            .split(/\r?\n|[;,]/)
            .map(item => item.trim())
            .filter(Boolean);
    }

    if (Array.isArray(value)) {
        return value.flatMap(extractStrings);
    }

    if (typeof value === 'object') {
        const directValues = ['label', 'name', 'title', 'text', 'value', 'keyword', 'item', 'skill', 'tool']
            .map(key => value[key])
            .filter(candidate => candidate !== undefined && candidate !== null);
        if (directValues.length > 0) {
            return directValues.flatMap(extractStrings);
        }

        return Object.values(value).flatMap(extractStrings);
    }

    return [String(value)];
}

export function toStringArray(value) {
    return [...new Set(extractStrings(value).filter(Boolean))];
}

function toOptionalNumber(value) {
    if (value === null || value === undefined || value === '') {
        return null;
    }

    const normalized = Number(value);
    return Number.isFinite(normalized) ? normalized : null;
}

function toOptionalInteger(value) {
    const normalized = toOptionalNumber(value);
    return normalized === null ? null : Math.round(normalized);
}

function extractKeywordEvidenceName(value) {
    if (value === null || value === undefined) {
        return '';
    }

    if (typeof value === 'string') {
        return value.trim();
    }

    if (typeof value !== 'object' || Array.isArray(value)) {
        return String(value).trim();
    }

    return toTrimmedString(
        value.name
        ?? value.skill
        ?? value.tool
        ?? value.label
        ?? value.title
        ?? value.text
        ?? value.value
        ?? value.keyword
        ?? value.item
    );
}

function normalizeStoredEvidenceCategory(category) {
    if (category === null || category === undefined || category === '') {
        return null;
    }

    const normalized = normalizeEvidenceCategory(category);
    if (normalized === 'tool') return 'tool';
    if (normalized === 'softSkill') return 'soft_skill';
    return 'skill';
}

export function normalizeEvidenceCategory(category) {
    const normalized = toStrictString(category, '').toLowerCase();

    switch (normalized) {
        case 'tool':
        case 'tools':
        case 'technology':
        case 'technologies':
        case 'framework':
        case 'frameworks':
        case 'platform':
        case 'platforms':
            return 'tool';
        case 'soft_skill':
        case 'soft skills':
        case 'soft_skill_category':
        case 'behavioral_skill':
        case 'behavioural_skill':
            return 'softSkill';
        case 'technical_skill':
        case 'technical_skills':
        case 'skill':
        case 'skills':
        case 'competency':
        case 'competence':
        default:
            return 'skill';
    }
}

function clampScore(value) {
    if (value === null || value === undefined || Number.isNaN(value)) {
        return null;
    }

    return Math.max(0, Math.min(1, value));
}

function normalizeDurationScore(yearsOfExperienceEstimated) {
    if (yearsOfExperienceEstimated === null || yearsOfExperienceEstimated === undefined) {
        return 0;
    }

    return clampScore(Number(yearsOfExperienceEstimated) / 5) ?? 0;
}

function normalizeRecencyScore(recency) {
    switch (String(recency || '').trim().toLowerCase()) {
        case 'recent':
            return 1;
        case 'mid':
            return 0.65;
        case 'old':
            return 0.3;
        case 'unknown':
        default:
            return 0.45;
    }
}

function normalizeDepthScore(depth) {
    switch (String(depth || '').trim().toLowerCase()) {
        case 'mentioned_only':
            return 0.3;
        case 'contextual':
            return 0.55;
        case 'substantive':
            return 0.8;
        case 'central':
            return 1;
        case 'basic':
            return 0.35;
        case 'intermediate':
            return 0.65;
        case 'advanced':
            return 0.9;
        default:
            return 0.3;
    }
}

function normalizeContextDiversity(contexts) {
    if (contexts === null || contexts === undefined) {
        return 0;
    }

    return clampScore(Number(contexts) / 3) ?? 0;
}

function normalizeMentionConfidence(mentions) {
    if (mentions === null || mentions === undefined) {
        return 0;
    }

    return clampScore(Number(mentions) / 3) ?? 0;
}

function computeEvidenceScore({
    yearsOfExperienceEstimated,
    recency,
    usageDepth,
    contexts,
    mentions
}) {
    return clampScore(
        (0.30 * normalizeDurationScore(yearsOfExperienceEstimated))
        + (0.20 * normalizeRecencyScore(recency))
        + (0.20 * normalizeDepthScore(usageDepth))
        + (0.15 * normalizeContextDiversity(contexts))
        + (0.15 * normalizeMentionConfidence(mentions))
    );
}

function inferProofLevel(score) {
    if (score === null || score === undefined) {
        return null;
    }

    if (score >= 0.75) return 'high';
    if (score >= 0.46) return 'medium';
    return 'low';
}

function normalizeKeywordEvidenceItem(value) {
    const name = extractKeywordEvidenceName(value);
    if (!name) {
        return null;
    }

    const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const evidence = source.evidence && typeof source.evidence === 'object' && !Array.isArray(source.evidence)
        ? source.evidence
        : {};
    const proof = source.proof && typeof source.proof === 'object' && !Array.isArray(source.proof)
        ? source.proof
        : {};
    const mentions = toOptionalInteger(
        proof.occurrenceCountEstimate
        ?? proof.occurrence_count_estimate
        ?? evidence.mentions
        ?? source.mentions
        ?? (typeof value === 'string' ? 1 : null)
    );
    const contexts = toOptionalInteger(
        proof.contextCountEstimate
        ?? proof.context_count_estimate
        ?? evidence.contexts
        ?? source.contexts
        ?? 0
    );
    const yearsOfExperienceEstimated = toOptionalNumber(
        evidence.yearsOfExperienceEstimated
        ?? evidence.years_of_experience_estimated
        ?? proof.estimatedExperienceYears
        ?? proof.estimated_experience_years
        ?? source.yearsOfExperienceEstimated
        ?? source.years_of_experience_estimated
    );
    const recency = toStrictString(
        proof.recency
        ?? evidence.recency
        ?? source.recency,
        typeof value === 'string' ? 'unknown' : null
    );
    const usageDepth = toStrictString(
        proof.usageDepth
        ?? proof.usage_depth
        ?? evidence.depth
        ?? source.depth,
        typeof value === 'string' ? 'mentioned_only' : null
    );
    const evidenceSources = toStringArray(
        proof.evidenceSources
        ?? proof.evidence_sources
        ?? evidence.sourceTypes
        ?? evidence.source_types
        ?? source.sourceTypes
        ?? source.source_types
    );
    const projects = toStringArray(evidence.projects ?? source.projects);
    const proofScore = toOptionalNumber(
        proof.proofScore
        ?? proof.proof_score
    );
    const computedEvidenceScore = computeEvidenceScore({
        yearsOfExperienceEstimated,
        recency,
        usageDepth,
        contexts,
        mentions
    });
    const evidenceScore = toOptionalNumber(source.evidenceScore ?? source.evidence_score) ?? computedEvidenceScore;
    const confidence = toOptionalNumber(source.confidence) ?? proofScore ?? evidenceScore;
    const proofLevel = toStrictString(
        proof.proofLevel
        ?? proof.proof_level,
        inferProofLevel(proofScore ?? evidenceScore)
    );
    const category = normalizeStoredEvidenceCategory(source.category);
    const justification = toStrictString(proof.justification ?? source.justification, null);

    return {
        name,
        category,
        evidenceScore,
        confidence,
        proofLevel,
        proofScore: proofScore ?? evidenceScore,
        justification,
        proof: {
            proofLevel,
            proofScore: proofScore ?? evidenceScore,
            evidenceSources,
            occurrenceCountEstimate: mentions,
            contextCountEstimate: contexts,
            recency,
            usageDepth,
            estimatedExperienceYears: toOptionalNumber(proof.estimatedExperienceYears ?? proof.estimated_experience_years),
            estimatedExperienceConfidence: toStrictString(
                proof.estimatedExperienceConfidence ?? proof.estimated_experience_confidence,
                null
            ),
            experienceEstimationBasis: toStrictString(
                proof.experienceEstimationBasis ?? proof.experience_estimation_basis,
                null
            ),
            justification
        },
        evidence: {
            mentions,
            contexts,
            yearsOfExperienceEstimated,
            recency,
            depth: usageDepth,
            sourceTypes: evidenceSources,
            projects
        }
    };
}

export function dedupeKeywordEvidence(items) {
    const unique = new Map();

    for (const item of items) {
        if (!item?.name) {
            continue;
        }

        const key = item.name.trim().toLowerCase();
        if (!unique.has(key)) {
            unique.set(key, item);
        }
    }

    return [...unique.values()];
}

export function splitDetailedKeywordEvidence(entries) {
    const buckets = {
        skillsEvidence: [],
        toolsEvidence: [],
        softSkillsEvidence: []
    };

    for (const entry of entries) {
        const category = normalizeEvidenceCategory(entry?.category);
        if (category === 'tool') {
            buckets.toolsEvidence.push({ ...entry, category: 'tool' });
        } else if (category === 'softSkill') {
            buckets.softSkillsEvidence.push({ ...entry, category: 'soft_skill' });
        } else {
            buckets.skillsEvidence.push({ ...entry, category: 'skill' });
        }
    }

    return {
        skillsEvidence: dedupeKeywordEvidence(buckets.skillsEvidence),
        toolsEvidence: dedupeKeywordEvidence(buckets.toolsEvidence),
        softSkillsEvidence: dedupeKeywordEvidence(buckets.softSkillsEvidence)
    };
}

export function toKeywordEvidenceArray(value) {
    if (value === null || value === undefined) {
        return [];
    }

    if (typeof value === 'string') {
        return dedupeKeywordEvidence(
            toStringArray(value).map((name) => normalizeKeywordEvidenceItem(name)).filter(Boolean)
        );
    }

    if (Array.isArray(value)) {
        return dedupeKeywordEvidence(value.flatMap((entry) => toKeywordEvidenceArray(entry)));
    }

    if (typeof value === 'object') {
        const normalizedItem = normalizeKeywordEvidenceItem(value);
        if (normalizedItem) {
            return [normalizedItem];
        }

        return dedupeKeywordEvidence(Object.values(value).flatMap((entry) => toKeywordEvidenceArray(entry)));
    }

    return dedupeKeywordEvidence([normalizeKeywordEvidenceItem(String(value))].filter(Boolean));
}

export function deriveKeywordNamesFromEvidence(evidenceItems) {
    return evidenceItems.map((item) => item.name).filter(Boolean);
}
