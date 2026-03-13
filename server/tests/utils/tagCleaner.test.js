/**
 * Tests for tagCleaner.js
 * Tag cleaning and normalization utilities
 */

import { describe, it, expect } from 'vitest';
import { 
    cleanTag, 
    cleanTagsArray, 
    cleanTagsObject, 
    processAnalysisTags 
} from '../../utils/tagCleaner.js';

describe('tagCleaner', () => {
    describe('cleanTag', () => {
        it('should trim whitespace from tag', () => {
            expect(cleanTag('  JavaScript  ')).toBe('JavaScript');
            expect(cleanTag('\tReact\n')).toBe('React');
        });

        it('should preserve original case', () => {
            expect(cleanTag('JavaScript')).toBe('JavaScript');
            expect(cleanTag('PYTHON')).toBe('PYTHON');
            expect(cleanTag('node.js')).toBe('node.js');
        });

        it('should preserve full technical terms', () => {
            expect(cleanTag('Machine Learning')).toBe('Machine Learning');
            expect(cleanTag('Natural Language Processing')).toBe('Natural Language Processing');
            expect(cleanTag('CI/CD')).toBe('CI/CD');
        });

        it('should return empty string for null', () => {
            expect(cleanTag(null)).toBe('');
        });

        it('should return empty string for undefined', () => {
            expect(cleanTag(undefined)).toBe('');
        });

        it('should return empty string for non-string types', () => {
            expect(cleanTag(123)).toBe('');
            expect(cleanTag({})).toBe('');
            expect(cleanTag([])).toBe('');
        });

        it('should return empty string for empty string', () => {
            expect(cleanTag('')).toBe('');
        });

        it('should handle whitespace-only strings', () => {
            expect(cleanTag('   ')).toBe('');
        });
    });

    describe('cleanTagsArray', () => {
        it('should clean all tags in array', () => {
            const tags = ['  JavaScript  ', 'React', '  Python  '];
            const result = cleanTagsArray(tags);

            expect(result).toContain('JavaScript');
            expect(result).toContain('React');
            expect(result).toContain('Python');
        });

        it('should remove duplicates', () => {
            const tags = ['JavaScript', 'javascript', 'JavaScript'];
            const result = cleanTagsArray(tags);

            // Note: cleanTag preserves case, so 'JavaScript' and 'javascript' are different
            expect(result.filter(t => t === 'JavaScript').length).toBe(1);
        });

        it('should sort tags alphabetically', () => {
            const tags = ['Zebra', 'Apple', 'Mango'];
            const result = cleanTagsArray(tags);

            expect(result).toEqual(['Apple', 'Mango', 'Zebra']);
        });

        it('should filter out empty tags', () => {
            const tags = ['JavaScript', '', '  ', null, 'React'];
            const result = cleanTagsArray(tags);

            expect(result).toEqual(['JavaScript', 'React']);
        });

        it('should return empty array for non-array input', () => {
            expect(cleanTagsArray(null)).toEqual([]);
            expect(cleanTagsArray(undefined)).toEqual([]);
            expect(cleanTagsArray('string')).toEqual([]);
            expect(cleanTagsArray(123)).toEqual([]);
        });

        it('should return empty array for empty array', () => {
            expect(cleanTagsArray([])).toEqual([]);
        });

        it('should handle mixed valid and invalid tags', () => {
            const tags = ['Valid', null, 123, 'Another', {}, 'Third'];
            const result = cleanTagsArray(tags);

            expect(result).toEqual(['Another', 'Third', 'Valid']);
        });
    });

    describe('cleanTagsObject', () => {
        it('should clean tags in all categories', () => {
            const tagsObj = {
                skills: ['  JavaScript  ', 'React'],
                tools: ['  Git  ', 'Docker']
            };

            const result = cleanTagsObject(tagsObj);

            expect(result.skills).toEqual(['JavaScript', 'React']);
            expect(result.tools).toEqual(['Docker', 'Git']);
        });

        it('should handle empty categories', () => {
            const tagsObj = {
                skills: [],
                tools: ['Git']
            };

            const result = cleanTagsObject(tagsObj);

            expect(result.skills).toEqual([]);
            expect(result.tools).toEqual(['Git']);
        });

        it('should skip non-array values', () => {
            const tagsObj = {
                skills: ['JavaScript'],
                invalid: 'not an array',
                tools: ['Git']
            };

            const result = cleanTagsObject(tagsObj);

            expect(result.skills).toEqual(['JavaScript']);
            expect(result.tools).toEqual(['Git']);
            expect(result.invalid).toBeUndefined();
        });

        it('should return empty object for null', () => {
            expect(cleanTagsObject(null)).toEqual({});
        });

        it('should return empty object for undefined', () => {
            expect(cleanTagsObject(undefined)).toEqual({});
        });

        it('should return empty object for non-object types', () => {
            expect(cleanTagsObject('string')).toEqual({});
            expect(cleanTagsObject(123)).toEqual({});
            expect(cleanTagsObject([])).toEqual({});
        });

        it('should return empty object for empty object', () => {
            expect(cleanTagsObject({})).toEqual({});
        });
    });

    describe('processAnalysisTags', () => {
        it('should process complete analysis data', () => {
            const analysisData = {
                tags: {
                    skills: ['  JavaScript  ', 'React'],
                    industries: ['  Tech  ', 'Finance'],
                    tools: ['  Git  ', 'Docker'],
                    softSkills: ['  Leadership  ', 'Communication']
                }
            };

            const result = processAnalysisTags(analysisData);

            expect(result.rawTags.skills).toEqual(['  JavaScript  ', 'React']);
            expect(result.cleanedTags.skills).toEqual(['JavaScript', 'React']);
            expect(result.cleanedTags.industries).toEqual(['Finance', 'Tech']);
            expect(result.cleanedTags.tools).toEqual(['Docker', 'Git']);
            expect(result.cleanedTags.softSkills).toEqual(['Communication', 'Leadership']);
        });

        it('should return empty arrays for null analysisData', () => {
            const result = processAnalysisTags(null);

            expect(result.rawTags).toEqual({
                skills: [],
                industries: [],
                tools: [],
                softSkills: []
            });
            expect(result.cleanedTags).toEqual({
                skills: [],
                industries: [],
                tools: [],
                softSkills: []
            });
        });

        it('should return empty arrays for undefined analysisData', () => {
            const result = processAnalysisTags(undefined);

            expect(result.rawTags.skills).toEqual([]);
            expect(result.cleanedTags.skills).toEqual([]);
        });

        it('should return empty arrays when tags is missing', () => {
            const analysisData = { someOtherField: 'value' };

            const result = processAnalysisTags(analysisData);

            expect(result.rawTags.skills).toEqual([]);
            expect(result.cleanedTags.skills).toEqual([]);
        });

        it('should handle partial tags object', () => {
            const analysisData = {
                tags: {
                    skills: ['JavaScript'],
                    // industries, tools, softSkills missing
                }
            };

            const result = processAnalysisTags(analysisData);

            expect(result.rawTags.skills).toEqual(['JavaScript']);
            expect(result.rawTags.industries).toEqual([]);
            expect(result.rawTags.tools).toEqual([]);
            expect(result.rawTags.softSkills).toEqual([]);
        });

        it('should handle non-array tag values', () => {
            const analysisData = {
                tags: {
                    skills: 'not an array',
                    industries: null,
                    tools: 123,
                    softSkills: {}
                }
            };

            const result = processAnalysisTags(analysisData);

            expect(result.rawTags.skills).toEqual([]);
            expect(result.rawTags.industries).toEqual([]);
            expect(result.rawTags.tools).toEqual([]);
            expect(result.rawTags.softSkills).toEqual([]);
        });

        it('should preserve raw tags while cleaning', () => {
            const analysisData = {
                tags: {
                    skills: ['  Dirty Tag  ', 'Clean'],
                    industries: [],
                    tools: [],
                    softSkills: []
                }
            };

            const result = processAnalysisTags(analysisData);

            // Raw should preserve original
            expect(result.rawTags.skills).toEqual(['  Dirty Tag  ', 'Clean']);
            // Cleaned should be trimmed and sorted
            expect(result.cleanedTags.skills).toEqual(['Clean', 'Dirty Tag']);
        });

        it('should remove duplicates in cleaned tags', () => {
            const analysisData = {
                tags: {
                    skills: ['JavaScript', 'JavaScript', 'React'],
                    industries: [],
                    tools: [],
                    softSkills: []
                }
            };

            const result = processAnalysisTags(analysisData);

            expect(result.cleanedTags.skills).toEqual(['JavaScript', 'React']);
        });
    });
});
