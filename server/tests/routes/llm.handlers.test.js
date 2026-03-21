/**
 * Tests for resumes/llm.handlers.js
 * analyzeHandler, analyzeTextHandler, improveHandler, improveByIdHandler, matchHandler, adaptHandler
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../utils/logger.backend.js', () => ({ safeLog: vi.fn() }));
vi.mock('../../utils/trigram.js', () => ({ generateTrigram: vi.fn(name => (name || 'X').substring(0, 3).toUpperCase()) }));

const mockFindResume = vi.fn();
const mockFindMission = vi.fn();
const mockCreateAdaptation = vi.fn();
vi.mock('../../services/resumes.service.js', () => ({
    findResumeRecord: (...a) => mockFindResume(...a),
    findMissionRecord: (...a) => mockFindMission(...a),
    createAdaptation: (...a) => mockCreateAdaptation(...a)
}));

const mockAnalyzeResume = vi.fn();
const mockImproveResume = vi.fn();
const mockMatchResume = vi.fn();
const mockAdaptResume = vi.fn();
const mockCleanupText = vi.fn(t => t);
vi.mock('../../services/openai.service.js', () => ({
    analyzeResume: (...a) => mockAnalyzeResume(...a),
    improveResume: (...a) => mockImproveResume(...a),
    matchResumeWithMission: (...a) => mockMatchResume(...a),
    adaptResumeToMission: (...a) => mockAdaptResume(...a),
    cleanupText: (...a) => mockCleanupText(...a)
}));

vi.mock('../../services/security.service.js', () => ({
    getRequestMetadata: vi.fn(() => ({ ip: '127.0.0.1' }))
}));

const mockGetLLMSettings = vi.fn();
const mockCalcWeighted = vi.fn(a => a);
vi.mock('../../services/settings.service.js', () => ({
    getLLMSettings: (...a) => mockGetLLMSettings(...a),
    calculateWeightedGlobalRating: (...a) => mockCalcWeighted(...a)
}));

vi.mock('../../services/industry.service.js', () => ({
    getAcceptedIndustriesString: vi.fn(() => 'IT,Finance'),
    getIndustryMappingString: vi.fn(() => '- Informatique, Tech → IT\n- Banque → Finance')
}));

vi.mock('../../config/prompts.backend.js', () => ({
    DEFAULT_ANALYSIS_PROMPT: 'analyze {ACCEPTED_INDUSTRIES} {INDUSTRY_MAPPING} {ANONYMIZATION_RULES}',
    DEFAULT_IMPROVEMENT_PROMPT: 'improve {ACCEPTED_INDUSTRIES} {INDUSTRY_MAPPING} {ANONYMIZATION_RULES}',
    DEFAULT_MATCH_ANALYSIS_PROMPT: 'match',
    DEFAULT_ADAPTATION_PROMPT: 'adapt {ACCEPTED_INDUSTRIES} {INDUSTRY_MAPPING} {ANONYMIZATION_RULES} {FILENAME}',
    ANONYMIZATION_RULES_ANONYMOUS: 'anon {FILENAME}',
    ANONYMIZATION_RULES_NOMINATIVE: 'named {FILENAME}'
}));

import {
    analyzeHandler,
    analyzeTextHandler,
    improveHandler,
    improveByIdHandler,
    matchHandler,
    adaptHandler
} from '../../routes/resumes/llm.handlers.js';

function mockReqRes(params = {}, body = {}, user = { role: 'admin', firm: 'TestFirm' }) {
    return {
        req: { params, body, user },
        res: { status: vi.fn().mockReturnThis(), json: vi.fn(), redirect: vi.fn() }
    };
}

const defaultSettings = { llmModel: 'gpt-4o', cvMode: 'nominative' };

describe('LLM Handlers', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        mockGetLLMSettings.mockResolvedValue(defaultSettings);
        mockCalcWeighted.mockImplementation(a => a);
    });

    describe('analyzeHandler', () => {
        it('should return 403 for non-admin accessing other firm', async () => {
            mockFindResume.mockResolvedValueOnce({ firm_name: 'OtherFirm', original_text: 'text' });
            const { req, res } = mockReqRes({ id: '1' }, {}, { role: 'user', firm: 'MyFirm' });

            await analyzeHandler(req, res);

            expect(res.status).toHaveBeenCalledWith(403);
        });

        it('should return 400 if resume has no text', async () => {
            mockFindResume.mockResolvedValueOnce({ firm_name: 'TestFirm', original_text: null, improved_text: null });
            const { req, res } = mockReqRes({ id: '1' });

            await analyzeHandler(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
        });

        it('should return 500 if no LLM model', async () => {
            mockGetLLMSettings.mockResolvedValue({ llmModel: null });
            mockFindResume.mockResolvedValueOnce({ firm_name: 'TestFirm', original_text: 'some text' });
            const { req, res } = mockReqRes({ id: '1' });

            await analyzeHandler(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
        });

        it('should analyze and return result', async () => {
            mockFindResume.mockResolvedValueOnce({ firm_name: 'TestFirm', original_text: 'CV text', name: 'Bob' });
            mockAnalyzeResume.mockResolvedValueOnce({ name: 'Bob', globalRating: 75 });

            const { req, res } = mockReqRes({ id: '1' });

            await analyzeHandler(req, res);

            expect(mockAnalyzeResume).toHaveBeenCalled();
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ name: 'Bob' }));
        });

        it('should replace name with trigram in anonymous mode', async () => {
            mockGetLLMSettings.mockResolvedValue({ llmModel: 'gpt-4o', cvMode: 'anonymous' });
            mockFindResume.mockResolvedValueOnce({ firm_name: 'TestFirm', original_text: 'CV text' });
            mockAnalyzeResume.mockResolvedValueOnce({ name: 'Alice Martin', globalRating: 80 });

            const { req, res } = mockReqRes({ id: '1' });

            await analyzeHandler(req, res);

            const result = res.json.mock.calls[0][0];
            expect(result.name).not.toBe('Alice Martin');
            expect(result.originalName).toBe('Alice Martin');
        });
    });

    describe('analyzeTextHandler', () => {
        it('should return 400 if no text', async () => {
            const { req, res } = mockReqRes({}, { text: '' });

            await analyzeTextHandler(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
        });

        it('should analyze text and return result', async () => {
            mockAnalyzeResume.mockResolvedValueOnce({ name: 'Test', globalRating: 70 });
            const { req, res } = mockReqRes({}, { text: 'CV content', fileName: 'cv.pdf' });

            await analyzeTextHandler(req, res);

            expect(mockCleanupText).toHaveBeenCalled();
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ globalRating: 70 }));
        });
    });

    describe('improveHandler', () => {
        it('should return 400 if no text', async () => {
            const { req, res } = mockReqRes({}, { text: '' });

            await improveHandler(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
        });

        it('should improve and re-analyze', async () => {
            mockImproveResume.mockResolvedValueOnce({ text: '<p>improved</p>', analysis: { globalRating: 80 } });
            mockAnalyzeResume.mockResolvedValueOnce({ globalRating: 85, suggestions: { tip: 'ok' }, tags: { skills: ['JS'] } });

            const { req, res } = mockReqRes({}, { text: 'CV text', analysis: { globalRating: 70 } });

            await improveHandler(req, res);

            expect(mockImproveResume).toHaveBeenCalled();
            expect(mockAnalyzeResume).toHaveBeenCalled();
            const result = res.json.mock.calls[0][0];
            expect(result.text).toBe('<p>improved</p>');
            expect(result.analysis.suggestions).toEqual({ tip: 'ok' });
        });
    });

    describe('improveByIdHandler', () => {
        it('should return 403 for non-admin accessing other firm', async () => {
            mockFindResume.mockResolvedValueOnce({ firm_name: 'Other', original_text: 'text' });
            const { req, res } = mockReqRes({ id: '1' }, {}, { role: 'user', firm: 'Mine' });

            await improveByIdHandler(req, res);

            expect(res.status).toHaveBeenCalledWith(403);
        });

        it('should return 400 if no original text', async () => {
            mockFindResume.mockResolvedValueOnce({ firm_name: 'TestFirm', original_text: null });
            const { req, res } = mockReqRes({ id: '1' });

            await improveByIdHandler(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
        });

        it('should improve resume by ID', async () => {
            mockFindResume.mockResolvedValueOnce({
                firm_name: 'TestFirm', original_text: 'Original text',
                name: 'Bob', title: 'Dev', global_rating: 70,
                skills: ['JS'], industries: ['IT'], tools: [], soft_skills: []
            });
            mockImproveResume.mockResolvedValueOnce({ text: '<p>better</p>', analysis: { globalRating: 82 } });

            const { req, res } = mockReqRes({ id: '1' });

            await improveByIdHandler(req, res);

            expect(mockImproveResume).toHaveBeenCalled();
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ text: '<p>better</p>' }));
        });
    });

    describe('matchHandler', () => {
        it('should return 400 if no missionId', async () => {
            const { req, res } = mockReqRes({ id: '1' }, {});

            await matchHandler(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
        });

        it('should match resume with mission', async () => {
            mockFindResume.mockResolvedValueOnce({ firm_name: 'TestFirm', improved_text: 'CV text' });
            mockFindMission.mockResolvedValueOnce({ title: 'Dev Lead', content: 'Job desc' });
            mockMatchResume.mockResolvedValueOnce({ matchScore: 72, strengths: ['React'] });

            const { req, res } = mockReqRes({ id: '1' }, { missionId: 'm1' });

            await matchHandler(req, res);

            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ matchScore: 72 }));
        });
    });

    describe('adaptHandler', () => {
        it('should return 400 if no missionId', async () => {
            const { req, res } = mockReqRes({ id: '1' }, {});

            await adaptHandler(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
        });

        it('should adapt resume and save adaptation', async () => {
            mockFindResume.mockResolvedValueOnce({ id: 'r1', firm_name: 'TestFirm', improved_text: 'CV', name: 'Bob' });
            mockFindMission.mockResolvedValueOnce({ id: 'm1', title: 'Dev', content: 'Job' });
            mockMatchResume.mockResolvedValueOnce({ matchScore: '65%' });
            mockAdaptResume.mockResolvedValueOnce({ adaptedText: '<p>adapted</p>', adaptedTitle: 'Adapted Dev' });
            mockCreateAdaptation.mockResolvedValueOnce({ id: 'a1' });

            const { req, res } = mockReqRes({ id: 'r1' }, { missionId: 'm1' });

            await adaptHandler(req, res);

            expect(mockCreateAdaptation).toHaveBeenCalledWith(expect.objectContaining({
                resume_id: 'r1',
                mission_id: 'm1',
                match_score: 65
            }));
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                adaptedText: '<p>adapted</p>',
                adaptationId: 'a1'
            }));
        });
    });
});
