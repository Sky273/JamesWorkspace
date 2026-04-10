import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockTransaction = vi.fn();
const mockSafeLog = vi.fn();

vi.mock('../../utils/postgresHelpers.js', () => ({
    transaction: (...args) => mockTransaction(...args)
}));

vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: (...args) => mockSafeLog(...args)
}));

import { persistResumeSkillEvidence } from '../../services/skillEvidence.service.js';

describe('skillEvidence.service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('persists evidence rows and occurrences for multiple categories', async () => {
        const clientQuery = vi.fn()
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({ rows: [{ id: 'skill-java' }] })
            .mockResolvedValueOnce({ rows: [{ id: 'evidence-java' }] })
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({ rows: [{ id: 'tool-docker' }] })
            .mockResolvedValueOnce({ rows: [{ id: 'evidence-docker' }] })
            .mockResolvedValueOnce({ rows: [] });

        mockTransaction.mockImplementation(async (callback) => callback({ query: clientQuery }));

        const result = await persistResumeSkillEvidence({
            candidateId: 'resume-1',
            phase: 'initial',
            analysis: {
                tags: {
                    skillsEvidence: [{
                        name: 'Java',
                        confidence: 0.91,
                        evidenceScore: 0.82,
                        proof: {
                            proofLevel: 'high',
                            proofScore: 0.84,
                            evidenceSources: ['experience', 'skills_section'],
                            occurrenceCountEstimate: 7,
                            contextCountEstimate: 3,
                            recency: 'recent',
                            usageDepth: 'central',
                            justification: 'Utilisé dans plusieurs expériences backend.'
                        },
                        evidence: {
                            yearsOfExperienceEstimated: 5,
                            projects: ['Projet A', 'Projet C']
                        }
                    }],
                    toolsEvidence: [{
                        name: 'Docker',
                        confidence: 0.88,
                        proof: {
                            evidenceSources: ['experience'],
                            contextCountEstimate: 2,
                            recency: 'recent',
                            usageDepth: 'substantive',
                            justification: 'Docker est lié à des contextes de déploiement.'
                        },
                        evidence: {
                            yearsOfExperienceEstimated: 3
                        }
                    }]
                }
            }
        });

        expect(result).toEqual({
            evidenceCount: 2,
            occurrenceCount: 3
        });
        expect(clientQuery).toHaveBeenCalledWith(
            'DELETE FROM skill_evidence WHERE candidate_id = $1 AND analysis_phase = $2',
            ['resume-1', 'initial']
        );
        expect(clientQuery).toHaveBeenCalledWith(
            expect.stringContaining('INSERT INTO skills'),
            ['Java', 'java', 'skill']
        );
        expect(clientQuery).toHaveBeenCalledWith(
            expect.stringContaining('INSERT INTO skills'),
            ['Docker', 'docker', 'tool']
        );
        expect(clientQuery).toHaveBeenCalledWith(
            expect.stringContaining('INSERT INTO skill_occurrences'),
            ['evidence-java', 'experience', 'Projet A', 60, 'Utilisé dans plusieurs expériences backend.']
        );
    });

    it('returns zero counts when there is no usable evidence', async () => {
        const clientQuery = vi.fn().mockResolvedValue({ rows: [] });
        mockTransaction.mockImplementation(async (callback) => callback({ query: clientQuery }));

        const result = await persistResumeSkillEvidence({
            candidateId: 'resume-1',
            analysis: { tags: { skillsEvidence: [{ name: '   ' }] } }
        });

        expect(result).toEqual({
            evidenceCount: 0,
            occurrenceCount: 0
        });
        expect(clientQuery).toHaveBeenCalledTimes(1);
    });
});
