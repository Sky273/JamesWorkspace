import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn(),
    createModuleLogger: () => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    })
}));

vi.mock('../../services/franceTravail.service.js', () => ({
    FRENCH_REGIONS: [{ code: '11', name: 'Ile-de-France' }]
}));

vi.mock('../../services/rome.service.js', () => ({
    getStoredMetiers: vi.fn()
}));

import {
    collectTrendsByRomeAndRegion,
    createCollectionAccumulator,
    estimateExpectedTotal
} from '../../services/marketTrends/collectionRuntime.js';

describe('Market Trends - Collection Runtime', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    it('estimates totals with national tensions and salaries collected once per ROME code', () => {
        expect(estimateExpectedTotal({
            itRomeCodes: ['M1801', 'M1805'],
            regions: [{ code: '11' }, { code: '75' }, { code: '84' }]
        }).expectedTotal).toBe(31);
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.clearAllMocks();
    });

    it('reports failed API attempts as processed items', async () => {
        const onItemProcessed = vi.fn();
        const runtime = createCollectionAccumulator({
            onTrendCollected: vi.fn(),
            onItemProcessed,
            collectionDate: '2026-05-02',
            quarter: 'Q1 2026',
            romeLabelsMap: { M1805: 'Dev' }
        });

        const collection = collectTrendsByRomeAndRegion({
            typeName: 'tensions',
            apiCallFn: vi.fn().mockRejectedValue(new Error('API timeout')),
            trendType: 'tension',
            apiEndpoint: 'stat-perspective-employeur',
            itRomeCodes: ['M1805'],
            regions: [{ code: '11', name: 'Ile-de-France' }],
            runtime
        });

        await vi.advanceTimersByTimeAsync(350);
        await collection;

        expect(onItemProcessed).toHaveBeenCalledWith(expect.objectContaining({
            status: 'failed',
            type: 'tension',
            codeRome: 'M1805',
            regionCode: '11',
            error: 'API timeout'
        }));
    });

    it('stops regional collection after a critical France Travail credential error', async () => {
        const onItemProcessed = vi.fn();
        const runtime = createCollectionAccumulator({
            onTrendCollected: vi.fn(),
            onItemProcessed,
            collectionDate: '2026-05-02',
            quarter: 'Q1 2026',
            romeLabelsMap: { M1805: 'Dev' }
        });
        const credentialError = new Error('Request failed with status code 400');
        credentialError.response = {
            status: 400,
            data: { error: 'invalid_client' }
        };

        const apiCallFn = vi.fn().mockRejectedValue(credentialError);
        const collection = collectTrendsByRomeAndRegion({
            typeName: 'job offers',
            apiCallFn,
            trendType: 'offre',
            apiEndpoint: 'stat-offres',
            itRomeCodes: ['M1805', 'M1806'],
            regions: [{ code: '11', name: 'Ile-de-France' }, { code: '75', name: 'Nouvelle-Aquitaine' }],
            runtime
        });

        await vi.advanceTimersByTimeAsync(350);
        await collection;

        expect(apiCallFn).toHaveBeenCalledTimes(1);
        expect(runtime.criticalError).toBe('API credentials rejected (invalid_client)');
        expect(onItemProcessed).toHaveBeenCalledWith(expect.objectContaining({
            status: 'failed',
            type: 'offre',
            codeRome: 'M1805',
            regionCode: '11',
            error: 'Request failed with status code 400'
        }));
    });

    it('stops regional collection after a token acquisition error with null response data', async () => {
        const onItemProcessed = vi.fn();
        const runtime = createCollectionAccumulator({
            onTrendCollected: vi.fn(),
            onItemProcessed,
            collectionDate: '2026-05-02',
            quarter: 'Q1 2026',
            romeLabelsMap: { M1805: 'Dev' }
        });
        const tokenError = new Error('France Travail access token unavailable: Request failed with status code 400');
        tokenError.isFranceTravailTokenError = true;
        tokenError.response = {
            status: 400,
            data: null
        };

        const apiCallFn = vi.fn().mockRejectedValue(tokenError);
        const collection = collectTrendsByRomeAndRegion({
            typeName: 'hiring data',
            apiCallFn,
            trendType: 'embauche',
            apiEndpoint: 'stat-embauches',
            itRomeCodes: ['M1805', 'M1849'],
            regions: [{ code: '11', name: 'Ile-de-France' }, { code: '27', name: 'Bourgogne-Franche-Comte' }],
            runtime
        });

        await vi.advanceTimersByTimeAsync(350);
        await collection;

        expect(apiCallFn).toHaveBeenCalledTimes(1);
        expect(runtime.criticalError).toBe('France Travail token unavailable (400)');
    });

    it('reports collected trends as processed items after save callback', async () => {
        const onTrendCollected = vi.fn();
        const onItemProcessed = vi.fn();
        const runtime = createCollectionAccumulator({
            onTrendCollected,
            onItemProcessed,
            collectionDate: '2026-05-02',
            quarter: 'Q1 2026',
            romeLabelsMap: { M1805: 'Dev' }
        });

        const collection = collectTrendsByRomeAndRegion({
            typeName: 'tensions',
            apiCallFn: vi.fn().mockResolvedValue({
                listeValeursParPeriode: [{ valeurPrincipaleTaux: '12,5' }]
            }),
            trendType: 'tension',
            apiEndpoint: 'stat-perspective-employeur',
            itRomeCodes: ['M1805'],
            regions: [{ code: '11', name: 'Ile-de-France' }],
            runtime
        });

        await vi.advanceTimersByTimeAsync(350);
        await collection;

        expect(onTrendCollected).toHaveBeenCalledWith(expect.objectContaining({
            type: 'tension',
            value: 12.5
        }));
        expect(onItemProcessed).toHaveBeenCalledWith(expect.objectContaining({
            status: 'collected',
            type: 'tension',
            codeRome: 'M1805',
            regionCode: '11'
        }));
    });

    it('skips API responses that contain no usable numeric value', async () => {
        const onTrendCollected = vi.fn();
        const onItemProcessed = vi.fn();
        const runtime = createCollectionAccumulator({
            onTrendCollected,
            onItemProcessed,
            collectionDate: '2026-05-02',
            quarter: 'Q1 2026',
            romeLabelsMap: { M1805: 'Dev' }
        });

        const collection = collectTrendsByRomeAndRegion({
            typeName: 'tensions',
            apiCallFn: vi.fn().mockResolvedValue({
                datMaj: '2026-04-15T14:29:30.000+02:00',
                codeIndicateur: 'PERSP_2',
                libIndicateur: 'PERSPECTIVES Employeur'
            }),
            trendType: 'tension',
            apiEndpoint: 'stat-perspective-employeur',
            itRomeCodes: ['M1805'],
            regions: [{ code: '11', name: 'Ile-de-France' }],
            runtime
        });

        await vi.advanceTimersByTimeAsync(350);
        await collection;

        expect(onTrendCollected).not.toHaveBeenCalled();
        expect(onItemProcessed).toHaveBeenCalledWith(expect.objectContaining({
            status: 'skipped',
            type: 'tension',
            codeRome: 'M1805',
            regionCode: '11',
            reason: 'no_value'
        }));
    });
});
