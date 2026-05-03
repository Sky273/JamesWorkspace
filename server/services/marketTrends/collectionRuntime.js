import { safeLog } from '../../utils/logger.backend.js';
import { FRENCH_REGIONS } from '../franceTravail.service.js';
import { getStoredMetiers } from '../rome.service.js';
import { extractDynamiqueLabel, extractRawValue, extractValueLabel } from './extractors.js';

const IT_FAMILLE_CODE = 'M18';
const BATCH_SIZE = 50;

function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function createMemoryCheckpointTracker() {
    let batchCount = 0;

    return function trackMemoryCheckpoint() {
        batchCount++;
        if (batchCount % BATCH_SIZE !== 0) {
            return;
        }

        if (global.gc) {
            global.gc();
        }

        const memUsage = process.memoryUsage();
        safeLog('debug', 'MarketTrends: Memory checkpoint', {
            batchCount,
            heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024),
            heapTotalMB: Math.round(memUsage.heapTotal / 1024 / 1024)
        });
    };
}

export async function loadCollectionContext() {
    try {
        const metiers = await getStoredMetiers();
        const itMetiers = metiers.filter((metier) => metier.CodeRome?.startsWith(IT_FAMILLE_CODE));
        const itRomeCodes = itMetiers.map((metier) => metier.CodeRome);
        const romeLabelsMap = itMetiers.reduce((acc, metier) => {
            if (metier.CodeRome && metier.Libelle) {
                acc[metier.CodeRome] = metier.Libelle;
            }
            return acc;
        }, {});

        safeLog('info', 'MarketTrends: Loaded IS/IT ROME codes (M18 family)', {
            count: itRomeCodes.length,
            codes: itRomeCodes
        });

        if (itRomeCodes.length === 0) {
            throw new Error('No IS/IT métiers found (M18 family). Please run métiers collection first.');
        }

        return { itRomeCodes, romeLabelsMap, regions: FRENCH_REGIONS };
    } catch (error) {
        safeLog('error', 'MarketTrends: Failed to load IS/IT métiers, cannot proceed', { error: error.message });
        if (error.message.includes('No IS/IT métiers found')) {
            throw error;
        }
        throw new Error('Cannot collect trends without IS/IT métiers. Please run métiers collection first.');
    }
}

export function estimateExpectedTotal({ itRomeCodes, regions }) {
    const regionsCount = regions.length;
    const romeCount = itRomeCodes.length;
    return {
        regionsCount,
        romeCount,
        expectedTotal: (4 * romeCount * regionsCount) + (2 * romeCount) + regionsCount
    };
}

export function createCollectionAccumulator({ onTrendCollected, onItemProcessed, collectionDate, quarter, romeLabelsMap }) {
    const trends = onTrendCollected ? null : [];
    let savedCount = 0;
    let criticalError = null;
    const trackMemoryCheckpoint = createMemoryCheckpointTracker();

    function getRomeLabel(codeRome) {
        return romeLabelsMap[codeRome] || null;
    }

    function prepareMetadata(data, codeRome) {
        if (!data) return null;
        return {
            ...data,
            romeLabel: codeRome ? getRomeLabel(codeRome) : null
        };
    }

    async function saveTrend(trend) {
        if (onTrendCollected) {
            await onTrendCollected(trend);
            savedCount++;
            trackMemoryCheckpoint();
            await notifyItemProcessed({
                status: 'collected',
                type: trend.type,
                regionCode: trend.regionCode,
                codeRome: trend.codeRome
            });
            return;
        }

        trends.push(trend);
        await notifyItemProcessed({
            status: 'collected',
            type: trend.type,
            regionCode: trend.regionCode,
            codeRome: trend.codeRome
        });
    }

    async function notifyItemProcessed(event) {
        if (!onItemProcessed) return;

        try {
            await onItemProcessed(event);
        } catch {
            // Progress callbacks must never stop the collection.
        }
    }

    async function recordSkipped(event) {
        await notifyItemProcessed({
            ...event,
            status: 'skipped'
        });
    }

    async function recordFailure(event) {
        await notifyItemProcessed({
            ...event,
            status: 'failed'
        });
    }

    function recordCriticalError(error) {
        if (error?.isFranceTravailTokenError) {
            const status = error.response?.status || error.code || 'unknown';
            const providerCode = error.response?.data?.error;
            criticalError = providerCode
                ? `France Travail token unavailable (${status}: ${providerCode})`
                : `France Travail token unavailable (${status})`;
            return true;
        }

        if (error?.response?.status === 403 || error?.response?.status === 401) {
            criticalError = `API access denied (${error.response.status})`;
            return true;
        }

        if (
            error?.response?.status === 400
            && ['invalid_client', 'invalid_scope'].includes(error.response?.data?.error)
        ) {
            criticalError = `API credentials rejected (${error.response.data.error})`;
            return true;
        }

        return false;
    }

    return {
        collectionDate,
        quarter,
        trends,
        get savedCount() {
            return savedCount;
        },
        get criticalError() {
            return criticalError;
        },
        getRomeLabel,
        prepareMetadata,
        saveTrend,
        recordSkipped,
        recordFailure,
        recordCriticalError
    };
}

