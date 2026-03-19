/**
 * Tests for Resume Versions Service
 * Tests version creation, retrieval, restoration, and change detection
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../services/database.service.js', () => ({
    query: vi.fn()
}));

vi.mock('../../utils/logger.backend.js', () => ({
    createModuleLogger: vi.fn(() => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    })),
    safeLog: vi.fn()
}));

import { query as mockQuery } from '../../services/database.service.js';
import {
    getLatestVersionNumber,
    createVersion,
    getVersions,
    getVersion,
    restoreVersion,
    hasImprovedTextChanged
} from '../../services/resumeVersions.service.js';

// Helper to create a mock DB version row
function mockVersionRow(overrides = {}) {
    return {
        id: 'v1',
        resume_id: 'r1',
        version_number: 1,
        improved_text: '<p>Improved</p>',
        improved_global_rating: 85,
        improved_skills_score: 80,
        improved_experience_score: 90,
        improved_education_score: 75,
        improved_ats_score: 88,
        improved_executive_summary_score: 82,
        improved_hobbies_languages_score: 70,
        improved_skills: ['React', 'Node'],
        improved_industries: ['IT'],
        improved_tools: ['Git'],
        improved_soft_skills: ['Communication'],
        improved_key_improvements: 'Better structure',
        created_by: 'u1',
        created_by_name: 'Admin',
        created_by_email: 'admin@test.com',
        change_reason: 'manual_edit',
        created_at: '2025-01-01',
        ...overrides
    };
}

describe('Resume Versions Service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // ============================================
    // GET LATEST VERSION
    // ============================================

    describe('getLatestVersionNumber', () => {
        it('should return latest version number', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [{ latest_version: 3 }] });

            const result = await getLatestVersionNumber('r1');

            expect(result).toBe(3);
        });

        it('should return 0 if no versions exist', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [{ latest_version: 0 }] });

            const result = await getLatestVersionNumber('r1');

            expect(result).toBe(0);
        });
    });

    // ============================================
    // CREATE VERSION
    // ============================================

    describe('createVersion', () => {
        it('should create a new version with incremented number', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [{ latest_version: 2 }] }) // getLatestVersionNumber
                .mockResolvedValueOnce({ rows: [mockVersionRow({ version_number: 3 })] }) // insert
                .mockResolvedValueOnce({ rows: [] }); // update resume current_version

            const result = await createVersion({
                resumeId: 'r1',
                improvedText: '<p>New</p>',
                scores: { improvedGlobalRating: 85 },
                tags: { improvedSkills: ['React'] },
                userId: 'u1'
            });

            expect(result.versionNumber).toBe(3);
            expect(result.resumeId).toBe('r1');
            // Check insert was called with version_number = 3
            expect(mockQuery.mock.calls[1][1][1]).toBe(3);
            // Check resume was updated
            expect(mockQuery.mock.calls[2][0]).toContain('UPDATE resumes SET current_version');
        });

        it('should use default changeReason "manual_edit"', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [{ latest_version: 0 }] })
                .mockResolvedValueOnce({ rows: [mockVersionRow()] })
                .mockResolvedValueOnce({ rows: [] });

            await createVersion({ resumeId: 'r1', improvedText: 'text' });

            const insertParams = mockQuery.mock.calls[1][1];
            expect(insertParams[16]).toBe('manual_edit'); // change_reason
        });

        it('should handle snake_case score keys', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [{ latest_version: 0 }] })
                .mockResolvedValueOnce({ rows: [mockVersionRow()] })
                .mockResolvedValueOnce({ rows: [] });

            await createVersion({
                resumeId: 'r1',
                improvedText: 'text',
                scores: { improved_global_rating: 90 }
            });

            const insertParams = mockQuery.mock.calls[1][1];
            expect(insertParams[3]).toBe(90); // improved_global_rating
        });
    });

    // ============================================
    // GET VERSIONS
    // ============================================

    describe('getVersions', () => {
        it('should return paginated versions', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [{ total: '5' }] }) // count
                .mockResolvedValueOnce({ rows: [mockVersionRow(), mockVersionRow({ id: 'v2', version_number: 2 })] });

            const result = await getVersions('r1', { limit: 10, offset: 0 });

            expect(result.versions).toHaveLength(2);
            expect(result.total).toBe(5);
            expect(result.hasMore).toBe(true);
        });

        it('should format version records', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [{ total: '1' }] })
                .mockResolvedValueOnce({ rows: [mockVersionRow()] });

            const result = await getVersions('r1');

            const v = result.versions[0];
            expect(v.id).toBe('v1');
            expect(v.resumeId).toBe('r1');
            expect(v.versionNumber).toBe(1);
            expect(v.improvedText).toBe('<p>Improved</p>');
            expect(v.createdByName).toBe('Admin');
        });

        it('should use default limit/offset', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [{ total: '0' }] })
                .mockResolvedValueOnce({ rows: [] });

            const result = await getVersions('r1');

            expect(result.limit).toBe(50);
            expect(result.offset).toBe(0);
        });
    });

    // ============================================
    // GET SINGLE VERSION
    // ============================================

    describe('getVersion', () => {
        it('should return formatted version by number', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [mockVersionRow()] });

            const result = await getVersion('r1', 1);

            expect(result.versionNumber).toBe(1);
            expect(result.improvedGlobalRating).toBe(85);
        });

        it('should return null if not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [] });
            expect(await getVersion('r1', 999)).toBeNull();
        });
    });

    // ============================================
    // RESTORE VERSION
    // ============================================

    describe('restoreVersion', () => {
        it('should create new version from restored content and update resume', async () => {
            // getVersion (for the version to restore)
            mockQuery.mockResolvedValueOnce({ rows: [mockVersionRow({ version_number: 2, improved_text: 'Old text' })] });
            // createVersion internals: getLatestVersionNumber
            mockQuery.mockResolvedValueOnce({ rows: [{ latest_version: 3 }] });
            // createVersion internals: insert
            mockQuery.mockResolvedValueOnce({ rows: [mockVersionRow({ version_number: 4, change_reason: 'restore_from_v2' })] });
            // createVersion internals: update resume current_version
            mockQuery.mockResolvedValueOnce({ rows: [] });
            // restoreVersion: update resume improved_text
            mockQuery.mockResolvedValueOnce({ rows: [] });

            const result = await restoreVersion('r1', 2, 'u1');

            expect(result.versionNumber).toBe(4);
            // Last call should update the resume's improved_text
            const lastCall = mockQuery.mock.calls[mockQuery.mock.calls.length - 1];
            expect(lastCall[0]).toContain('UPDATE resumes SET');
            expect(lastCall[0]).toContain('improved_text = $1');
        });

        it('should throw if version not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [] });

            await expect(restoreVersion('r1', 999, 'u1')).rejects.toThrow('Version 999 not found');
        });
    });

    // ============================================
    // CHANGE DETECTION
    // ============================================

    describe('hasImprovedTextChanged', () => {
        it('should return false if text is the same', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [{ improved_text: 'Hello world' }] });

            expect(await hasImprovedTextChanged('r1', 'Hello world')).toBe(false);
        });

        it('should return true if text differs', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [{ improved_text: 'Old text' }] });

            expect(await hasImprovedTextChanged('r1', 'New text')).toBe(true);
        });

        it('should normalize whitespace for comparison', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [{ improved_text: 'Hello   world\n\nfoo' }] });

            expect(await hasImprovedTextChanged('r1', 'Hello world foo')).toBe(false);
        });

        it('should return true if resume not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [] });

            expect(await hasImprovedTextChanged('r1', 'Some text')).toBe(true);
        });

        it('should handle null improved_text', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [{ improved_text: null }] });

            expect(await hasImprovedTextChanged('r1', 'New text')).toBe(true);
        });

        it('should treat null new text and null current text as same', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [{ improved_text: null }] });

            expect(await hasImprovedTextChanged('r1', null)).toBe(false);
        });
    });
});
