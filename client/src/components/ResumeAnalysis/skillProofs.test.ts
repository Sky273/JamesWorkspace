import { describe, expect, it } from 'vitest';

import {
  extractCurrentSkillProofs,
  extractImprovedSkillProofs,
} from './skillProofs';

describe('skillProofs', () => {
  it('extracts and deduplicates current skills and tools evidence', () => {
    const proofs = extractCurrentSkillProofs({
      id: 'resume-1',
      skillsEvidence: [
        { name: 'Java', evidenceScore: 0.61 },
        { skill: 'Java', proof: { proof_score: 0.82 } },
      ],
      toolsEvidence: [
        { tool: 'Docker', evidence_score: 0.73 },
      ],
    });

    expect(proofs).toEqual([
      expect.objectContaining({ name: 'Docker', category: 'tool', evidenceScore: 0.73 }),
      expect.objectContaining({ name: 'Java', category: 'skill', proofScore: 0.82 }),
    ]);
  });

  it('prefers improved evidence and falls back to current evidence when needed', () => {
    const proofs = extractImprovedSkillProofs({
      id: 'resume-1',
      skillsEvidence: [{ name: 'Java', evidenceScore: 0.51 }],
      improvedSkillsEvidence: [{ name: 'Java', evidenceScore: 0.92 }],
      toolsEvidence: [{ tool: 'Kubernetes', evidence_score: 0.64 }],
    });

    expect(proofs).toEqual([
      expect.objectContaining({ name: 'Java', category: 'skill', evidenceScore: 0.92 }),
      expect.objectContaining({ name: 'Kubernetes', category: 'tool', evidenceScore: 0.64 }),
    ]);
  });

  it('falls back to analysis details and skillsDetailed when flattened evidence is absent', () => {
    const proofs = extractCurrentSkillProofs({
      id: 'resume-1',
      analysisDetails: JSON.stringify({
        tags: {
          skillsEvidence: [{ name: 'Spring', evidenceScore: 0.77 }],
        },
        skillsDetailed: [
          {
            name: 'Docker',
            category: 'tool',
            proof: { proof_score: 0.68 },
          },
        ],
      }),
    });

    expect(proofs).toEqual([
      expect.objectContaining({ name: 'Docker', category: 'tool', proofScore: 0.68 }),
      expect.objectContaining({ name: 'Spring', category: 'skill', evidenceScore: 0.77 }),
    ]);
  });
});
