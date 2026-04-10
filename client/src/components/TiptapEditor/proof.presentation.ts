import type { SkillProofEntry } from './proof.shared';

function normalizeLower(value: string | undefined): string {
  return String(value || '').trim().toLowerCase();
}

export function formatProofScore(score: number | undefined): string {
  if (typeof score !== 'number' || Number.isNaN(score)) return 'n/a';
  return `${Math.round(score * 100)}%`;
}

export function formatProofLevel(level: string | undefined): string {
  switch (normalizeLower(level)) {
  case 'high':
    return 'Forte';
  case 'medium':
    return 'Moyenne';
  case 'low':
    return 'Faible';
  default:
    return 'Prudente';
  }
}

export function formatRecency(value: string | undefined): string {
  switch (normalizeLower(value)) {
  case 'recent':
    return 'Recente';
  case 'mid':
    return 'Intermediaire';
  case 'old':
    return 'Ancienne';
  case 'unknown':
  default:
    return 'Non estimee';
  }
}

export function formatUsageDepth(value: string | undefined): string {
  switch (normalizeLower(value)) {
  case 'mentioned_only':
    return 'Mention seule';
  case 'contextual':
    return 'Contextuelle';
  case 'substantive':
    return 'Substantielle';
  case 'central':
    return 'Centrale';
  case 'basic':
    return 'Basique';
  case 'intermediate':
    return 'Intermediaire';
  case 'advanced':
    return 'Avancee';
  default:
    return 'Non estimee';
  }
}

export function formatExperienceYears(proof: SkillProofEntry): string {
  const years = proof.proof?.estimatedExperienceYears ?? proof.evidence?.yearsOfExperienceEstimated;
  if (typeof years === 'number' && Number.isFinite(years)) {
    return `${years} an${years > 1 ? 's' : ''}`;
  }

  const months = proof.evidence?.durationMonths;
  if (typeof months === 'number' && Number.isFinite(months)) {
    const derivedYears = Number((months / 12).toFixed(1));
    return `${derivedYears} an${derivedYears > 1 ? 's' : ''}`;
  }

  return 'Non estimee';
}

export function formatExperienceConfidence(value: string | undefined): string {
  switch (normalizeLower(value)) {
  case 'high':
    return 'Elevee';
  case 'medium':
    return 'Moyenne';
  case 'low':
    return 'Faible';
  default:
    return 'Non estimee';
  }
}

export function getProofDetailRows(proof: SkillProofEntry): Array<{ label: string; value: string }> {
  const rows: Array<{ label: string; value: string }> = [
    { label: 'Score de preuve', value: formatProofScore(proof.evidenceScore ?? proof.proofScore) },
    { label: 'Niveau de preuve', value: formatProofLevel(proof.proofLevel || proof.proof?.proofLevel) },
  ];

  if (typeof proof.confidence === 'number') {
    rows.push({ label: 'Confiance', value: formatProofScore(proof.confidence) });
  }

  rows.push({ label: 'Experience estimee', value: formatExperienceYears(proof) });

  if (proof.proof?.estimatedExperienceConfidence) {
    rows.push({
      label: "Confiance d'estimation",
      value: formatExperienceConfidence(proof.proof.estimatedExperienceConfidence),
    });
  }

  const mentions = proof.proof?.occurrenceCountEstimate ?? proof.evidence?.mentions;
  if (typeof mentions === 'number') {
    rows.push({ label: 'Occurrences utiles', value: String(mentions) });
  }

  const contexts = proof.proof?.contextCountEstimate ?? proof.evidence?.contexts;
  if (typeof contexts === 'number') {
    rows.push({ label: "Contextes d'usage", value: String(contexts) });
  }

  rows.push({
    label: 'Recence',
    value: formatRecency(proof.proof?.recency || proof.evidence?.recency),
  });

  rows.push({
    label: "Profondeur d'usage",
    value: formatUsageDepth(proof.proof?.usageDepth || proof.evidence?.depth),
  });

  const sources = proof.proof?.evidenceSources?.length
    ? proof.proof.evidenceSources
    : proof.evidence?.sourceTypes;
  if (sources?.length) {
    rows.push({ label: 'Sources', value: sources.join(', ') });
  }

  if (proof.evidence?.projects?.length) {
    rows.push({ label: 'Projets', value: proof.evidence.projects.join(', ') });
  }

  if (proof.proof?.experienceEstimationBasis) {
    rows.push({
      label: "Base d'estimation",
      value: proof.proof.experienceEstimationBasis,
    });
  }

  const justification = proof.justification || proof.proof?.justification;
  if (justification) {
    rows.push({ label: 'Justification', value: justification });
  }

  return rows;
}
