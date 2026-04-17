import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFindResumeRecord = vi.fn();
const mockFindMissionRecord = vi.fn();
const mockCreateAdaptation = vi.fn();

vi.mock('../../services/resumes.service.js', () => ({
    findResumeRecord: (...args) => mockFindResumeRecord(...args),
    findMissionRecord: (...args) => mockFindMissionRecord(...args),
    createAdaptation: (...args) => mockCreateAdaptation(...args)
}));

vi.mock('../../services/openai.service.js', () => ({
    matchResumeWithMission: vi.fn(),
    adaptResumeToMission: vi.fn()
}));

vi.mock('../../services/settings.service.js', () => ({
    getLLMSettings: vi.fn(async () => ({
        llmModel: 'gpt-5.4',
        llmProvider: 'openai',
        cvMode: 'nominative'
    }))
}));

vi.mock('../../services/industry.service.js', () => ({
    getAcceptedIndustriesString: vi.fn(async () => 'IT')
}));

vi.mock('../../config/prompts.backend.js', () => ({
    DEFAULT_MATCH_ANALYSIS_PROMPT: 'match prompt',
    DEFAULT_ADAPTATION_PROMPT: 'adapt prompt {ACCEPTED_INDUSTRIES} {ANONYMIZATION_RULES} {FILENAME}',
    ANONYMIZATION_RULES_ANONYMOUS: 'anon {FILENAME}',
    ANONYMIZATION_RULES_NOMINATIVE: 'nominative {FILENAME}'
}));

vi.mock('../../config/llmGovernance.js', () => ({
    buildPromptExecutionMetadata: vi.fn((key) => ({ key }))
}));

vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn()
}));

vi.mock('../../services/aiCredits.service.js', () => ({
    executeAiWorkflowWithCredits: (_options, runner) => runner({
        workflowReservation: {
            id: 'wf-1',
            plan: [{ actionType: 'resume.adaptation' }]
        }
    }),
    runAiActionWithCredits: (_options, action) => action(),
    workflowReservationCoversAction: () => true
}));

import { executeResumeAdaptation } from '../../services/resumeAdaptation.service.js';

describe('resumeAdaptation.service E2E mocked mode', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        delete process.env.E2E_DISABLE_EXTERNAL_LLM;

        mockFindResumeRecord.mockResolvedValue({
            id: 'resume-1',
            original_text: '<p>CV source</p>',
            improved_text: null,
            original_file_name: 'candidate.docx',
            title: 'Consultant',
            name: 'Candidate',
            candidate_name: 'Candidate',
            firm_name: 'Firm One'
        });

        mockFindMissionRecord.mockResolvedValue({
            id: 'mission-1',
            title: 'Mission React',
            content: 'Recherche profil React'
        });

        mockCreateAdaptation.mockImplementation(async (payload) => ({
            id: 'adapt-1',
            ...payload
        }));
    });

    it('should create a mocked adaptation without external LLM calls when disabled', async () => {
        process.env.E2E_DISABLE_EXTERNAL_LLM = 'true';

        const result = await executeResumeAdaptation({
            resumeId: 'resume-1',
            missionId: 'mission-1'
        });

        expect(mockCreateAdaptation).toHaveBeenCalledWith(expect.objectContaining({
            resume_id: 'resume-1',
            mission_id: 'mission-1',
            adapted_title: 'Mission React',
            status: 'completed'
        }));
        expect(result.matchAnalysis.matchScore).toBe('84');
        expect(result.adaptedText).toContain('Adaptation E2E');
    });

    it('should prefer improved_text over original_text for downstream adaptation content', async () => {
        process.env.E2E_DISABLE_EXTERNAL_LLM = 'true';
        mockFindResumeRecord.mockResolvedValueOnce({
            id: 'resume-1',
            original_text: '<p>CV source</p>',
            improved_text: '<p>CV amélioré</p>',
            original_file_name: 'candidate.docx',
            title: 'Consultant',
            name: 'Candidate',
            candidate_name: 'Candidate',
            firm_name: 'Firm One'
        });

        const result = await executeResumeAdaptation({
            resumeId: 'resume-1',
            missionId: 'mission-1'
        });

        expect(result.adaptedText).toContain('<p>CV amélioré</p>');
        expect(result.adaptedText).not.toContain('<p>CV source</p>');
        expect(mockCreateAdaptation).toHaveBeenCalledWith(expect.objectContaining({
            adapted_text: expect.stringContaining('<p>CV amélioré</p>')
        }));
    });
});
