/**
 * Tests for ESCO Service
 * Tests search, tag conversion, cache management, and processCleanedTagsToEsco
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('axios', () => ({
    default: { get: vi.fn() }
}));

vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn()
}));

import axios from 'axios';
import {
    searchEscoSkill,
    searchEscoOccupation,
    convertTagsToEsco,
    processCleanedTagsToEsco,
    clearEscoCache,
    getEscoCacheStats,
    ESCO_API_BASE,
    ESCO_LANGUAGE
} from '../../services/escoService.js';

const mockEscoResponse = (results) => ({
    data: {
        _embedded: {
            results: results.map(r => ({
                uri: r.uri || 'http://esco/skill/1',
                title: r.title || 'Skill',
                preferredLabel: { fr: r.label || r.title || 'Skill' },
                className: r.className || 'Skill'
            }))
        }
    }
});

describe('ESCO Service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        clearEscoCache();
    });

    describe('constants', () => {
        it('should export API base URL', () => {
            expect(ESCO_API_BASE).toContain('ec.europa.eu');
        });

        it('should export default language', () => {
            expect(ESCO_LANGUAGE).toBe('fr');
        });
    });

    describe('searchEscoSkill', () => {
        it('should return matched skill', async () => {
            axios.get.mockResolvedValueOnce(mockEscoResponse([{ uri: 'http://esco/s1', title: 'JavaScript', label: 'JavaScript' }]));

            const result = await searchEscoSkill('JavaScript');

            expect(result).not.toBeNull();
            expect(result.uri).toBe('http://esco/s1');
            expect(result.preferredLabel).toBe('JavaScript');
            expect(axios.get).toHaveBeenCalledWith(expect.stringContaining('/search'), expect.objectContaining({
                params: expect.objectContaining({ type: 'skill', text: 'JavaScript' })
            }));
        });

        it('should return null for empty results', async () => {
            axios.get.mockResolvedValueOnce({ data: { _embedded: { results: [] } } });
            expect(await searchEscoSkill('unknowntag')).toBeNull();
        });

        it('should return null for null/undefined input', async () => {
            expect(await searchEscoSkill(null)).toBeNull();
            expect(await searchEscoSkill('')).toBeNull();
        });

        it('should use cache on second call', async () => {
            axios.get.mockResolvedValueOnce(mockEscoResponse([{ title: 'Python', label: 'Python' }]));

            await searchEscoSkill('Python');
            const result2 = await searchEscoSkill('Python');

            expect(axios.get).toHaveBeenCalledTimes(1);
            expect(result2.preferredLabel).toBe('Python');
        });

        it('should return null on API error', async () => {
            axios.get.mockRejectedValueOnce(new Error('Network error'));
            expect(await searchEscoSkill('test')).toBeNull();
        });
    });

    describe('searchEscoOccupation', () => {
        it('should search with occupation type', async () => {
            axios.get.mockResolvedValueOnce(mockEscoResponse([{ title: 'Developer', label: 'Développeur' }]));

            const result = await searchEscoOccupation('Développeur');

            expect(result).not.toBeNull();
            expect(axios.get.mock.calls[0][1].params.type).toBe('occupation');
        });

        it('should return null for invalid input', async () => {
            expect(await searchEscoOccupation(null)).toBeNull();
            expect(await searchEscoOccupation(42)).toBeNull();
        });
    });

    describe('convertTagsToEsco', () => {
        it('should convert array of tags', async () => {
            axios.get
                .mockResolvedValueOnce(mockEscoResponse([{ uri: 'http://esco/s1', title: 'JS', label: 'JavaScript' }]))
                .mockResolvedValueOnce(mockEscoResponse([{ uri: 'http://esco/s2', title: 'TS', label: 'TypeScript' }]));

            const result = await convertTagsToEsco(['JS', 'TS'], 'skill');

            expect(result).toHaveLength(2);
            expect(result[0].original).toBe('JS');
            expect(result[0].esco.preferredLabel).toBe('JavaScript');
            expect(result[1].original).toBe('TS');
        });

        it('should return empty array for empty input', async () => {
            expect(await convertTagsToEsco([])).toEqual([]);
            expect(await convertTagsToEsco(null)).toEqual([]);
        });

        it('should handle tags with no ESCO match', async () => {
            axios.get.mockResolvedValueOnce({ data: { _embedded: { results: [] } } });

            const result = await convertTagsToEsco(['gibberish']);

            expect(result[0].original).toBe('gibberish');
            expect(result[0].esco).toBeNull();
        });
    });

    describe('processCleanedTagsToEsco', () => {
        it('should process only tools via ESCO', async () => {
            axios.get.mockResolvedValueOnce(mockEscoResponse([{ uri: 'http://esco/t1', title: 'Docker', label: 'Docker' }]));

            const result = await processCleanedTagsToEsco({
                skills: ['Leadership'],
                industries: ['IT'],
                tools: ['Docker'],
                softSkills: ['Teamwork']
            });

            // Only tools should be ESCO-processed
            expect(result.tools).toHaveLength(1);
            expect(result.tools[0].label).toBe('Docker');
            // Other categories should be empty arrays (not ESCO-processed)
            expect(result.skills).toEqual([]);
            expect(result.industries).toEqual([]);
            expect(result.softSkills).toEqual([]);
        });

        it('should return empty arrays for null input', async () => {
            const result = await processCleanedTagsToEsco(null);

            expect(result.skills).toEqual([]);
            expect(result.tools).toEqual([]);
        });

        it('should deduplicate tools by URI', async () => {
            // Same URI returned twice for different tags
            axios.get
                .mockResolvedValueOnce(mockEscoResponse([{ uri: 'http://esco/t1', title: 'Docker', label: 'Docker' }]))
                .mockResolvedValueOnce(mockEscoResponse([{ uri: 'http://esco/t1', title: 'Docker', label: 'Docker' }]));

            const result = await processCleanedTagsToEsco({
                tools: ['Docker', 'docker']
            });

            expect(result.tools).toHaveLength(1);
        });
    });

    describe('cache management', () => {
        it('clearEscoCache should reset cache', () => {
            clearEscoCache();
            const stats = getEscoCacheStats();
            expect(stats.size).toBe(0);
        });

        it('getEscoCacheStats should return stats', () => {
            const stats = getEscoCacheStats();
            expect(stats).toHaveProperty('size');
            expect(stats).toHaveProperty('maxSize');
            expect(stats).toHaveProperty('ttlHours');
            expect(stats.ttlHours).toBe(24);
        });
    });
});
