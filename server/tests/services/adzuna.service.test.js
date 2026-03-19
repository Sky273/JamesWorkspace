/**
 * Tests for Adzuna Service
 * Configuration check, API wrappers, constants
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('axios');
vi.mock('../../config/constants.js', () => ({
    ADZUNA_APP_ID: 'test-app-id',
    ADZUNA_APP_KEY: 'test-app-key',
    ADZUNA_API_URL: 'https://test-adzuna-api'
}));
vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn()
}));

import axios from 'axios';
import {
    isConfigured,
    searchJobs,
    getCategories,
    getSalaryHistogram,
    getHistoricalSalary,
    getTopCompanies,
    getRegionalData,
    IT_CATEGORIES,
    FRENCH_LOCATIONS,
    IT_KEYWORDS
} from '../../services/adzuna.service.js';

describe('Adzuna Service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('isConfigured', () => {
        it('should return true when credentials are set', () => {
            expect(isConfigured()).toBe(true);
        });
    });

    describe('constants', () => {
        it('should export IT_CATEGORIES', () => {
            expect(IT_CATEGORIES).toContain('it-jobs');
        });

        it('should export FRENCH_LOCATIONS', () => {
            expect(FRENCH_LOCATIONS.find(l => l.code === 'paris')).toBeDefined();
        });

        it('should export IT_KEYWORDS', () => {
            expect(IT_KEYWORDS).toContain('javascript');
        });
    });

    describe('searchJobs', () => {
        it('should search with params and return results', async () => {
            axios.get.mockResolvedValueOnce({
                data: {
                    count: 100,
                    results: [{ id: '1', title: 'Dev' }],
                    mean: 45000,
                    location: 'Paris'
                }
            });

            const result = await searchJobs({ what: 'javascript', where: 'paris' });

            expect(result.count).toBe(100);
            expect(result.results).toHaveLength(1);
            expect(result.mean).toBe(45000);
            expect(axios.get).toHaveBeenCalledWith(
                expect.stringContaining('/jobs/fr/search/1'),
                expect.objectContaining({ params: expect.objectContaining({ app_id: 'test-app-id' }) })
            );
        });

        it('should throw on API error', async () => {
            axios.get.mockRejectedValueOnce(new Error('API Error'));
            await expect(searchJobs({ what: 'test' })).rejects.toThrow('API Error');
        });
    });

    describe('getCategories', () => {
        it('should return categories', async () => {
            axios.get.mockResolvedValueOnce({
                data: { results: [{ tag: 'it-jobs', label: 'IT' }] }
            });

            const result = await getCategories();
            expect(result).toHaveLength(1);
            expect(result[0].tag).toBe('it-jobs');
        });
    });

    describe('getSalaryHistogram', () => {
        it('should return histogram data', async () => {
            axios.get.mockResolvedValueOnce({
                data: { histogram: { '30000': 10, '40000': 20 }, location: 'Paris' }
            });

            const result = await getSalaryHistogram({ what: 'react' });
            expect(result.histogram).toHaveProperty('30000');
        });
    });

    describe('getHistoricalSalary', () => {
        it('should return historical data', async () => {
            axios.get.mockResolvedValueOnce({
                data: { month: { '2024-01': 40000 }, location: 'France' }
            });

            const result = await getHistoricalSalary({ what: 'python', months: 6 });
            expect(result.month).toHaveProperty('2024-01');
        });
    });

    describe('getTopCompanies', () => {
        it('should return leaderboard', async () => {
            axios.get.mockResolvedValueOnce({
                data: { leaderboard: [{ name: 'Acme', count: 50 }], location: 'France' }
            });

            const result = await getTopCompanies({ what: 'developer' });
            expect(result.leaderboard).toHaveLength(1);
        });
    });

    describe('getRegionalData', () => {
        it('should return regional data', async () => {
            axios.get.mockResolvedValueOnce({
                data: { locations: [{ location: 'Paris', count: 500 }], location: 'France' }
            });

            const result = await getRegionalData({ what: 'developer' });
            expect(result.locations).toHaveLength(1);
        });
    });
});
