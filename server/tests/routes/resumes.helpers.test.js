/**
 * Tests for resumes/helpers.js
 * checkResumeAccess, parseScore, stringifyIfNeeded, mapResumeToFrontend
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../utils/logger.backend.js', () => ({ safeLog: vi.fn() }));

const mockGetResumeForAccessCheck = vi.fn();
vi.mock('../../services/resumes.service.js', () => ({
    getResumeForAccessCheck: (...a) => mockGetResumeForAccessCheck(...a),
    RESUME_SELECT_COLUMNS: 'id, name'
}));

const mockGetUserFirmId = vi.fn();
const mockIsUserAdmin = vi.fn();
vi.mock('../../utils/firmHelpers.js', () => ({
    getUserFirmId: (...a) => mockGetUserFirmId(...a),
    isUserAdmin: (...a) => mockIsUserAdmin(...a)
}));

import { checkResumeAccess, parseScore, stringifyIfNeeded, mapResumeToFrontend } from '../../routes/resumes/helpers.js';

describe('resumes/helpers', () => {
    beforeEach(() => vi.resetAllMocks());

    describe('parseScore', () => {
        it('should return undefined for null/undefined', () => {
            expect(parseScore(null)).toBeUndefined();
            expect(parseScore(undefined)).toBeUndefined();
        });

        it('should return number as-is', () => {
            expect(parseScore(75)).toBe(75);
            expect(parseScore(0)).toBe(0);
        });

        it('should parse string number', () => {
            expect(parseScore('85')).toBe(85);
        });

        it('should parse percentage string', () => {
            expect(parseScore('72%')).toBe(72);
        });

        it('should return undefined for non-numeric string', () => {
            expect(parseScore('abc')).toBeUndefined();
        });
    });

    describe('stringifyIfNeeded', () => {
        it('should return valid JSON string as-is', () => {
            const json = '["a","b"]';
            expect(stringifyIfNeeded(json)).toBe(json);
        });

        it('should wrap plain string in array', () => {
            expect(stringifyIfNeeded('hello')).toBe('["hello"]');
        });

        it('should stringify arrays', () => {
            expect(stringifyIfNeeded(['a', 'b'])).toBe('["a","b"]');
        });

        it('should stringify objects', () => {
            const result = stringifyIfNeeded({ key: 'val' });
            expect(JSON.parse(result)).toEqual({ key: 'val' });
        });

        it('should return empty array for null/undefined', () => {
            expect(stringifyIfNeeded(null)).toBe('[]');
            expect(stringifyIfNeeded(undefined)).toBe('[]');
        });
    });

    describe('mapResumeToFrontend', () => {
        it('should map database record to frontend format', () => {
            const record = {
                id: 'r1', name: 'Alice', title: 'Dev', file_name: 'cv.pdf',
                resume_file_url: '/api/resumes/r1/download', resume_file_size: 1024,
                resume_file_type: 'application/pdf',
                status: 'analyzed', firm_name: 'Corp',
                global_rating: 80, skills_score: 75,
                original_text: '<p>text</p>', created_at: '2024-01-01'
            };

            const result = mapResumeToFrontend(record);

            expect(result.id).toBe('r1');
            expect(result.Name).toBe('Alice');
            expect(result.Title).toBe('Dev');
            expect(result['File Name']).toBe('cv.pdf');
            expect(result['Resume File']).toHaveLength(1);
            expect(result['Resume File'][0].filename).toBe('cv.pdf');
            expect(result.Status).toBe('analyzed');
            expect(result['Global Rating']).toBe(80);
            expect(result['Original Text']).toBe('<p>text</p>');
        });

        it('should return empty array for Resume File when no URL', () => {
            const result = mapResumeToFrontend({ id: 'r2', resume_file_url: null });
            expect(result['Resume File']).toEqual([]);
        });
    });

    describe('checkResumeAccess', () => {
        it('should deny access if resume not found', async () => {
            mockGetResumeForAccessCheck.mockResolvedValueOnce(null);

            const result = await checkResumeAccess({ user: { id: 'u1' } }, 'r1');

            expect(result.hasAccess).toBe(false);
            expect(result.error).toBe('Resume not found');
        });

        it('should allow admin access to any resume', async () => {
            mockGetResumeForAccessCheck.mockResolvedValueOnce({ id: 'r1', firm_id: 'f2' });
            mockIsUserAdmin.mockReturnValue(true);

            const result = await checkResumeAccess({ user: { id: 'u1', role: 'admin' } }, 'r1');

            expect(result.hasAccess).toBe(true);
        });

        it('should allow user access to own firm resume', async () => {
            mockGetResumeForAccessCheck.mockResolvedValueOnce({ id: 'r1', firm_id: 'f1' });
            mockIsUserAdmin.mockReturnValue(false);
            mockGetUserFirmId.mockResolvedValueOnce('f1');

            const result = await checkResumeAccess({ user: { id: 'u1' } }, 'r1');

            expect(result.hasAccess).toBe(true);
        });

        it('should deny user access to other firm resume', async () => {
            mockGetResumeForAccessCheck.mockResolvedValueOnce({ id: 'r1', firm_id: 'f2' });
            mockIsUserAdmin.mockReturnValue(false);
            mockGetUserFirmId.mockResolvedValueOnce('f1');

            const result = await checkResumeAccess({ user: { id: 'u1' } }, 'r1');

            expect(result.hasAccess).toBe(false);
            expect(result.error).toBe('Access denied');
        });

        it('should deny access if user has no firm', async () => {
            mockGetResumeForAccessCheck.mockResolvedValueOnce({ id: 'r1', firm_id: 'f1' });
            mockIsUserAdmin.mockReturnValue(false);
            mockGetUserFirmId.mockResolvedValueOnce(null);

            const result = await checkResumeAccess({ user: { id: 'u1' } }, 'r1');

            expect(result.hasAccess).toBe(false);
        });

        it('should handle errors gracefully', async () => {
            mockGetResumeForAccessCheck.mockRejectedValueOnce(new Error('DB error'));

            const result = await checkResumeAccess({ user: { id: 'u1' } }, 'r1');

            expect(result.hasAccess).toBe(false);
            expect(result.error).toBe('Failed to verify access');
        });
    });
});
