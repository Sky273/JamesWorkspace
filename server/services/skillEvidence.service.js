import { transaction } from '../utils/postgresHelpers.js';
import { safeLog } from '../utils/logger.backend.js';

const EVIDENCE_CATEGORY_MAP = [
    { key: 'skillsEvidence', category: 'skill' },
    { key: 'toolsEvidence', category: 'tool' },
    { key: 'softSkillsEvidence', category: 'soft_skill' }
];

function clampScore(value, fallback = 0) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return Math.max(0, Math.min(1, numeric));
}

function normalizeDisplayName(name) {
    return typeof name === 'string' ? name.trim() : '';
}

function normalizeCatalogName(name) {
    return normalizeDisplayName(name)
        .normalize('NFKC')
        .toLowerCase()
        .replace(/\s+/g, ' ');
}

function parseAnalysisPayload(analysis) {
    if (!analysis) return null;
    if (typeof analysis === 'string') {
        try {
            return JSON.parse(analysis);
        } catch {
            return null;
        }
    }
    return typeof analysis === 'object' ? analysis : null;
}

function extractEvidenceName(item) {
    return normalizeDisplayName(item?.name || item?.skill || item?.tool || '');
}

function normalizePhase(phase) {
    return phase === 'improved' ? 'improved' : 'initial';
}

function resolveDurationMonths(item) {
    const months = Number(item?.durationMonths);
    if (Number.isFinite(months) && months >= 0) {
        return Math.round(months);
    }

    const years = Number(
        item?.proof?.estimatedExperienceYears
        ?? item?.proof?.estimated_experience_years
        ?? item?.evidence?.yearsOfExperienceEstimated
        ?? item?.evidence?.years_of_experience_estimated
    );

    if (Number.isFinite(years) && years >= 0) {
        return Math.round(years * 12);
    }

    const legacyYears = Number(
        item?.evidence?.yearsOfExperienceEstimated
        ?? item?.evidence?.years_of_experience_estimated
    );

    if (Number.isFinite(legacyYears) && legacyYears >= 0) {
        return Math.round(legacyYears * 12);
    }

    return null;
}

function resolveRecencyValue(item) {
    return String(item?.proof?.recency || item?.evidence?.recency || '').trim().toLowerCase();
}

function resolveRecencyScore(item) {
    switch (resolveRecencyValue(item)) {
    case 'recent':
        return 1;
    case 'mid':
        return 0.65;
    case 'old':
        return 0.3;
    default:
        return 0.45;
    }
}

function resolveDepthValue(item) {
    return String(item?.proof?.usageDepth || item?.evidence?.depth || '').trim().toLowerCase();
}

function resolveDepthScore(item) {
    switch (resolveDepthValue(item)) {
    case 'central':
    case 'advanced':
        return 1;
    case 'substantive':
        return 0.8;
    case 'intermediate':
        return 0.65;
    case 'contextual':
        return 0.55;
    case 'mentioned_only':
    case 'basic':
        return 0.3;
    default:
        return 0.45;
    }
}

function resolveContextCount(item) {
    const explicit = Number(item?.proof?.contextCountEstimate ?? item?.evidence?.contexts);
    if (Number.isFinite(explicit) && explicit >= 0) {
        return Math.round(explicit);
    }
    return null;
}

function resolveOccurrenceCount(item) {
    const explicit = Number(item?.proof?.occurrenceCountEstimate ?? item?.evidence?.mentions);
    if (Number.isFinite(explicit) && explicit >= 0) {
        return Math.round(explicit);
    }
    return null;
}

function extractSourceTypes(item) {
    const sources = item?.proof?.evidenceSources || item?.evidence?.sourceTypes || [];
    if (!Array.isArray(sources)) return [];
    return [...new Set(
        sources
            .map((value) => typeof value === 'string' ? value.trim().toLowerCase() : '')
            .filter(Boolean)
    )];
}

function extractProjects(item) {
    const projects = item?.evidence?.projects || [];
    if (!Array.isArray(projects)) return [];
    return [...new Set(
        projects
            .map((value) => typeof value === 'string' ? value.trim() : '')
            .filter(Boolean)
    )];
}

function resolveDiversityScore(item) {
    const contextCount = resolveContextCount(item) || 0;
    const sourceCount = extractSourceTypes(item).length;
    const projectCount = extractProjects(item).length;
    const diversityBase = Math.max(contextCount, sourceCount, projectCount);
    return clampScore(diversityBase / 3, 0);
}

function resolveConfidence(item) {
    return clampScore(item?.confidence, 0);
}

function resolveEvidenceScore(item) {
    if (Number.isFinite(Number(item?.evidenceScore))) {
        return clampScore(item.evidenceScore, 0);
    }

    if (Number.isFinite(Number(item?.proofScore))) {
        return clampScore(item.proofScore, 0);
    }

    const durationMonths = resolveDurationMonths(item);
    const durationScore = durationMonths === null
        ? 0
        : clampScore(durationMonths / 60, 0);

    return clampScore(
        (0.30 * durationScore)
        + (0.20 * resolveRecencyScore(item))
        + (0.20 * resolveDepthScore(item))
        + (0.15 * resolveDiversityScore(item))
        + (0.15 * resolveConfidence(item)),
        0
    );
}

