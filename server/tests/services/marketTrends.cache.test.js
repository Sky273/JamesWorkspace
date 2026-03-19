/**
 * Tests for Market Trends - Cache System
 * Tests invalidateTrendsCache, destroyTrendsCache, getTrendsCacheStats,
 * cleanupTrendsCache, getTrendFilterOptions, getTrendsSummary,
 * getStoredTrends, getStoredTrendsGroupedByType
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../config/database.js', () => ({
    query: vi.fn()
}));

vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn()
}));

vi.mock('../../services/marketTrends/queries.js', () => ({
    fetchMetadataForIds: vi.fn(async () => ({}))
}));

vi.mock('../../services/marketTrends/apiClient.js', () => ({
    clearTokenCache: vi.fn()
}));

import { query } from '../../config/database.js';
import { fetchMetadataForIds } from '../../services/marketTrends/queries.js';
import {
    invalidateTrendsCache,
    destroyTrendsCache,
    getTrendsCacheStats,
    cleanupTrendsCache,
    loadTrendsCache,
    getTrendFilterOptions,
    getTrendsSummary,
    getStoredTrends,
    getStoredTrendsGroupedByType
} from '../../services/marketTrends/cache.js';

const mockTrendRows = [
    { id: 't1', type: 'embauche', code_rome: 'M1805', rome_label: 'Dev', region: 'Île-de-France', region_code: '11', date: '2024-Q1', value: '100', value_label: '100' },
    { id: 't2', type: 'salaire', code_rome: 'M1805', rome_label: 'Dev', region: 'Occitanie', region_code: '76', date: '2024-Q2', value: '3500', value_label: '3 500' },
    { id: 't3', type: 'embauche', code_rome: 'A1234', rome_label: 'Agri', region: 'Île-de-France', region_code: '11', date: '2024-Q1', value: '50', value_label: '50' }
];

describe('Market Trends - Cache', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        invalidateTrendsCache();
    });

    describe('invalidateTrendsCache', () => {
        it('should reset cache stats to zero', () => {
            invalidateTrendsCache();
            const stats = getTrendsCacheStats();
            expect(stats.size).toBe(0);
            expect(stats.ageMs).toBeNull();
        });
    });

    describe('destroyTrendsCache', () => {
        it('should clear all caches', () => {
            destroyTrendsCache();
            const stats = getTrendsCacheStats();
            expect(stats.size).toBe(0);
            expect(stats.hasFilterOptions).toBe(false);
            expect(stats.hasSummary).toBe(false);
        });
    });

    describe('getTrendsCacheStats', () => {
        it('should return cache statistics', () => {
            const stats = getTrendsCacheStats();
            expect(stats).toHaveProperty('size');
            expect(stats).toHaveProperty('maxSize');
            expect(stats).toHaveProperty('ttlMinutes');
            expect(stats.ttlMinutes).toBe(5);
        });
    });

    describe('cleanupTrendsCache', () => {
        it('should clear cache without error', () => {
            expect(() => cleanupTrendsCache()).not.toThrow();
            expect(getTrendsCacheStats().size).toBe(0);
        });
    });

    describe('loadTrendsCache', () => {
        it('should load trends from database', async () => {
            query.mockResolvedValueOnce({ rows: mockTrendRows });
            fetchMetadataForIds.mockResolvedValueOnce({});

            const result = await loadTrendsCache();

            expect(result).toHaveLength(3);
            expect(getTrendsCacheStats().size).toBe(3);
        });

        it('should compute filter options after loading', async () => {
            query.mockResolvedValueOnce({ rows: mockTrendRows });
            fetchMetadataForIds.mockResolvedValueOnce({});

            await loadTrendsCache();

            expect(getTrendsCacheStats().hasFilterOptions).toBe(true);
        });
    });

    describe('getTrendFilterOptions', () => {
        it('should return filter options from cache', async () => {
            query.mockResolvedValueOnce({ rows: mockTrendRows });
            fetchMetadataForIds.mockResolvedValueOnce({});

            const options = await getTrendFilterOptions();

            expect(options.types).toContain('embauche');
            expect(options.types).toContain('salaire');
            expect(options.regions.length).toBeGreaterThan(0);
            expect(options.romeCodes).toContain('M1805');
        });

        it('should return empty options when no data', async () => {
            query.mockResolvedValueOnce({ rows: [] });

            const options = await getTrendFilterOptions();

            expect(options.types).toEqual([]);
            expect(options.regions).toEqual([]);
            expect(options.romeCodes).toEqual([]);
        });
    });

    describe('getTrendsSummary', () => {
        it('should return summary from cache', async () => {
            query.mockResolvedValueOnce({ rows: mockTrendRows });
            fetchMetadataForIds.mockResolvedValue({});

            await loadTrendsCache();
            const summary = await getTrendsSummary();

            expect(summary.totalRecords).toBe(3);
            expect(summary.types.length).toBeGreaterThan(0);
            expect(summary.regions.length).toBeGreaterThan(0);
        });
    });

    describe('getStoredTrends', () => {
        beforeEach(async () => {
            query.mockResolvedValueOnce({ rows: mockTrendRows });
            fetchMetadataForIds.mockResolvedValueOnce({});
            await loadTrendsCache();
        });

        it('should return paginated trends', async () => {
            fetchMetadataForIds.mockResolvedValueOnce({});

            const result = await getStoredTrends({ page: 1, pageSize: 2 });

            expect(result.trends).toHaveLength(2);
            expect(result.totalCount).toBe(3);
            expect(result.pagination.totalPages).toBe(2);
        });

        it('should filter by type', async () => {
            fetchMetadataForIds.mockResolvedValueOnce({});

            const result = await getStoredTrends({ type: 'embauche' });

            expect(result.totalCount).toBe(2);
            result.trends.forEach(t => expect(t.Type).toBe('embauche'));
        });

        it('should filter by codeRome', async () => {
            fetchMetadataForIds.mockResolvedValueOnce({});

            const result = await getStoredTrends({ codeRome: 'A1234' });

            expect(result.totalCount).toBe(1);
        });

        it('should filter by regionCode', async () => {
            fetchMetadataForIds.mockResolvedValueOnce({});

            const result = await getStoredTrends({ regionCode: '76' });

            expect(result.totalCount).toBe(1);
        });

        it('should merge metadata into results', async () => {
            fetchMetadataForIds.mockResolvedValue({ t1: { detail: 'info' } });

            const result = await getStoredTrends();

            const t1 = result.trends.find(t => t.id === 't1');
            expect(t1.Metadata).toEqual({ detail: 'info' });
        });
    });

    describe('getStoredTrendsGroupedByType', () => {
        beforeEach(async () => {
            query.mockResolvedValueOnce({ rows: mockTrendRows });
            fetchMetadataForIds.mockResolvedValueOnce({});
            await loadTrendsCache();
        });

        it('should group trends by type', async () => {
            fetchMetadataForIds.mockResolvedValueOnce({});

            const result = await getStoredTrendsGroupedByType();

            expect(result.groupedTrends).toHaveProperty('embauche');
            expect(result.groupedTrends).toHaveProperty('salaire');
            expect(result.countsByType.embauche).toBe(2);
            expect(result.countsByType.salaire).toBe(1);
            expect(result.totalCount).toBe(3);
        });

        it('should limit items per type', async () => {
            fetchMetadataForIds.mockResolvedValueOnce({});

            const result = await getStoredTrendsGroupedByType({ itemsPerType: 1 });

            expect(result.groupedTrends.embauche).toHaveLength(1);
        });

        it('should apply codeRome filter', async () => {
            fetchMetadataForIds.mockResolvedValueOnce({});

            const result = await getStoredTrendsGroupedByType({ codeRome: 'A1234' });

            expect(result.totalCount).toBe(1);
        });
    });
});
