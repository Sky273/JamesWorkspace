import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../utils/tagCleaner.js', () => ({
    processAnalysisTags: vi.fn(({ tags }) => ({ cleanedTags: tags }))
}));

vi.mock('../../routes/resumes/helpers.js', () => ({
    parseScore: vi.fn((value) => {
        if (value === undefined || value === null) return undefined;
        return typeof value === 'number' ? value : parseInt(String(value).replace('%', ''), 10);
    }),
    stringifyIfNeeded: vi.fn((value) => typeof value === 'string' ? value : JSON.stringify(value || []))
}));

vi.mock('../../routes/resumes/crud/improvementHelpers.js', () => ({
    hasSuggestionContent: vi.fn((payload) => Boolean(payload && Object.keys(payload).length > 0)),
    parseSuggestionsPayload: vi.fn((value) => {
        if (!value) return null;
        return typeof value === 'string' ? JSON.parse(value) : value;
    })
}));

import {
    buildDeferredPostAnalysisDecision,
    buildResumeUpdateData,
    buildVersionPayload,
    getCleanedTagsLogContext,
    getPreparedUpdateLogContext,
    getUpdateRequestLogContext,
    resolveResumeChangeReason,
    shouldInvalidateResumeTagsCache
} from '../../routes/resumes/crud/updateResumeFlow.js';

describe('updateResumeFlow', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('buildResumeUpdateData maps scalar, score, and json-like fields', () => {
        const { updateData } = buildResumeUpdateData({
            name: 'Modern Name',
            status: 'Improved',
            globalRating: '91%',
            improvedSkills: ['Node.js'],
            keyImprovements: { summary: 'Better' },
            improvedKeyImprovements: { summary: 'Best' },
            analysisDate: '2026-03-31T12:00:00.000Z'
        });

        expect(updateData).toMatchObject({
            name: 'Modern Name',
            status: 'improved',
            global_rating: 91,
            improved_skills: JSON.stringify(['Node.js']),
            key_improvements: JSON.stringify({ summary: 'Better' }),
            improved_key_improvements: JSON.stringify({ summary: 'Best' }),
            improvement_suggestions: JSON.stringify({ summary: 'Best' })
        });
        expect(updateData.analyzed_at).toBeInstanceOf(Date);
    });

    it('buildResumeUpdateData computes cleaned tags metadata when raw tags are provided', () => {
        const { updateData, cleanedTagsMetadata } = buildResumeUpdateData({
            skills: ['JavaScript', 'Python'],
            industries: ['Finance']
        });

        expect(cleanedTagsMetadata).not.toBeNull();
        expect(updateData.skills_cleaned).toBe(JSON.stringify(['JavaScript', 'Python']));
        expect(updateData.industries_cleaned).toBe(JSON.stringify(['Finance']));
    });

    it('resolveResumeChangeReason detects initial improvements', () => {
        expect(resolveResumeChangeReason(
            { status: 'Improved', lastImproved: '2026-03-31T12:00:00.000Z' },
            { improved_text: 'new text' }
        )).toBe('initial_improvement');

        expect(resolveResumeChangeReason({}, { improved_text: 'new text' })).toBe('manual_edit');
        expect(resolveResumeChangeReason({}, {})).toBe('manual_edit');
    });

    it('buildVersionPayload normalizes version fields for createVersion', () => {
        const versionPayload = buildVersionPayload({
            resumeId: 'resume-1',
            userId: 'user-1',
            changeReason: 'initial_improvement',
            updateData: {
                improved_text: 'updated content',
                improved_global_rating: 90,
                improved_skills: JSON.stringify(['Node.js']),
                improved_industries: JSON.stringify(['Finance']),
                improved_tools: JSON.stringify(['Vitest']),
                improved_soft_skills: JSON.stringify(['Leadership']),
                improved_key_improvements: '{"summary":"Best"}'
            }
        });

        expect(versionPayload).toMatchObject({
            resumeId: 'resume-1',
            improvedText: 'updated content',
            userId: 'user-1',
            changeReason: 'initial_improvement'
        });
        expect(versionPayload.tags.improvedSkills).toEqual(['Node.js']);
        expect(versionPayload.tags.improvedIndustries).toEqual(['Finance']);
    });

    it('buildDeferredPostAnalysisDecision flags missing immediate post-analysis', () => {
        const decision = buildDeferredPostAnalysisDecision('initial_improvement', {
            improved_text: 'updated content',
            improved_key_improvements: null
        });

        expect(decision.hasImmediateSuggestions).toBe(false);
        expect(decision.hasImmediatePostAnalysisPayload).toBe(false);
        expect(decision.shouldRunDeferredPostAnalysis).toBe(true);
    });

    it('exposes compact log contexts', () => {
        expect(getUpdateRequestLogContext(
            { improvedGlobalRating: 88, improvedSkillsScore: 77, improvedExperienceScore: 66 },
            { Name: 'X', Title: 'Y' }
        )).toEqual({
            bodyKeys: ['Name', 'Title'],
            hasImprovedGlobalRating: true,
            improvedGlobalRatingValue: 88,
            improvedSkillsScoreValue: 77,
            improvedExperienceScoreValue: 66
        });

        expect(getPreparedUpdateLogContext({ global_rating: 91, name: 'Modern Name' })).toEqual({
            fieldsToUpdate: ['global_rating', 'name'],
            hasGlobalRating: true,
            globalRatingMapped: 91
        });

        expect(getCleanedTagsLogContext({
            rawTags: { skills: ['A'], industries: ['B'] },
            cleanedTags: { skills: ['A'], industries: ['B'] }
        })).toEqual({
            rawSkills: 1,
            cleanedSkills: 1,
            rawIndustries: 1,
            cleanedIndustries: 1
        });
    });

    it('shouldInvalidateResumeTagsCache detects cleaned tag writes', () => {
        expect(shouldInvalidateResumeTagsCache({ skills_cleaned: '[]' })).toBe(true);
        expect(shouldInvalidateResumeTagsCache({})).toBe(false);
    });
});
