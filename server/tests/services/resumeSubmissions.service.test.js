/**
 * Tests for Resume Submissions Service
 * Tests listing, CRUD, validation helpers, and stats
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../config/database.js', () => ({
    query: vi.fn()
}));

vi.mock('../../services/cache.service.js', () => ({
    invalidateClientsCaches: vi.fn(async () => undefined)
}));

import { query } from '../../config/database.js';
import {
    listSubmissions,
    getSubmissionById,
    validateResume,
    validateClient,
    validateContact,
    validateMission,
    createSubmission,
    findSubmission,
    updateSubmission,
    deleteSubmission,
    getStatsSummary
} from '../../services/resumeSubmissions.service.js';

describe('Resume Submissions Service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // ============================================
    // LIST
    // ============================================

    describe('listSubmissions', () => {
        it('should return paginated submissions with count on page 1', async () => {
            query
                .mockResolvedValueOnce({ rows: [{ id: 's1' }, { id: 's2' }] })
                .mockResolvedValueOnce({ rows: [{ count: '2' }] });

            const result = await listSubmissions({ page: 1, limit: 20 });

            expect(result.data).toHaveLength(2);
            expect(result.pagination.totalCount).toBe(2);
            expect(result.pagination.hasMore).toBe(false);
        });

        it('should detect hasMore', async () => {
            const rows = Array(21).fill(null).map((_, i) => ({ id: `s${i}` }));
            query
                .mockResolvedValueOnce({ rows })
                .mockResolvedValueOnce({ rows: [{ count: '50' }] });

            const result = await listSubmissions({ page: 1, limit: 20 });

            expect(result.data).toHaveLength(20);
            expect(result.pagination.hasMore).toBe(true);
            expect(result.pagination.nextPage).toBe(2);
        });

        it('should skip count on page > 1', async () => {
            query.mockResolvedValueOnce({ rows: [] });

            const result = await listSubmissions({ page: 2, limit: 20 });

            expect(query).toHaveBeenCalledTimes(1);
            expect(result.pagination.totalCount).toBeNull();
        });

        it('should apply firmId filter', async () => {
            query.mockResolvedValueOnce({ rows: [] });

            await listSubmissions({ page: 2, firmId: 'f1' });

            expect(query.mock.calls[0][0]).toContain('rs.firm_id = $');
        });

        it('should apply clientId filter', async () => {
            query.mockResolvedValueOnce({ rows: [] });

            await listSubmissions({ page: 2, clientId: 'c1' });

            expect(query.mock.calls[0][0]).toContain('rs.client_id = $');
        });

        it('should apply resumeId filter', async () => {
            query.mockResolvedValueOnce({ rows: [] });

            await listSubmissions({ page: 2, resumeId: 'r1' });

            expect(query.mock.calls[0][0]).toContain('rs.resume_id = $');
        });

        it('should apply status filter', async () => {
            query.mockResolvedValueOnce({ rows: [] });

            await listSubmissions({ page: 2, status: 'sent' });

            expect(query.mock.calls[0][0]).toContain('rs.status = $');
        });

        it('should clamp invalid pagination inputs to safe values', async () => {
            query
                .mockResolvedValueOnce({ rows: [] })
                .mockResolvedValueOnce({ rows: [{ count: '0' }] });

            const result = await listSubmissions({ page: -1, limit: 1000 });

            expect(result.pagination.page).toBe(1);
            expect(result.pagination.limit).toBe(100);
            expect(query.mock.calls[0][1]).toContain(101);
            expect(query.mock.calls[0][1]).toContain(0);
        });
    });

    // ============================================
    // GET BY ID
    // ============================================

    describe('getSubmissionById', () => {
        it('should return submission with joins', async () => {
            query.mockResolvedValueOnce({ rows: [{ id: 's1', resume_name: 'CV' }] });

            const result = await getSubmissionById('s1');

            expect(result.resume_name).toBe('CV');
        });

        it('should return null if not found', async () => {
            query.mockResolvedValueOnce({ rows: [] });
            expect(await getSubmissionById('missing')).toBeNull();
        });
    });

    // ============================================
    // VALIDATION
    // ============================================

    describe('validateResume', () => {
        it('should return exists + firmMatch true when resume belongs to firm', async () => {
            query.mockResolvedValueOnce({ rows: [{ firm_id: 'f1' }] });
            expect(await validateResume('r1', 'f1')).toEqual({ exists: true, firmMatch: true });
        });

        it('should return firmMatch false when resume belongs to another firm', async () => {
            query.mockResolvedValueOnce({ rows: [{ firm_id: 'f2' }] });
            expect(await validateResume('r1', 'f1')).toEqual({ exists: true, firmMatch: false });
        });

        it('should return exists false if not found', async () => {
            query.mockResolvedValueOnce({ rows: [] });
            expect(await validateResume('missing', 'f1')).toEqual({ exists: false, firmMatch: false });
        });
    });

    describe('validateClient', () => {
        it('should return exists + firmMatch true', async () => {
            query.mockResolvedValueOnce({ rows: [{ firm_id: 'f1' }] });

            const result = await validateClient('c1', 'f1');

            expect(result).toEqual({ exists: true, firmMatch: true });
        });

        it('should return firmMatch false if wrong firm', async () => {
            query.mockResolvedValueOnce({ rows: [{ firm_id: 'f2' }] });

            const result = await validateClient('c1', 'f1');

            expect(result).toEqual({ exists: true, firmMatch: false });
        });

        it('should return exists false if not found', async () => {
            query.mockResolvedValueOnce({ rows: [] });
            expect(await validateClient('missing', 'f1')).toEqual({ exists: false, firmMatch: false });
        });
    });

    describe('validateContact', () => {
        it('should return true if contact belongs to client', async () => {
            query.mockResolvedValueOnce({ rows: [{ id: 'ct1' }] });
            expect(await validateContact('ct1', 'c1')).toBe(true);
        });

        it('should return false if not found', async () => {
            query.mockResolvedValueOnce({ rows: [] });
            expect(await validateContact('ct1', 'c1')).toBe(false);
        });
    });

    describe('validateMission', () => {
        it('should return exists + firmMatch true when mission belongs to firm', async () => {
            query.mockResolvedValueOnce({ rows: [{ firm_id: 'f1' }] });
            expect(await validateMission('m1', 'f1')).toEqual({ exists: true, firmMatch: true });
        });

        it('should return firmMatch false when mission belongs to another firm', async () => {
            query.mockResolvedValueOnce({ rows: [{ firm_id: 'f2' }] });
            expect(await validateMission('m1', 'f1')).toEqual({ exists: true, firmMatch: false });
        });

        it('should return exists false if not found', async () => {
            query.mockResolvedValueOnce({ rows: [] });
            expect(await validateMission('missing', 'f1')).toEqual({ exists: false, firmMatch: false });
        });
    });

    // ============================================
    // CRUD
    // ============================================

    describe('createSubmission', () => {
        it('should insert and return full submission with joins', async () => {
            query
                .mockResolvedValueOnce({ rows: [{ id: 's1' }] }) // insert
                .mockResolvedValueOnce({ rows: [{ id: 's1', resume_name: 'CV', client_name: 'Acme' }] }); // fetch with joins

            const result = await createSubmission({
                resume_id: 'r1', client_id: 'c1', contact_id: 'ct1',
                firm_id: 'f1', sent_by: 'u1'
            });

            expect(result.resume_name).toBe('CV');
            expect(query.mock.calls[0][0]).toContain('INSERT INTO resume_submissions');
        });
    });

    describe('findSubmission', () => {
        it('should return raw submission', async () => {
            query.mockResolvedValueOnce({ rows: [{ id: 's1', status: 'sent' }] });
            expect(await findSubmission('s1')).toEqual({ id: 's1', status: 'sent' });
        });

        it('should return null if not found', async () => {
            query.mockResolvedValueOnce({ rows: [] });
            expect(await findSubmission('missing')).toBeNull();
        });
    });

    describe('updateSubmission', () => {
        it('should update status and notes', async () => {
            query.mockResolvedValueOnce({ rows: [{ id: 's1', status: 'viewed' }] });

            const result = await updateSubmission('s1', { status: 'viewed', notes: 'Read' });

            expect(result.status).toBe('viewed');
        });
    });

    describe('deleteSubmission', () => {
        it('should delete submission', async () => {
            query.mockResolvedValueOnce({ rows: [] });

            await deleteSubmission('s1');

            expect(query.mock.calls[0][0]).toContain('DELETE FROM resume_submissions');
        });
    });

    // ============================================
    // STATS
    // ============================================

    describe('getStatsSummary', () => {
        it('should return stats for a firm', async () => {
            query.mockResolvedValueOnce({
                rows: [{
                    total_submissions: '10', sent: '5', viewed: '2',
                    accepted: '1', rejected: '1', pending: '1',
                    unique_clients: '3', unique_resumes: '7'
                }]
            });

            const result = await getStatsSummary('f1');

            expect(result.total_submissions).toBe('10');
            expect(query.mock.calls[0][0]).toContain('WHERE firm_id = $1');
        });

        it('should return stats for admin (no firm filter)', async () => {
            query.mockResolvedValueOnce({ rows: [{ total_submissions: '100' }] });

            const result = await getStatsSummary(null);

            expect(result.total_submissions).toBe('100');
            expect(query.mock.calls[0][1]).toEqual([]);
        });
    });
});
