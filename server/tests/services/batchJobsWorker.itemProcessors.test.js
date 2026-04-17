/**
 * Tests for Batch Jobs Worker - Item Processors
 * processImportItem, processImproveItem
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn(),
    createModuleLogger: vi.fn(() => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }))
}));
vi.mock('../../utils/tagCleaner.js', () => ({
    processAnalysisTags: vi.fn(() => ({
        rawTags: { skills: ['JS'], industries: ['IT'], tools: ['VS Code'], softSkills: ['Teamwork'] },
        cleanedTags: { skills: ['javascript'], industries: ['it'], tools: ['vscode'], softSkills: ['teamwork'] }
    }))
}));

const mockQuery = vi.fn();
vi.mock('../../config/database.js', () => ({
    query: (...args) => mockQuery(...args)
}));
vi.mock('../../services/batchJobs/constants.js', () => ({
    ITEM_STATUS: { PENDING: 'pending', PROCESSING: 'processing', SUCCESS: 'success', ERROR: 'error', PENDING_NAME: 'pending_name' }
}));
vi.mock('../../services/batchJobs/itemCrud.js', () => ({
    updateJobItemStatus: vi.fn(),
    getJobItemFilePayload: vi.fn(),
    clearJobItemFileData: vi.fn()
}));

const mockExtractText = vi.fn();
vi.mock('../../services/batchJobsWorker/textExtraction.js', () => ({
    extractTextFromBuffer: (...args) => mockExtractText(...args)
}));

const mockAnalyze = vi.fn();
const mockPreAnalyze = vi.fn();
const mockImprove = vi.fn();
const mockAnalyzeImproved = vi.fn();
vi.mock('../../services/batchJobsWorker/llmIntegration.js', () => ({
    analyzeResumeWithLLM: (...args) => mockAnalyze(...args),
    preAnalyzeResumeWithLLM: (...args) => mockPreAnalyze(...args),
    improveResumeWithLLM: (...args) => mockImprove(...args),
    analyzeImprovedResumeWithLLM: (...args) => mockAnalyzeImproved(...args)
}));

vi.mock('../../services/batchJobsWorker/helpers.js', () => ({
    parseScore: vi.fn(v => typeof v === 'number' ? v : parseInt(v) || 0),
    generateTrigram: vi.fn(name => (name || 'XXX').substring(0, 3).toUpperCase())
}));

vi.mock('../../services/settings.service.js', () => ({
    getLLMSettings: vi.fn(() => ({
        preAnalysisEnabled: false,
        cvMode: 'named',
        executiveSummaryWeight: 20, skillsWeight: 20, experienceWeight: 20,
        educationWeight: 15, atsWeight: 15, hobbiesLanguagesWeight: 10
    }))
}));

const mockTrackBatchImportActivity = vi.fn();
const mockTrackOcrActivity = vi.fn();
const mockTrackImprovementActivity = vi.fn();
vi.mock('../../services/metrics.service.js', () => ({
    metrics: {
        trackBatchImportActivity: (...args) => mockTrackBatchImportActivity(...args),
        trackOcrActivity: (...args) => mockTrackOcrActivity(...args),
        trackImprovementActivity: (...args) => mockTrackImprovementActivity(...args)
    }
}));

const mockSendConsentRequest = vi.fn();
const mockMarkConsentError = vi.fn();
vi.mock('../../services/consent.service.js', () => ({
    sendConsentRequest: (...args) => mockSendConsentRequest(...args),
    markConsentError: (...args) => mockMarkConsentError(...args)
}));

const mockExecuteResumeAdaptation = vi.fn();
vi.mock('../../services/resumeAdaptation.service.js', () => ({
    executeResumeAdaptation: (...args) => mockExecuteResumeAdaptation(...args)
}));

const mockPersistResumeSkillEvidence = vi.fn();
vi.mock('../../services/skillEvidence.service.js', () => ({
    persistResumeSkillEvidence: (...args) => mockPersistResumeSkillEvidence(...args)
}));

vi.mock('../../services/openai.service.js', () => ({
    matchResumeWithMission: vi.fn()
}));

const mockInsertResume = vi.fn(async (data) => {
    const result = await mockQuery(
        'INSERT INTO resumes (...) RETURNING *',
        [data]
    );
    return result.rows[0];
});
const mockUpdateResume = vi.fn(async (id, data) => {
    await mockQuery(
        "UPDATE resumes SET ... status = 'analyzed' WHERE id = $1",
        [data, id]
    );
    return { id, ...data };
});
const mockUpdateResumeFileUrl = vi.fn(async (id, fileUrl) => {
    await mockQuery(
        'UPDATE resumes SET resume_file_url = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [fileUrl, id]
    );
});

vi.mock('../../services/resumes.service.js', () => ({
    insertResume: (...args) => mockInsertResume(...args),
    updateResume: (...args) => mockUpdateResume(...args),
    updateResumeFileUrl: (...args) => mockUpdateResumeFileUrl(...args),
    findResumeRecord: vi.fn(),
    findMissionRecord: vi.fn()
}));

const mockRunAiActionWithCredits = vi.fn(async (options, action) => action({ maxTokens: 1234, cost: 0 }, options));
const mockGetBatchJobActionCreditReservation = vi.fn(() => null);
const mockMarkBatchJobActionCreditConsumed = vi.fn(async () => undefined);
vi.mock('../../services/aiCredits.service.js', () => ({
    runAiActionWithCredits: (...args) => mockRunAiActionWithCredits(...args),
    getConfiguredAiActionRuntimeConfig: vi.fn(async () => ({ maxTokens: 1234, cost: 0 }))
}));
vi.mock('../../services/batchJobCredits.service.js', () => ({
    getBatchJobActionCreditReservation: (...args) => mockGetBatchJobActionCreditReservation(...args),
    markBatchJobActionCreditConsumed: (...args) => mockMarkBatchJobActionCreditConsumed(...args)
}));

import { processImportItem, processImproveItem, processAdaptItem } from '../../services/batchJobsWorker/itemProcessors.js';
import { updateJobItemStatus, getJobItemFilePayload, clearJobItemFileData } from '../../services/batchJobs/itemCrud.js';
import { getLLMSettings } from '../../services/settings.service.js';

describe('Batch Jobs Worker - Item Processors', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockQuery.mockReset();
        mockExtractText.mockReset();
        mockAnalyze.mockReset();
        mockPreAnalyze.mockReset();
        mockImprove.mockReset();
        mockAnalyzeImproved.mockReset();
        mockSendConsentRequest.mockReset();
        mockMarkConsentError.mockReset();
        mockExecuteResumeAdaptation.mockReset();
        mockTrackBatchImportActivity.mockReset();
        mockTrackOcrActivity.mockReset();
        mockTrackImprovementActivity.mockReset();
        mockPersistResumeSkillEvidence.mockReset();
        mockInsertResume.mockClear();
        mockUpdateResume.mockClear();
        mockUpdateResumeFileUrl.mockClear();
        mockRunAiActionWithCredits.mockClear();
        mockGetBatchJobActionCreditReservation.mockReset();
        mockGetBatchJobActionCreditReservation.mockReturnValue(null);
        mockMarkBatchJobActionCreditConsumed.mockReset();
        vi.mocked(getJobItemFilePayload).mockReset();
        vi.mocked(clearJobItemFileData).mockReset();
        vi.mocked(getJobItemFilePayload).mockResolvedValue({
            file_data: Buffer.from('pdf'),
            file_mime_type: 'application/pdf'
        });
        vi.mocked(clearJobItemFileData).mockResolvedValue();
        vi.mocked(getLLMSettings).mockReset();
        vi.mocked(getLLMSettings).mockResolvedValue({
            preAnalysisEnabled: false,
            cvMode: 'named',
            executiveSummaryWeight: 20,
            skillsWeight: 20,
            experienceWeight: 20,
            educationWeight: 15,
            atsWeight: 15,
            hobbiesLanguagesWeight: 10
        });
    });

    const job = { id: 'job-1', firm_id: 'firm-1', firm_name: 'TestFirm' };

    describe('processImportItem', () => {
        const item = { id: 'item-1', file_name: 'cv.pdf', file_mime_type: 'application/pdf' };

        it('should import and analyze a resume', async () => {
            // DB insert returns resume id
            mockQuery
                .mockResolvedValueOnce({ rows: [{ id: 'res-1' }] }) // INSERT resume
                .mockResolvedValueOnce({ rows: [] }) // UPDATE resume_file_url
                .mockResolvedValueOnce({ rows: [] }); // UPDATE resume with analysis

            mockExtractText.mockResolvedValueOnce({
                text: 'A long resume text that is more than fifty characters for the check to pass easily.',
                ocrUsed: false,
                ocrPageCount: 0,
                failedOcrPages: 0
            });

            mockAnalyze.mockResolvedValueOnce({
                name: 'John Doe',
                title: 'Developer',
                globalRating: 75,
                skillsRating: 80,
                experiencesRating: 70,
                educationRating: 65,
                atsOptimizationRating: 72,
                executiveSummaryRating: 78,
                hobbiesLanguagesRating: 60,
                structuredText: '<p>structured</p>',
                tags: {
                    skills: ['Java'],
                    industries: ['IT'],
                    tools: ['Docker'],
                    softSkills: ['Communication'],
                    skillsEvidence: [{
                        name: 'Java',
                        evidenceScore: 0.82,
                        confidence: 0.91
                    }],
                    toolsEvidence: [{
                        name: 'Docker',
                        evidenceScore: 0.74,
                        confidence: 0.88
                    }]
                },
                suggestions: { tip: 'improve skills' }
            });

            await processImportItem(item, job, { improve: false });

            // Should create resume record
            expect(mockInsertResume).toHaveBeenCalledWith(expect.objectContaining({
                fileName: 'cv.pdf',
                firmId: 'firm-1'
            }));
            expect(getJobItemFilePayload).toHaveBeenCalledWith('item-1');
            // Should extract text
            expect(mockExtractText).toHaveBeenCalledWith(Buffer.from('pdf'), item.file_mime_type, item.file_name);
            // Should analyze
            expect(mockAnalyze).toHaveBeenCalledWith(expect.any(String), 'firm-1', 'cv.pdf', expect.objectContaining({ ocrUsed: false, maxTokens: 1234 }));
            // Should update resume with analysis
            expect(mockUpdateResumeFileUrl).toHaveBeenCalledWith('res-1', '/api/resumes/res-1/download');
            const finalUpdateCall = mockUpdateResume.mock.calls.find(([, data]) => data?.status === 'analyzed');
            const persistedAnalysis = finalUpdateCall?.[1]?.analysis_details;
            expect(persistedAnalysis).toBeTruthy();
            expect(JSON.parse(persistedAnalysis)).toEqual(expect.objectContaining({
                tags: expect.objectContaining({
                    skillsEvidence: [expect.objectContaining({ name: 'Java' })],
                    toolsEvidence: [expect.objectContaining({ name: 'Docker' })]
                })
            }));
            expect(mockPersistResumeSkillEvidence).toHaveBeenCalledWith({
                candidateId: 'res-1',
                analysis: expect.objectContaining({
                    tags: expect.objectContaining({
                        skillsEvidence: [expect.objectContaining({ name: 'Java' })],
                        toolsEvidence: [expect.objectContaining({ name: 'Docker' })]
                    })
                }),
                phase: 'initial'
            });
            expect(clearJobItemFileData).toHaveBeenCalledWith('item-1');
            expect(mockTrackBatchImportActivity).toHaveBeenCalledWith(expect.objectContaining({ event: 'run', mimeType: 'application/pdf' }));
            expect(mockTrackBatchImportActivity).toHaveBeenCalledWith(expect.objectContaining({ event: 'completed', successfulRuns: 1 }));
        });

        it('should run pre-analysis before analysis when enabled in settings', async () => {
            const extractedText = 'A long extracted resume text that is more than fifty characters for validation and downstream analysis.';

            vi.mocked(getLLMSettings).mockResolvedValueOnce({
                preAnalysisEnabled: true,
                cvMode: 'named'
            }).mockResolvedValueOnce({
                preAnalysisEnabled: true,
                cvMode: 'named'
            });

            mockQuery
                .mockResolvedValueOnce({ rows: [{ id: 'res-1' }] })
                .mockResolvedValueOnce({ rows: [] })
                .mockResolvedValueOnce({ rows: [] });

            mockExtractText.mockResolvedValueOnce({
                text: extractedText,
                ocrUsed: false
            });
            mockPreAnalyze.mockResolvedValueOnce('# Experience\n- Structured resume text for analysis');
            mockAnalyze.mockResolvedValueOnce({
                name: 'John Doe',
                title: 'Developer',
                globalRating: 75,
                skillsRating: 80,
                experiencesRating: 70,
                educationRating: 65,
                atsOptimizationRating: 72,
                executiveSummaryRating: 78,
                hobbiesLanguagesRating: 60,
                suggestions: {}
            });

            await processImportItem(item, job, { improve: false });

            expect(mockPreAnalyze).toHaveBeenCalledWith(
                expect.any(String),
                'firm-1',
                'cv.pdf'
            );
            expect(mockAnalyze).toHaveBeenCalledWith(
                '# Experience\n- Structured resume text for analysis',
                'firm-1',
                'cv.pdf',
                expect.objectContaining({ ocrUsed: false })
            );
            expect(updateJobItemStatus).toHaveBeenCalledWith('item-1', 'processing', expect.objectContaining({ progress: 50 }));
            expect(updateJobItemStatus).toHaveBeenCalledWith('item-1', 'processing', expect.objectContaining({ progress: 60 }));

            const finalUpdateCall = mockQuery.mock.calls.find(
                ([sql]) => typeof sql === 'string' && sql.includes("status = 'analyzed'")
            );

            expect(finalUpdateCall).toBeTruthy();
            expect(finalUpdateCall[1][0].original_text).toBe(mockPreAnalyze.mock.calls[0][0]);
            expect(finalUpdateCall[1][0].original_text).not.toBe('# Experience\n- Structured resume text for analysis');
        });

        it('should mark the item as analyzing before running the main analysis even without pre-analysis', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [{ id: 'res-1' }] })
                .mockResolvedValueOnce({ rows: [] })
                .mockResolvedValueOnce({ rows: [] });

            mockExtractText.mockResolvedValueOnce({
                text: 'A long extracted resume text that is more than fifty characters for validation and downstream analysis.',
                ocrUsed: false
            });
            mockAnalyze.mockResolvedValueOnce({
                name: 'John Doe',
                title: 'Developer',
                globalRating: 75,
                skillsRating: 80,
                experiencesRating: 70,
                educationRating: 65,
                atsOptimizationRating: 72,
                executiveSummaryRating: 78,
                hobbiesLanguagesRating: 60,
                suggestions: {}
            });

            await processImportItem(item, job, { improve: false });

            expect(updateJobItemStatus).toHaveBeenCalledWith('item-1', 'processing', expect.objectContaining({ progress: 60 }));
        });

        it('should persist extracted text as original_text instead of overwriting it with structuredText', async () => {
            const extractedText = 'OCR extracted text that should remain visible in the original text tab after analysis.';

            mockQuery
                .mockResolvedValueOnce({ rows: [{ id: 'res-1' }] })
                .mockResolvedValueOnce({ rows: [] })
                .mockResolvedValueOnce({ rows: [] });

            mockExtractText.mockResolvedValueOnce({
                text: extractedText,
                ocrUsed: true,
                ocrPageCount: 1,
                failedOcrPages: 0
            });

            mockAnalyze.mockResolvedValueOnce({
                name: 'John Doe',
                title: 'Developer',
                globalRating: 75,
                skillsRating: 80,
                experiencesRating: 70,
                educationRating: 65,
                atsOptimizationRating: 72,
                executiveSummaryRating: 78,
                hobbiesLanguagesRating: 60,
                structuredText: '<p></p>',
                suggestions: {}
            });

            await processImportItem(item, job, { improve: false });

            const finalUpdateCall = mockQuery.mock.calls.find(
                ([sql]) => typeof sql === 'string' && sql.includes("status = 'analyzed'")
            );

            expect(finalUpdateCall).toBeTruthy();
            expect(finalUpdateCall[1][0].original_text).toBe(extractedText);
        });

        it('should throw on text too short', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [{ id: 'res-1' }] });
            mockQuery.mockResolvedValueOnce({ rows: [] });
            mockExtractText.mockResolvedValueOnce({ text: 'short', ocrUsed: false });

            await expect(processImportItem(item, job, {})).rejects.toThrow("extraire le texte");
            expect(mockTrackBatchImportActivity).toHaveBeenCalledWith(expect.objectContaining({
                event: 'extract-failed',
                textExtractionFailures: 1,
                failedRuns: 1,
                stage: 'extract-text'
            }));
        });

        it('should pause item when name extraction fails', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [{ id: 'res-1' }] })
                .mockResolvedValueOnce({ rows: [] })
                .mockResolvedValueOnce({ rows: [] }); // UPDATE with partial analysis

            mockExtractText.mockResolvedValueOnce({
                text: 'A long resume text that is more than fifty characters for validation.',
                ocrUsed: false,
                ocrPageCount: 0,
                failedOcrPages: 0
            });
            mockAnalyze.mockResolvedValueOnce({
                name: 'XXX',
                title: 'Dev',
                globalRating: 70, skillsRating: 70, experiencesRating: 70,
                educationRating: 70, atsOptimizationRating: 70,
                executiveSummaryRating: 70, hobbiesLanguagesRating: 70
            });

            await processImportItem(item, job, {});

            expect(updateJobItemStatus).toHaveBeenCalledWith('item-1', 'pending_name', expect.objectContaining({
                error_message: expect.stringContaining('nom du candidat')
            }));
            expect(clearJobItemFileData).toHaveBeenCalledWith('item-1');
            expect(mockTrackBatchImportActivity).toHaveBeenCalledWith(expect.objectContaining({
                event: 'pending-name',
                pendingNameRuns: 1
            }));
        });

        it('should preserve external profile metadata and send consent request', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [{ id: 'res-1' }] })
                .mockResolvedValueOnce({ rows: [] })
                .mockResolvedValueOnce({ rows: [] });

            mockExtractText.mockResolvedValueOnce({
                text: 'A long resume text that is more than fifty characters for the check to pass easily.',
                ocrUsed: false,
                ocrPageCount: 0,
                failedOcrPages: 0
            });
            mockAnalyze.mockResolvedValueOnce({
                name: 'John Doe',
                title: 'Developer',
                globalRating: 75,
                skillsRating: 80,
                experiencesRating: 70,
                educationRating: 65,
                atsOptimizationRating: 72,
                executiveSummaryRating: 78,
                hobbiesLanguagesRating: 60,
                structuredText: '<p>structured</p>',
                suggestions: {}
            });

            await processImportItem(item, job, {
                profileType: 'external',
                candidateName: 'Jane Candidate',
                candidateEmail: 'jane@example.com'
            });

            expect(mockInsertResume).toHaveBeenCalledWith(expect.objectContaining({
                name: 'Jane Candidate',
                candidateName: 'Jane Candidate',
                candidateEmail: 'jane@example.com',
                profileType: 'external',
                consentStatus: 'pending_consent'
            }));
            expect(mockSendConsentRequest).toHaveBeenCalledWith('res-1');
        });

        it('should use the provided candidate name as fallback when analysis returns XXX', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [{ id: 'res-1' }] })
                .mockResolvedValueOnce({ rows: [] })
                .mockResolvedValueOnce({ rows: [] });

            mockExtractText.mockResolvedValueOnce({
                text: 'A long resume text that is more than fifty characters for validation.',
                ocrUsed: false,
                ocrPageCount: 0,
                failedOcrPages: 0
            });
            mockAnalyze.mockResolvedValueOnce({
                name: 'XXX',
                title: 'Dev',
                globalRating: 70, skillsRating: 70, experiencesRating: 70,
                educationRating: 70, atsOptimizationRating: 70,
                executiveSummaryRating: 70, hobbiesLanguagesRating: 70
            });

            await processImportItem(item, job, {
                profileType: 'external',
                candidateName: 'Fallback Name',
                candidateEmail: 'fallback@example.com'
            });

            expect(updateJobItemStatus).not.toHaveBeenCalledWith('item-1', 'pending_name', expect.anything());
            expect(mockUpdateResume).toHaveBeenCalledWith('res-1', expect.objectContaining({
                name: 'Fallback Name',
                status: 'analyzed'
            }));
        });

        it('should import and improve when improve=true', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [{ id: 'res-1' }] })
                .mockResolvedValueOnce({ rows: [] })
                .mockResolvedValueOnce({ rows: [] }) // analysis update
                .mockResolvedValueOnce({ rows: [] }); // improvement update

            mockExtractText.mockResolvedValueOnce({
                text: 'A long resume text that is more than fifty characters for the check to pass easily.',
                ocrUsed: false
            });
            mockAnalyze.mockResolvedValueOnce({
                name: 'Jane Smith', title: 'Engineer',
                globalRating: 80, skillsRating: 85, experiencesRating: 75,
                educationRating: 80, atsOptimizationRating: 78,
                executiveSummaryRating: 82, hobbiesLanguagesRating: 65,
                structuredText: '<p>structured text for improvement that is long enough</p>'
            });
            mockImprove.mockResolvedValueOnce({
                text: '<p>improved CV text</p>',
                analysis: {
                    skillsRating: 90, experiencesRating: 85, educationRating: 88,
                    atsOptimizationRating: 85, executiveSummaryRating: 90, hobbiesLanguagesRating: 75,
                    tags: { skills: ['React'], industries: ['Tech'], tools: ['Git'], softSkills: ['Leadership'] },
                    suggestions: {}
                }
            });
            mockAnalyzeImproved.mockResolvedValueOnce({
                skillsRating: 90, experiencesRating: 85, educationRating: 88,
                atsOptimizationRating: 85, executiveSummaryRating: 90, hobbiesLanguagesRating: 75,
                tags: { skills: ['React'], industries: ['Tech'], tools: ['Git'], softSkills: ['Leadership'] },
                suggestions: {}
            });

            await processImportItem(item, job, { improve: true });

            expect(mockImprove).toHaveBeenCalled();
            // Should save improved data
            expect(mockUpdateResume).toHaveBeenCalledWith('res-1', expect.objectContaining({
                improved_text: '<p>improved CV text</p>'
            }));
            expect(clearJobItemFileData).toHaveBeenCalledWith('item-1');
        });

        it('should treat OCR placeholder names like CANDIDAT 1 as extraction failure and use provided fallback name', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [{ id: 'res-1' }] })
                .mockResolvedValueOnce({ rows: [] })
                .mockResolvedValueOnce({ rows: [] });

            mockExtractText.mockResolvedValueOnce({
                text: 'CANDIDAT 1\nDeveloppeur full stack\nEmail luc . moreau @ gmail . com\nExperience detaillee pour passer la validation.',
                ocrUsed: true
            });
            mockAnalyze.mockResolvedValueOnce({
                name: 'CANDIDAT 1',
                title: 'Dev',
                globalRating: 70, skillsRating: 70, experiencesRating: 70,
                educationRating: 70, atsOptimizationRating: 70,
                executiveSummaryRating: 70, hobbiesLanguagesRating: 70
            });

            await processImportItem(item, job, {
                profileType: 'external',
                candidateName: 'Luc Moreau'
            });

            expect(mockAnalyze).toHaveBeenCalledWith(expect.stringContaining('luc.moreau@gmail.com'), 'firm-1', 'cv.pdf', expect.objectContaining({ ocrUsed: true }));
            expect(mockUpdateResume).toHaveBeenCalledWith('res-1', expect.objectContaining({
                name: 'Luc Moreau',
                status: 'analyzed'
            }));
            expect(updateJobItemStatus).not.toHaveBeenCalledWith('item-1', 'pending_name', expect.anything());
        });

        it('should track OCR metrics for batch imports when OCR was used', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [{ id: 'res-1' }] })
                .mockResolvedValueOnce({ rows: [] })
                .mockResolvedValueOnce({ rows: [] });

            mockExtractText.mockResolvedValueOnce({
                text: 'A long OCR extracted resume text that is more than fifty characters for the check to pass easily.',
                ocrUsed: true,
                pages: 1,
                ocrPageCount: 1,
                failedOcrPages: 0,
                avgOcrConfidence: 88,
                primaryResult: {
                    engine: 'tesseract-cli',
                    variant: 'pdftoppm-page',
                    psm: '11',
                    textLength: 120
                },
                recentResults: [
                    {
                        success: true,
                        pageNum: 1,
                        engine: 'tesseract-cli',
                        variant: 'pdftoppm-page',
                        psm: '11',
                        textLength: 120
                    }
                ]
            });

            mockAnalyze.mockResolvedValueOnce({
                name: 'John Doe',
                title: 'Developer',
                globalRating: 75,
                skillsRating: 80,
                experiencesRating: 70,
                educationRating: 65,
                atsOptimizationRating: 72,
                executiveSummaryRating: 78,
                hobbiesLanguagesRating: 60,
                structuredText: '<p>structured</p>',
                suggestions: {}
            });

            await processImportItem(item, job, { improve: false });

            expect(mockTrackOcrActivity).toHaveBeenCalledWith(expect.objectContaining({
                pages: 1,
                ocrPageCount: 1,
                failedPages: 0,
                avgConfidence: 88,
                success: true,
                metadata: expect.objectContaining({
                    source: 'batch-job',
                    fileName: 'cv.pdf',
                    engine: 'tesseract-cli',
                    variant: 'pdftoppm-page',
                    psm: '11'
                })
            }));
        });

        it('should fail early when the batch item file payload is missing', async () => {
            vi.mocked(getJobItemFilePayload).mockResolvedValueOnce(null);

            await expect(processImportItem(item, job, { improve: false })).rejects.toThrow('Fichier source du batch introuvable');

            expect(mockQuery).not.toHaveBeenCalled();
            expect(mockExtractText).not.toHaveBeenCalled();
            expect(clearJobItemFileData).not.toHaveBeenCalled();
        });
    });

    describe('processAdaptItem', () => {
        it('should throw if no resume_id', async () => {
            await expect(processAdaptItem({ id: 'ia1' }, job, { missionId: 'm1' })).rejects.toThrow('Resume ID manquant');
        });

        it('should throw if no missionId in job options', async () => {
            await expect(processAdaptItem({ id: 'ia2', resume_id: 'res-1' }, job, {})).rejects.toThrow('Mission ID manquant');
        });

        it('should create an adaptation and persist adaptation_id on the job item', async () => {
            mockExecuteResumeAdaptation.mockResolvedValueOnce({
                adaptationRecord: { id: 'adapt-1' }
            });

            await processAdaptItem({ id: 'ia3', resume_id: 'res-1', file_name: 'cv.pdf' }, job, { missionId: 'm1' });

            expect(mockExecuteResumeAdaptation).toHaveBeenCalledWith(expect.objectContaining({
                resumeId: 'res-1',
                missionId: 'm1'
            }));
            expect(updateJobItemStatus).toHaveBeenCalledWith('ia3', 'processing', expect.objectContaining({ adaptation_id: 'adapt-1' }));
        });
    });

    describe('processImproveItem', () => {
        it('should throw if no resume_id', async () => {
            await expect(processImproveItem({ id: 'i1' }, job, {})).rejects.toThrow('Resume ID manquant');
        });

        it('should throw if resume not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [] });

            await expect(processImproveItem({ id: 'i1', resume_id: 'res-1' }, job, {})).rejects.toThrow('CV non trouv');
        });

        it('should throw if resume has no text', async () => {
            mockQuery.mockResolvedValueOnce({
                rows: [{ id: 'res-1', original_text: null, global_rating: 70 }]
            });

            await expect(processImproveItem({ id: 'i1', resume_id: 'res-1' }, job, {})).rejects.toThrow('Texte du CV manquant');
        });

        it('should improve an existing resume', async () => {
            mockQuery
                .mockResolvedValueOnce({
                    rows: [{
                        id: 'res-1', original_text: 'Original CV text', global_rating: 70,
                        skills_score: 65, experience_score: 72, education_score: 68,
                        ats_score: 70, executive_summary_score: 75, hobbies_languages_score: 60,
                        name: 'Bob', title: 'PM', key_improvements: '{}'
                    }]
                })
                .mockResolvedValueOnce({ rows: [] }); // UPDATE improved

            mockImprove.mockResolvedValueOnce({
                text: '<p>improved text</p>',
                analysis: {
                    skillsRating: 80, experiencesRating: 78, educationRating: 75,
                    atsOptimizationRating: 82, executiveSummaryRating: 85, hobbiesLanguagesRating: 70,
                    tags: { skills: [], industries: [], tools: [], softSkills: [] },
                    suggestions: {}
                }
            });
            mockAnalyzeImproved.mockResolvedValueOnce({
                skillsRating: 80, experiencesRating: 78, educationRating: 75,
                atsOptimizationRating: 82, executiveSummaryRating: 85, hobbiesLanguagesRating: 70,
                tags: { skills: [], industries: [], tools: [], softSkills: [] },
                suggestions: {}
            });

            await processImproveItem({ id: 'i2', resume_id: 'res-1', file_name: 'bob.pdf' }, job, {});

            expect(mockImprove).toHaveBeenCalledWith(
                'Original CV text',
                expect.objectContaining({ name: 'Bob' }),
                'firm-1',
                'bob.pdf',
                expect.objectContaining({ maxTokens: 1234 })
            );
            expect(mockUpdateResume).toHaveBeenCalledWith('res-1', expect.objectContaining({
                improved_text: '<p>improved text</p>'
            }));
        });

        it('should persist the improved resume when post-improvement analysis returns an invalid response but embedded analysis is usable', async () => {
            mockQuery
                .mockResolvedValueOnce({
                    rows: [{
                        id: 'res-1', original_text: 'Original CV text', global_rating: 70,
                        skills_score: 65, experience_score: 72, education_score: 68,
                        ats_score: 70, executive_summary_score: 75, hobbies_languages_score: 60,
                        name: 'Bob', title: 'PM', key_improvements: '{}'
                    }]
                })
                .mockResolvedValueOnce({ rows: [] });

            mockImprove.mockResolvedValueOnce({
                text: '<p>improved text</p>',
                analysis: {
                    globalRating: 84,
                    skillsRating: 80,
                    experiencesRating: 78,
                    educationRating: 75,
                    atsOptimizationRating: 82,
                    executiveSummaryRating: 85,
                    hobbiesLanguagesRating: 70,
                    title: 'Senior PM',
                    tags: { skills: ['Leadership'], industries: ['Tech'], tools: ['Jira'], softSkills: ['Communication'] },
                    suggestions: {}
                }
            });
            mockAnalyzeImproved.mockRejectedValueOnce(new Error('Le modèle LLM a retourné une réponse invalide.'));

            await processImproveItem({ id: 'i2b', resume_id: 'res-1', file_name: 'bob.pdf' }, job, {});

            expect(mockUpdateResume).toHaveBeenCalledWith('res-1', expect.objectContaining({
                improved_text: '<p>improved text</p>',
                title: 'Senior PM',
                improved_skills: JSON.stringify(['Leadership']),
                improved_tools: JSON.stringify(['Jira'])
            }));
            expect(mockTrackImprovementActivity).toHaveBeenCalledWith(expect.objectContaining({
                provider: 'batch-job',
                event: 'post-analysis-fallback',
                postAnalysisFallbackRuns: 1,
                metadata: expect.objectContaining({
                    source: 'embedded-analysis-fallback',
                    stage: 'post-analysis',
                    itemId: 'i2b',
                    resumeId: 'res-1'
                })
            }));
        });

        it('should merge sparse post-analysis fields with embedded improvement analysis when the persistence analysis succeeds but is incomplete', async () => {
            mockQuery
                .mockResolvedValueOnce({
                    rows: [{
                        id: 'res-1', original_text: 'Original CV text', global_rating: 70,
                        skills_score: 65, experience_score: 72, education_score: 68,
                        ats_score: 70, executive_summary_score: 75, hobbies_languages_score: 60,
                        name: 'Bob', title: 'PM', key_improvements: '{}'
                    }]
                })
                .mockResolvedValueOnce({ rows: [] });

            mockImprove.mockResolvedValueOnce({
                text: '<p>improved text</p>',
                analysis: {
                    globalRating: 84,
                    skillsRating: 80,
                    title: 'Senior PM',
                    summary: 'Résumé embarqué',
                    tags: { skills: ['Leadership'], industries: ['Tech'], tools: ['Jira'], softSkills: ['Communication'] },
                    suggestions: { skills: ['Mettre en avant le leadership'] }
                }
            });
            mockAnalyzeImproved.mockResolvedValueOnce({
                globalRating: 90,
                skillsRating: 88,
                tags: { skills: [], industries: [], tools: [], softSkills: [] },
                suggestions: {}
            });

            await processImproveItem({ id: 'i2c', resume_id: 'res-1', file_name: 'bob.pdf' }, job, {});

            expect(mockUpdateResume).toHaveBeenCalledWith('res-1', expect.objectContaining({
                improved_text: '<p>improved text</p>',
                title: 'Senior PM',
                improved_skills: JSON.stringify(['Leadership']),
                improved_tools: JSON.stringify(['Jira'])
            }));
            expect(mockTrackImprovementActivity).toHaveBeenCalledWith(expect.objectContaining({
                provider: 'batch-job',
                event: 'post-analysis-merge',
                postAnalysisMergeRuns: 1,
                metadata: expect.objectContaining({
                    source: 'embedded-analysis-merge',
                    stage: 'post-analysis',
                    mergedKeys: expect.arrayContaining(['title', 'summary', 'tags', 'suggestions']),
                    itemId: 'i2c',
                    resumeId: 'res-1'
                })
            }));
        });

        it('should throw after retries if improvement keeps failing', async () => {
            mockQuery.mockResolvedValueOnce({
                rows: [{
                    id: 'res-1', original_text: 'Original text', global_rating: 70,
                    skills_score: 65, experience_score: 72, education_score: 68,
                    ats_score: 70, executive_summary_score: 75, hobbies_languages_score: 60,
                    name: 'Alice', title: 'Dev', key_improvements: '{}'
                }]
            });

            mockImprove
                .mockRejectedValueOnce(new Error('LLM timeout'))
                .mockRejectedValueOnce(new Error('LLM timeout'));

            await expect(
                processImproveItem({ id: 'i3', resume_id: 'res-1', file_name: 'a.pdf' }, job, {})
            ).rejects.toThrow('tentatives');
        }, 10000);

        it('should not retry when provider authentication fails during improvement', async () => {
            mockQuery.mockResolvedValueOnce({
                rows: [{
                    id: 'res-1', original_text: 'Original text', global_rating: 70,
                    skills_score: 65, experience_score: 72, education_score: 68,
                    ats_score: 70, executive_summary_score: 75, hobbies_languages_score: 60,
                    name: 'Alice', title: 'Dev', key_improvements: '{}'
                }]
            });

            mockImprove.mockRejectedValueOnce(new Error('token expired or incorrect'));

            await expect(
                processImproveItem({ id: 'i4', resume_id: 'res-1', file_name: 'a.pdf' }, job, {})
            ).rejects.toThrow("fournisseur IA est mal configuré");

            expect(mockImprove).toHaveBeenCalledTimes(1);
        });
    });
});
