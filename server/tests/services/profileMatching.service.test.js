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
vi.mock('../../services/openai.service.js', () => ({
    callOpenAI: vi.fn()
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
import { callOpenAI } from '../../services/openai.service.js';
import { getLLMSettings } from '../../services/settings.service.js';

// Import the service (after mocks are set up)
import profileMatchingService from '../../services/profileMatching.service.js';

// Extract functions from default export
const { findMatchingProfiles, calculateMatchScore, DEFAULT_WEIGHTS } = profileMatchingService;

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
    // calculateMatchScore tests
    // ============================================
    
    describe('calculateMatchScore', () => {
        it('should return 100% when all tags match', () => {
            const resumeTags = {
                skills: ['React', 'TypeScript', 'Node.js'],
                tools: ['Git', 'Docker', 'AWS'],
                industries: ['Banque', 'Finance'],
                softSkills: ['Communication', 'Leadership']
            };
            
            const result = calculateMatchScore(resumeTags, mockMissionKeywords);
            
            expect(result.totalScore).toBe(100);
            expect(result.categoryScores.skills).toBe(100);
            expect(result.categoryScores.tools).toBe(100);
            expect(result.categoryScores.industries).toBe(100);
            expect(result.categoryScores.softSkills).toBe(100);
        });

        it('should return low score when few tags match', () => {
            const resumeTags = {
                skills: ['Cobol', 'Fortran'],
                tools: ['Maven', 'Jenkins'],
                industries: ['Retail'],
                softSkills: ['Autonomie']
            };
            
            const result = calculateMatchScore(resumeTags, mockMissionKeywords);
            
            // Low score expected due to minimal matches
            expect(result.totalScore).toBeLessThan(30);
            // No skill matches expected with completely different technologies
            expect(result.matches.skills).toHaveLength(0);
        });

        it('should calculate partial match correctly', () => {
            const resumeTags = {
                skills: ['React', 'Python'], // 1/3 exact match (React)
                tools: ['Git', 'Docker'], // 2/3 match
                industries: ['Banque'], // 1/2 match
                softSkills: ['Communication'] // 1/2 match
            };
            
            const result = calculateMatchScore(resumeTags, mockMissionKeywords);
            
            // Skills: React matches (1/3), JavaScript may fuzzy match
            expect(result.categoryScores.skills).toBeGreaterThanOrEqual(33);
            expect(result.categoryScores.tools).toBe(67); // 2/3 ≈ 67%
            expect(result.categoryScores.industries).toBe(50); // 1/2 = 50%
            expect(result.categoryScores.softSkills).toBe(50); // 1/2 = 50%
            
            // Total should be reasonable partial match
            expect(result.totalScore).toBeGreaterThan(40);
            expect(result.totalScore).toBeLessThan(70);
        });

        it('should handle empty mission keywords gracefully', () => {
            const resumeTags = {
                skills: ['React'],
                tools: ['Git'],
                industries: ['Banque'],
                softSkills: ['Communication']
            };
            
            const emptyMissionKeywords = {
                skills: [],
                tools: [],
                industries: [],
                softSkills: []
            };
            
            const result = calculateMatchScore(resumeTags, emptyMissionKeywords);
            
            // Empty mission keywords = 100% match (nothing required)
            expect(result.totalScore).toBe(100);
        });

        it('should handle empty resume tags gracefully', () => {
            const emptyResumeTags = {
                skills: [],
                tools: [],
                industries: [],
                softSkills: []
            };
            
            const result = calculateMatchScore(emptyResumeTags, mockMissionKeywords);
            
            expect(result.totalScore).toBe(0);
            expect(result.missing.skills).toEqual(mockMissionKeywords.skills);
        });

        it('should apply custom weights correctly', () => {
            const resumeTags = {
                skills: ['React', 'TypeScript', 'Node.js'], // 100%
                tools: [], // 0%
                industries: [], // 0%
                softSkills: [] // 0%
            };
            
            const customWeights = {
                skills: 100, // Only skills matter
                tools: 0,
                industries: 0,
                softSkills: 0
            };
            
            const result = calculateMatchScore(resumeTags, mockMissionKeywords, customWeights);
            
            expect(result.totalScore).toBe(100); // 100% skills * 100 weight
        });

        it('should perform fuzzy matching for technology variations', () => {
            const resumeTags = {
                skills: ['ReactJS', 'TS', 'NodeJS'], // Variations
                tools: ['git', 'DOCKER', 'aws'], // Case variations
                industries: ['banque'], // Lowercase
                softSkills: ['communication']
            };
            
            const result = calculateMatchScore(resumeTags, mockMissionKeywords);
            
            // Should match despite variations
            expect(result.categoryScores.skills).toBeGreaterThan(0);
            expect(result.categoryScores.tools).toBeGreaterThan(0);
        });
    });

    // ============================================
    // findMatchingProfiles tests (integration)
    // ============================================
    
    describe('findMatchingProfiles', () => {
        beforeEach(() => {
            findWithTimeout.mockResolvedValue(mockMissionRecord);
            selectWithTimeout.mockResolvedValue(mockResumeRecords);
            callOpenAI.mockResolvedValue(mockLLMScoringResponse);
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

        it('should fall back to text-based scoring when LLM fails', async () => {
            callOpenAI.mockRejectedValue(new Error('LLM API error'));
            
            const result = await findMatchingProfiles('mission-1', { limit: 10 });
            
            expect(result.llmScoringApplied).toBe(false);
            expect(result.llmScoringFailed).toBe(true);
            expect(result.profiles).toHaveLength(3);
            
            // Should still have scores (text-based)
            result.profiles.forEach(profile => {
                expect(typeof profile.matchScore).toBe('number');
            });
        });

        it('should fall back when LLM model is not configured', async () => {
            getLLMSettings.mockResolvedValue({ llmModel: null });
            
            const result = await findMatchingProfiles('mission-1', { limit: 10 });
            
            expect(result.llmScoringApplied).toBe(false);
            expect(result.llmScoringFailed).toBe(true);
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
            const extractionCalls = callOpenAI.mock.calls.filter(
                call => call[0]?.operationType === 'Mission Keywords Extraction'
            );
            expect(extractionCalls).toHaveLength(0);
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
            
            callOpenAI
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
            callOpenAI.mockResolvedValue({
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
            expect(callOpenAI).toHaveBeenCalled();
        });

        it('should handle partial LLM failures gracefully', async () => {
            // First batch succeeds, second fails
            callOpenAI
                .mockResolvedValueOnce(mockLLMScoringResponse)
                .mockRejectedValueOnce(new Error('Batch 2 failed'));
            
            const result = await findMatchingProfiles('mission-1', { limit: 10 });
            
            // Should still return results (partial success)
            expect(result.profiles.length).toBeGreaterThan(0);
            expect(result.llmScoringApplied).toBe(true);
        });

        it('should handle malformed LLM response', async () => {
            callOpenAI.mockResolvedValue({
                choices: [{
                    message: {
                        content: 'not valid json'
                    }
                }]
            });
            
            const result = await findMatchingProfiles('mission-1', { limit: 10 });
            
            // Should fall back to text-based scoring
            expect(result.llmScoringFailed).toBe(true);
            expect(result.profiles.length).toBeGreaterThan(0);
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
