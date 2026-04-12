/**
 * Tests for Resumes Service
 * Tests CRUD operations, listing, counting, and LLM helper functions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../config/database.js', () => ({
    query: vi.fn()
}));

vi.mock('../../utils/postgresHelpers.js', () => ({
    findWithTimeout: vi.fn(),
    createWithTimeout: vi.fn()
}));

vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn()
}));

const mockInvalidateDashboardAndGroupedViews = vi.fn();
vi.mock('../../services/viewCacheInvalidation.service.js', () => ({
    invalidateDashboardAndGroupedViews: (...args) => mockInvalidateDashboardAndGroupedViews(...args)
}));

import { query } from '../../config/database.js';
import { findWithTimeout, createWithTimeout } from '../../utils/postgresHelpers.js';
import {
    RESUME_SELECT_COLUMNS,
    getResumeForAccessCheck,
    getResumeById,
    getResumeFileForDownload,
    countResumes,
    listResumes,
    updateResume,
    deleteResume,
    insertResume,
    updateResumeFileUrl,
    updateConsentStatus,
    findResumeRecord,
    findMissionRecord,
    createAdaptation
} from '../../services/resumes.service.js';

describe('Resumes Service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockInvalidateDashboardAndGroupedViews.mockResolvedValue(undefined);
    });

    describe('RESUME_SELECT_COLUMNS', () => {
        it('should be a non-empty string with expected columns', () => {
            expect(typeof RESUME_SELECT_COLUMNS).toBe('string');
            expect(RESUME_SELECT_COLUMNS).toContain('id');
            expect(RESUME_SELECT_COLUMNS).toContain('firm_name');
            expect(RESUME_SELECT_COLUMNS).toContain('original_text');
            expect(RESUME_SELECT_COLUMNS).toContain('consent_status');
        });
    });

    describe('getResumeForAccessCheck', () => {
        it('should return lightweight resume data', async () => {
            query.mockResolvedValueOnce({ rows: [{ id: 'r1', firm_id: 'f1', name: 'CV' }] });

            const result = await getResumeForAccessCheck('r1');

            expect(result).toEqual({ id: 'r1', firm_id: 'f1', name: 'CV' });
            expect(query.mock.calls[0][0]).toContain('id, firm_id, name');
        });

        it('should return null if not found', async () => {
            query.mockResolvedValueOnce({ rows: [] });
            expect(await getResumeForAccessCheck('missing')).toBeNull();
        });
    });

    describe('getResumeById', () => {
        it('should return full resume data', async () => {
            query.mockResolvedValueOnce({ rows: [{ id: 'r1', name: 'CV', original_text: 'text' }] });

            const result = await getResumeById('r1');

            expect(result.id).toBe('r1');
            expect(query.mock.calls[0][0]).toContain(RESUME_SELECT_COLUMNS);
        });

        it('should return null if not found', async () => {
            query.mockResolvedValueOnce({ rows: [] });
            expect(await getResumeById('missing')).toBeNull();
        });
    });

    describe('getResumeFileForDownload', () => {
        it('should return file data fields', async () => {
            const fileData = { id: 'r1', file_name: 'cv.pdf', resume_file_data: Buffer.from('pdf'), resume_file_type: 'application/pdf', resume_file_size: 1024, firm_name: 'Acme' };
            query.mockResolvedValueOnce({ rows: [fileData] });

            const result = await getResumeFileForDownload('r1');

            expect(result.file_name).toBe('cv.pdf');
            expect(result.resume_file_data).toBeDefined();
        });

        it('should return null if not found', async () => {
            query.mockResolvedValueOnce({ rows: [] });
            expect(await getResumeFileForDownload('missing')).toBeNull();
        });
    });

    describe('countResumes', () => {
        it('should count all resumes without conditions', async () => {
            query.mockResolvedValueOnce({ rows: [{ total: '42' }] });

            const result = await countResumes({ conditions: [], params: [] });

            expect(result).toBe(42);
            expect(query.mock.calls[0][0]).toContain('SELECT COUNT(*) as total FROM resumes');
        });

        it('should count with conditions', async () => {
            query.mockResolvedValueOnce({ rows: [{ total: '10' }] });

            const result = await countResumes({
                conditions: ['firm_id = $1'],
                params: ['f1']
            });

            expect(result).toBe(10);
            expect(query.mock.calls[0][0]).toContain('WHERE firm_id = $1');
        });

        it('should count with deal filter', async () => {
            query.mockResolvedValueOnce({ rows: [{ total: '5' }] });

            const result = await countResumes({
                conditions: [],
                params: [],
                dealId: 'd1',
                dealParamIndex: 1
            });

            expect(result).toBe(5);
            expect(query.mock.calls[0][0]).toContain('deal_resumes');
        });

        it('should return 0 when no results', async () => {
            query.mockResolvedValueOnce({ rows: [{}] });
            expect(await countResumes({ conditions: [], params: [] })).toBe(0);
        });
    });

    describe('listResumes', () => {
        it('should list resumes without deal filter', async () => {
            query.mockResolvedValueOnce({ rows: [{ id: 'r1' }, { id: 'r2' }] });

            const result = await listResumes({ conditions: [], params: [], limit: 20, offset: 0 });

            expect(result).toHaveLength(2);
            expect(query.mock.calls[0][0]).toContain('ORDER BY LOWER(name) ASC');
        });

        it('should list resumes with deal filter', async () => {
            query.mockResolvedValueOnce({ rows: [{ id: 'r1' }] });

            const result = await listResumes({
                conditions: [], params: [],
                dealId: 'd1', dealParamIndex: 1,
                limit: 20, offset: 0
            });

            expect(result).toHaveLength(1);
            expect(query.mock.calls[0][0]).toContain('deal_resumes');
        });

        it('should apply conditions to query', async () => {
            query.mockResolvedValueOnce({ rows: [] });

            await listResumes({
                conditions: ['firm_id = $1'],
                params: ['f1'],
                limit: 20, offset: 0
            });

            expect(query.mock.calls[0][0]).toContain('WHERE firm_id = $1');
        });
    });

    describe('updateResume', () => {
        it('should update fields and return result', async () => {
            query.mockResolvedValueOnce({ rows: [{ id: 'r1', name: 'Updated', firm_id: 'f1' }] });

            const result = await updateResume('r1', { name: 'Updated', title: 'Dev' });

            expect(result.name).toBe('Updated');
            expect(query.mock.calls[0][0]).toContain('UPDATE resumes SET');
            expect(query.mock.calls[0][0]).toContain('updated_at = CURRENT_TIMESTAMP');
            expect(mockInvalidateDashboardAndGroupedViews).toHaveBeenCalledWith('f1');
        });

        it('should skip undefined values', async () => {
            query.mockResolvedValueOnce({ rows: [{ id: 'r1', firm_id: 'f1' }] });

            await updateResume('r1', { name: 'Valid', title: undefined });

            // Only 2 params: 'Valid' + id
            expect(query.mock.calls[0][1]).toHaveLength(2);
        });

        it('should return existing resume if no updates', async () => {
            query.mockResolvedValueOnce({ rows: [{ id: 'r1', name: 'Unchanged' }] });

            const result = await updateResume('r1', {});

            expect(result.name).toBe('Unchanged');
            // Called getResumeById internally
            expect(query.mock.calls[0][0]).toContain('SELECT');
        });

        it('should throw 404 if resume not found on update', async () => {
            query.mockResolvedValueOnce({ rows: [] });

            try {
                await updateResume('missing', { name: 'X' });
                expect.fail('Should have thrown');
            } catch (err) {
                expect(err.statusCode).toBe(404);
            }
        });
    });

    describe('deleteResume', () => {
        it('should return true when deleted', async () => {
            query.mockResolvedValueOnce({ rows: [{ id: 'r1', firm_id: 'f1' }] });
            expect(await deleteResume('r1')).toBe(true);
            expect(mockInvalidateDashboardAndGroupedViews).toHaveBeenCalledWith('f1');
        });

        it('should throw 404 if not found', async () => {
            query.mockResolvedValueOnce({ rows: [] });

            try {
                await deleteResume('missing');
                expect.fail('Should have thrown');
            } catch (err) {
                expect(err.statusCode).toBe(404);
            }
        });
    });

    describe('insertResume', () => {
        it('should insert and return the new resume', async () => {
            const created = { id: 'r1', name: 'New CV', firm_id: 'f1' };
            query.mockResolvedValueOnce({ rows: [created] });

            const result = await insertResume({
                name: 'New CV', title: 'Dev', fileName: 'cv.pdf',
                fileBuffer: Buffer.from('data'), fileSize: 100, mimeType: 'application/pdf',
                fileUrl: '/files/cv.pdf', status: 'uploaded', firmId: 'f1', firmName: 'Acme',
                profileType: 'external', candidateName: 'John', candidateEmail: 'j@test.com',
                consentStatus: 'pending', consentToken: 'tok', tokenExpiresAt: null,
                consentRequestedAt: null, retentionUntil: null
            });

            expect(result).toEqual(created);
            expect(query.mock.calls[0][0]).toContain('INSERT INTO resumes');
            expect(mockInvalidateDashboardAndGroupedViews).toHaveBeenCalledWith('f1');
        });
    });

    describe('updateResumeFileUrl', () => {
        it('should update file URL', async () => {
            query.mockResolvedValueOnce({ rows: [] });

            await updateResumeFileUrl('r1', '/new-url');

            expect(query.mock.calls[0][1]).toEqual(['/new-url', 'r1']);
        });
    });

    describe('updateConsentStatus', () => {
        it('should update consent status', async () => {
            query.mockResolvedValueOnce({ rows: [] });

            await updateConsentStatus('r1', 'granted');

            expect(query.mock.calls[0][0]).toContain('consent_status = $1');
            expect(query.mock.calls[0][1]).toEqual(['granted', 'r1']);
        });
    });

    // ============================================
    // LLM handler helpers
    // ============================================

    describe('findResumeRecord', () => {
        it('should delegate to findWithTimeout', async () => {
            findWithTimeout.mockResolvedValueOnce({ id: 'r1', name: 'CV' });

            const result = await findResumeRecord('r1');

            expect(findWithTimeout).toHaveBeenCalledWith('resumes', 'r1');
            expect(result.name).toBe('CV');
        });
    });

    describe('findMissionRecord', () => {
        it('should delegate to findWithTimeout', async () => {
            findWithTimeout.mockResolvedValueOnce({ id: 'm1', title: 'Dev' });

            const result = await findMissionRecord('m1');

            expect(findWithTimeout).toHaveBeenCalledWith('missions', 'm1');
            expect(result.title).toBe('Dev');
        });
    });

    describe('createAdaptation', () => {
        it('should delegate to createWithTimeout', async () => {
            createWithTimeout.mockResolvedValueOnce({ id: 'a1', firm_id: 'f1' });

            const data = { resume_id: 'r1', mission_id: 'm1' };
            const result = await createAdaptation(data);

            expect(createWithTimeout).toHaveBeenCalledWith('resume_adaptations', data);
            expect(result.id).toBe('a1');
            expect(mockInvalidateDashboardAndGroupedViews).toHaveBeenCalledWith('f1');
        });
    });
});
