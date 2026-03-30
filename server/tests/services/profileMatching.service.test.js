/**
 * Tests for Profile Matching Service
 * Tests the LLM-based intelligent scoring and text-based matching functions
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock logger
vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn(),
    createModuleLogger: () => ({
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn()
    })
}));

// Mock postgres helpers
vi.mock('../../utils/postgresHelpers.js', () => ({
    selectWithTimeout: vi.fn(),
    findWithTimeout: vi.fn(),
    updateWithTimeout: vi.fn()
}));

// Mock OpenAI service
vi.mock('../../services/llmProvider.service.js', () => ({
    callBusinessChatCompletion: vi.fn()
}));

// Mock settings service
vi.mock('../../services/settings.service.js', () => ({
    getLLMSettings: vi.fn()
}));

// Mock metrics service
vi.mock('../../services/metrics.service.js', () => ({
    __esModule: true,
    default: {
        trackProfileMatchingActivity: vi.fn()
    },
    buildLLMMetricLabel: vi.fn((provider, model = '') => model ? `${provider}:${model}` : provider)
}));

// Mock prompts
vi.mock('../../config/prompts.backend.js', () => ({
    MISSION_KEYWORDS_EXTRACTION_PROMPT: 'mock extraction prompt {MISSION_TITLE} {MISSION_CONTENT}',
    DETAILED_PROFILE_ANALYSIS_PROMPT: 'mock analysis prompt',
    TITLE_MATCHING_REFINEMENT_PROMPT: 'mock title prompt',
    BATCH_PROFILE_SCORING_PROMPT: 'mock batch scoring prompt {MISSION_TITLE} {MISSION_SKILLS} {MISSION_TOOLS} {MISSION_INDUSTRIES} {MISSION_SOFT_SKILLS} {EXPERIENCE_LEVEL} {CANDIDATES_JSON}'
}));

// Import mocked modules
import { selectWithTimeout, findWithTimeout, updateWithTimeout } from '../../utils/postgresHelpers.js';
import { callBusinessChatCompletion } from '../../services/llmProvider.service.js';
import { getLLMSettings } from '../../services/settings.service.js';
import metrics from '../../services/metrics.service.js';

// Import the service (after mocks are set up)
import profileMatchingService from '../../services/profileMatching.service.js';

// Extract functions from default export
const { findMatchingProfiles, DEFAULT_WEIGHTS } = profileMatchingService;
const { analyzeProfileForMission } = profileMatchingService;

// ============================================
// TEST DATA
// ============================================

const mockMissionKeywords = {
    skills: ['React', 'TypeScript', 'Node.js'],
    tools: ['Git', 'Docker', 'AWS'],
    industries: ['Banque', 'Finance'],
    softSkills: ['Communication', 'Leadership'],
    experienceLevel: 'senior'
};

const mockMissionRecord = {
    id: 'mission-1',
    title: 'Développeur Full Stack Senior',
    content: 'Nous recherchons un développeur senior React/Node.js pour notre équipe bancaire.',
    keywords: JSON.stringify(mockMissionKeywords)
};

const mockResumeRecords = [
    {
        id: 'resume-1',
        name: 'Jean Dupont',
        title: 'Lead Developer React',
        status: 'improved',
        global_rating: 85,
        firm_id: 'firm-1',
        skills: JSON.stringify(['React', 'TypeScript', 'JavaScript', 'Node.js']),
        tools: JSON.stringify(['Git', 'Docker', 'Jenkins']),
        industries: JSON.stringify(['Banque', 'Assurance']),
        soft_skills: JSON.stringify(['Communication', 'Travail en équipe']),
        firm_name: 'TestFirm',
        created_at: new Date().toISOString()
    },
    {
        id: 'resume-2',
        name: 'Marie Martin',
        title: 'Développeur Java Backend',
        status: 'analyzed',
        global_rating: 70,
        firm_id: 'firm-1',
        skills: JSON.stringify(['Java', 'Spring', 'SQL']),
        tools: JSON.stringify(['Git', 'Maven']),
        industries: JSON.stringify(['Retail']),
        soft_skills: JSON.stringify(['Autonomie']),
        firm_name: 'TestFirm',
        created_at: new Date().toISOString()
    },
    {
        id: 'resume-3',
        name: 'Pierre Bernard',
        title: 'Architecte Cloud AWS',
        status: 'improved',
        global_rating: 90,
        firm_id: 'firm-1',
        skills: JSON.stringify(['AWS', 'Terraform', 'Python']),
        tools: JSON.stringify(['AWS', 'Docker', 'Kubernetes']),
        industries: JSON.stringify(['Finance', 'Banque']),
        soft_skills: JSON.stringify(['Leadership', 'Communication']),
        firm_name: 'TestFirm',
        created_at: new Date().toISOString()
    }
];

const mockLLMScoringResponse = {
    choices: [{
        message: {
            content: JSON.stringify({
                scores: {
                    'resume-1': {
                        score: 88,
                        confidence: 'high',
                        reason: 'Profil senior React parfaitement aligné avec les besoins. Expérience bancaire valorisante.',
                        keyStrengths: ['Maîtrise React/TypeScript', 'Expérience bancaire'],
                        keyGaps: ['AWS non mentionné']
                    },
                    'resume-2': {
                        score: 35,
                        confidence: 'high',
                        reason: 'Profil Java backend, pas de compétences React/Node demandées.',
                        keyStrengths: ['Solide en backend'],
                        keyGaps: ['Pas de React', 'Pas de Node.js', 'Secteur différent']
                    },
                    'resume-3': {
                        score: 65,
                        confidence: 'medium',
                        reason: 'Compétences cloud AWS pertinentes mais profil orienté infra plutôt que dev.',
                        keyStrengths: ['Expert AWS', 'Secteur bancaire'],
                        keyGaps: ['Pas de React', 'Profil infra vs dev']
                    }
                }
            })
        }
    }]
};

const mockDetailedAnalysisResponse = {
    choices: [{
        message: {
            content: JSON.stringify({
                overallScore: 82,
                verdict: 'Bon match',
                summary: 'Très bon alignement global.',
                strengths: [{ category: 'skills', item: 'React', explanation: 'Compétence clé présente' }],
                gaps: [{ category: 'tools', item: 'AWS', severity: 'important', explanation: 'Outil peu démontré' }],
                recommendations: [{ type: 'highlight', suggestion: 'Mettre en avant les projets React' }],
                interviewQuestions: ['Décrivez un projet React complexe.'],
                riskAssessment: { level: 'medium', factors: ['AWS peu détaillé'] }
            })
        }
    }]
};

// ============================================
// UNIT TESTS
// ============================================

describe('Profile Matching Service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        
        // Default mock implementations
        getLLMSettings.mockResolvedValue({ llmModel: 'gpt-4o' });
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    // ============================================
    // findMatchingProfiles tests (LLM-only scoring)
    // ============================================
    
    describe('findMatchingProfiles', () => {
        beforeEach(() => {
            findWithTimeout.mockResolvedValue(mockMissionRecord);
            selectWithTimeout.mockResolvedValue(mockResumeRecords);
            callBusinessChatCompletion.mockResolvedValue(mockLLMScoringResponse);
        });

        it('should find and score profiles using LLM', async () => {
            const result = await findMatchingProfiles('mission-1', {
                limit: 10,
                minScore: 0
            });
            
            expect(result.missionId).toBe('mission-1');
            expect(result.missionTitle).toBe('Développeur Full Stack Senior');
            expect(result.profiles).toHaveLength(3);
            expect(result.llmScoringApplied).toBe(true);
            
            // Check that profiles are sorted by score (highest first)
            expect(result.profiles[0].matchScore).toBeGreaterThanOrEqual(result.profiles[1].matchScore);
        });

        it('should include LLM scoring details in results', async () => {
            const result = await findMatchingProfiles('mission-1', { limit: 10 });
            
            const topProfile = result.profiles.find(p => p.resumeId === 'resume-1');
            
            expect(topProfile.llmScored).toBe(true);
            expect(topProfile.confidence).toBe('high');
            expect(topProfile.reason).toContain('React');
            expect(topProfile.keyStrengths).toContain('Maîtrise React/TypeScript');
            expect(topProfile.keyGaps).toContain('AWS non mentionné');
        });

        it('should return empty profiles when LLM fails', async () => {
            callBusinessChatCompletion.mockRejectedValue(new Error('LLM API error'));
            
            const result = await findMatchingProfiles('mission-1', { limit: 10 });
            
            expect(result.llmScoringApplied).toBe(false);
            expect(result.llmScoringFailed).toBe(true);
            // No fallback - LLM is the only scoring source
            expect(result.profiles).toHaveLength(0);
        });

        it('should return empty profiles when LLM model is not configured', async () => {
            getLLMSettings.mockResolvedValue({ llmModel: null });
            
            const result = await findMatchingProfiles('mission-1', { limit: 10 });
            
            expect(result.llmScoringApplied).toBe(false);
            expect(result.llmScoringFailed).toBe(true);
            expect(result.profiles).toHaveLength(0);
        });

        it('should respect minScore filter', async () => {
            const result = await findMatchingProfiles('mission-1', {
                limit: 10,
                minScore: 50
            });
            
            // All returned profiles should have score >= 50
            result.profiles.forEach(profile => {
                expect(profile.matchScore).toBeGreaterThanOrEqual(50);
            });
        });

        it('should respect limit parameter', async () => {
            const result = await findMatchingProfiles('mission-1', {
                limit: 2,
                minScore: 0
            });
            
            expect(result.profiles.length).toBeLessThanOrEqual(2);
        });

        it('should throw error when mission not found', async () => {
            findWithTimeout.mockResolvedValue(null);
            
            await expect(findMatchingProfiles('non-existent')).rejects.toThrow('Mission not found');
        });

        it('should use cached mission keywords when available', async () => {
            const result = await findMatchingProfiles('mission-1', { limit: 10 });
            
            // Mission keywords should come from cached JSON in mission record
            expect(result.missionKeywords).toEqual(mockMissionKeywords);
            
            // Should not call LLM for keyword extraction (only for scoring)
            const extractionCalls = callBusinessChatCompletion.mock.calls.filter(
                call => call[0]?.operationType === 'Mission Keywords Extraction'
            );
            expect(extractionCalls).toHaveLength(0);
        });

        it('should not request responseFormat for batch profile scoring with MiniMax', async () => {
            getLLMSettings.mockResolvedValue({ llmModel: 'MiniMax-M2.7', llmProvider: 'minimax' });

            await findMatchingProfiles('mission-1', { limit: 10 });

            const scoringCall = callBusinessChatCompletion.mock.calls.find(
                call => call[0]?.operationType === 'Batch Profile Scoring'
            );

            expect(scoringCall).toBeDefined();
            expect(scoringCall[0].responseFormat).toBeUndefined();
        });

        it('should request responseFormat for batch profile scoring with DeepSeek', async () => {
            getLLMSettings.mockResolvedValue({ llmModel: 'deepseek-reasoner', llmProvider: 'deepseek' });

            await findMatchingProfiles('mission-1', { limit: 10 });

            const scoringCall = callBusinessChatCompletion.mock.calls.find(
                call => call[0]?.operationType === 'Batch Profile Scoring'
            );

            expect(scoringCall).toBeDefined();
            expect(scoringCall[0].responseFormat).toEqual({ type: 'json_object' });
        });

        it('should filter resumes by firm_id when a firm is provided', async () => {
            await findMatchingProfiles('mission-1', {
                limit: 10,
                firm: 'firm-1'
            });

            expect(selectWithTimeout).toHaveBeenCalledWith('resumes', expect.objectContaining({
                rawQuery: expect.stringContaining('r.firm_id = $1'),
                rawParams: ['firm-1']
            }));
        });

        it('should return an empty result without LLM failure when no resumes match filters', async () => {
            selectWithTimeout.mockResolvedValue([]);

            const result = await findMatchingProfiles('mission-1', {
                limit: 10,
                firm: 'firm-1'
            });

            expect(result.totalResumesScanned).toBe(0);
            expect(result.profiles).toEqual([]);
            expect(result.llmScoringApplied).toBe(false);
            expect(result.llmScoringFailed).toBe(false);
            expect(callBusinessChatCompletion).not.toHaveBeenCalled();
        });

        it('should extract keywords via LLM when not cached', async () => {
            const missionWithoutKeywords = { ...mockMissionRecord, keywords: null };
            findWithTimeout.mockResolvedValue(missionWithoutKeywords);
            
            // Mock keyword extraction response
            const extractionResponse = {
                choices: [{
                    message: {
                        content: JSON.stringify(mockMissionKeywords)
                    }
                }]
            };
            
            callBusinessChatCompletion
                .mockResolvedValueOnce(extractionResponse) // First call: extraction
                .mockResolvedValue(mockLLMScoringResponse); // Subsequent calls: scoring
            
            const result = await findMatchingProfiles('mission-1', { limit: 10 });
            
            expect(result.missionKeywords).toBeDefined();
            expect(updateWithTimeout).toHaveBeenCalled(); // Should cache keywords
        });
    });

    // ============================================
    // LLM Batch Scoring tests
    // ============================================
    
    describe('LLM Batch Scoring', () => {
        beforeEach(() => {
            findWithTimeout.mockResolvedValue(mockMissionRecord);
            selectWithTimeout.mockResolvedValue(mockResumeRecords);
        });

        it('should process profiles in batches', async () => {
            // Create 25 mock resumes to test batching (batch size is 12)
            const manyResumes = Array.from({ length: 25 }, (_, i) => ({
                ...mockResumeRecords[0],
                id: `resume-${i}`,
                name: `Candidate ${i}`
            }));
            
            selectWithTimeout.mockResolvedValue(manyResumes);
            
            // Mock responses for multiple batches
            callBusinessChatCompletion.mockResolvedValue({
                choices: [{
                    message: {
                        content: JSON.stringify({
                            scores: Object.fromEntries(
                                manyResumes.slice(0, 12).map(r => [r.id, { score: 75, confidence: 'medium', reason: 'Test' }])
                            )
                        })
                    }
                }]
            });
            
            await findMatchingProfiles('mission-1', { limit: 25 });
            
            // Should have called LLM multiple times for batches
            // (exact count depends on pre-filtering)
            expect(callBusinessChatCompletion).toHaveBeenCalled();
            expect(metrics.trackProfileMatchingActivity).toHaveBeenCalledWith(expect.objectContaining({
                event: 'search',
                profilesRequested: 25
            }));
        });

        it('should prefilter very large candidate sets before sending them to the LLM', async () => {
            const manyResumes = Array.from({ length: 180 }, (_, i) => ({
                ...mockResumeRecords[0],
                id: `resume-${i}`,
                name: `Candidate ${i}`,
                global_rating: 100 - (i % 20),
                skills: JSON.stringify(i < 120 ? ['React', 'TypeScript', 'Node.js'] : ['Cobol']),
                tools: JSON.stringify(i < 120 ? ['Git', 'Docker'] : ['SVN']),
                industries: JSON.stringify(i < 120 ? ['Banque'] : ['Retail']),
                soft_skills: JSON.stringify(['Communication'])
            }));

            selectWithTimeout.mockResolvedValue(manyResumes);
            callBusinessChatCompletion.mockResolvedValue({
                choices: [{
                    message: {
                        content: JSON.stringify({
                            scores: Object.fromEntries(
                                manyResumes.slice(0, 100).map(r => [r.id, { score: 72, confidence: 'medium', reason: 'Test' }])
                            )
                        })
                    }
                }]
            });

            await findMatchingProfiles('mission-1', { limit: 0 });

            const llmPayload = callBusinessChatCompletion.mock.calls[0][0];
            const serializedCandidates = llmPayload.messages[1].content;
            const candidateIdCount = (serializedCandidates.match(/"id":/g) || []).length;

            expect(candidateIdCount).toBeLessThanOrEqual(100);
        });

        it('should send all in-scope resumes to the batching pipeline when the prefilter cap is disabled', async () => {
            const originalPrefilterCap = process.env.PROFILE_MATCHING_LLM_PREFILTER_CAP;
            process.env.PROFILE_MATCHING_LLM_PREFILTER_CAP = '0';
            vi.resetModules();

            try {
                const refreshedService = await import('../../services/profileMatching.service.js');
                const refreshedFindMatchingProfiles = refreshedService.default.findMatchingProfiles;

                const manyResumes = Array.from({ length: 150 }, (_, i) => ({
                    ...mockResumeRecords[0],
                    id: `resume-${i}`,
                    name: `Candidate ${i}`
                }));

                findWithTimeout.mockResolvedValue(mockMissionRecord);
                selectWithTimeout.mockResolvedValue(manyResumes);
                callBusinessChatCompletion.mockResolvedValue({
                    choices: [{
                        message: {
                            content: JSON.stringify({
                                scores: Object.fromEntries(
                                    manyResumes.map(r => [r.id, { score: 72, confidence: 'medium', reason: 'Test' }])
                                )
                            })
                        }
                    }]
                });

                const result = await refreshedFindMatchingProfiles('mission-1', { limit: 0 });
                const totalCandidatesSent = callBusinessChatCompletion.mock.calls.reduce((total, call) => {
                    const llmPayload = call[0];
                    const serializedCandidates = llmPayload.messages[1].content;
                    return total + (serializedCandidates.match(/"id":/g) || []).length;
                }, 0);

                expect(result.totalResumesScanned).toBe(150);
                expect(result.profilesSentToLlm).toBe(150);
                expect(totalCandidatesSent).toBe(150);
                expect(callBusinessChatCompletion.mock.calls.length).toBeGreaterThan(1);
            } finally {
                if (originalPrefilterCap === undefined) {
                    delete process.env.PROFILE_MATCHING_LLM_PREFILTER_CAP;
                } else {
                    process.env.PROFILE_MATCHING_LLM_PREFILTER_CAP = originalPrefilterCap;
                }
                vi.resetModules();
            }
        });

        it('should handle partial LLM failures gracefully', async () => {
            // First batch succeeds, second fails
            callBusinessChatCompletion
                .mockResolvedValueOnce(mockLLMScoringResponse)
                .mockRejectedValueOnce(new Error('Batch 2 failed'));
            
            const result = await findMatchingProfiles('mission-1', { limit: 10 });
            
            // Should still return results (partial success)
            expect(result.profiles.length).toBeGreaterThan(0);
            expect(result.llmScoringApplied).toBe(true);
        });

        it('should handle malformed LLM response', async () => {
            callBusinessChatCompletion.mockResolvedValue({
                choices: [{
                    message: {
                        content: 'not valid json'
                    }
                }]
            });
            
            const result = await findMatchingProfiles('mission-1', { limit: 10 });
            
            // No fallback - LLM is the only scoring source
            expect(result.llmScoringFailed).toBe(true);
            expect(result.profiles).toHaveLength(0);
        });

        it('should retry malformed batch scoring responses with smaller sub-batches', async () => {
            const sixResumes = Array.from({ length: 6 }, (_, i) => ({
                ...mockResumeRecords[0],
                id: `resume-${i}`,
                name: `Candidate ${i}`
            }));

            selectWithTimeout.mockResolvedValue(sixResumes);

            callBusinessChatCompletion
                .mockResolvedValueOnce({
                    choices: [{
                        message: {
                            content: '{"scores":{"resume-0":{"score":80,"confidence":"high","reason":"oops'
                        }
                    }]
                })
                .mockResolvedValueOnce({
                    choices: [{
                        message: {
                            content: JSON.stringify({
                                scores: Object.fromEntries(
                                    sixResumes.slice(0, 3).map(r => [r.id, { score: 80, confidence: 'high', reason: 'OK' }])
                                )
                            })
                        }
                    }]
                })
                .mockResolvedValueOnce({
                    choices: [{
                        message: {
                            content: JSON.stringify({
                                scores: Object.fromEntries(
                                    sixResumes.slice(3).map(r => [r.id, { score: 78, confidence: 'medium', reason: 'OK' }])
                                )
                            })
                        }
                    }]
                });

            const result = await findMatchingProfiles('mission-1', { limit: 10 });
            const scoringCalls = callBusinessChatCompletion.mock.calls.filter(
                call => call[0]?.operationType === 'Batch Profile Scoring'
            );

            expect(result.llmScoringApplied).toBe(true);
            expect(result.llmScoringFailed).toBe(false);
            expect(result.profiles).toHaveLength(6);
            expect(scoringCalls).toHaveLength(3);
            expect(metrics.trackProfileMatchingActivity).toHaveBeenCalledWith(expect.objectContaining({
                event: 'retry',
                batchesRetried: 1
            }));
        });

        it('should retry DeepSeek token-limit truncation with smaller sub-batches', async () => {
            const fourResumes = Array.from({ length: 4 }, (_, i) => ({
                ...mockResumeRecords[0],
                id: `resume-${i}`,
                name: `Candidate ${i}`
            }));

            getLLMSettings.mockResolvedValue({ llmModel: 'deepseek-reasoner', llmProvider: 'deepseek' });
            selectWithTimeout.mockResolvedValue(fourResumes);

            callBusinessChatCompletion
                .mockRejectedValueOnce(new Error('DeepSeek response truncated due to token limit'))
                .mockResolvedValueOnce({
                    choices: [{
                        message: {
                            content: JSON.stringify({
                                scores: Object.fromEntries(
                                    fourResumes.slice(0, 2).map(r => [r.id, { score: 81, confidence: 'high', reason: 'OK' }])
                                )
                            })
                        }
                    }]
                })
                .mockResolvedValueOnce({
                    choices: [{
                        message: {
                            content: JSON.stringify({
                                scores: Object.fromEntries(
                                    fourResumes.slice(2).map(r => [r.id, { score: 79, confidence: 'medium', reason: 'OK' }])
                                )
                            })
                        }
                    }]
                });

            const result = await findMatchingProfiles('mission-1', { limit: 10 });
            const scoringCalls = callBusinessChatCompletion.mock.calls.filter(
                call => call[0]?.operationType === 'Batch Profile Scoring'
            );

            expect(result.llmScoringApplied).toBe(true);
            expect(result.profiles).toHaveLength(4);
            expect(scoringCalls).toHaveLength(3);
        });

        it('should run a second explanation pass only for the top profiles on larger result sets', async () => {
            const manyResumes = Array.from({ length: 12 }, (_, i) => ({
                ...mockResumeRecords[0],
                id: `resume-${i}`,
                name: `Candidate ${i}`
            }));

            selectWithTimeout.mockResolvedValue(manyResumes);
            callBusinessChatCompletion
                .mockResolvedValueOnce({
                    choices: [{
                        message: {
                            content: JSON.stringify({
                                scores: Object.fromEntries(
                                    manyResumes.map((resume, index) => [resume.id, {
                                        score: 90 - index,
                                        confidence: 'high',
                                        reason: 'Batch reason',
                                        keyStrengths: ['Batch strength'],
                                        keyGaps: ['Batch gap']
                                    }])
                                )
                            })
                        }
                    }]
                })
                .mockResolvedValue({
                    choices: [{
                        message: {
                            content: JSON.stringify({
                                reason: 'Focused explanation',
                                keyStrengths: ['Strong match'],
                                keyGaps: ['Minor gap']
                            })
                        }
                    }]
                });

            const result = await findMatchingProfiles('mission-1', { limit: 12 });
            const explanationCalls = callBusinessChatCompletion.mock.calls.filter(
                call => call[0]?.operationType === 'Profile Match Explanation'
            );

            expect(result.profilesExplained).toBe(5);
            expect(explanationCalls).toHaveLength(5);
            expect(result.profiles[0].reason).toBe('Focused explanation');
        });
    });

    // ============================================
    // DEFAULT_WEIGHTS tests
    // ============================================
    
    describe('DEFAULT_WEIGHTS', () => {
        it('should have correct default values', () => {
            expect(DEFAULT_WEIGHTS.skills).toBe(40);
            expect(DEFAULT_WEIGHTS.tools).toBe(25);
            expect(DEFAULT_WEIGHTS.industries).toBe(20);
            expect(DEFAULT_WEIGHTS.softSkills).toBe(15);
        });

        it('should sum to 100', () => {
            const total = DEFAULT_WEIGHTS.skills + DEFAULT_WEIGHTS.tools + 
                         DEFAULT_WEIGHTS.industries + DEFAULT_WEIGHTS.softSkills;
            expect(total).toBe(100);
        });
    });

    describe('analyzeProfileForMission', () => {
        beforeEach(() => {
            findWithTimeout
                .mockResolvedValueOnce({
                    id: 'resume-1',
                    name: 'Jean Dupont',
                    title: 'Lead Developer React',
                    global_rating: 85,
                    skills: JSON.stringify(['React', 'TypeScript']),
                    tools: JSON.stringify(['Git', 'Docker']),
                    industries: JSON.stringify(['Banque']),
                    soft_skills: JSON.stringify(['Communication'])
                })
                .mockResolvedValueOnce(mockMissionRecord);
            callBusinessChatCompletion.mockResolvedValue(mockDetailedAnalysisResponse);
        });

        it('should request structured JSON response for DeepSeek detailed analysis', async () => {
            getLLMSettings.mockResolvedValue({ llmModel: 'deepseek-reasoner', llmProvider: 'deepseek' });

            const result = await analyzeProfileForMission('mission-1', 'resume-1');

            expect(result.analysis.overallScore).toBe(82);
            expect(callBusinessChatCompletion).toHaveBeenCalledWith(expect.objectContaining({
                operationType: 'Detailed Profile Analysis',
                responseFormat: { type: 'json_object' },
                maxTokens: 8192
            }));
        });

        it('should retry recoverable malformed JSON once for detailed analysis', async () => {
            getLLMSettings.mockResolvedValue({ llmModel: 'deepseek-reasoner', llmProvider: 'deepseek' });
            callBusinessChatCompletion
                .mockRejectedValueOnce(new Error('DeepSeek response truncated due to token limit'))
                .mockResolvedValueOnce(mockDetailedAnalysisResponse);

            const result = await analyzeProfileForMission('mission-1', 'resume-1');

            expect(result.analysis.verdict).toBe('Bon match');
            expect(callBusinessChatCompletion).toHaveBeenCalledTimes(2);
        });

        it('should throw a user-facing error when detailed analysis still fails after retry', async () => {
            getLLMSettings.mockResolvedValue({ llmModel: 'deepseek-reasoner', llmProvider: 'deepseek' });
            callBusinessChatCompletion
                .mockRejectedValueOnce(new Error('DeepSeek response truncated due to token limit'))
                .mockRejectedValueOnce(new Error('Unexpected end of JSON input'));

            await expect(analyzeProfileForMission('mission-1', 'resume-1'))
                .rejects
                .toThrow("Erreur lors de l'analyse détaillée du profil.");
        });
    });
});