function resolveProofLevel(item) {
    const explicit = String(item?.proofLevel || item?.proof?.proofLevel || '').trim().toLowerCase();
    if (explicit) return explicit;

    const proofScore = Number(item?.proofScore ?? item?.proof?.proofScore);
    if (Number.isFinite(proofScore)) {
        if (proofScore >= 0.75) return 'high';
        if (proofScore >= 0.46) return 'medium';
        return 'low';
    }

    const evidenceScore = resolveEvidenceScore(item);
    if (evidenceScore >= 0.75) return 'high';
    if (evidenceScore >= 0.46) return 'medium';
    return 'low';
}

function buildOccurrences(item) {
    const durationMonths = resolveDurationMonths(item);
    const context = typeof item?.justification === 'string'
        ? item.justification.trim() || null
        : (typeof item?.proof?.justification === 'string' ? item.proof.justification.trim() || null : null);
    const sourceTypes = extractSourceTypes(item);
    const projects = extractProjects(item);

    if (projects.length > 0) {
        return projects.map((projectName, index) => ({
            sourceType: sourceTypes[index] || sourceTypes[0] || 'project_context',
            projectName,
            durationMonths,
            context
        }));
    }

    return sourceTypes.map((sourceType) => ({
        sourceType,
        projectName: null,
        durationMonths,
        context
    }));
}

function collectEvidenceEntries(analysis) {
    const tags = analysis?.tags || {};
    const deduped = new Map();

    for (const { key, category } of EVIDENCE_CATEGORY_MAP) {
        const items = Array.isArray(tags[key]) ? tags[key] : [];
        for (const item of items) {
            const name = extractEvidenceName(item);
            const normalizedName = normalizeCatalogName(name);
            if (!normalizedName) continue;
            deduped.set(`${category}:${normalizedName}`, {
                category,
                name,
                normalizedName,
                item
            });
        }
    }

    return [...deduped.values()];
}

export async function persistResumeSkillEvidence({ candidateId, analysis, phase = 'initial' }) {
    const parsedAnalysis = parseAnalysisPayload(analysis);
    const entries = collectEvidenceEntries(parsedAnalysis);
    const normalizedPhase = normalizePhase(phase);

    return transaction(async (client) => {
        await client.query(
            'DELETE FROM skill_evidence WHERE candidate_id = $1 AND analysis_phase = $2',
            [candidateId, normalizedPhase]
        );

        let evidenceCount = 0;
        let occurrenceCount = 0;

        for (const entry of entries) {
            const skillResult = await client.query(
                `INSERT INTO skills (name, normalized_name, category)
                 VALUES ($1, $2, $3)
                 ON CONFLICT (normalized_name, category)
                 DO UPDATE SET name = EXCLUDED.name
                 RETURNING id`,
                [entry.name, entry.normalizedName, entry.category]
            );

            const skillId = skillResult.rows[0]?.id;
            if (!skillId) continue;

            const evidenceResult = await client.query(
                `INSERT INTO skill_evidence (
                    candidate_id,
                    skill_id,
                    analysis_phase,
                    evidence_score,
                    confidence,
                    duration_months,
                    recency_score,
                    depth_score,
                    diversity_score,
                    proof_level,
                    proof_score,
                    occurrence_count_estimate,
                    context_count_estimate,
                    justification
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
                )
                RETURNING id`,
                [
                    candidateId,
                    skillId,
                    normalizedPhase,
                    resolveEvidenceScore(entry.item),
                    resolveConfidence(entry.item),
                    resolveDurationMonths(entry.item),
                    resolveRecencyScore(entry.item),
                    resolveDepthScore(entry.item),
                    resolveDiversityScore(entry.item),
                    resolveProofLevel(entry.item),
                    clampScore(entry.item?.proofScore ?? entry.item?.proof?.proofScore, null),
                    resolveOccurrenceCount(entry.item),
                    resolveContextCount(entry.item),
                    typeof entry.item?.justification === 'string'
                        ? entry.item.justification
                        : (entry.item?.proof?.justification || null)
                ]
            );

            const skillEvidenceId = evidenceResult.rows[0]?.id;
            evidenceCount += 1;

            if (!skillEvidenceId) continue;

            const occurrences = buildOccurrences(entry.item);
            for (const occurrence of occurrences) {
                await client.query(
                    `INSERT INTO skill_occurrences (
                        skill_evidence_id,
                        source_type,
                        project_name,
                        duration_months,
                        context
                    ) VALUES ($1, $2, $3, $4, $5)`,
                    [
                        skillEvidenceId,
                        occurrence.sourceType,
                        occurrence.projectName,
                        occurrence.durationMonths,
                        occurrence.context
                    ]
                );
                occurrenceCount += 1;
            }
        }

        safeLog('info', 'Resume skill evidence persisted', {
            candidateId,
            analysisPhase: normalizedPhase,
            evidenceCount,
            occurrenceCount
        });

        return { evidenceCount, occurrenceCount };
    });
}
