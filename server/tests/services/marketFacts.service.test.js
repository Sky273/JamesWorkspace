/**
 * Tests for Market Facts Service
 * Tests ROME code retrieval, fact storage, cache, retrieval functions
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../config/database.js', () => ({
    query: vi.fn()
}));

vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn()
}));

vi.mock('../../services/franceTravail.service.js', () => ({
    collectMarketFacts: vi.fn()
}));

vi.mock('../../services/adzuna.service.js', () => ({
    collectMarketFacts: vi.fn()
}));

import { query } from '../../config/database.js';
import {
    getStoredRomeCodes,
    storeFact,
    storeFacts,
    getFactsByDateRange,
    getLatestFacts,
    getKeywordTrend,
    getRegionalComparison,
    invalidateFactsCache,
    getFactsCacheStats,
    cleanupFactsCache,
    destroyFactsCache
} from '../../services/marketFacts.service.js';

describe('Market Facts Service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        invalidateFactsCache();
    });

    afterEach(() => {
        cleanupFactsCache();
    });

    describe('getStoredRomeCodes', () => {
        it('should return ROME codes from DB', async () => {
            query.mockResolvedValueOnce({ rows: [{ code_rome: 'M1805' }, { code_rome: 'M1802' }] });

            const result = await getStoredRomeCodes();

            expect(result).toEqual(['M1805', 'M1802']);
        });

        it('should return empty array on error', async () => {
            query.mockRejectedValueOnce(new Error('DB error'));

            const result = await getStoredRomeCodes();

            expect(result).toEqual([]);
        });
    });

    describe('storeFact', () => {
        it('should insert fact and return record', async () => {
            query.mockResolvedValueOnce({ rows: [{ id: 'f1' }] });

            const result = await storeFact({
                date: '2025-01-01', source: 'france_travail',
                keyword: 'M1805', region: 'Île-de-France',
                jobCount: 100, meanSalary: 45000,
                metadata: {}, type: 'rome_region', regionCode: '11', romeCode: 'M1805'
            });

            expect(result.id).toBe('f1');
            expect(query.mock.calls[0][0]).toContain('INSERT INTO market_facts');
        });

        it('should throw on DB error', async () => {
            query.mockRejectedValueOnce(new Error('Duplicate'));

            await expect(storeFact({ date: '2025-01-01', source: 'test', metadata: {} }))
                .rejects.toThrow('Duplicate');
        });
    });

    describe('storeFacts', () => {
        it('should store multiple facts and return summary', async () => {
            query
                .mockResolvedValueOnce({ rows: [{ id: '1' }] })
                .mockResolvedValueOnce({ rows: [{ id: '2' }] });

            const result = await storeFacts([
                { date: '2025-01-01', source: 's', metadata: {} },
                { date: '2025-01-02', source: 's', metadata: {} }
            ]);

            expect(result.success).toBe(2);
            expect(result.failed).toBe(0);
        });

        it('should count failures', async () => {
            query
                .mockResolvedValueOnce({ rows: [{ id: '1' }] })
                .mockRejectedValueOnce(new Error('fail'));

            const result = await storeFacts([
                { date: '2025-01-01', source: 's', metadata: {} },
                { date: '2025-01-02', source: 's', metadata: {} }
            ]);

            expect(result.success).toBe(1);
            expect(result.failed).toBe(1);
        });
    });

    describe('getFactsByDateRange', () => {
        it('should load cache and return filtered facts', async () => {
            query.mockResolvedValueOnce({
                rows: [
                    { id: '1', source: 'france_travail', date: '2025-01-02', keyword: 'M1805', location: 'Paris', job_count: 50, mean_salary: 40000, metadata: {} },
                    { id: '2', source: 'adzuna', date: '2025-01-01', keyword: 'dev', location: 'Lyon', job_count: 30, mean_salary: 35000, metadata: {} }
                ]
            });

            const result = await getFactsByDateRange(null, null, { source: 'france_travail' });

            expect(result.facts).toHaveLength(1);
            expect(result.facts[0].Source).toBe('france_travail');
        });

        it('should support pagination', async () => {
            const rows = Array(25).fill(null).map((_, i) => ({
                id: `${i}`, source: 'ft', date: `2025-01-${String(i + 1).padStart(2, '0')}`,
                keyword: 'K', location: 'L', job_count: i, mean_salary: null, metadata: {}
            }));
            query.mockResolvedValueOnce({ rows });

            const result = await getFactsByDateRange(null, null, { page: 1, pageSize: 10 });

            expect(result.facts).toHaveLength(10);
            expect(result.pagination.totalCount).toBe(25);
            expect(result.pagination.totalPages).toBe(3);
        });
    });

    describe('getLatestFacts', () => {
        it('should return latest facts', async () => {
            query.mockResolvedValueOnce({ rows: [{ id: '1', source: 'ft', date: '2025-01-01', keyword: 'K', location: 'L', region: 'R', job_count: 10, mean_salary: null, metadata: {} }] });

            const result = await getLatestFacts('all');

            expect(result).toHaveLength(1);
            expect(result[0].Source).toBe('ft');
        });

        it('should filter by source', async () => {
            query.mockResolvedValueOnce({ rows: [] });

            await getLatestFacts('all', 'adzuna');

            expect(query.mock.calls[0][0]).toContain('WHERE source = $1');
        });
    });

    describe('getKeywordTrend', () => {
        it('should return trend data for keyword', async () => {
            query.mockResolvedValueOnce({ rows: [
                { date: '2025-01-01', source: 'ft', job_count: 10, mean_salary: 40000 },
                { date: '2025-01-15', source: 'ft', job_count: 15, mean_salary: 42000 }
            ] });

            const result = await getKeywordTrend('M1805', 30);

            expect(result.keyword).toBe('M1805');
            expect(result.dataPoints).toBe(2);
            expect(result.trend).toHaveLength(2);
        });
    });

    describe('getRegionalComparison', () => {
        it('should return regional data for date', async () => {
            query.mockResolvedValueOnce({ rows: [
                { id: '1', location: 'Paris', keyword: 'K', job_count: 100, mean_salary: 50000, source: 'ft' }
            ] });

            const result = await getRegionalComparison('2025-01-01');

            expect(result).toHaveLength(1);
            expect(result[0].location).toBe('Paris');
        });

        it('should filter by source', async () => {
            query.mockResolvedValueOnce({ rows: [] });

            await getRegionalComparison('2025-01-01', 'adzuna');

            expect(query.mock.calls[0][0]).toContain('AND source = $2');
        });
    });

    describe('Cache management', () => {
        it('getFactsCacheStats should return stats', () => {
            const stats = getFactsCacheStats();
            expect(stats.size).toBe(0);
            expect(stats.maxSize).toBe(10000);
        });

        it('destroyFactsCache should not throw', () => {
            expect(() => destroyFactsCache()).not.toThrow();
        });
    });
});
