/**
 * Tests for France Travail Service
 * Token management, searchOffers, getReferentiel, constants
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('axios');
vi.mock('../../config/constants.js', () => ({
    FRANCE_TRAVAIL_CLIENT_ID: 'test-client-id',
    FRANCE_TRAVAIL_CLIENT_SECRET: 'test-client-secret',
    FRANCE_TRAVAIL_TOKEN_URL: 'https://test-token-url/token',
    FRANCE_TRAVAIL_API_URL: 'https://test-api'
}));
vi.mock('../../utils/logger.backend.js', () => ({
    createModuleLogger: vi.fn(() => ({
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    })),
    safeLog: vi.fn()
}));

import axios from 'axios';
import {
    getAccessToken,
    searchOffers,
    getReferentiel,
    IT_ROME_CODES,
    FRENCH_REGIONS,
    IT_KEYWORDS
} from '../../services/franceTravail.service.js';

describe('France Travail Service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('constants', () => {
        it('should export IT_ROME_CODES array', () => {
            expect(Array.isArray(IT_ROME_CODES)).toBe(true);
            expect(IT_ROME_CODES).toContain('M1805');
        });

        it('should export FRENCH_REGIONS array', () => {
            expect(Array.isArray(FRENCH_REGIONS)).toBe(true);
            expect(FRENCH_REGIONS.find(r => r.code === '11')).toBeDefined();
        });

        it('should export IT_KEYWORDS array', () => {
            expect(Array.isArray(IT_KEYWORDS)).toBe(true);
            expect(IT_KEYWORDS).toContain('javascript');
        });
    });

    describe('getAccessToken', () => {
        it('should fetch and cache access token', async () => {
            axios.post.mockResolvedValueOnce({
                data: { access_token: 'ft-tok-123', expires_in: 1500, scope: 'api_offresdemploiv2' }
            });

            const token = await getAccessToken();
            expect(token).toBe('ft-tok-123');

            // Second call should use cache (no additional axios call)
            const token2 = await getAccessToken();
            expect(token2).toBe('ft-tok-123');
            expect(axios.post).toHaveBeenCalledTimes(1);
        });
    });

    describe('searchOffers', () => {
        it('should search with parameters', async () => {
            // Token
            axios.post.mockResolvedValueOnce({
                data: { access_token: 'tok', expires_in: 1500 }
            });
            // Search
            axios.get.mockResolvedValueOnce({
                data: { resultats: [{ id: '1' }], filtresPossibles: [] },
                headers: { 'content-range': '0-0/42' }
            });

            const result = await searchOffers({ codeROME: 'M1805', region: '11' });

            expect(result.results).toHaveLength(1);
            expect(result.totalCount).toBe(42);
        });

        it('should retry on token expiration (401)', async () => {
            // Token
            axios.post.mockResolvedValue({
                data: { access_token: 'new-tok', expires_in: 1500 }
            });
            // First call fails with 401
            axios.get.mockRejectedValueOnce({
                response: { status: 401, data: 'Mal_wellFormed' }
            });
            // Retry succeeds
            axios.get.mockResolvedValueOnce({
                data: { resultats: [{ id: '2' }], filtresPossibles: [] },
                headers: { 'content-range': '0-0/10' }
            });

            const result = await searchOffers({ codeROME: 'M1805' });
            expect(result.results).toHaveLength(1);
        });
    });

    describe('getReferentiel', () => {
        it('should fetch reference data', async () => {
            axios.post.mockResolvedValueOnce({
                data: { access_token: 'tok', expires_in: 1500 }
            });
            axios.get.mockResolvedValueOnce({
                data: [{ code: 'M1805', libelle: 'Dev' }]
            });

            const result = await getReferentiel('metiers');
            expect(result).toHaveLength(1);
            expect(result[0].code).toBe('M1805');
        });
    });
});
