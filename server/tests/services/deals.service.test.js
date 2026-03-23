/**
 * Tests for Deals Service
 * Tests CRUD operations, resume-deal linking, statistics, and access helpers
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
    DEAL_STATUS,
    DEAL_PRIORITY,
    DEAL_RESUME_STATUS,
    initDealsTable,
    createDeal,
    updateDeal,
    deleteDeal,
    getDealById,
    getDeals,
    addResumeToDeal,
    removeResumeFromDeal,
    updateDealResumeStatus,
    getDealsForResume,
    getResumesForDeal,
    getDealStats,
    getDealFirmId,
    getClientFirmId,
    getResumeFirmId,
    getMissionsForDeal,
    getDealsCountForClient
} from '../../services/deals.service.js';

describe('Deals Service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // ============================================
    // CONSTANTS
    // ============================================

    describe('Constants', () => {
        it('should export DEAL_STATUS', () => {
            expect(DEAL_STATUS.OPEN).toBe('open');
            expect(DEAL_STATUS.WON).toBe('won');
            expect(DEAL_STATUS.LOST).toBe('lost');
            expect(DEAL_STATUS.ON_HOLD).toBe('on_hold');
        });

        it('should export DEAL_PRIORITY', () => {
            expect(DEAL_PRIORITY.LOW).toBe('low');
            expect(DEAL_PRIORITY.URGENT).toBe('urgent');
        });

        it('should export DEAL_RESUME_STATUS', () => {
            expect(DEAL_RESUME_STATUS.PROPOSED).toBe('proposed');
            expect(DEAL_RESUME_STATUS.SELECTED).toBe('selected');
        });
    });

    // ============================================
    // INIT TABLE
    // ============================================

    describe('initDealsTable', () => {
        it('should verify tables, columns, and indexes', async () => {
            query.mockImplementation((sql, params) => {
                if (sql.includes('information_schema.tables')) {
                    expect(params).toEqual([['deals', 'deal_resumes', 'missions']]);
                    return Promise.resolve({ rows: [
                        { table_name: 'deals' },
                        { table_name: 'deal_resumes' },
                        { table_name: 'missions' }
                    ] });
                }
                if (sql.includes('information_schema.columns')) {
                    if (params[0] === 'deals') {
                        expect(params).toEqual(['deals', ['contact_id']]);
                        return Promise.resolve({ rows: [{ column_name: 'contact_id' }] });
                    }
                    expect(params).toEqual(['missions', ['deal_id']]);
                    return Promise.resolve({ rows: [{ column_name: 'deal_id' }] });
                }
                if (sql.includes('pg_indexes')) {
                    return Promise.resolve({ rows: [
                        { indexname: 'idx_deals_firm_id' },
                        { indexname: 'idx_deals_client_id' },
                        { indexname: 'idx_deals_status' },
                        { indexname: 'idx_deals_priority' },
                        { indexname: 'idx_deal_resumes_deal_id' },
                        { indexname: 'idx_deal_resumes_resume_id' },
                        { indexname: 'idx_missions_deal_id' }
                    ] });
                }
                return Promise.resolve({ rows: [] });
            });

            await initDealsTable();

            expect(query).toHaveBeenCalledTimes(4);
        });

        it('should throw on fatal error', async () => {
            query.mockRejectedValueOnce(new Error('DB down'));

            await expect(initDealsTable()).rejects.toThrow('DB down');
        });
    });

    // ============================================
    // CREATE
    // ============================================

    describe('createDeal', () => {
        it('should create a deal with all fields', async () => {
            const deal = { id: 'd1', title: 'New Deal', status: 'open' };
            query.mockResolvedValueOnce({ rows: [deal] });

            const result = await createDeal(
                { title: 'New Deal', description: 'Desc', client_id: 'c1', contact_id: 'ct1', tags: ['tag1'] },
                'user-1', 'firm-1'
            );

            expect(result).toEqual(deal);
            expect(query.mock.calls[0][0]).toContain('INSERT INTO deals');
            expect(query.mock.calls[0][1][0]).toBe('firm-1');
        });

        it('should use default status and priority', async () => {
            query.mockResolvedValueOnce({ rows: [{ id: 'd1' }] });

            await createDeal({ title: 'Minimal' }, 'user-1', 'firm-1');

            const params = query.mock.calls[0][1];
            expect(params[5]).toBe('open');    // default status
            expect(params[10]).toBe('medium'); // default priority
        });

        it('should clean empty string client_id to null', async () => {
            query.mockResolvedValueOnce({ rows: [{ id: 'd1' }] });

            await createDeal({ title: 'Test', client_id: '  ', contact_id: '' }, 'user-1', 'firm-1');

            const params = query.mock.calls[0][1];
            expect(params[1]).toBeNull(); // cleaned client_id
            expect(params[2]).toBeNull(); // cleaned contact_id
        });

        it('should throw on DB error', async () => {
            query.mockRejectedValueOnce(new Error('Constraint violation'));
            await expect(createDeal({ title: 'Bad' }, 'u1', 'f1')).rejects.toThrow('Constraint violation');
        });
    });

    // ============================================
    // UPDATE
    // ============================================

    describe('updateDeal', () => {
        it('should update and return deal', async () => {
            query.mockResolvedValueOnce({ rows: [{ id: 'd1', title: 'Updated' }] });

            const result = await updateDeal('d1', { title: 'Updated', status: 'won' });

            expect(result.title).toBe('Updated');
            expect(query.mock.calls[0][0]).toContain('UPDATE deals SET');
        });

        it('should throw if deal not found', async () => {
            query.mockResolvedValueOnce({ rows: [] });
            await expect(updateDeal('missing', { title: 'X' })).rejects.toThrow('Deal not found');
        });
    });

    // ============================================
    // DELETE
    // ============================================

    describe('deleteDeal', () => {
        it('should return true when deleted', async () => {
            query.mockResolvedValueOnce({ rows: [{ id: 'd1' }] });
            expect(await deleteDeal('d1')).toBe(true);
        });

        it('should throw if not found', async () => {
            query.mockResolvedValueOnce({ rows: [] });
            await expect(deleteDeal('missing')).rejects.toThrow('Deal not found');
        });
    });

    // ============================================
    // GET BY ID
    // ============================================

    describe('getDealById', () => {
        it('should return deal with joined data', async () => {
            const deal = { id: 'd1', title: 'Deal', client_name: 'Client A', resumes_count: '3', missions_count: '2' };
            query.mockResolvedValueOnce({ rows: [deal] });

            const result = await getDealById('d1');

            expect(result.client_name).toBe('Client A');
            expect(query.mock.calls[0][0]).toContain('LEFT JOIN clients');
        });

        it('should return null if not found', async () => {
            query.mockResolvedValueOnce({ rows: [] });
            expect(await getDealById('missing')).toBeNull();
        });
    });

    // ============================================
    // LIST
    // ============================================

    describe('getDeals', () => {
        it('should return paginated deals', async () => {
            query
                .mockResolvedValueOnce({ rows: [{ total: '5' }] })
                .mockResolvedValueOnce({ rows: [{ id: 'd1' }, { id: 'd2' }] });

            const result = await getDeals('f1', {}, { page: 1, limit: 20 });

            expect(result.data).toHaveLength(2);
            expect(result.pagination.totalCount).toBe(5);
            expect(result.pagination.page).toBe(1);
        });

        it('should apply client filter', async () => {
            query
                .mockResolvedValueOnce({ rows: [{ total: '0' }] })
                .mockResolvedValueOnce({ rows: [] });

            await getDeals('f1', { clientId: 'c1' });

            expect(query.mock.calls[0][0]).toContain('d.client_id = $');
        });

        it('should apply status filter', async () => {
            query
                .mockResolvedValueOnce({ rows: [{ total: '0' }] })
                .mockResolvedValueOnce({ rows: [] });

            await getDeals('f1', { status: 'open' });

            expect(query.mock.calls[0][0]).toContain('d.status = $');
        });

        it('should skip status filter for "all"', async () => {
            query
                .mockResolvedValueOnce({ rows: [{ total: '0' }] })
                .mockResolvedValueOnce({ rows: [] });

            await getDeals('f1', { status: 'all' });

            expect(query.mock.calls[0][0]).not.toContain('d.status = $');
        });

        it('should apply priority filter', async () => {
            query
                .mockResolvedValueOnce({ rows: [{ total: '0' }] })
                .mockResolvedValueOnce({ rows: [] });

            await getDeals('f1', { priority: 'high' });

            expect(query.mock.calls[0][0]).toContain('d.priority = $');
        });

        it('should apply search filter', async () => {
            query
                .mockResolvedValueOnce({ rows: [{ total: '0' }] })
                .mockResolvedValueOnce({ rows: [] });

            await getDeals('f1', { search: 'dev' });

            expect(query.mock.calls[0][0]).toContain('ILIKE');
        });

        it('should cap limit at 100', async () => {
            query
                .mockResolvedValueOnce({ rows: [{ total: '0' }] })
                .mockResolvedValueOnce({ rows: [] });

            const result = await getDeals('f1', {}, { limit: 500 });

            expect(result.pagination.limit).toBe(100);
        });

        it('should calculate hasMore correctly', async () => {
            query
                .mockResolvedValueOnce({ rows: [{ total: '50' }] })
                .mockResolvedValueOnce({ rows: Array(20).fill({ id: 'x' }) });

            const result = await getDeals('f1', {}, { page: 1, limit: 20 });

            expect(result.pagination.hasMore).toBe(true);
            expect(result.pagination.totalPages).toBe(3);
        });
    });

    // ============================================
    // DEAL-RESUME OPERATIONS
    // ============================================

    describe('addResumeToDeal', () => {
        it('should add resume to deal with upsert', async () => {
            query.mockResolvedValueOnce({ rows: [{ deal_id: 'd1', resume_id: 'r1', status: 'proposed' }] });

            const result = await addResumeToDeal('d1', 'r1', 'u1');

            expect(result.status).toBe('proposed');
            expect(query.mock.calls[0][0]).toContain('ON CONFLICT');
        });

        it('should accept custom status and notes', async () => {
            query.mockResolvedValueOnce({ rows: [{ status: 'submitted' }] });

            await addResumeToDeal('d1', 'r1', 'u1', { status: 'submitted', notes: 'Note' });

            expect(query.mock.calls[0][1]).toContain('submitted');
            expect(query.mock.calls[0][1]).toContain('Note');
        });
    });

    describe('removeResumeFromDeal', () => {
        it('should return true when removed', async () => {
            query.mockResolvedValueOnce({ rows: [{ id: 'link1' }] });
            expect(await removeResumeFromDeal('d1', 'r1')).toBe(true);
        });

        it('should throw if link not found', async () => {
            query.mockResolvedValueOnce({ rows: [] });
            await expect(removeResumeFromDeal('d1', 'r999')).rejects.toThrow('Resume not found in deal');
        });
    });

    describe('updateDealResumeStatus', () => {
        it('should update status and return link', async () => {
            query.mockResolvedValueOnce({ rows: [{ status: 'selected' }] });

            const result = await updateDealResumeStatus('d1', 'r1', 'selected', 'Good fit');

            expect(result.status).toBe('selected');
            expect(query.mock.calls[0][1]).toContain('selected');
        });

        it('should throw if link not found', async () => {
            query.mockResolvedValueOnce({ rows: [] });
            await expect(updateDealResumeStatus('d1', 'r999', 'selected')).rejects.toThrow();
        });
    });

    // ============================================
    // QUERY FUNCTIONS
    // ============================================

    describe('getDealsForResume', () => {
        it('should return deals for a resume', async () => {
            query.mockResolvedValueOnce({ rows: [{ deal_id: 'd1', deal_title: 'Deal 1' }] });

            const result = await getDealsForResume('r1', 'f1');

            expect(result).toHaveLength(1);
            expect(query.mock.calls[0][1]).toEqual(['r1', 'f1']);
        });
    });

    describe('getResumesForDeal', () => {
        it('should return resumes for a deal', async () => {
            query.mockResolvedValueOnce({ rows: [{ id: 'r1', name: 'CV', deal_status: 'proposed' }] });

            const result = await getResumesForDeal('d1');

            expect(result[0].deal_status).toBe('proposed');
            expect(query.mock.calls[0][0]).toContain('deal_resumes');
        });
    });

    describe('getDealStats', () => {
        it('should return aggregated stats', async () => {
            const stats = { total: '10', open_count: '5', won_count: '3', lost_count: '1', on_hold_count: '1', urgent_count: '2', high_priority_count: '3' };
            query.mockResolvedValueOnce({ rows: [stats] });

            const result = await getDealStats('f1');

            expect(result.total).toBe('10');
            expect(result.open_count).toBe('5');
        });
    });

    // ============================================
    // ACCESS HELPERS
    // ============================================

    describe('getDealFirmId', () => {
        it('should return firm_id', async () => {
            query.mockResolvedValueOnce({ rows: [{ firm_id: 'f1' }] });
            expect(await getDealFirmId('d1')).toBe('f1');
        });

        it('should return null if not found', async () => {
            query.mockResolvedValueOnce({ rows: [] });
            expect(await getDealFirmId('missing')).toBeNull();
        });
    });

    describe('getClientFirmId', () => {
        it('should return firm_id', async () => {
            query.mockResolvedValueOnce({ rows: [{ firm_id: 'f1' }] });
            expect(await getClientFirmId('c1')).toBe('f1');
        });

        it('should return null if not found', async () => {
            query.mockResolvedValueOnce({ rows: [] });
            expect(await getClientFirmId('missing')).toBeNull();
        });
    });

    describe('getResumeFirmId', () => {
        it('should return firm_id', async () => {
            query.mockResolvedValueOnce({ rows: [{ firm_id: 'f1' }] });
            expect(await getResumeFirmId('r1')).toBe('f1');
        });

        it('should return null if not found', async () => {
            query.mockResolvedValueOnce({ rows: [] });
            expect(await getResumeFirmId('missing')).toBeNull();
        });
    });

    describe('getMissionsForDeal', () => {
        it('should return missions with joins and adaptation counts', async () => {
            query.mockResolvedValueOnce({ rows: [{ id: 'm1', title: 'Dev', client_name: 'A', adaptations_count: '2' }] });

            const result = await getMissionsForDeal('d1');

            expect(result).toHaveLength(1);
            expect(result[0].adaptations_count).toBe('2');
            expect(query.mock.calls[0][0]).toContain('resume_adaptations');
        });
    });

    describe('getDealsCountForClient', () => {
        it('should return count', async () => {
            query.mockResolvedValueOnce({ rows: [{ count: '7' }] });
            expect(await getDealsCountForClient('c1')).toBe(7);
        });
    });
});

