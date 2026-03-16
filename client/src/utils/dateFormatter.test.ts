/**
 * Tests for dateFormatter utility
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { formatDate, formatDateTime, formatDateSmart, formatPeriod } from './dateFormatter';

describe('dateFormatter', () => {
    describe('formatDate', () => {
        it('should return empty string for null/undefined', () => {
            expect(formatDate(null)).toBe('');
            expect(formatDate(undefined)).toBe('');
            expect(formatDate('')).toBe('');
        });

        it('should return empty string for invalid date', () => {
            expect(formatDate('not-a-date')).toBe('');
            expect(formatDate('abc123')).toBe('');
        });

        it('should format ISO date string in short style', () => {
            const result = formatDate('2024-03-15T10:30:00Z', 'short', 'fr-FR');
            expect(result).toContain('2024');
            expect(result).toContain('03');
            expect(result).toContain('15');
        });

        it('should format ISO date string in medium style', () => {
            const result = formatDate('2024-03-15T10:30:00Z', 'medium', 'fr-FR');
            expect(result).toContain('2024');
        });

        it('should format ISO date string in long style', () => {
            const result = formatDate('2024-03-15T10:30:00Z', 'long', 'fr-FR');
            expect(result).toContain('2024');
        });

        it('should format Date object', () => {
            const date = new Date('2024-06-01T00:00:00Z');
            const result = formatDate(date, 'short', 'en-US');
            expect(result).toContain('2024');
        });

        it('should handle relative style', () => {
            const now = new Date();
            const result = formatDate(now, 'relative', 'fr-FR');
            expect(result).toBeTruthy();
        });

        it('should default to medium style', () => {
            const result = formatDate('2024-01-15T00:00:00Z');
            expect(result).toContain('2024');
        });
    });

    describe('formatDateTime', () => {
        it('should return empty string for null/undefined', () => {
            expect(formatDateTime(null)).toBe('');
            expect(formatDateTime(undefined)).toBe('');
        });

        it('should return empty string for invalid date', () => {
            expect(formatDateTime('invalid')).toBe('');
        });

        it('should format date with time', () => {
            const result = formatDateTime('2024-03-15T14:30:00Z', false, 'en-US');
            expect(result).toContain('2024');
        });

        it('should include seconds when requested', () => {
            const result = formatDateTime('2024-03-15T14:30:45Z', true, 'en-US');
            expect(result).toBeTruthy();
        });

        it('should accept Date object', () => {
            const date = new Date('2024-06-15T10:00:00Z');
            const result = formatDateTime(date);
            expect(result).toContain('2024');
        });
    });

    describe('formatDateSmart', () => {
        it('should return empty string for null/undefined', () => {
            expect(formatDateSmart(null)).toBe('');
            expect(formatDateSmart(undefined)).toBe('');
        });

        it('should return empty string for invalid date', () => {
            expect(formatDateSmart('not-valid')).toBe('');
        });

        it('should use relative format for recent dates', () => {
            const now = new Date();
            const result = formatDateSmart(now, 'fr-FR');
            expect(result).toBeTruthy();
        });

        it('should use medium format for older dates', () => {
            const oldDate = new Date('2020-01-01T00:00:00Z');
            const result = formatDateSmart(oldDate, 'fr-FR');
            expect(result).toContain('2020');
        });
    });

    describe('formatPeriod', () => {
        it('should return empty string for null/undefined', () => {
            expect(formatPeriod(null)).toBe('');
            expect(formatPeriod(undefined)).toBe('');
        });

        it('should format quarter in French', () => {
            expect(formatPeriod('2024-T1', 'fr-FR')).toContain('trimestre');
            expect(formatPeriod('2024-T1', 'fr-FR')).toContain('2024');
            expect(formatPeriod('2024-T3', 'fr-FR')).toContain('3');
        });

        it('should format quarter in English', () => {
            expect(formatPeriod('2024-T2', 'en-US')).toBe('Q2 2024');
        });

        it('should format month period', () => {
            const result = formatPeriod('2024-03', 'fr-FR');
            expect(result).toContain('2024');
        });

        it('should return as-is for unrecognized format', () => {
            expect(formatPeriod('something')).toBe('something');
        });

        it('should handle 1st quarter ordinal in French', () => {
            const result = formatPeriod('2024-T1', 'fr-FR');
            expect(result).toContain('1er');
        });

        it('should handle non-1st quarter ordinal in French', () => {
            const result = formatPeriod('2024-T2', 'fr-FR');
            expect(result).toContain('2');
        });
    });
});
