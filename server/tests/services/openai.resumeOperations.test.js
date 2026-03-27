/**
 * Tests for OpenAI Resume Operations
 * analyzeResume, improveResume, normalizeAnalysisResponse
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn()
}));

vi.mock('../../services/llmProvider.service.js', () => ({
    callBusinessChatCompletion: vi.fn()
}));

vi.mock('../../services/openai/textUtils.js', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        cleanupHtml: vi.fn(html => html)
    };
});

import { callBusinessChatCompletion } from '../../services/llmProvider.service.js';
import { analyzeResume, improveResume } from '../../services/openai/resumeOperations.js';

describe('OpenAI Resume Operations', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('analyzeResume', () => {
        const mockAnalysis = {
            name: 'John Doe',
            title: 'Developer',
            globalRating: '85%',
            executiveSummaryRating: '80%',
            skillsRating: '90%',
            experiencesRating: '85%',
            educationRating: '70%',
            hobbiesLanguagesRating: '60%',
            atsOptimizationRating: '75%',
            tags: {
                skills: ['React', 'Node.js'],
                industries: ['IT'],
                tools: ['VS Code'],
                softSkills: ['Communication']
            },
            suggestions: {
                executiveSummary: ['Add summary'],
                skills: []
            }
        };

        it('should return normalized analysis', async () => {
            callBusinessChatCompletion.mockResolvedValueOnce({
                choices: [{ message: { content: JSON.stringify(mockAnalysis) } }]
            });

            const result = await analyzeResume('resume text', 'gpt-4o', '{TEXT} {FILENAME}');

            expect(result.name).toBe('John Doe');
            expect(result.globalRating).toBe('85%');
            expect(result.tags.skills).toContain('React');
            // Legacy format preserved
            expect(result['Global Rating']).toBe('85%');
            expect(result['Top Skills']).toContain('React');
        });

        it('should normalize GPT-5 format with different field names', async () => {
            callBusinessChatCompletion.mockResolvedValueOnce({
                choices: [{
                    message: {
                        content: JSON.stringify({
                            Name: 'Jane',
                            Title: 'PM',
                            'Global Rating': '70%',
                            'Executive Summary': '65%',
                            'Skills': '75%',
                            'Experience': '80%',
                            'Education': '60%',
                            'Hobbies Languages': '50%',
                            'ATS Compatibility': '70%',
                            'Top Skills': ['Agile'],
                            'Top Industries': ['Tech'],
                            'Top Tools': ['Jira'],
                            'Top Soft Skills': ['Leadership']
                        })
                    }
                }]
            });

            const result = await analyzeResume('resume', 'gpt-5', '{TEXT} {FILENAME}');

            expect(result.name).toBe('Jane');
            expect(result.skillsRating).toBe('75%');
            expect(result.tags.skills).toContain('Agile');
            expect(result.tags.tools).toContain('Jira');
        });

        it('should inject filename into prompt', async () => {
            callBusinessChatCompletion.mockResolvedValueOnce({
                choices: [{ message: { content: JSON.stringify(mockAnalysis) } }]
            });

            await analyzeResume('text', 'gpt-4o', 'Analyze {TEXT} file:{FILENAME}', null, false, 'cv_john.pdf');

            const callArgs = callBusinessChatCompletion.mock.calls[0][0];
            expect(callArgs.messages[1].content).toContain('cv_john.pdf');
        });

        it('should throw on invalid JSON response', async () => {
            callBusinessChatCompletion.mockResolvedValueOnce({
                choices: [{ message: { content: 'not valid json' } }]
            });

            await expect(analyzeResume('text', 'gpt-4o', '{TEXT} {FILENAME}')).rejects.toThrow();
        });
    });

    describe('improveResume', () => {
        it('should return structured result from JSON response', async () => {
            callBusinessChatCompletion.mockResolvedValueOnce({
                choices: [{
                    message: {
                        content: JSON.stringify({
                            improvedText: '<p>Improved CV</p>',
                            improvements: { overall: 90, skills: 85, experience: 80, education: 75, atsOptimization: 70, executiveSummary: 85, languagesInterests: 60 },
                            summary: { title: 'Dev', targetRole: 'Lead', industries: ['IT'] }
                        })
                    }
                }]
            });

            const result = await improveResume(
                'A'.repeat(200), // min 100 chars
                { name: 'John' },
                'gpt-4o',
                '{TEXT} {ANALYSIS} {FILENAME}'
            );

            expect(result.text).toBe('<p>Improved CV</p>');
            expect(result.analysis.globalRating).toBe(90);
            expect(result.analysis.skillsRating).toBe(85);
        });

        it('should handle HTML fallback response', async () => {
            callBusinessChatCompletion.mockResolvedValueOnce({
                choices: [{
                    message: { content: '<h1>Improved</h1><p>Content here</p>' }
                }]
            });

            const result = await improveResume(
                'A'.repeat(200),
                {},
                'gpt-4o',
                '{TEXT} {ANALYSIS} {FILENAME}'
            );

            expect(result.text).toContain('Improved');
            expect(result.analysis.globalRating).toBe(0);
        });

        it('should throw if input text is too short', async () => {
            await expect(improveResume(
                'short', {}, 'gpt-4o', '{TEXT} {ANALYSIS} {FILENAME}'
            )).rejects.toThrow('trop court');
        });

        it('should throw if JSON response has empty improvedText', async () => {
            callBusinessChatCompletion.mockResolvedValueOnce({
                choices: [{
                    message: {
                        content: JSON.stringify({ improvedText: '' })
                    }
                }]
            });

            await expect(improveResume(
                'A'.repeat(200), {}, 'gpt-4o', '{TEXT} {ANALYSIS} {FILENAME}'
            )).rejects.toThrow();
        });

        it('should strip markdown code fences from response', async () => {
            callBusinessChatCompletion.mockResolvedValueOnce({
                choices: [{
                    message: {
                        content: '```json\n' + JSON.stringify({
                            improvedText: '<p>Clean</p>',
                            improvements: { overall: 80 },
                            summary: {}
                        }) + '\n```'
                    }
                }]
            });

            const result = await improveResume(
                'A'.repeat(200), {}, 'gpt-4o', '{TEXT} {ANALYSIS} {FILENAME}'
            );

            expect(result.text).toBe('<p>Clean</p>');
        });
    });
});
