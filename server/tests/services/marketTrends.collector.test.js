/**
 * Tests for Market Trends - Collector
 * Tests storeTrend and generateCollectionReport (DB-facing logic)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../config/database.js', () => ({
    query: vi.fn()
}));

vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn()
}));

vi.mock('../../services/franceTravail.service.js', () => ({
    FRENCH_REGIONS: [{ code: '11', name: 'Île-de-France' }]
}));

vi.mock('../../services/rome.service.js', () => ({
    getStoredMetiers: vi.fn()
}));

vi.mock('../../services/marketTrends/apiClient.js', () => ({
    getStatEmbauches: vi.fn(),
    getStatDynamiqueEmploi: vi.fn(),
    getStatTensions: vi.fn(),
    getStatSalaires: vi.fn(),
    getStatOffres: vi.fn(),
    getStatDemandeurs: vi.fn(),
    getStatDemandeursEntrants: vi.fn()
}));

import { query } from '../../config/database.js';
import { storeTrend, generateCollectionReport } from '../../services/marketTrends/collector.js';

describe('Market Trends - Collector', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('storeTrend', () => {
        const baseTrend = {
            type: 'embauche',
            codeRome: 'M1805',
            romeLabel: 'Dev',
            region: 'Île-de-France',
            regionCode: '11',
            date: '2024-01-15',
            value: 1234,
            valueLabel: '1 234',
            metadata: { key: 'value' },
            apiEndpoint: 'stat-embauches',
            quarterPeriod: 'Q4 2024'
        };

        it('should create a new trend when none exists', async () => {
            query.mockResolvedValueOnce({ rows: [] }); // SELECT - no existing
            query.mockResolvedValueOnce({ rows: [{ id: 't1', ...baseTrend }] }); // INSERT

            const result = await storeTrend(baseTrend);

            expect(result.action).toBe('created');
            expect(query.mock.calls[1][0]).toContain('INSERT INTO');
        });

        it('should update an existing trend', async () => {
            query.mockResolvedValueOnce({ rows: [{ id: 't1', value: 1000 }] }); // SELECT - existing
            query.mockResolvedValueOnce({ rows: [{ id: 't1', value: 1234 }] }); // UPDATE

            const result = await storeTrend(baseTrend);

            expect(result.action).toBe('updated');
            expect(result.previousValue).toBe(1000);
            expect(query.mock.calls[1][0]).toContain('UPDATE');
        });

        it('should return error info on DB failure without throwing', async () => {
            query.mockRejectedValueOnce(new Error('DB error'));

            const result = await storeTrend(baseTrend);

            expect(result.action).toBe('failed');
            expect(result.error).toBe('DB error');
        });

        it('should handle null metadata', async () => {
            query.mockResolvedValueOnce({ rows: [] });
            query.mockResolvedValueOnce({ rows: [{ id: 't1' }] });

            const result = await storeTrend({ ...baseTrend, metadata: null });

            expect(result.action).toBe('created');
        });

        it('should pass decimal trend values to PostgreSQL without integer coercion', async () => {
            query.mockResolvedValueOnce({ rows: [] });
            query.mockResolvedValueOnce({ rows: [{ id: 't1', value: '0.574321' }] });

            const result = await storeTrend({ ...baseTrend, value: 0.574321 });

            expect(result.action).toBe('created');
            expect(query.mock.calls[1][1][7]).toBe(0.574321);
        });
    });

    describe('generateCollectionReport', () => {
        it('should return collection report with summary and changes', async () => {
            query.mockResolvedValueOnce({
                rows: [{ type: 'embauche', total_records: '50', records_with_value: '45', total_value: '10000', avg_value: '200', updated_records: '10', significant_changes: '2' }]
            });
            query.mockResolvedValueOnce({
                rows: [{ type: 'embauche', region_code: '11', code_rome: 'M1805', rome_label: 'Dev', previous_value: '100', value: '200', change_percent: '100.0' }]
            });

            const report = await generateCollectionReport('Q4 2024', '2024-12-31');

            expect(report.quarterPeriod).toBe('Q4 2024');
            expect(report.summary.totalRecordsCollected).toBe(50);
            expect(report.summary.totalSignificantChanges).toBe(2);
            expect(report.topChanges).toHaveLength(1);
        });

        it('should return error report on DB failure', async () => {
            query.mockRejectedValueOnce(new Error('DB error'));

            const report = await generateCollectionReport('Q4 2024', '2024-12-31');

            expect(report.error).toBe('DB error');
        });
    });
});