export async function collectTrendsByRomeAndRegion({
    typeName,
    apiCallFn,
    trendType,
    apiEndpoint,
    extraParams = {},
    itRomeCodes,
    regions,
    runtime
}) {
    safeLog('info', `MarketTrends: Collecting ${typeName}...`);

    for (const rome of itRomeCodes) {
        if (runtime.criticalError) break;

        for (const region of regions) {
            if (runtime.criticalError) break;

            try {
                await delay(350);
                const data = await apiCallFn({
                    codeRome: rome,
                    codeTerritoire: region.code,
                    ...extraParams
                });
                const value = extractRawValue(data);

                if (value === null) {
                    await runtime.recordSkipped({
                        type: trendType,
                        regionCode: region.code,
                        codeRome: rome,
                        reason: data ? 'no_value' : 'no_data'
                    });
                    continue;
                }

                await runtime.saveTrend({
                    date: runtime.collectionDate,
                    type: trendType,
                    codeRome: rome,
                    romeLabel: runtime.getRomeLabel(rome),
                    region: region.name,
                    regionCode: region.code,
                    value,
                    valueLabel: extractValueLabel(data),
                    metadata: runtime.prepareMetadata(data, rome),
                    apiEndpoint,
                    quarterPeriod: runtime.quarter
                });
            } catch (error) {
                await runtime.recordFailure({
                    type: trendType,
                    regionCode: region.code,
                    codeRome: rome,
                    error: error.message
                });
                if (runtime.recordCriticalError(error)) break;
                safeLog('warn', `MarketTrends: Failed to collect ${trendType}`, {
                    rome,
                    region: region.name,
                    error: error.message
                });
            }
        }
    }
}

export async function collectTrendsByRome({
    typeName,
    apiCallFn,
    trendType,
    apiEndpoint,
    itRomeCodes,
    runtime
}) {
    safeLog('info', `MarketTrends: Collecting ${typeName}...`);

    for (const rome of itRomeCodes) {
        if (runtime.criticalError) break;

        try {
            await delay(350);
            const data = await apiCallFn({ codeRome: rome });
            const value = extractRawValue(data);

            if (value === null) {
                await runtime.recordSkipped({
                    type: trendType,
                    codeRome: rome,
                    reason: data ? 'no_value' : 'no_data'
                });
                continue;
            }

            await runtime.saveTrend({
                date: runtime.collectionDate,
                type: trendType,
                codeRome: rome,
                romeLabel: runtime.getRomeLabel(rome),
                value,
                valueLabel: extractValueLabel(data),
                metadata: runtime.prepareMetadata(data, rome),
                apiEndpoint,
                quarterPeriod: runtime.quarter
            });
        } catch (error) {
            await runtime.recordFailure({
                type: trendType,
                codeRome: rome,
                error: error.message
            });
            if (runtime.recordCriticalError(error)) break;
            safeLog('warn', `MarketTrends: Failed to collect ${trendType}`, {
                rome,
                error: error.message
            });
        }
    }
}

export async function collectDynamiqueEmploi({
    apiCallFn,
    regions,
    runtime
}) {
    let dynSkippedCount = 0;
    let dynSuccessCount = 0;

    safeLog('info', 'MarketTrends: Collecting employment dynamics (DYN_1) via dataemploi API...', {
        totalRegions: regions.length
    });

    for (const region of regions) {
        if (runtime.criticalError) break;

        try {
            await delay(350);
            let data = await apiCallFn({
                codeTerritoire: region.code,
                codeTypeTerritoire: 'REG',
                codeTypeActivite: 'MOYENNE',
                codeActivite: 'MOYENNE',
                codeTypePeriode: 'TRIMESTRE',
                dernierePeriode: true,
                sansCaracteristiques: true
            });

            if (!data) {
                dynSkippedCount++;
                await runtime.recordSkipped({
                    type: 'dynamique_emploi',
                    regionCode: region.code,
                    reason: 'no_data'
                });
                safeLog('debug', 'MarketTrends: DYN_1 no data for region', {
                    region: region.name,
                    regionCode: region.code
                });
                continue;
            }
            const value = extractRawValue(data);

            if (value === null) {
                dynSkippedCount++;
                await runtime.recordSkipped({
                    type: 'dynamique_emploi',
                    regionCode: region.code,
                    reason: 'no_value'
                });
                continue;
            }

            await runtime.saveTrend({
                date: runtime.collectionDate,
                type: 'dynamique_emploi',
                region: region.name,
                regionCode: region.code,
                value,
                valueLabel: extractDynamiqueLabel(data),
                metadata: runtime.prepareMetadata(data, null),
                apiEndpoint: 'stat-dynamique-emploi',
                quarterPeriod: runtime.quarter
            });

            data = null;
            dynSuccessCount++;
        } catch (error) {
            await runtime.recordFailure({
                type: 'dynamique_emploi',
                regionCode: region.code,
                error: error.message
            });
            if (runtime.recordCriticalError(error)) break;
            safeLog('warn', 'MarketTrends: Failed to collect dynamique', {
                region: region.name,
                error: error.message
            });
        }
    }

    safeLog('info', 'MarketTrends: DYN_1 collection summary', {
        totalRegions: regions.length,
        success: dynSuccessCount,
        skipped: dynSkippedCount,
        accountingMatch: (dynSuccessCount + dynSkippedCount) === regions.length ? 'OK' : 'MISMATCH'
    });
}
