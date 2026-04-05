/**
 * Tests for OpenAI Mission Operations
 * matchResumeWithMission, adaptResumeToMission, normalizeMatchAnalysis
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn()
}));

vi.mock('../../services/llmProvider.service.js', () => ({
    callBusinessChatCompletion: vi.fn()
}));

vi.mock('../../services/metrics.service.js', () => ({
    __esModule: true,
    default: {
        trackAdaptationActivity: vi.fn()
    },
    metrics: {
        trackAdaptationActivity: vi.fn()
    },
    buildLLMMetricLabel: vi.fn((provider, model = '') => model ? `${provider}:${model}` : provider)
}));

vi.mock('../../services/llmConfiguration.service.js', () => ({
    isLikelyAnthropicModel: vi.fn((model) => /^claude/i.test(String(model || ''))),
    isLikelyDeepSeekModel: vi.fn((model) => /^deepseek/i.test(String(model || ''))),
    isLikelyGlmModel: vi.fn((model) => /^glm/i.test(String(model || ''))),
    isLikelyMiniMaxModel: vi.fn((model) => /^minimax/i.test(String(model || '')))
}));

import { callBusinessChatCompletion } from '../../services/llmProvider.service.js';
import { metrics } from '../../services/metrics.service.js';
import { matchResumeWithMission, adaptResumeToMission } from '../../services/openai/missionOperations.js';

describe('OpenAI Mission Operations', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('matchResumeWithMission', () => {
        it('should return normalized match analysis', async () => {
            callBusinessChatCompletion.mockResolvedValueOnce({
                choices: [{
                    message: {
                        content: JSON.stringify({
                            matchScore: 85,
                            strengths: ['Good skills'],
                            gaps: ['Missing cert'],
                            keywordMatches: ['react'],
                            missingKeywords: ['angular']
                        })
                    }
                }]
            });

            const result = await matchResumeWithMission(
                'resume text', 'Dev Job', 'Job content', 'gpt-4o',
                'Match {RESUME_TEXT} with {MISSION_TITLE} and {MISSION_CONTENT}'
            );

            expect(result.matchScore).toBe(85);
            expect(result.strengths).toContain('Good skills');
        });

        it('should normalize structured strengths to string array', async () => {
            callBusinessChatCompletion.mockResolvedValueOnce({
                choices: [{
                    message: {
                        content: JSON.stringify({
                            matchScore: '75%',
                            strengths: [
                                { item: 'React', evidence: '5 years', coverage: 'explicit' },
                                { item: 'Node.js', evidence: '3 years', coverage: 'partial' }
                            ],
                            gaps: [
                                { item: 'Angular', reason: 'Not mentioned', severity: 'high' }
                            ]
                        })
                    }
                }]
            });

            const result = await matchResumeWithMission(
                'resume', 'Job', 'Content', 'gpt-4o', '{RESUME_TEXT}{MISSION_TITLE}{MISSION_CONTENT}'
            );

            expect(result.matchScore).toBe(75);
            expect(result._strengthsDetailed).toHaveLength(2);
            expect(result.strengths[0]).toContain('React');
            expect(result._gapsDetailed).toHaveLength(1);
            expect(result.gaps[0]).toContain('Angular');
        });

        it('should normalize keywordAnalysis to legacy format', async () => {
            callBusinessChatCompletion.mockResolvedValueOnce({
                choices: [{
                    message: {
                        content: JSON.stringify({
                            matchScore: 70,
                            strengths: [],
                            gaps: [],
                            keywordAnalysis: {
                                matchedKeywords: ['react', 'node'],
                                partialKeywords: ['typescript'],
                                missingKeywords: ['angular']
                            }
                        })
                    }
                }]
            });

            const result = await matchResumeWithMission(
                'resume', 'Job', 'Content', 'gpt-4o', '{RESUME_TEXT}{MISSION_TITLE}{MISSION_CONTENT}'
            );

            expect(result.keywordMatches).toContain('react');
            expect(result.keywordMatches).toContain('~typescript');
            expect(result.missingKeywords).toContain('angular');
        });

        it('should normalize malformed match analysis fields', async () => {
            callBusinessChatCompletion.mockResolvedValueOnce({
                choices: [{
                    message: {
                        content: JSON.stringify({
                            matchScore: '82%',
                            strengths: 'React; Node.js',
                            gaps: { first: 'AWS' },
                            keywordAnalysis: {
                                matchedKeywords: 'react, node',
                                partialKeywords: { first: 'typescript' },
                                missingKeywords: ['aws']
                            }
                        })
                    }
                }]
            });

            const result = await matchResumeWithMission(
                'resume', 'Job', 'Content', 'gpt-4o', '{RESUME_TEXT}{MISSION_TITLE}{MISSION_CONTENT}'
            );

            expect(result.matchScore).toBe(82);
            expect(result.strengths).toEqual(['React', 'Node.js']);
            expect(result.gaps).toEqual(['AWS']);
            expect(result.keywordMatches).toContain('react');
            expect(result.keywordMatches).toContain('~typescript');
            expect(result.missingKeywords).toContain('aws');
        });

        it('should throw on invalid JSON response', async () => {
            callBusinessChatCompletion.mockResolvedValueOnce({
                choices: [{ message: { content: 'not json' } }]
            });

            await expect(matchResumeWithMission(
                'resume', 'Job', 'Content', 'gpt-4o', '{RESUME_TEXT}{MISSION_TITLE}{MISSION_CONTENT}'
            )).rejects.toThrow();
        });

        it('should retry once when the matching JSON is truncated and succeed on compact retry', async () => {
            callBusinessChatCompletion
                .mockResolvedValueOnce({
                    choices: [{
                        message: {
                            content: '{"matchScore":65,"summary":{"overallAssessment":"truncated'
                        }
                    }]
                })
                .mockResolvedValueOnce({
                    choices: [{
                        message: {
                            content: JSON.stringify({
                                matchScore: 65,
                                strengths: ['Backlog management'],
                                gaps: ['Senior leadership'],
                                keywordAnalysis: {
                                    matchedKeywords: ['product owner'],
                                    partialKeywords: [],
                                    missingKeywords: ['roadmap']
                                }
                            })
                        }
                    }]
                });

            const result = await matchResumeWithMission(
                'resume', 'Job', 'Content', 'gpt-4o', '{RESUME_TEXT}{MISSION_TITLE}{MISSION_CONTENT}'
            );

            expect(result.matchScore).toBe(65);
            expect(result.strengths).toContain('Backlog management');
            expect(callBusinessChatCompletion).toHaveBeenCalledTimes(2);
            expect(metrics.trackAdaptationActivity).toHaveBeenCalledWith(expect.objectContaining({
                metadata: expect.objectContaining({ source: 'match-analysis-retry' })
            }));
        });
    });

    describe('adaptResumeToMission', () => {
        it('should return adaptedText from new format (improvedText)', async () => {
            callBusinessChatCompletion.mockResolvedValueOnce({
                choices: [{
                    message: {
                        content: JSON.stringify({
                            improvedText: '<p>Adapted CV</p>',
                            summary: { title: 'Dev Senior', targetRole: 'Lead' }
                        })
                    }
                }]
            });

            const result = await adaptResumeToMission({
                resumeText: 'text', missionTitle: 'Job', missionContent: 'content',
                matchAnalysis: {}, model: 'gpt-4o',
                adaptationPrompt: '{RESUME_TEXT}{MISSION_TITLE}{MISSION_CONTENT}{MATCH_ANALYSIS_JSON}'
            });

            expect(result.adaptedText).toBe('<p>Adapted CV</p>');
            expect(result.adaptedTitle).toBe('Dev Senior');
            expect(metrics.trackAdaptationActivity).toHaveBeenCalledWith(expect.objectContaining({
                successfulRuns: 1,
                structuredRuns: 1
            }));
        });

        it('should return adaptedText from legacy format (targetedTitle)', async () => {
            callBusinessChatCompletion.mockResolvedValueOnce({
                choices: [{
                    message: {
                        content: JSON.stringify({
                            targetedTitle: 'Dev Lead',
                            professionalSummary: 'Experienced dev',
                            keySkills: ['React', 'Node']
                        })
                    }
                }]
            });

            const result = await adaptResumeToMission({
                resumeText: 'text', missionTitle: 'Job', missionContent: 'content',
                matchAnalysis: {}, model: 'gpt-4o',
                adaptationPrompt: '{RESUME_TEXT}{MISSION_TITLE}{MISSION_CONTENT}{MATCH_ANALYSIS_JSON}'
            });

            expect(result.adaptedTitle).toBe('Dev Lead');
            expect(result.adaptedText).toContain('Experienced dev');
            expect(result.structuredData).toBeDefined();
        });

        it('should normalize malformed adaptation payload fields', async () => {
            callBusinessChatCompletion.mockResolvedValueOnce({
                choices: [{
                    message: {
                        content: JSON.stringify({
                            improvedText: '<p>Adapted CV</p>',
                            summary: {
                                title: 42,
                                targetRole: 'Delivery Lead'
                            },
                            keySkills: 'React, TypeScript',
                            toolsAndTechnologies: { one: 'Docker', two: 'AWS' },
                            certifications: 'AWS Solution Architect',
                            languages: { first: 'French', second: 'English' }
                        })
                    }
                }]
            });

            const result = await adaptResumeToMission({
                resumeText: 'text', missionTitle: 'Job', missionContent: 'content',
                matchAnalysis: {}, model: 'gpt-4o',
                adaptationPrompt: '{RESUME_TEXT}{MISSION_TITLE}{MISSION_CONTENT}{MATCH_ANALYSIS_JSON}'
            });

            expect(result.adaptedText).toBe('<p>Adapted CV</p>');
            expect(result.adaptedTitle).toBe('Delivery Lead');
            expect(result.structuredData.keySkills).toEqual(['React', 'TypeScript']);
            expect(result.structuredData.toolsAndTechnologies).toEqual(['Docker', 'AWS']);
            expect(result.structuredData.certifications).toEqual(['AWS Solution Architect']);
            expect(result.structuredData.languages).toEqual(['French', 'English']);
        });

        it('should handle non-JSON response as plain text', async () => {
            callBusinessChatCompletion.mockResolvedValueOnce({
                choices: [{ message: { content: '<p>Plain HTML</p>' } }]
            });

            const result = await adaptResumeToMission({
                resumeText: 'text', missionTitle: 'Job', missionContent: 'content',
                matchAnalysis: {}, model: 'gpt-4o',
                adaptationPrompt: '{RESUME_TEXT}{MISSION_TITLE}{MISSION_CONTENT}{MATCH_ANALYSIS_JSON}'
            });

            expect(result.adaptedText).toContain('Plain HTML');
            expect(result.adaptedTitle).toBeNull();
        });
    });
});
