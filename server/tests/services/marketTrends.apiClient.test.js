/**
 * Tests for Market Trends API Client
 * API endpoint wrappers for France Travail Stats API
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.hoisted(() => {
    process.env.FRANCE_TRAVAIL_CLIENT_ID = 'test-id';
    process.env.FRANCE_TRAVAIL_CLIENT_SECRET = 'test-secret';
});

vi.mock('axios');
vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn()
}));

import axios from 'axios';
import {
    clearTokenCache,
    getStatTensions,
    getStatSalaires,
    getStatOffres,
    getStatDemandeurs,
    getStatEmbauches,
    getStatDynamiqueEmploi,
    getStatDemandeursEntrants
} from '../../services/marketTrends/apiClient.js';

// Helper: queue a token mock followed by an API response mock
function mockTokenThenPost(apiData) {
    axios.post
        .mockResolvedValueOnce({ data: { access_token: 'tok', expires_in: 1500 } })
        .mockResolvedValueOnce({ data: apiData });
}

describe('Market Trends API Client', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        clearTokenCache();
    });

    const params = {
        codeTerritoire: '11',
        codeRome: 'M1805',
        dateDeb: '2024T1',
        dateFin: '2024T4'
    };

    describe('Token caching', () => {
        it('should cache token across calls', async () => {
            // First call: token + API
            axios.post
                .mockResolvedValueOnce({ data: { access_token: 'tok-1', expires_in: 1500 } })
                .mockResolvedValueOnce({ data: { r: 1 } })
                .mockResolvedValueOnce({ data: { r: 2 } });

            await getStatOffres(params);
            await getStatOffres(params);

            // Token fetch should happen only once (first post call)
            expect(axios.post.mock.calls[0][0]).toContain('access_token');
            // Subsequent calls reuse cached token
            expect(axios.post).toHaveBeenCalledTimes(3); // 1 token + 2 API
        });

        it('clearTokenCache should force new token fetch', async () => {
            mockTokenThenPost({ r: 1 });
            await getStatOffres(params);

            clearTokenCache();

            axios.post
                .mockResolvedValueOnce({ data: { access_token: 'tok-2', expires_in: 1500 } })
                .mockResolvedValueOnce({ data: { r: 2 } });
            await getStatOffres(params);

            // Two token fetches total
            const tokenCalls = axios.post.mock.calls.filter(c => c[0].includes('access_token'));
            expect(tokenCalls).toHaveLength(2);
        });

        it('should share an in-flight token request across concurrent API calls', async () => {
            let resolveToken;
            const tokenPromise = new Promise(resolve => {
                resolveToken = resolve;
            });
            axios.post
                .mockReturnValueOnce(tokenPromise)
                .mockResolvedValueOnce({ data: { offres: 100 } })
                .mockResolvedValueOnce({ data: { demandeurs: 50 } });

            const firstCall = getStatOffres(params);
            const secondCall = getStatDemandeurs(params);
            resolveToken({ data: { access_token: 'tok-shared', expires_in: 1500 } });

            await expect(firstCall).resolves.toEqual({ offres: 100 });
            await expect(secondCall).resolves.toEqual({ demandeurs: 50 });

            const tokenCalls = axios.post.mock.calls.filter(c => c[0].includes('access_token'));
            expect(tokenCalls).toHaveLength(1);
        });

        it('should tag token acquisition failures as critical token errors even when response data is null', async () => {
            const tokenError = new Error('Request failed with status code 400');
            tokenError.response = {
                status: 400,
                data: null
            };
            axios.post.mockRejectedValueOnce(tokenError);

            await expect(getStatOffres(params)).rejects.toMatchObject({
                isFranceTravailTokenError: true,
                response: {
                    status: 400,
                    data: null
                }
            });
        });
    });

    describe('Authenticated endpoints', () => {
        it('getStatTensions should read Data Emploi national tension decimals by ROME code', async () => {
            axios.get
                .mockResolvedValueOnce({ data: { access_token: 'dataemploi-token', expires_in: 1500 } })
                .mockResolvedValueOnce({
                    data: {
                        topActivite: [{
                            activite: { codeActivite: 'M1805', libelleActivite: 'Dev' },
                            statsDemandeurOffre: {
                                persp2: {
                                    libelleNomenclature: 'Indicateur principal tension',
                                    valPrincPersp: '4',
                                    valPrincDec: '0.57'
                                }
                            },
                            indicateurRetour: { datMaj: '2026-04-15T14:29:30.000+02:00' }
                        }]
                    }
                });

            const result = await getStatTensions(params);

            expect(result.valeurPrincipaleDecimale).toBe('0.57');
            expect(result.statsDemandeurOffre.persp2.valPrincPersp).toBe('4');
            expect(axios.get.mock.calls[1][0]).toContain('top/activite/demandeurs-offres-flux/PERSP_2/ROME/NAT/FR');
        });

        it('getStatSalaires should GET salaire-rome-fap', async () => {
            axios.post.mockResolvedValueOnce({ data: { access_token: 'tok', expires_in: 1500 } });
            axios.get.mockResolvedValueOnce({ data: { salaire: 3000 } });

            const result = await getStatSalaires(params);

            expect(result).toEqual({ salaire: 3000 });
            expect(axios.get.mock.calls[0][0]).toContain('salaire-rome-fap');
        });

        it('getStatOffres should POST to stat-offres', async () => {
            mockTokenThenPost({ offres: 100 });

            const result = await getStatOffres(params);

            expect(result).toEqual({ offres: 100 });
            expect(axios.post.mock.calls[1][0]).toContain('stat-offres');
        });

        it('getStatDemandeurs should POST to stat-demandeurs', async () => {
            mockTokenThenPost({ demandeurs: 50 });

            const result = await getStatDemandeurs(params);

            expect(result).toEqual({ demandeurs: 50 });
            expect(axios.post.mock.calls[1][0]).toContain('stat-demandeurs');
        });

        it('getStatEmbauches should POST to stat-embauches', async () => {
            mockTokenThenPost({ embauches: 200 });

            const result = await getStatEmbauches(params);

            expect(result).toEqual({ embauches: 200 });
            expect(axios.post.mock.calls[1][0]).toContain('stat-embauches');
        });

        it('getStatDemandeursEntrants should POST to stat-demandeurs-entrant', async () => {
            mockTokenThenPost({ entrants: 30 });

            const result = await getStatDemandeursEntrants(params);

            expect(result).toEqual({ entrants: 30 });
            expect(axios.post.mock.calls[1][0]).toContain('stat-demandeurs-entrant');
        });

        it('should throw on API error', async () => {
            axios.get
                .mockResolvedValueOnce({ data: { access_token: 'dataemploi-token', expires_in: 1500 } })
                .mockRejectedValueOnce(new Error('API timeout'));

            await expect(getStatTensions(params)).rejects.toThrow('API timeout');
        });
    });

    describe('Public endpoints', () => {
        it('getStatDynamiqueEmploi should use dataemploi public API', async () => {
            axios.post.mockResolvedValueOnce({ data: { dynamique: 'ok' } });

            const result = await getStatDynamiqueEmploi({ codeTerritoire: '11' });

            expect(result).toEqual({ dynamique: 'ok' });
            expect(axios.post.mock.calls[0][0]).toContain('dataemploi.francetravail.fr');
            expect(axios.post.mock.calls[0][2]?.headers?.Authorization).toBeUndefined();
        });

        it('getStatDynamiqueEmploi should return null on error', async () => {
            axios.post.mockRejectedValueOnce(new Error('API timeout'));

            const result = await getStatDynamiqueEmploi({ codeTerritoire: '11' });
            expect(result).toBeNull();
        });
    });
});
