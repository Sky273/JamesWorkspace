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

// Import the service (after mocks are set up)
import profileMatchingService from '../../services/profileMatching.service.js';

// Extract functions from default export
const { findMatchingProfiles, DEFAULT_WEIGHTS } = profileMatchingService;

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

            expect(result.llmScoringApplied).toBe(true);
            expect(result.llmScoringFailed).toBe(false);
            expect(result.profiles).toHaveLength(6);
            expect(callBusinessChatCompletion).toHaveBeenCalledTimes(3);
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

            expect(result.llmScoringApplied).toBe(true);
            expect(result.profiles).toHaveLength(4);
            expect(callBusinessChatCompletion).toHaveBeenCalledTimes(3);
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
});
