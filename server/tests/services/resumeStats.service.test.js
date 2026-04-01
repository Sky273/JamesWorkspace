/**
 * Tests for Resume Stats Service
 * Tests cache, grouped-by-deal view, and dashboard stats
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
    getCachedStats,
    setCachedStats,
    invalidateStatsCache,
    getStatsCacheStats,
    getResumesGroupedByDeal,
    getResumeStats,
    getMissionStats,
    getAdaptationStats
} from '../../services/resumeStats.service.js';

describe('Resume Stats Service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        invalidateStatsCache(); // clear cache between tests
    });

    // ============================================
    // CACHE
    // ============================================

    describe('Stats Cache', () => {
        it('should set and get cached stats', () => {
            setCachedStats('f1', { total: 10 });
            expect(getCachedStats('f1')).toEqual({ total: 10 });
        });

        it('should return null for missing key', () => {
            expect(getCachedStats('missing')).toBeNull();
        });

        it('should invalidate specific firm cache', () => {
            setCachedStats('f1', { total: 10 });
            setCachedStats('f2', { total: 20 });
            invalidateStatsCache('f1');
            expect(getCachedStats('f1')).toBeNull();
            expect(getCachedStats('f2')).toEqual({ total: 20 }); // f2 still exists
        });

        it('should invalidate all caches', () => {
            setCachedStats('f1', { total: 10 });
            setCachedStats('f2', { total: 20 });
            invalidateStatsCache();
            expect(getCachedStats('f1')).toBeNull();
            expect(getCachedStats('f2')).toBeNull();
        });

        it('should also invalidate admin cache when invalidating a firm', () => {
            setCachedStats('admin', { total: 100 });
            setCachedStats('f1', { total: 10 });
            invalidateStatsCache('f1');
            expect(getCachedStats('admin')).toBeNull();
        });

        it('should report cache stats', () => {
            setCachedStats('f1', {});
            const stats = getStatsCacheStats();
            expect(stats.size).toBe(1);
            expect(stats.maxSize).toBe(100);
            expect(stats.ttlSeconds).toBe(30);
        });
    });

    // ============================================
    // GROUPED BY DEAL
    // ============================================

    describe('getResumesGroupedByDeal', () => {
        it('should return deals with resumes, missions, adaptations, and unassigned', async () => {
            // Query 1: deals
            query.mockResolvedValueOnce({ rows: [{ id: 'd1', title: 'Deal 1', resumes_count: 1 }] });
            // Query 2: resumes for deals
            query.mockResolvedValueOnce({ rows: [{ id: 'r1', name: 'CV', deal_id: 'd1' }] });
            // Query 3: missions for deals
            query.mockResolvedValueOnce({ rows: [{ id: 'm1', title: 'Dev', deal_id: 'd1' }] });
            // Query 4: adaptations for missions
            query.mockResolvedValueOnce({ rows: [{ id: 'a1', resume_name: 'CV', mission_id: 'm1' }] });
            // Query 5: unassigned resumes
            query.mockResolvedValueOnce({ rows: [{ id: 'r2', name: 'Unassigned CV' }] });

            const result = await getResumesGroupedByDeal({ firmId: 'f1', isAdmin: false });

            expect(result.deals).toHaveLength(1);
            expect(result.deals[0].resumes).toHaveLength(1);
            expect(result.deals[0].missions).toHaveLength(1);
            expect(result.deals[0].missions[0].adaptations).toHaveLength(1);
            expect(result.unassigned).toHaveLength(1);
            expect(result.totalDeals).toBe(1);
            expect(result.totalAssigned).toBe(1);
            expect(result.totalUnassigned).toBe(1);
        });

        it('should handle empty deals', async () => {
            query.mockResolvedValueOnce({ rows: [] }); // no deals
            query.mockResolvedValueOnce({ rows: [] }); // unassigned

            const result = await getResumesGroupedByDeal({ firmId: 'f1', isAdmin: false });

            expect(result.deals).toHaveLength(0);
            expect(query).toHaveBeenCalledTimes(2); // deals + unassigned only
        });

        it('should not filter unassigned by firm for admin', async () => {
            query.mockResolvedValueOnce({ rows: [] }); // deals
            query.mockResolvedValueOnce({ rows: [] }); // unassigned

            await getResumesGroupedByDeal({ firmId: 'f1', isAdmin: true });

            const dealsQuery = query.mock.calls[0][0];
            const unassignedQuery = query.mock.calls[1][0];
            expect(dealsQuery).not.toContain('WHERE d.firm_id = $1');
            expect(unassignedQuery).not.toContain('r.firm_id = $1');
        });
    });

    // ============================================
    // DASHBOARD STATS
    // ============================================

    describe('getResumeStats', () => {
        it('should return resume stats with firm filter', async () => {
            query.mockResolvedValueOnce({ rows: [{
                total: '50', analyzed: '40', improved: '30',
                today: '2', this_week: '10', this_month: '25',
                avg_original_score: '65.5', avg_improved_score: '82.3'
            }] });

            const result = await getResumeStats({ userFirmId: 'f1' });

            expect(result.total).toBe('50');
            expect(query.mock.calls[0][0]).toContain('r.firm_id = $1');
        });

        it('should return all stats for admin (no filter)', async () => {
            query.mockResolvedValueOnce({ rows: [{ total: '100' }] });

            await getResumeStats({});

            expect(query.mock.calls[0][0]).not.toContain('WHERE');
        });
    });

    describe('getMissionStats', () => {
        it('should return mission stats with firmId filter', async () => {
            query.mockResolvedValueOnce({ rows: [{ total: '20', active: '15' }] });

            const result = await getMissionStats({ userFirmId: 'f1' });

            expect(result.total).toBe('20');
            expect(query.mock.calls[0][0]).toContain('firm_id = $1');
        });
    });

    describe('getAdaptationStats', () => {
        it('should return adaptation count with firmId filter', async () => {
            query.mockResolvedValueOnce({ rows: [{ total: '30' }] });

            const result = await getAdaptationStats({ userFirmId: 'f1' });

            expect(result.total).toBe('30');
            expect(query.mock.calls[0][0]).toContain('firm_id = $1');
        });

        it('should return stats for admin (no filter)', async () => {
            query.mockResolvedValueOnce({ rows: [{ total: '200' }] });

            await getAdaptationStats({});

            expect(query.mock.calls[0][1]).toEqual([]);
        });
    });
});
