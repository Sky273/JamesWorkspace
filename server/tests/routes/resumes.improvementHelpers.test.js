import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockAnalyzeResume = vi.fn();
const mockCleanupText = vi.fn((value) => value);
const mockGetLLMSettings = vi.fn();
const mockCalculateWeightedGlobalRating = vi.fn();
const mockGetAcceptedIndustriesString = vi.fn();
const mockGetIndustryMappingString = vi.fn();
const mockUpdateResume = vi.fn();
const mockPersistResumeSkillEvidence = vi.fn();
const mockUpdateVersionPostAnalysis = vi.fn();
const mockRunAiActionWithCredits = vi.fn(async (_options, action) => action({ maxTokens: 1234 }));

vi.mock('../../services/openai.service.js', () => ({
    analyzeResume: (...args) => mockAnalyzeResume(...args),
    cleanupText: (...args) => mockCleanupText(...args)
}));

vi.mock('../../services/settings.service.js', () => ({
    getLLMSettings: (...args) => mockGetLLMSettings(...args),
    calculateWeightedGlobalRating: (...args) => mockCalculateWeightedGlobalRating(...args)
}));

vi.mock('../../services/industry.service.js', () => ({
    getAcceptedIndustriesString: (...args) => mockGetAcceptedIndustriesString(...args),
    getIndustryMappingString: (...args) => mockGetIndustryMappingString(...args)
}));

vi.mock('../../routes/resumes/helpers.js', () => ({
    parseScore: vi.fn((value) => {
        if (value === undefined || value === null) return undefined;
        return typeof value === 'number' ? value : parseInt(String(value).replace('%', ''), 10);
    })
}));

vi.mock('../../services/resumes.service.js', () => ({
    updateResume: (...args) => mockUpdateResume(...args)
}));

vi.mock('../../services/skillEvidence.service.js', () => ({
    persistResumeSkillEvidence: (...args) => mockPersistResumeSkillEvidence(...args)
}));

vi.mock('../../services/resumeVersions.service.js', () => ({
    updateVersionPostAnalysis: (...args) => mockUpdateVersionPostAnalysis(...args)
}));

vi.mock('../../services/aiCredits.service.js', () => ({
    executeAiWorkflowWithCredits: (_options, runner) => runner({ workflowReservation: null }),
    runAiActionWithCredits: (...args) => mockRunAiActionWithCredits(...args)
    ,
    workflowReservationCoversAction: () => false
}));

vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn()
}));

import { persistDeferredPostImprovementAnalysis } from '../../routes/resumes/crud/improvementHelpers.js';

describe('resumes improvementHelpers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        delete process.env.E2E_DISABLE_EXTERNAL_LLM;
        mockGetLLMSettings.mockResolvedValue({
            llmModel: 'gpt-5.4',
            cvMode: 'nominative',
            'Analysis Prompt': '{TEXT} {FILENAME} {ACCEPTED_INDUSTRIES} {INDUSTRY_MAPPING} {ANONYMIZATION_RULES}'
        });
        mockGetAcceptedIndustriesString.mockResolvedValue('');
        mockGetIndustryMappingString.mockResolvedValue('');
        mockAnalyzeResume.mockResolvedValue({
            title: 'Architecte Java',
            globalRating: '84%',
            skillsRating: '85%',
            experiencesRating: '80%',
            educationRating: '70%',
            atsOptimizationRating: '75%',
            executiveSummaryRating: '78%',
            hobbiesLanguagesRating: '60%',
            tags: {
                skills: ['Java'],
                tools: ['Docker'],
                softSkills: ['Leadership'],
                industries: ['IT'],
                skillsEvidence: [{ name: 'Java', evidenceScore: 0.82, confidence: 0.91 }],
                toolsEvidence: [{ name: 'Docker', evidenceScore: 0.74, confidence: 0.88 }]
            },
            suggestions: { skills: ['Mieux structurer les compétences'] }
        });
        mockCalculateWeightedGlobalRating.mockImplementation(async (analysis) => analysis);
        mockUpdateResume.mockResolvedValue({
            id: 'resume-1',
            file_name: 'cv.pdf'
        });
        mockUpdateVersionPostAnalysis.mockResolvedValue(undefined);
    });

    it('persists improved-phase skill evidence after deferred post analysis', async () => {
        await persistDeferredPostImprovementAnalysis({
            resumeId: 'resume-1',
            improvedText: 'Improved CV text',
            fileName: 'cv.pdf',
            userMetadata: { userId: 'user-1', firmId: 'firm-1' },
            currentVersion: null
        });

        expect(mockRunAiActionWithCredits).toHaveBeenCalledWith(
            expect.objectContaining({
                firmId: 'firm-1',
                userId: 'user-1',
                actionType: 'resume.improvement'
            }),
            expect.any(Function)
        );
        expect(mockAnalyzeResume).toHaveBeenCalledWith(
            'Improved CV text',
            'gpt-5.4',
            expect.any(String),
            { userId: 'user-1', firmId: 'firm-1' },
            true,
            'cv.pdf',
            { maxTokens: 1234 }
        );
        expect(mockUpdateResume).toHaveBeenCalledWith(
            'resume-1',
            expect.objectContaining({
                improved_text: 'Improved CV text',
                analysis_details: expect.objectContaining({
                    tags: expect.objectContaining({
                        skillsEvidence: [expect.objectContaining({ name: 'Java' })],
                        toolsEvidence: [expect.objectContaining({ name: 'Docker' })]
                    })
                })
            })
        );
        expect(mockPersistResumeSkillEvidence).toHaveBeenCalledWith({
            candidateId: 'resume-1',
            analysis: expect.objectContaining({
                tags: expect.objectContaining({
                    skillsEvidence: [expect.objectContaining({ name: 'Java' })],
                    toolsEvidence: [expect.objectContaining({ name: 'Docker' })]
                })
            }),
            phase: 'improved'
        });
        expect(mockUpdateVersionPostAnalysis).not.toHaveBeenCalled();
    });

    it('skips external LLM calls during deferred post analysis in E2E mode', async () => {
        process.env.E2E_DISABLE_EXTERNAL_LLM = 'true';

        await persistDeferredPostImprovementAnalysis({
            resumeId: 'resume-1',
            improvedText: 'Improved CV text',
            fileName: 'cv.pdf',
            userMetadata: { userId: 'user-1', firmId: 'firm-1' },
            currentVersion: 'version-2'
        });

        expect(mockRunAiActionWithCredits).not.toHaveBeenCalled();
        expect(mockGetLLMSettings).not.toHaveBeenCalled();
        expect(mockAnalyzeResume).not.toHaveBeenCalled();
        expect(mockUpdateResume).toHaveBeenCalledWith(
            'resume-1',
            expect.objectContaining({
                improved_text: 'Improved CV text',
                improved_global_rating: 88,
                improved_skills: JSON.stringify(['JavaScript', 'TypeScript', 'React'])
            })
        );
        expect(mockPersistResumeSkillEvidence).toHaveBeenCalledWith({
            candidateId: 'resume-1',
            analysis: expect.objectContaining({
                tags: expect.objectContaining({
                    skills: ['JavaScript', 'TypeScript', 'React']
                })
            }),
            phase: 'improved'
        });
        expect(mockUpdateVersionPostAnalysis).toHaveBeenCalledWith(
            'resume-1',
            'version-2',
            expect.objectContaining({
                globalRating: '88%'
            })
        );
    });
});
