/**
 * Tests for Batch Jobs Worker - Helpers
 * Tests parseScore and removeSuggestionMarkers
 */

import { describe, it, expect } from 'vitest';

import { parseScore, removeSuggestionMarkers } from '../../services/batchJobsWorker/helpers.js';

describe('Batch Jobs Worker - Helpers', () => {
    describe('parseScore', () => {
        it('should parse integer number', () => {
            expect(parseScore(84)).toBe(84);
        });

        it('should round float number', () => {
            expect(parseScore(84.7)).toBe(85);
            expect(parseScore(84.2)).toBe(84);
        });

        it('should parse string number', () => {
            expect(parseScore('84')).toBe(84);
        });

        it('should parse string with percent sign', () => {
            expect(parseScore('84%')).toBe(84);
        });

        it('should handle whitespace', () => {
            expect(parseScore(' 84 % ')).toBe(84);
        });

        it('should return null for null/undefined', () => {
            expect(parseScore(null)).toBeNull();
            expect(parseScore(undefined)).toBeNull();
        });

        it('should return null for non-numeric string', () => {
            expect(parseScore('abc')).toBeNull();
        });

        it('should return null for other types', () => {
            expect(parseScore({})).toBeNull();
            expect(parseScore([])).toBeNull();
            expect(parseScore(true)).toBeNull();
        });
    });

    describe('removeSuggestionMarkers', () => {
        it('should remove suggestion highlight spans', () => {
            const input = '<span style="color:#F59E0B">Suggestion</span>rest';
            const result = removeSuggestionMarkers(input);
            expect(result).not.toContain('#F59E0B');
            expect(result).toContain('rest');
        });

        it('should remove lightbulb emoji spans', () => {
            const input = '<span>💡 tip</span>text';
            const result = removeSuggestionMarkers(input);
            expect(result).not.toContain('💡');
            expect(result).toContain('text');
        });

        it('should remove standalone lightbulb emojis', () => {
            const input = 'Some text 💡 3 more text';
            const result = removeSuggestionMarkers(input);
            expect(result).not.toContain('💡');
        });

        it('should remove empty spans and divs', () => {
            const input = '<span>  </span><div>  </div>content';
            const result = removeSuggestionMarkers(input);
            expect(result).toContain('content');
        });

        it('should collapse multiple whitespaces', () => {
            const input = 'hello    world';
            expect(removeSuggestionMarkers(input)).toBe('hello world');
        });

        it('should handle null/empty input', () => {
            expect(removeSuggestionMarkers(null)).toBe('');
            expect(removeSuggestionMarkers('')).toBe('');
            expect(removeSuggestionMarkers(undefined)).toBe('');
        });

        it('should preserve normal HTML content', () => {
            const input = '<h1>Title</h1><p>Content</p>';
            expect(removeSuggestionMarkers(input)).toBe(input);
        });
    });
});
