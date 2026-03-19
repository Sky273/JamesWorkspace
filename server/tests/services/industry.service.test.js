/**
 * Tests for Industry Service
 * Tests industry fetching, caching, and string export
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../utils/postgresHelpers.js', () => ({
    selectWithTimeout: vi.fn()
}));

vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn()
}));

import { selectWithTimeout } from '../../utils/postgresHelpers.js';
import {
    getAcceptedIndustries,
    getAcceptedIndustriesString,
    clearIndustriesCache
} from '../../services/industry.service.js';

describe('Industry Service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        clearIndustriesCache();
    });

    describe('getAcceptedIndustries', () => {
        it('should return sorted unique industries', async () => {
            selectWithTimeout.mockResolvedValueOnce([
                { canonical_name: 'Technologies' },
                { canonical_name: 'Finance' },
                { canonical_name: 'Technologies' }, // duplicate
                { canonical_name: 'Santé' }
            ]);

            const result = await getAcceptedIndustries();

            expect(result).toEqual(['Finance', 'Santé', 'Technologies']);
        });

        it('should filter out empty/null values', async () => {
            selectWithTimeout.mockResolvedValueOnce([
                { canonical_name: 'IT' },
                { canonical_name: '' },
                { canonical_name: null },
                { canonical_name: '  ' }
            ]);

            const result = await getAcceptedIndustries();

            expect(result).toEqual(['IT']);
        });

        it('should use cache on second call', async () => {
            selectWithTimeout.mockResolvedValueOnce([{ canonical_name: 'IT' }]);

            await getAcceptedIndustries();
            const result2 = await getAcceptedIndustries();

            expect(selectWithTimeout).toHaveBeenCalledTimes(1); // only once
            expect(result2).toEqual(['IT']);
        });

        it('should return empty array on error', async () => {
            selectWithTimeout.mockRejectedValueOnce(new Error('DB error'));

            const result = await getAcceptedIndustries();

            expect(result).toEqual([]);
        });
    });

    describe('getAcceptedIndustriesString', () => {
        it('should return comma-separated string', async () => {
            selectWithTimeout.mockResolvedValueOnce([
                { canonical_name: 'Finance' },
                { canonical_name: 'IT' }
            ]);

            const result = await getAcceptedIndustriesString();

            expect(result).toBe('Finance, IT');
        });
    });

    describe('clearIndustriesCache', () => {
        it('should force reload on next call', async () => {
            selectWithTimeout
                .mockResolvedValueOnce([{ canonical_name: 'IT' }])
                .mockResolvedValueOnce([{ canonical_name: 'Finance' }]);

            await getAcceptedIndustries();
            clearIndustriesCache();
            const result = await getAcceptedIndustries();

            expect(selectWithTimeout).toHaveBeenCalledTimes(2);
            expect(result).toEqual(['Finance']);
        });
    });
});
