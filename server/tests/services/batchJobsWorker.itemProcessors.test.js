/**
 * Tests for Batch Jobs Worker - Item Processors
 * processImportItem, processImproveItem
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../utils/logger.backend.js', () => ({ safeLog: vi.fn() }));
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
vi.mock('../../services/batchJobs.service.js', () => ({
    ITEM_STATUS: { PENDING: 'pending', PROCESSING: 'processing', SUCCESS: 'success', ERROR: 'error', PENDING_NAME: 'pending_name' },
    updateJobItemStatus: vi.fn()
}));

const mockExtractText = vi.fn();
vi.mock('../../services/batchJobsWorker/textExtraction.js', () => ({
    extractTextFromBuffer: (...args) => mockExtractText(...args)
}));

const mockAnalyze = vi.fn();
const mockImprove = vi.fn();
vi.mock('../../services/batchJobsWorker/llmIntegration.js', () => ({
    analyzeResumeWithLLM: (...args) => mockAnalyze(...args),
    improveResumeWithLLM: (...args) => mockImprove(...args)
}));

vi.mock('../../services/batchJobsWorker/helpers.js', () => ({
    parseScore: vi.fn(v => typeof v === 'number' ? v : parseInt(v) || 0),
    generateTrigram: vi.fn(name => (name || 'XXX').substring(0, 3).toUpperCase())
}));

vi.mock('../../services/settings.service.js', () => ({
    getLLMSettings: vi.fn(() => ({
        cvMode: 'named',
        executiveSummaryWeight: 20, skillsWeight: 20, experienceWeight: 20,
        educationWeight: 15, atsWeight: 15, hobbiesLanguagesWeight: 10
    }))
}));

const mockSendConsentRequest = vi.fn();
const mockMarkConsentError = vi.fn();
vi.mock('../../services/consent.service.js', () => ({
    sendConsentRequest: (...args) => mockSendConsentRequest(...args),
    markConsentError: (...args) => mockMarkConsentError(...args)
}));

import { processImportItem, processImproveItem } from '../../services/batchJobsWorker/itemProcessors.js';
import { updateJobItemStatus } from '../../services/batchJobs.service.js';

describe('Batch Jobs Worker - Item Processors', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const job = { id: 'job-1', firm_id: 'firm-1', firm_name: 'TestFirm' };

    describe('processImportItem', () => {
        const item = { id: 'item-1', file_name: 'cv.pdf', file_data: Buffer.from('pdf'), file_mime_type: 'application/pdf' };

        it('should import and analyze a resume', async () => {
            // DB insert returns resume id
            mockQuery
                .mockResolvedValueOnce({ rows: [{ id: 'res-1' }] }) // INSERT resume
                .mockResolvedValueOnce({ rows: [] }) // UPDATE resume_file_url
                .mockResolvedValueOnce({ rows: [] }); // UPDATE resume with analysis

            mockExtractText.mockResolvedValueOnce('A long resume text that is more than fifty characters for the check to pass easily.');

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
                suggestions: { tip: 'improve skills' }
            });

            await processImportItem(item, job, { improve: false });

            // Should create resume record
            expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO resumes'), expect.any(Array));
            // Should extract text
            expect(mockExtractText).toHaveBeenCalledWith(item.file_data, item.file_mime_type, item.file_name);
            // Should analyze
            expect(mockAnalyze).toHaveBeenCalledWith(expect.any(String), 'firm-1', 'cv.pdf');
            // Should update resume with analysis
            expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('UPDATE resumes SET'), expect.any(Array));
        });

        it('should throw on text too short', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [{ id: 'res-1' }] });
            mockQuery.mockResolvedValueOnce({ rows: [] });
            mockExtractText.mockResolvedValueOnce('short');

            await expect(processImportItem(item, job, {})).rejects.toThrow("extraire le texte");
        });

        it('should pause item when name extraction fails', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [{ id: 'res-1' }] })
                .mockResolvedValueOnce({ rows: [] })
                .mockResolvedValueOnce({ rows: [] }); // UPDATE with partial analysis

            mockExtractText.mockResolvedValueOnce('A long resume text that is more than fifty characters for validation.');
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
        });

        it('should preserve external profile metadata and send consent request', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [{ id: 'res-1' }] })
                .mockResolvedValueOnce({ rows: [] })
                .mockResolvedValueOnce({ rows: [] });

            mockExtractText.mockResolvedValueOnce('A long resume text that is more than fifty characters for the check to pass easily.');
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

            expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('candidate_name'), expect.arrayContaining([
                'Jane Candidate',
                'jane@example.com',
                'external',
                'pending_consent'
            ]));
            expect(mockSendConsentRequest).toHaveBeenCalledWith('res-1');
        });

        it('should use the provided candidate name as fallback when analysis returns XXX', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [{ id: 'res-1' }] })
                .mockResolvedValueOnce({ rows: [] })
                .mockResolvedValueOnce({ rows: [] });

            mockExtractText.mockResolvedValueOnce('A long resume text that is more than fifty characters for validation.');
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
            expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('name = COALESCE'), expect.arrayContaining(['Fallback Name']));
        });

        it('should import and improve when improve=true', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [{ id: 'res-1' }] })
                .mockResolvedValueOnce({ rows: [] })
                .mockResolvedValueOnce({ rows: [] }) // analysis update
                .mockResolvedValueOnce({ rows: [] }); // improvement update

            mockExtractText.mockResolvedValueOnce('A long resume text that is more than fifty characters for the check to pass easily.');
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

            await processImportItem(item, job, { improve: true });

            expect(mockImprove).toHaveBeenCalled();
            // Should save improved data
            expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('improved_text'), expect.any(Array));
        });
    });

    describe('processImproveItem', () => {
        it('should throw if no resume_id', async () => {
            await expect(processImproveItem({ id: 'i1' }, job, {})).rejects.toThrow('Resume ID manquant');
        });

        it('should throw if resume not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [] });

            await expect(processImproveItem({ id: 'i1', resume_id: 'res-1' }, job, {})).rejects.toThrow('CV non trouvé');
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

            await processImproveItem({ id: 'i2', resume_id: 'res-1', file_name: 'bob.pdf' }, job, {});

            expect(mockImprove).toHaveBeenCalledWith('Original CV text', expect.objectContaining({ name: 'Bob' }), 'firm-1', 'bob.pdf');
            expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('improved_text'), expect.any(Array));
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
    });
});
