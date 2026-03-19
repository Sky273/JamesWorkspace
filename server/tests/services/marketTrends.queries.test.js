/**
 * Tests for Market Trends - Queries
 * Tests getStoredTrendsLight, getStoredTrendsWithMetadata, getTrendMetadata,
 * getTrendsAuditReport, fetchMetadataForIds
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
    getStoredTrendsLight,
    getStoredTrendsWithMetadata,
    getTrendMetadata,
    getTrendsAuditReport,
    fetchMetadataForIds
} from '../../services/marketTrends/queries.js';

const mockRow = (overrides = {}) => ({
    id: 't1',
    type: 'embauche',
    code_rome: 'M1805',
    rome_label: 'Dev',
    region: 'Île-de-France',
    region_code: '11',
    date: '2024-Q1',
    value: '1234',
    value_label: '1 234',
    ...overrides
});

describe('Market Trends - Queries', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getStoredTrendsLight', () => {
        it('should return trends without metadata', async () => {
            query.mockResolvedValueOnce({ rows: [mockRow({ collected_at: '2024-01-15', api_endpoint: '/api/x', quarter_period: 'Q1' })] });

            const result = await getStoredTrendsLight();

            expect(result.trends).toHaveLength(1);
            expect(result.trends[0].Type).toBe('embauche');
            expect(result.trends[0].Value).toBe(1234);
            expect(result.totalCount).toBe(1);
        });

        it('should apply type filter', async () => {
            query.mockResolvedValueOnce({ rows: [] });

            await getStoredTrendsLight({ type: 'salaire' });

            expect(query.mock.calls[0][0]).toContain('type = $1');
            expect(query.mock.calls[0][1]).toEqual(['salaire']);
        });

        it('should apply codeRome filter', async () => {
            query.mockResolvedValueOnce({ rows: [] });

            await getStoredTrendsLight({ codeRome: 'M1805' });

            expect(query.mock.calls[0][0]).toContain('code_rome = $1');
            expect(query.mock.calls[0][1]).toEqual(['M1805']);
        });

        it('should apply regionCode filter', async () => {
            query.mockResolvedValueOnce({ rows: [] });

            await getStoredTrendsLight({ regionCode: '11' });

            expect(query.mock.calls[0][0]).toContain('region_code = $1');
        });

        it('should combine multiple filters', async () => {
            query.mockResolvedValueOnce({ rows: [] });

            await getStoredTrendsLight({ type: 'embauche', codeRome: 'M1805', regionCode: '11' });

            expect(query.mock.calls[0][1]).toEqual(['embauche', 'M1805', '11']);
        });

        it('should throw on DB error', async () => {
            query.mockRejectedValueOnce(new Error('DB error'));
            await expect(getStoredTrendsLight()).rejects.toThrow();
        });
    });

    describe('getStoredTrendsWithMetadata', () => {
        it('should return trends with metadata', async () => {
            query.mockResolvedValueOnce({
                rows: [mockRow({ metadata: { detail: 'info' } })]
            });

            const result = await getStoredTrendsWithMetadata();

            expect(result.trends[0].Metadata).toEqual({ detail: 'info' });
        });

        it('should apply filters', async () => {
            query.mockResolvedValueOnce({ rows: [] });

            await getStoredTrendsWithMetadata({ type: 'tension' });

            expect(query.mock.calls[0][1]).toEqual(['tension']);
        });

        it('should throw on DB error', async () => {
            query.mockRejectedValueOnce(new Error('DB error'));
            await expect(getStoredTrendsWithMetadata()).rejects.toThrow();
        });
    });

    describe('getTrendMetadata', () => {
        it('should return trend with metadata', async () => {
            query.mockResolvedValueOnce({
                rows: [mockRow({ metadata: { key: 'val' } })]
            });

            const result = await getTrendMetadata('t1');

            expect(result.Type).toBe('embauche');
            expect(result.Metadata).toEqual({ key: 'val' });
        });

        it('should return null if not found', async () => {
            query.mockResolvedValueOnce({ rows: [] });
            expect(await getTrendMetadata('missing')).toBeNull();
        });

        it('should throw on DB error', async () => {
            query.mockRejectedValueOnce(new Error('DB error'));
            await expect(getTrendMetadata('t1')).rejects.toThrow();
        });
    });

    describe('getTrendsAuditReport', () => {
        it('should return freshness, changes, and overall stats', async () => {
            query.mockResolvedValueOnce({ rows: [{ type: 'embauche', total_records: '10' }] }); // freshness
            query.mockResolvedValueOnce({ rows: [{ type: 'salaire', change_percent: '55.0' }] }); // changes
            query.mockResolvedValueOnce({ rows: [{ total_records: '100', total_types: '5' }] }); // overall

            const result = await getTrendsAuditReport();

            expect(result.freshness).toHaveLength(1);
            expect(result.significantChanges).toHaveLength(1);
            expect(result.overall.total_records).toBe('100');
        });
    });

    describe('fetchMetadataForIds', () => {
        it('should return metadata map for given IDs', async () => {
            query.mockResolvedValueOnce({
                rows: [
                    { id: 't1', metadata: { a: 1 } },
                    { id: 't2', metadata: { b: 2 } }
                ]
            });

            const result = await fetchMetadataForIds(['t1', 't2']);

            expect(result.t1).toEqual({ a: 1 });
            expect(result.t2).toEqual({ b: 2 });
        });

        it('should return empty object for empty input', async () => {
            expect(await fetchMetadataForIds([])).toEqual({});
            expect(await fetchMetadataForIds(null)).toEqual({});
        });
    });
});
