import { describe, expect, it } from 'vitest';

import {
  formatExperienceConfidence,
  formatExperienceYears,
  formatRecency,
  formatUsageDepth,
  getProofDetailRows,
} from './proof.presentation';

describe('proof.presentation', () => {
  it('formats detailed proof rows with proof and evidence data', () => {
    const rows = getProofDetailRows({
      name: 'Java',
      category: 'skill',
      evidenceScore: 0.84,
      confidence: 0.91,
      proofLevel: 'high',
      proof: {
        occurrenceCountEstimate: 7,
        contextCountEstimate: 3,
        recency: 'recent',
        usageDepth: 'central',
        estimatedExperienceYears: 3.5,
        estimatedExperienceConfidence: 'medium',
        experienceEstimationBasis: 'Java apparait dans plusieurs experiences datees.',
        evidenceSources: ['experience', 'skills_section'],
        justification: 'Java est utilise dans plusieurs experiences.',
      },
      evidence: {
        projects: ['Projet A', 'Projet C'],
      },
    });

    expect(rows).toEqual(
      expect.arrayContaining([
        { label: 'Score de preuve', value: '84%' },
        { label: 'Confiance', value: '91%' },
        { label: 'Experience estimee', value: '3.5 ans' },
        { label: "Confiance d'estimation", value: 'Moyenne' },
        { label: 'Recence', value: 'Recente' },
        { label: "Profondeur d'usage", value: 'Centrale' },
      ]),
    );
  });

  it('derives years from duration months when needed', () => {
    expect(formatExperienceYears({
      name: 'Docker',
      category: 'tool',
      evidence: { durationMonths: 18 },
    })).toBe('1.5 ans');
  });

  it('formats normalized labels for recency and usage depth', () => {
    expect(formatRecency('mid')).toBe('Intermediaire');
    expect(formatUsageDepth('mentioned_only')).toBe('Mention seule');
    expect(formatExperienceConfidence('high')).toBe('Elevee');
  });
});
