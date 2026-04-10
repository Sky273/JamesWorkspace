export interface SkillProofEvidence {
  mentions?: number;
  contexts?: number;
  durationMonths?: number;
  yearsOfExperienceEstimated?: number;
  recency?: string;
  depth?: string;
  sourceTypes?: string[];
  projects?: string[];
}

export interface SkillProofMeta {
  proofLevel?: string;
  proofScore?: number;
  evidenceSources?: string[];
  occurrenceCountEstimate?: number;
  contextCountEstimate?: number;
  recency?: string;
  usageDepth?: string;
  estimatedExperienceYears?: number;
  estimatedExperienceConfidence?: string;
  experienceEstimationBasis?: string;
  justification?: string;
}

export interface SkillProofEntry {
  name: string;
  category: 'skill' | 'tool' | 'soft_skill';
  evidenceScore?: number;
  confidence?: number;
  proofLevel?: string;
  proofScore?: number;
  justification?: string;
  evidence?: SkillProofEvidence;
  proof?: SkillProofMeta;
}

function clampScore(value: unknown): number | null {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Math.max(0, Math.min(1, numeric));
}

function normalizeTextValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => normalizeTextValue(item)).filter(Boolean))];
}

export function normalizeSkillProofEntry(
  value: unknown,
  category: SkillProofEntry['category'],
): SkillProofEntry | null {
  if (!value || typeof value !== 'object') return null;

  const record = value as Record<string, unknown>;
  const name = normalizeTextValue(record.name || record.skill || record.tool);
  if (!name) return null;

  const evidence = (record.evidence && typeof record.evidence === 'object'
    ? record.evidence
    : {}) as Record<string, unknown>;
  const proof = (record.proof && typeof record.proof === 'object'
    ? record.proof
    : {}) as Record<string, unknown>;

  return {
    name,
    category,
    evidenceScore: clampScore(record.evidenceScore ?? record.evidence_score) ?? undefined,
    confidence: clampScore(record.confidence) ?? undefined,
    proofLevel: normalizeTextValue(record.proofLevel || proof.proofLevel || proof.proof_level) || undefined,
    proofScore: clampScore(record.proofScore ?? proof.proofScore ?? proof.proof_score) ?? undefined,
    justification:
      normalizeTextValue(record.justification || proof.justification) || undefined,
    evidence: {
      mentions: Number.isFinite(Number(evidence.mentions)) ? Number(evidence.mentions) : undefined,
      contexts: Number.isFinite(Number(evidence.contexts)) ? Number(evidence.contexts) : undefined,
      durationMonths: Number.isFinite(Number(evidence.durationMonths ?? evidence.duration_months))
        ? Number(evidence.durationMonths ?? evidence.duration_months)
        : undefined,
      yearsOfExperienceEstimated: Number.isFinite(Number(
        evidence.yearsOfExperienceEstimated
        ?? evidence.years_of_experience_estimated
        ?? proof.estimatedExperienceYears
        ?? proof.estimated_experience_years,
      ))
        ? Number(
          evidence.yearsOfExperienceEstimated
          ?? evidence.years_of_experience_estimated
          ?? proof.estimatedExperienceYears
          ?? proof.estimated_experience_years,
        )
        : Number.isFinite(Number(evidence.durationMonths ?? evidence.duration_months))
          ? Number((Number(evidence.durationMonths ?? evidence.duration_months) / 12).toFixed(1))
        : undefined,
      recency: normalizeTextValue(evidence.recency) || undefined,
      depth: normalizeTextValue(evidence.depth) || undefined,
      sourceTypes: normalizeStringArray(evidence.sourceTypes ?? evidence.source_types),
      projects: normalizeStringArray(evidence.projects),
    },
    proof: {
      proofLevel: normalizeTextValue(proof.proofLevel || proof.proof_level) || undefined,
      proofScore: clampScore(proof.proofScore ?? proof.proof_score) ?? undefined,
      evidenceSources: normalizeStringArray(proof.evidenceSources ?? proof.evidence_sources),
      occurrenceCountEstimate: Number.isFinite(Number(proof.occurrenceCountEstimate ?? proof.occurrence_count_estimate))
        ? Number(proof.occurrenceCountEstimate ?? proof.occurrence_count_estimate)
        : undefined,
      contextCountEstimate: Number.isFinite(Number(proof.contextCountEstimate ?? proof.context_count_estimate))
        ? Number(proof.contextCountEstimate ?? proof.context_count_estimate)
        : undefined,
      recency: normalizeTextValue(proof.recency) || undefined,
      usageDepth: normalizeTextValue(proof.usageDepth ?? proof.usage_depth) || undefined,
      estimatedExperienceYears: Number.isFinite(Number(proof.estimatedExperienceYears ?? proof.estimated_experience_years))
        ? Number(proof.estimatedExperienceYears ?? proof.estimated_experience_years)
        : undefined,
      estimatedExperienceConfidence: normalizeTextValue(
        proof.estimatedExperienceConfidence ?? proof.estimated_experience_confidence,
      ) || undefined,
      experienceEstimationBasis: normalizeTextValue(
        proof.experienceEstimationBasis ?? proof.experience_estimation_basis,
      ) || undefined,
      justification: normalizeTextValue(proof.justification) || undefined,
    },
  };
}

export function getSkillProofCount(proofs: SkillProofEntry[]): number {
  return proofs.filter((proof) => normalizeTextValue(proof.name)).length;
}
