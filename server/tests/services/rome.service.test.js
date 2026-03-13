/**
 * Tests for rome.service.js
 * ROME 4.0 API Service - métiers and compétences handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies
vi.mock('axios');
vi.mock('../../config/database.js', () => ({
    query: vi.fn()
}));
vi.mock('../../utils/logger.backend.js', () => ({
    createModuleLogger: () => ({
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn()
    })
}));
vi.mock('../../services/franceTravail.service.js', () => ({
    getAccessToken: vi.fn().mockResolvedValue('mock-token'),
    getReferentiel: vi.fn()
}));

import axios from 'axios';
import { query } from '../../config/database.js';
import { getReferentiel } from '../../services/franceTravail.service.js';

// Import after mocks
const romeService = await import('../../services/rome.service.js');

describe('rome.service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('getMetiers', () => {
        it('should fetch métiers from referentiel', async () => {
            const mockMetiers = [
                { code: 'M1801', libelle: 'Administration de systèmes' },
                { code: 'M1802', libelle: 'Expertise et support technique' }
            ];
            getReferentiel.mockResolvedValue(mockMetiers);

            const result = await romeService.getMetiers();

            expect(getReferentiel).toHaveBeenCalledWith('metiers');
            expect(result).toEqual(mockMetiers);
        });

        it('should return empty array when referentiel returns null', async () => {
            getReferentiel.mockResolvedValue(null);

            const result = await romeService.getMetiers();

            expect(result).toEqual([]);
        });

        it('should throw error when referentiel fails', async () => {
            getReferentiel.mockRejectedValue(new Error('API error'));

            await expect(romeService.getMetiers()).rejects.toThrow('API error');
        });
    });

    describe('searchMetiers', () => {
        it('should filter métiers by keyword in libelle', async () => {
            const mockMetiers = [
                { code: 'M1801', libelle: 'Administration de systèmes' },
                { code: 'M1802', libelle: 'Expertise et support technique' },
                { code: 'M1803', libelle: 'Direction des systèmes' }
            ];
            getReferentiel.mockResolvedValue(mockMetiers);

            const result = await romeService.searchMetiers('systèmes');

            expect(result).toHaveLength(2);
            expect(result[0].code).toBe('M1801');
            expect(result[1].code).toBe('M1803');
        });

        it('should filter métiers by keyword in code', async () => {
            const mockMetiers = [
                { code: 'M1801', libelle: 'Administration' },
                { code: 'M1802', libelle: 'Expertise' }
            ];
            getReferentiel.mockResolvedValue(mockMetiers);

            const result = await romeService.searchMetiers('M1801');

            expect(result).toHaveLength(1);
            expect(result[0].code).toBe('M1801');
        });

        it('should be case insensitive', async () => {
            const mockMetiers = [
                { code: 'M1801', libelle: 'Administration de SYSTÈMES' }
            ];
            getReferentiel.mockResolvedValue(mockMetiers);

            const result = await romeService.searchMetiers('systèmes');

            expect(result).toHaveLength(1);
        });

        it('should return empty array when no matches', async () => {
            const mockMetiers = [
                { code: 'M1801', libelle: 'Administration' }
            ];
            getReferentiel.mockResolvedValue(mockMetiers);

            const result = await romeService.searchMetiers('xyz');

            expect(result).toEqual([]);
        });
    });

    describe('getGrandsDomaines', () => {
        it('should extract unique grands domaines from métiers', async () => {
            const mockMetiers = [
                { code: 'M1801', codeGrandDomaine: 'M', libelleGrandDomaine: 'Support entreprise' },
                { code: 'M1802', codeGrandDomaine: 'M', libelleGrandDomaine: 'Support entreprise' },
                { code: 'A1101', codeGrandDomaine: 'A', libelleGrandDomaine: 'Agriculture' }
            ];
            getReferentiel.mockResolvedValue(mockMetiers);

            const result = await romeService.getGrandsDomaines();

            expect(result).toHaveLength(2);
            expect(result.find(d => d.code === 'M')).toBeDefined();
            expect(result.find(d => d.code === 'A')).toBeDefined();
        });

        it('should use code as libelle fallback', async () => {
            const mockMetiers = [
                { code: 'M1801', codeGrandDomaine: 'M' }
            ];
            getReferentiel.mockResolvedValue(mockMetiers);

            const result = await romeService.getGrandsDomaines();

            expect(result[0].libelle).toBe('M');
        });
    });

    describe('getDomaines', () => {
        it('should extract unique domaines from métiers', async () => {
            const mockMetiers = [
                { code: 'M1801', codeDomaineProfessionnel: 'M18', libelleDomaineProfessionnel: 'IT', codeGrandDomaine: 'M' },
                { code: 'M1802', codeDomaineProfessionnel: 'M18', libelleDomaineProfessionnel: 'IT', codeGrandDomaine: 'M' },
                { code: 'M1901', codeDomaineProfessionnel: 'M19', libelleDomaineProfessionnel: 'Autre', codeGrandDomaine: 'M' }
            ];
            getReferentiel.mockResolvedValue(mockMetiers);

            const result = await romeService.getDomaines();

            expect(result).toHaveLength(2);
        });

        it('should filter by grand domaine when provided', async () => {
            const mockMetiers = [
                { code: 'M1801', codeDomaineProfessionnel: 'M18', codeGrandDomaine: 'M' },
                { code: 'A1101', codeDomaineProfessionnel: 'A11', codeGrandDomaine: 'A' }
            ];
            getReferentiel.mockResolvedValue(mockMetiers);

            const result = await romeService.getDomaines('M');

            expect(result).toHaveLength(1);
            expect(result[0].code).toBe('M18');
        });
    });

    describe('getITMetiers', () => {
        it('should filter métiers starting with M18', async () => {
            const mockMetiers = [
                { code: 'M1801', libelle: 'Administration systèmes' },
                { code: 'M1802', libelle: 'Expertise technique' },
                { code: 'M1901', libelle: 'Autre domaine' },
                { code: 'A1101', libelle: 'Agriculture' }
            ];
            getReferentiel.mockResolvedValue(mockMetiers);

            const result = await romeService.getITMetiers();

            expect(result).toHaveLength(2);
            expect(result.every(m => m.code.startsWith('M18'))).toBe(true);
        });

        it('should return empty array when no IT métiers', async () => {
            const mockMetiers = [
                { code: 'A1101', libelle: 'Agriculture' }
            ];
            getReferentiel.mockResolvedValue(mockMetiers);

            const result = await romeService.getITMetiers();

            expect(result).toEqual([]);
        });
    });

    describe('getMetierByCode', () => {
        it('should return métier from pre-fetched fiches', async () => {
            const allFiches = [
                { code: 'M1801', libelle: 'Admin' },
                { code: 'M1802', libelle: 'Expert' }
            ];

            const result = await romeService.getMetierByCode('M1801', allFiches);

            expect(result).toEqual({ code: 'M1801', libelle: 'Admin' });
        });

        it('should match by codeRome field', async () => {
            const allFiches = [
                { codeRome: 'M1801', libelle: 'Admin' }
            ];

            const result = await romeService.getMetierByCode('M1801', allFiches);

            expect(result.libelle).toBe('Admin');
        });

        it('should fetch from API when not in pre-fetched fiches', async () => {
            axios.get.mockResolvedValue({
                data: { code: 'M1801', libelle: 'Admin from API' }
            });

            const result = await romeService.getMetierByCode('M1801', null);

            expect(axios.get).toHaveBeenCalled();
            expect(result.libelle).toBe('Admin from API');
        });

        it('should return basic info on 401/403 error', async () => {
            axios.get.mockRejectedValue({
                response: { status: 401 }
            });

            const result = await romeService.getMetierByCode('M1801', null);

            expect(result).toEqual({ code: 'M1801', libelle: 'Unknown' });
        });
    });

    describe('getCompetencesByMetier', () => {
        it('should extract competences from fiche métier', async () => {
            axios.get.mockResolvedValue({
                data: {
                    code: 'M1801',
                    competences: ['Comp1', 'Comp2']
                }
            });

            const result = await romeService.getCompetencesByMetier('M1801');

            expect(result).toEqual(['Comp1', 'Comp2']);
        });

        it('should try competencesMobilisees field', async () => {
            axios.get.mockResolvedValue({
                data: {
                    code: 'M1801',
                    competencesMobilisees: ['CompMob1']
                }
            });

            const result = await romeService.getCompetencesByMetier('M1801');

            expect(result).toEqual(['CompMob1']);
        });

        it('should return empty array on error', async () => {
            axios.get.mockRejectedValue(new Error('API error'));

            const result = await romeService.getCompetencesByMetier('M1801');

            expect(result).toEqual([]);
        });
    });

    describe('storeMetier', () => {
        it('should create new métier when not exists', async () => {
            query.mockResolvedValueOnce({ rows: [] }); // Check existing
            query.mockResolvedValueOnce({ rows: [{ id: '1', code_rome: 'M1801' }] }); // Insert

            const metier = {
                code: 'M1801',
                metier: { libelle: 'Administration' },
                groupesCompetencesMobilisees: [],
                groupesSavoirs: []
            };

            const result = await romeService.storeMetier(metier);

            expect(result.action).toBe('created');
            expect(query).toHaveBeenCalledTimes(2);
        });

        it('should update existing métier', async () => {
            query.mockResolvedValueOnce({ rows: [{ id: '1' }] }); // Check existing
            query.mockResolvedValueOnce({ rows: [{ id: '1', code_rome: 'M1801' }] }); // Update

            const metier = {
                code: 'M1801',
                metier: { libelle: 'Administration Updated' },
                groupesCompetencesMobilisees: [],
                groupesSavoirs: []
            };

            const result = await romeService.storeMetier(metier);

            expect(result.action).toBe('updated');
        });

        it('should extract competences from groupes', async () => {
            query.mockResolvedValueOnce({ rows: [] });
            query.mockResolvedValueOnce({ rows: [{ id: '1' }] });

            const metier = {
                code: 'M1801',
                groupesCompetencesMobilisees: [{
                    enjeu: { code: 'E1', libelle: 'Enjeu 1' },
                    competences: [
                        { code: 'C1', libelle: 'Comp 1', type: 'COMPETENCE-DETAILLEE' },
                        { code: 'C2', libelle: 'Comp 2', type: 'MACRO-SAVOIR-FAIRE' }
                    ]
                }],
                groupesSavoirs: [{
                    categorie: { libelle: 'Cat1' },
                    savoirs: [{ code: 'S1', libelle: 'Savoir 1' }]
                }]
            };

            await romeService.storeMetier(metier);

            // Verify INSERT was called with JSON data
            const insertCall = query.mock.calls[1];
            expect(insertCall[0]).toContain('INSERT INTO rome_metiers');
        });
    });

    describe('getStoredMetiers', () => {
        it('should return all métiers from database', async () => {
            query.mockResolvedValue({
                rows: [
                    { id: '1', code_rome: 'M1801', libelle: 'Admin', obsolete: false, updated_at: new Date() },
                    { id: '2', code_rome: 'M1802', libelle: 'Expert', obsolete: false, updated_at: new Date() }
                ]
            });

            const result = await romeService.getStoredMetiers();

            expect(result).toHaveLength(2);
            expect(result[0].CodeRome).toBe('M1801');
        });

        it('should filter by codeRome', async () => {
            query.mockResolvedValue({
                rows: [{ id: '1', code_rome: 'M1801', libelle: 'Admin', obsolete: false }]
            });

            await romeService.getStoredMetiers({ codeRome: 'M1801' });

            expect(query).toHaveBeenCalledWith(
                expect.stringContaining('WHERE code_rome = $1'),
                ['M1801']
            );
        });

        it('should filter by search term', async () => {
            query.mockResolvedValue({ rows: [] });

            await romeService.getStoredMetiers({ search: 'admin' });

            expect(query).toHaveBeenCalledWith(
                expect.stringContaining('ILIKE'),
                ['%admin%']
            );
        });

        it('should handle pagination', async () => {
            // Clear cache first by using a filter that bypasses cache
            query.mockResolvedValue({
                rows: Array(50).fill(null).map((_, i) => ({
                    id: String(i),
                    code_rome: `M180${i}`,
                    libelle: `Métier ${i}`,
                    obsolete: false,
                    updated_at: new Date()
                }))
            });

            // Use search filter to bypass cache and get fresh data with pagination
            const result = await romeService.getStoredMetiers({ page: 2, pageSize: 10, search: 'Métier' });

            expect(result.metiers).toHaveLength(10);
            expect(result.pagination.page).toBe(2);
            expect(result.pagination.totalPages).toBe(5);
        });

        it('should include details when requested', async () => {
            query.mockResolvedValue({
                rows: [{
                    id: '1',
                    code_rome: 'M1801',
                    libelle: 'Admin',
                    obsolete: false,
                    enjeux: '[]',
                    competences: '[{"code":"C1"}]',
                    macro_savoir_faire: '[]',
                    savoirs: '[]',
                    updated_at: new Date()
                }]
            });

            const result = await romeService.getStoredMetiers({ includeDetails: true });

            expect(result[0].CompetencesDetaillees).toEqual([{ code: 'C1' }]);
        });
    });

    describe('getMetiersStats', () => {
        it('should return statistics', async () => {
            query.mockResolvedValueOnce({
                rows: [{ total: '100', last_updated: new Date() }]
            });
            query.mockResolvedValueOnce({
                rows: [{ total_competences: '500', total_macro: '200', total_savoirs: '300' }]
            });

            const result = await romeService.getMetiersStats();

            expect(result.totalMetiers).toBe(100);
            expect(result.totalCompetences).toBe(700); // 500 + 200
            expect(result.totalSavoirs).toBe(300);
        });

        it('should handle empty database', async () => {
            query.mockResolvedValueOnce({ rows: [{ total: '0', last_updated: null }] });
            query.mockResolvedValueOnce({ rows: [{ total_competences: '0', total_macro: '0', total_savoirs: '0' }] });

            const result = await romeService.getMetiersStats();

            expect(result.totalMetiers).toBe(0);
            expect(result.totalCompetences).toBe(0);
        });
    });

    describe('cache functions', () => {
        it('getMetiersCacheStats should return cache info', () => {
            const stats = romeService.getMetiersCacheStats();

            expect(stats).toHaveProperty('size');
            expect(stats).toHaveProperty('maxSize');
            expect(stats).toHaveProperty('ttlMinutes');
        });

        it('cleanupMetiersCache should clear cache', () => {
            romeService.cleanupMetiersCache();
            const stats = romeService.getMetiersCacheStats();

            expect(stats.size).toBe(0);
        });

        it('destroyMetiersCache should clear cache', () => {
            romeService.destroyMetiersCache();
            const stats = romeService.getMetiersCacheStats();

            expect(stats.size).toBe(0);
        });
    });

    describe('constants', () => {
        it('should export IT_FAMILLE_CODE', () => {
            expect(romeService.IT_FAMILLE_CODE).toBe('M18');
        });

        it('should export IT_GRAND_DOMAINE', () => {
            expect(romeService.IT_GRAND_DOMAINE).toBe('M');
        });
    });
});
