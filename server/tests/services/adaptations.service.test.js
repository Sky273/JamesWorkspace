/**
 * Tests for Adaptations Service
 * Tests CRUD operations, listing, and grouped-by-deal logic
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../config/database.js', () => ({
    query: vi.fn()
}));

vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn()
}));

import { query } from '../../config/database.js';
import {
    listAdaptations,
    getAdaptationsGroupedByDeal,
    getAdaptationById,
    getMissionClientContact,
    updateAdaptation,
    deleteAdaptation
} from '../../services/adaptations.service.js';

describe('Adaptations Service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // ============================================
    // LIST
    // ============================================

    describe('listAdaptations', () => {
        it('should return paginated adaptations without filters', async () => {
            query
                .mockResolvedValueOnce({ rows: [{ total: '5' }] })
                .mockResolvedValueOnce({ rows: [{ id: 'a1' }, { id: 'a2' }] });

            const result = await listAdaptations({ page: 1, limit: 20 });

            expect(result.totalCount).toBe(5);
            expect(result.records).toHaveLength(2);
        });

        it('should apply firm filter for non-admin', async () => {
            query
                .mockResolvedValueOnce({ rows: [{ total: '0' }] })
                .mockResolvedValueOnce({ rows: [] });

            await listAdaptations({ userFirm: 'Acme', page: 1, limit: 20 });

            expect(query.mock.calls[0][0]).toContain('firm = $1');
            expect(query.mock.calls[0][1]).toContain('Acme');
        });

        it('should apply resumeId filter', async () => {
            query
                .mockResolvedValueOnce({ rows: [{ total: '0' }] })
                .mockResolvedValueOnce({ rows: [] });

            await listAdaptations({ resumeId: 'r1', page: 1, limit: 20 });

            expect(query.mock.calls[0][0]).toContain('resume_id = $');
        });

        it('should apply missionId filter', async () => {
            query
                .mockResolvedValueOnce({ rows: [{ total: '0' }] })
                .mockResolvedValueOnce({ rows: [] });

            await listAdaptations({ missionId: 'm1', page: 1, limit: 20 });

            expect(query.mock.calls[0][0]).toContain('mission_id = $');
        });

        it('should apply status filter (not "all")', async () => {
            query
                .mockResolvedValueOnce({ rows: [{ total: '0' }] })
                .mockResolvedValueOnce({ rows: [] });

            await listAdaptations({ status: 'completed', page: 1, limit: 20 });

            expect(query.mock.calls[0][0]).toContain('status = $');
        });

        it('should skip status filter for "all"', async () => {
            query
                .mockResolvedValueOnce({ rows: [{ total: '0' }] })
                .mockResolvedValueOnce({ rows: [] });

            await listAdaptations({ status: 'all', page: 1, limit: 20 });

            expect(query.mock.calls[0][0]).not.toContain('status = $');
        });

        it('should apply search filter with ILIKE', async () => {
            query
                .mockResolvedValueOnce({ rows: [{ total: '0' }] })
                .mockResolvedValueOnce({ rows: [] });

            await listAdaptations({ search: 'dev', page: 1, limit: 20 });

            expect(query.mock.calls[0][0]).toContain('ILIKE');
        });

        it('should combine multiple filters', async () => {
            query
                .mockResolvedValueOnce({ rows: [{ total: '0' }] })
                .mockResolvedValueOnce({ rows: [] });

            await listAdaptations({ userFirm: 'Acme', status: 'completed', search: 'dev', page: 1, limit: 20 });

            const sql = query.mock.calls[0][0];
            expect(sql).toContain('firm = $1');
            expect(sql).toContain('status = $2');
            expect(sql).toContain('ILIKE $3');
        });

        it('should calculate correct offset', async () => {
            query
                .mockResolvedValueOnce({ rows: [{ total: '50' }] })
                .mockResolvedValueOnce({ rows: [] });

            await listAdaptations({ page: 3, limit: 10 });

            const dataCall = query.mock.calls[1];
            // offset should be (3-1)*10 = 20
            expect(dataCall[1]).toContain(20);
        });
    });

    // ============================================
    // GROUPED BY DEAL
    // ============================================

    describe('getAdaptationsGroupedByDeal', () => {
        it('should return empty structure when no deals', async () => {
            query
                .mockResolvedValueOnce({ rows: [] })  // deals
                .mockResolvedValueOnce({ rows: [] }); // unassigned

            const result = await getAdaptationsGroupedByDeal({ firmId: 'f1', isAdmin: false });

            expect(result.deals).toEqual([]);
            expect(result.unassigned).toEqual([]);
            expect(result.totalDeals).toBe(0);
        });

        it('should group adaptations under deals > missions', async () => {
            query
                .mockResolvedValueOnce({ rows: [{ id: 'd1', title: 'Deal 1' }] }) // deals
                .mockResolvedValueOnce({ rows: [{ id: 'm1', title: 'Mission 1', deal_id: 'd1' }] }) // missions with adaptations
                .mockResolvedValueOnce({ rows: [{ id: 'a1', mission_id: 'm1', resume_name: 'CV' }] }) // adaptations
                .mockResolvedValueOnce({ rows: [] }) // unassigned missions
            ;

            const result = await getAdaptationsGroupedByDeal({ firmId: 'f1', isAdmin: false });

            expect(result.deals).toHaveLength(1);
            expect(result.deals[0].missions[0].adaptations).toHaveLength(1);
            expect(result.deals[0].adaptations_count).toBe(1);
        });

        it('should filter out deals with zero adaptations', async () => {
            query
                .mockResolvedValueOnce({ rows: [{ id: 'd1', title: 'Empty Deal' }] }) // deals
                .mockResolvedValueOnce({ rows: [] }) // missions with adaptations for d1 (none)
                .mockResolvedValueOnce({ rows: [] }) // unassigned missions
            ;

            const result = await getAdaptationsGroupedByDeal({ firmId: 'f1', isAdmin: false });

            expect(result.deals).toHaveLength(0);
        });
    });

    // ============================================
    // GET BY ID
    // ============================================

    describe('getAdaptationById', () => {
        it('should return adaptation if found', async () => {
            query.mockResolvedValueOnce({ rows: [{ id: 'a1', status: 'completed' }] });

            const result = await getAdaptationById('a1');

            expect(result).toEqual({ id: 'a1', status: 'completed' });
        });

        it('should throw 404 if not found', async () => {
            query.mockResolvedValueOnce({ rows: [] });

            try {
                await getAdaptationById('missing');
                expect.fail('Should have thrown');
            } catch (err) {
                expect(err.message).toBe('Adaptation not found');
                expect(err.statusCode).toBe(404);
            }
        });
    });

    // ============================================
    // MISSION CLIENT/CONTACT
    // ============================================

    describe('getMissionClientContact', () => {
        it('should return client_id and contact_id', async () => {
            query.mockResolvedValueOnce({ rows: [{ client_id: 'c1', contact_id: 'ct1' }] });

            const result = await getMissionClientContact('m1');

            expect(result).toEqual({ client_id: 'c1', contact_id: 'ct1' });
        });

        it('should return nulls if mission not found', async () => {
            query.mockResolvedValueOnce({ rows: [] });

            const result = await getMissionClientContact('missing');

            expect(result).toEqual({ client_id: null, contact_id: null });
        });
    });

    // ============================================
    // UPDATE
    // ============================================

    describe('updateAdaptation', () => {
        it('should update fields and return updated record', async () => {
            query.mockResolvedValueOnce({ rows: [{ id: 'a1', status: 'revised' }] });

            const result = await updateAdaptation('a1', { status: 'revised' });

            expect(result.status).toBe('revised');
            const sql = query.mock.calls[0][0];
            expect(sql).toContain('UPDATE resume_adaptations SET');
            expect(sql).toContain('updated_at = CURRENT_TIMESTAMP');
        });

        it('should return existing record if no updates provided', async () => {
            query.mockResolvedValueOnce({ rows: [{ id: 'a1', status: 'completed' }] });

            const result = await updateAdaptation('a1', {});

            // Should call getAdaptationById internally
            expect(result).toEqual({ id: 'a1', status: 'completed' });
        });

        it('should throw 404 if adaptation not found on update', async () => {
            query.mockResolvedValueOnce({ rows: [] });

            try {
                await updateAdaptation('missing', { status: 'revised' });
                expect.fail('Should have thrown');
            } catch (err) {
                expect(err.statusCode).toBe(404);
            }
        });
    });

    // ============================================
    // DELETE
    // ============================================

    describe('deleteAdaptation', () => {
        it('should return true when deleted', async () => {
            query.mockResolvedValueOnce({ rows: [{ id: 'a1' }] });

            const result = await deleteAdaptation('a1');

            expect(result).toBe(true);
        });

        it('should throw 404 if not found', async () => {
            query.mockResolvedValueOnce({ rows: [] });

            try {
                await deleteAdaptation('missing');
                expect.fail('Should have thrown');
            } catch (err) {
                expect(err.statusCode).toBe(404);
            }
        });
    });
});
