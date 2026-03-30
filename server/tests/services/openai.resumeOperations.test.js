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

vi.mock('../../services/metrics.service.js', () => ({
    __esModule: true,
    default: {
        trackImprovementActivity: vi.fn()
    },
    buildLLMMetricLabel: vi.fn((provider, model = '') => model ? `${provider}:${model}` : provider)
}));

vi.mock('../../services/llmConfiguration.service.js', () => ({
    isLikelyAnthropicModel: vi.fn((model) => /^claude/i.test(String(model || ''))),
    isLikelyDeepSeekModel: vi.fn((model) => /^deepseek/i.test(String(model || ''))),
    isLikelyGlmModel: vi.fn((model) => /^glm/i.test(String(model || ''))),
    isLikelyMiniMaxModel: vi.fn((model) => /^minimax/i.test(String(model || '')))
}));

vi.mock('../../services/openai/textUtils.js', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        cleanupHtml: vi.fn(html => html)
    };
});

import { callBusinessChatCompletion } from '../../services/llmProvider.service.js';
import metrics from '../../services/metrics.service.js';
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

        it('should normalize alternate suggestion keys from analysis response', async () => {
            callBusinessChatCompletion.mockResolvedValueOnce({
                choices: [{
                    message: {
                        content: JSON.stringify({
                            name: 'Jane',
                            globalRating: '78%',
                            'Key Improvements': {
                                executiveBrief: ['Shorten intro'],
                                skillsKeywords: ['Group skills by category'],
                                experience: ['Add concrete deliverables'],
                                formation: ['Clarify degree title'],
                                ats: ['Use clearer section headings'],
                                languages: ['Make language levels explicit']
                            }
                        })
                    }
                }]
            });

            const result = await analyzeResume('resume', 'gpt-5', '{TEXT} {FILENAME}');

            expect(result.suggestions.executiveSummary).toEqual(['Shorten intro']);
            expect(result.suggestions.skills).toEqual(['Group skills by category']);
            expect(result.suggestions.experiences).toEqual(['Add concrete deliverables']);
            expect(result.suggestions.education).toEqual(['Clarify degree title']);
            expect(result.suggestions.atsOptimization).toEqual(['Use clearer section headings']);
            expect(result.suggestions.hobbiesLanguages).toEqual(['Make language levels explicit']);
        });

        it('should normalize malformed analysis tag and suggestion payloads', async () => {
            callBusinessChatCompletion.mockResolvedValueOnce({
                choices: [{
                    message: {
                        content: JSON.stringify({
                            name: 42,
                            globalRating: 81,
                            tags: {
                                skills: 'React; Node.js',
                                industries: { primary: 'IT' },
                                tools: ['VS Code', { label: 'Docker' }],
                                soft_skills: 'Communication, Leadership'
                            },
                            suggestions: {
                                executiveSummary: 'Add a sharper summary',
                                skills: { first: 'Group keywords' }
                            }
                        })
                    }
                }]
            });

            const result = await analyzeResume('resume text', 'gpt-4o', '{TEXT} {FILENAME}');

            expect(result.name).toBe('42');
            expect(result.globalRating).toBe('81%');
            expect(result.tags.skills).toEqual(['React', 'Node.js']);
            expect(result.tags.industries).toEqual(['IT']);
            expect(result.tags.tools).toEqual(['VS Code', 'Docker']);
            expect(result.tags.softSkills).toEqual(['Communication', 'Leadership']);
            expect(result.suggestions.executiveSummary).toEqual(['Add a sharper summary']);
            expect(result.suggestions.skills).toEqual(['Group keywords']);
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

        it('should retry once when analysis JSON is truncated and succeed on compact retry', async () => {
            callBusinessChatCompletion
                .mockResolvedValueOnce({
                    choices: [{
                        message: {
                            content: '{"name":"John","globalRating":"85%","summary":"truncated'
                        }
                    }]
                })
                .mockResolvedValueOnce({
                    choices: [{
                        message: {
                            content: JSON.stringify(mockAnalysis)
                        }
                    }]
                });

            const result = await analyzeResume('resume text', 'gpt-4o', '{TEXT} {FILENAME}');

            expect(result.name).toBe('John Doe');
            expect(callBusinessChatCompletion).toHaveBeenCalledTimes(2);
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
                'A'.repeat(200),
                { name: 'John' },
                'gpt-4o',
                '{TEXT} {ANALYSIS} {FILENAME}'
            );

            expect(result.text).toBe('<p>Improved CV</p>');
            expect(result.analysis.globalRating).toBe(90);
            expect(result.analysis.skillsRating).toBe(85);
            expect(metrics.trackImprovementActivity).toHaveBeenCalledWith(expect.objectContaining({
                successfulRuns: 1,
                structuredRuns: 1
            }));
        });

        it('should prefer structured HTML over flattened improvedText when both are present', async () => {
            callBusinessChatCompletion.mockResolvedValueOnce({
                choices: [{
                    message: {
                        content: JSON.stringify({
                            improvedText: 'Experiences Professionnelles Consultant Senior',
                            structuredText: '<h2>Experiences Professionnelles</h2><h4>Consultant Senior</h4><ul><li>Mission cle</li></ul>',
                            improvements: { overall: 88 },
                            summary: {}
                        })
                    }
                }]
            });

            const result = await improveResume(
                '<h2>Experiences Professionnelles</h2><p>Source</p>'.repeat(5),
                {},
                'gpt-4o',
                '{TEXT} {ANALYSIS} {FILENAME}'
            );

            expect(result.text).toContain('<h2>Experiences Professionnelles</h2>');
            expect(result.text).toContain('<h4>Consultant Senior</h4>');
        });


        it('should ignore flat text fields when any HTML field is present in the LLM payload', async () => {
            callBusinessChatCompletion.mockResolvedValueOnce({
                choices: [{
                    message: {
                        content: JSON.stringify({
                            improvedText: 'Version texte aplatie',
                            text: 'Autre version texte',
                            html: '<h2>Competences</h2><ul><li>Architecture</li></ul>',
                            improvements: { overall: 91 },
                            summary: {}
                        })
                    }
                }]
            });

            const result = await improveResume(
                '<h2>Competences</h2><p>Source</p>'.repeat(5),
                {},
                'gpt-4o',
                '{TEXT} {ANALYSIS} {FILENAME}'
            );

            expect(result.text).toBe('<h2>Competences</h2><ul><li>Architecture</li></ul>');
        });
        it('should keep explicit tags and avoid deriving suggestions from unrelated summary fields', async () => {
            callBusinessChatCompletion.mockResolvedValueOnce({
                choices: [{
                    message: {
                        content: JSON.stringify({
                            improvedText: '<h2>Resume</h2><p>Improved</p>',
                            name: 'JCH',
                            summary: {
                                title: 'Consultant Independant',
                                targetRole: 'Consultant Transformation',
                                industries: ['Assurance']
                            },
                            skills: ['TOGAF', 'SAFe'],
                            industries: ['Conseil', 'Assurance']
                        })
                    }
                }]
            });

            const result = await improveResume(
                '<h2>Resume</h2><p>Source</p>'.repeat(5),
                { name: 'John', skillsRating: 77 },
                'deepseek-reasoner',
                '{TEXT} {ANALYSIS} {FILENAME}'
            );

            expect(result.analysis.skillsRating).toBeUndefined();
            expect(result.analysis.tags.skills).toEqual(['TOGAF', 'SAFe']);
            expect(result.analysis.tags.industries).toEqual(['Conseil', 'Assurance']);
            expect(result.analysis.suggestions.executiveSummary).toEqual([]);
            expect(result.analysis.suggestions.skills).toEqual([]);
        });

        it('should normalize malformed improvement envelope fields', async () => {
            callBusinessChatCompletion.mockResolvedValueOnce({
                choices: [{
                    message: {
                        content: JSON.stringify({
                            improvedText: '<p>Improved CV</p>',
                            summary: {
                                title: 123,
                                targetRole: 'Lead Developer',
                                industries: { primary: 'Finance' }
                            },
                            tags: {
                                skills: 'React, TypeScript',
                                tools: { one: 'Docker', two: 'Git' },
                                soft_skills: 'Communication; Leadership'
                            },
                            certifications: 'AWS',
                            languages: { first: 'French', second: 'English' }
                        })
                    }
                }]
            });

            const result = await improveResume(
                'A'.repeat(200),
                { name: 'John' },
                'gpt-4o',
                '{TEXT} {ANALYSIS} {FILENAME}'
            );

            expect(result.text).toBe('<p>Improved CV</p>');
            expect(result.analysis.title).toBe('Lead Developer');
            expect(result.analysis.tags.skills).toEqual(['React', 'TypeScript']);
            expect(result.analysis.tags.tools).toEqual(['Docker', 'Git']);
            expect(result.analysis.tags.softSkills).toEqual(['Communication', 'Leadership']);
            expect(result.analysis.languages).toEqual(['French', 'English']);
            expect(result.analysis.certifications).toEqual(['AWS']);
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

        it('should retry once when improvement JSON is truncated and succeed on compact retry', async () => {
            callBusinessChatCompletion
                .mockResolvedValueOnce({
                    choices: [{
                        message: {
                            content: '{"improvedText":"<p>Improved CV</p>","summary":{"title":"Lead'
                        }
                    }]
                })
                .mockResolvedValueOnce({
                    choices: [{
                        message: {
                            content: JSON.stringify({
                                improvedText: '<p>Improved CV</p>',
                                improvements: { overall: 90, skills: 85 },
                                summary: { title: 'Lead Developer' }
                            })
                        }
                    }]
                });

            const result = await improveResume(
                'A'.repeat(200),
                { name: 'John' },
                'gpt-4o',
                '{TEXT} {ANALYSIS} {FILENAME}'
            );

            expect(result.text).toBe('<p>Improved CV</p>');
            expect(result.analysis.title).toBe('Lead Developer');
            expect(callBusinessChatCompletion).toHaveBeenCalledTimes(2);
            expect(metrics.trackImprovementActivity).toHaveBeenCalledWith(expect.objectContaining({
                metadata: expect.objectContaining({ source: 'structured-json-retry-success' })
            }));
        });
    });
});

