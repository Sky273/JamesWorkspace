/**
 * Tests for Missions Service
 * Tests CRUD operations, listing, grouping, and validation helpers
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before importing the service
vi.mock('../../config/database.js', () => ({
    query: vi.fn()
}));

vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn()
}));

vi.mock('../../utils/postgresHelpers.js', () => ({
    selectWithTimeout: vi.fn(),
    findWithTimeout: vi.fn(),
    createWithTimeout: vi.fn(),
    updateWithTimeout: vi.fn(),
    destroyWithTimeout: vi.fn(),
    escapeLike: vi.fn((str) => str.replace(/[%_\\]/g, '\\$&'))
}));

// Import after mocks
import { query } from '../../config/database.js';
import { selectWithTimeout, findWithTimeout, createWithTimeout, updateWithTimeout, destroyWithTimeout } from '../../utils/postgresHelpers.js';
import {
    mapMissionRecord,
    getMissionWithJoins,
    listMissions,
    getMissionsGroupedByDeal,
    validateFirm,
    validateClient,
    validateContact,
    validateDeal,
    createMission,
    findMission,
    updateMission,
    deleteMission,
    listMissionAdaptations
} from '../../services/missions.service.js';

describe('Missions Service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // ============================================
    // MAPPING
    // ============================================

    describe('mapMissionRecord', () => {
        it('should map DB record to API format', () => {
            const record = {
                id: '1', title: 'Dev', content: 'Job desc', firm: 'Acme', firm_id: 'f1',
                status: 'open', keywords: ['js'], required_skills: ['React'],
                preferred_skills: ['Node'], created_at: '2025-01-01', updated_at: '2025-01-02',
                client_id: 'c1', client_name: 'Client A', client_type: 'client',
                contact_id: 'ct1', contact_name: 'John', contact_email: 'j@test.com', contact_role: 'CTO',
                deal_id: 'd1', deal_title: 'Deal X', deal_status: 'open'
            };

            const mapped = mapMissionRecord(record);

            expect(mapped.id).toBe('1');
            expect(mapped.Title).toBe('Dev');
            expect(mapped['Firm ID']).toBe('f1');
            expect(mapped['Client Name']).toBe('Client A');
            expect(mapped['Contact Email']).toBe('j@test.com');
            expect(mapped['Deal Title']).toBe('Deal X');
        });
    });

    // ============================================
    // GET WITH JOINS
    // ============================================

    describe('getMissionWithJoins', () => {
        it('should return mission with joined data', async () => {
            query.mockResolvedValueOnce({ rows: [{ id: '1', title: 'Dev', client_name: 'A' }] });

            const result = await getMissionWithJoins('1');

            expect(result).toEqual({ id: '1', title: 'Dev', client_name: 'A' });
            expect(query.mock.calls[0][0]).toContain('LEFT JOIN clients');
            expect(query.mock.calls[0][1]).toEqual(['1']);
        });

        it('should return null if not found', async () => {
            query.mockResolvedValueOnce({ rows: [] });
            expect(await getMissionWithJoins('999')).toBeNull();
        });
    });

    // ============================================
    // LIST MISSIONS
    // ============================================

    describe('listMissions', () => {
        it('should return paginated missions', async () => {
            selectWithTimeout.mockResolvedValueOnce([{ total: '5' }]);
            query.mockResolvedValueOnce({
                rows: [{ id: '1', title: 'Dev', status: 'open' }]
            });

            const result = await listMissions({ page: 1, limit: 20 });

            expect(result.data).toHaveLength(1);
            expect(result.pagination.totalCount).toBe(5);
            expect(result.pagination.page).toBe(1);
        });

        it('should apply firm filter', async () => {
            selectWithTimeout.mockResolvedValueOnce([{ total: '0' }]);
            query.mockResolvedValueOnce({ rows: [] });

            await listMissions({ page: 1, limit: 20, firmId: 'f1' });

            const countCall = selectWithTimeout.mock.calls[0];
            expect(countCall[1].rawQuery).toContain('m.firm_id = $1');
            expect(countCall[1].rawParams).toContain('f1');
        });

        it('should apply status filter (not "all")', async () => {
            selectWithTimeout.mockResolvedValueOnce([{ total: '0' }]);
            query.mockResolvedValueOnce({ rows: [] });

            await listMissions({ page: 1, limit: 20, status: 'open' });

            const countCall = selectWithTimeout.mock.calls[0];
            expect(countCall[1].rawQuery).toContain('m.status = $');
        });

        it('should skip status filter for "all"', async () => {
            selectWithTimeout.mockResolvedValueOnce([{ total: '0' }]);
            query.mockResolvedValueOnce({ rows: [] });

            await listMissions({ page: 1, limit: 20, status: 'all' });

            const countCall = selectWithTimeout.mock.calls[0];
            expect(countCall[1].rawQuery).not.toContain('m.status');
        });

        it('should apply deal filter with "none"', async () => {
            selectWithTimeout.mockResolvedValueOnce([{ total: '0' }]);
            query.mockResolvedValueOnce({ rows: [] });

            await listMissions({ page: 1, limit: 20, dealId: 'none' });

            const countCall = selectWithTimeout.mock.calls[0];
            expect(countCall[1].rawQuery).toContain('m.deal_id IS NULL');
        });

        it('should apply search filter', async () => {
            selectWithTimeout.mockResolvedValueOnce([{ total: '0' }]);
            query.mockResolvedValueOnce({ rows: [] });

            await listMissions({ page: 1, limit: 20, search: 'dev' });

            const countCall = selectWithTimeout.mock.calls[0];
            expect(countCall[1].rawQuery).toContain('ILIKE');
        });

        it('should calculate pagination correctly', async () => {
            selectWithTimeout.mockResolvedValueOnce([{ total: '50' }]);
            query.mockResolvedValueOnce({ rows: [] });

            const result = await listMissions({ page: 1, limit: 20 });

            expect(result.pagination.totalPages).toBe(3);
            expect(result.pagination.hasMore).toBe(true);
        });
    });

    // ============================================
    // GROUPED BY DEAL
    // ============================================

    describe('getMissionsGroupedByDeal', () => {
        it('should return empty structure when no deals', async () => {
            query
                .mockResolvedValueOnce({ rows: [] })  // deals
                .mockResolvedValueOnce({ rows: [] }); // unassigned missions

            const result = await getMissionsGroupedByDeal({ firmId: 'f1', isAdmin: false });

            expect(result.deals).toEqual([]);
            expect(result.unassigned).toEqual([]);
            expect(result.totalDeals).toBe(0);
        });

        it('should group missions under deals', async () => {
            query
                .mockResolvedValueOnce({ rows: [{ id: 'd1', title: 'Deal 1' }] }) // deals
                .mockResolvedValueOnce({ rows: [{ id: 'm1', title: 'Mission 1', deal_id: 'd1' }] }) // missions
                .mockResolvedValueOnce({ rows: [{ mission_id: 'm1', count: '2' }] }) // adaptation counts
                .mockResolvedValueOnce({ rows: [{ deal_id: 'd1', count: '3' }] }) // resume counts
                .mockResolvedValueOnce({ rows: [] }); // unassigned

            const result = await getMissionsGroupedByDeal({ firmId: 'f1', isAdmin: false });

            expect(result.deals).toHaveLength(1);
            expect(result.deals[0].missions).toHaveLength(1);
            expect(result.deals[0].missions[0].adaptations_count).toBe(2);
            expect(result.deals[0].resumes_count).toBe(3);
        });

        it('should include unassigned missions', async () => {
            query
                .mockResolvedValueOnce({ rows: [] }) // deals
                .mockResolvedValueOnce({ rows: [{ id: 'm1', title: 'Orphan' }] }) // unassigned
                .mockResolvedValueOnce({ rows: [] }); // unassigned adaptation counts

            const result = await getMissionsGroupedByDeal({ firmId: 'f1', isAdmin: false });

            expect(result.unassigned).toHaveLength(1);
            expect(result.totalUnassigned).toBe(1);
        });
    });

    // ============================================
    // VALIDATION HELPERS
    // ============================================

    describe('validateFirm', () => {
        it('should return firm if found', async () => {
            query.mockResolvedValueOnce({ rows: [{ id: 'f1', name: 'Acme' }] });
            expect(await validateFirm('f1')).toEqual({ id: 'f1', name: 'Acme' });
        });

        it('should return null if not found', async () => {
            query.mockResolvedValueOnce({ rows: [] });
            expect(await validateFirm('missing')).toBeNull();
        });
    });

    describe('validateClient', () => {
        it('should return exists:true, firmMatch:true if client exists and firm matches', async () => {
            query.mockResolvedValueOnce({ rows: [{ firm_id: 'f1' }] });
            expect(await validateClient('c1', 'f1')).toEqual({ exists: true, firmMatch: true });
        });

        it('should return firmMatch:false if firm does not match', async () => {
            query.mockResolvedValueOnce({ rows: [{ firm_id: 'f2' }] });
            expect(await validateClient('c1', 'f1')).toEqual({ exists: true, firmMatch: false });
        });

        it('should return exists:false if client not found', async () => {
            query.mockResolvedValueOnce({ rows: [] });
            expect(await validateClient('missing', 'f1')).toEqual({ exists: false, firmMatch: false });
        });
    });

    describe('validateContact', () => {
        it('should return true if contact exists for client', async () => {
            query.mockResolvedValueOnce({ rows: [{ id: 'ct1' }] });
            expect(await validateContact('ct1', 'c1')).toBe(true);
        });

        it('should return false if not found', async () => {
            query.mockResolvedValueOnce({ rows: [] });
            expect(await validateContact('missing', 'c1')).toBe(false);
        });
    });

    describe('validateDeal', () => {
        it('should return exists:true, firmMatch:true if deal exists and firm matches', async () => {
            query.mockResolvedValueOnce({ rows: [{ firm_id: 'f1' }] });
            expect(await validateDeal('d1', 'f1')).toEqual({ exists: true, firmMatch: true });
        });

        it('should return exists:false if not found', async () => {
            query.mockResolvedValueOnce({ rows: [] });
            expect(await validateDeal('missing', 'f1')).toEqual({ exists: false, firmMatch: false });
        });
    });

    // ============================================
    // CRUD
    // ============================================

    describe('createMission', () => {
        it('should create mission and return it with joins', async () => {
            createWithTimeout.mockResolvedValueOnce({ id: 'm1' });
            query.mockResolvedValueOnce({ rows: [{ id: 'm1', title: 'New', client_name: 'A' }] });

            const result = await createMission({ title: 'New', firm_id: 'f1' });

            expect(createWithTimeout).toHaveBeenCalledWith('missions', { title: 'New', firm_id: 'f1' });
            expect(result.title).toBe('New');
        });
    });

    describe('findMission', () => {
        it('should delegate to findWithTimeout', async () => {
            findWithTimeout.mockResolvedValueOnce({ id: 'm1', title: 'Found' });

            const result = await findMission('m1');

            expect(findWithTimeout).toHaveBeenCalledWith('missions', 'm1');
            expect(result.title).toBe('Found');
        });
    });

    describe('updateMission', () => {
        it('should update and return mission with joins', async () => {
            updateWithTimeout.mockResolvedValueOnce({ id: 'm1' });
            query.mockResolvedValueOnce({ rows: [{ id: 'm1', title: 'Updated', client_name: 'B' }] });

            const result = await updateMission('m1', { title: 'Updated' });

            expect(updateWithTimeout).toHaveBeenCalledWith('missions', 'm1', { title: 'Updated' });
            expect(result.title).toBe('Updated');
        });
    });

    describe('deleteMission', () => {
        it('should delegate to destroyWithTimeout', async () => {
            destroyWithTimeout.mockResolvedValueOnce();

            await deleteMission('m1');

            expect(destroyWithTimeout).toHaveBeenCalledWith('missions', 'm1');
        });
    });

    describe('listMissionAdaptations', () => {
        it('should return mapped adaptation records', async () => {
            selectWithTimeout.mockResolvedValueOnce([
                { id: 'a1', resume_id: 'r1', mission_id: 'm1', resume_name: 'CV', candidate_name: 'John',
                  adapted_title: 'Dev', mission_title: 'Dev Mission', adapted_text: 'text',
                  match_score: 85, match_analysis: '{}', status: 'completed',
                  created_at: '2025-01-01', updated_at: '2025-01-02' }
            ]);

            const result = await listMissionAdaptations('m1');

            expect(result).toHaveLength(1);
            expect(result[0]['Resume Name']).toBe('CV');
            expect(result[0]['Match Score']).toBe(85);
            expect(result[0].Status).toBe('completed');
        });
    });
});
