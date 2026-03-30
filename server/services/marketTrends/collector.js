/**
 * Market Trends Data Collection & Storage
 * Handles collecting trends from France Travail API and storing them in PostgreSQL
 */

import { safeLog } from '../../utils/logger.backend.js';

import {
    getStatEmbauches,
    getStatDynamiqueEmploi,
    getStatTensions,
    getStatSalaires,
    getStatOffres,
    getStatDemandeurs,
    getStatDemandeursEntrants
} from './apiClient.js';
import {
    collectDynamiqueEmploi,
    collectTrendsByRome,
    collectTrendsByRomeAndRegion,
    createCollectionAccumulator,
    estimateExpectedTotal,
    loadCollectionContext
} from './collectionRuntime.js';
import { generateCollectionReport, storeTrend } from './persistence.js';

/**
 * Calculate the last complete quarter dates
 * Example: If current date is February 2026, returns Q4 2025 (Oct 1 - Dec 31, 2025)
 * @returns {Object} { dateDeb: 'YYYY-MM-DD', dateFin: 'YYYY-MM-DD', quarter: 'Q4 2025' }
 */
function getLastCompleteQuarter() {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const currentQuarter = Math.floor(currentMonth / 3);

    let lastQuarter;
    let lastQuarterYear;

    if (currentQuarter === 0) {
        lastQuarter = 3;
        lastQuarterYear = currentYear - 1;
    } else {
        lastQuarter = currentQuarter - 1;
        lastQuarterYear = currentYear;
    }

    const startMonth = lastQuarter * 3;
    const endMonth = startMonth + 2;
    const dateDeb = `${lastQuarterYear}-${String(startMonth + 1).padStart(2, '0')}-01`;
    const lastDayOfMonth = new Date(lastQuarterYear, endMonth + 1, 0).getDate();
    const dateFin = `${lastQuarterYear}-${String(endMonth + 1).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`;
    const quarterLabel = `Q${lastQuarter + 1} ${lastQuarterYear}`;

    safeLog('info', 'MarketTrends: Calculated last complete quarter', {
        quarter: quarterLabel,
        dateDeb,
        dateFin
    });

    return { dateDeb, dateFin, quarter: quarterLabel };
}

/**
 * Collect all market trends for IT jobs
 * Uses the correct API endpoints per OpenAPI spec
 * @param {Object} options - Collection options
 * @param {Function} options.onTrendCollected - Callback for immediate storage
 * @param {Function} [options.onTotalEstimated] - Callback when total expected trends is known: onTotalEstimated(total)
 */
export async function collectMarketTrends(options = {}) {
    const onTrendCollected = options.onTrendCollected || null;
    const onTotalEstimated = options.onTotalEstimated || null;
    const collectionDate = new Date().toISOString().split('T')[0];
    const { dateDeb, dateFin, quarter } = getLastCompleteQuarter();
    const { itRomeCodes, romeLabelsMap, regions } = await loadCollectionContext();
    const runtime = createCollectionAccumulator({
        onTrendCollected,
        collectionDate,
        quarter,
        romeLabelsMap
    });
    const { regionsCount, romeCount, expectedTotal } = estimateExpectedTotal({ itRomeCodes, regions });

    safeLog('info', 'MarketTrends: Starting collection', {
        quarter,
        dateDeb,
        dateFin,
        regionsCount,
        romeCodesCount: romeCount,
        expectedTotal
    });

    if (onTotalEstimated) {
        try {
            await onTotalEstimated(expectedTotal);
        } catch {
            // ignore progress callback failures
        }
    }

    await collectTrendsByRomeAndRegion({
        typeName: 'tensions (PERSP_2)',
        apiCallFn: getStatTensions,
        trendType: 'tension',
        apiEndpoint: 'stat-perspective-employeur',
        itRomeCodes,
        regions,
        runtime
    });

    await collectTrendsByRome({
        typeName: 'salaries (SAL_3)',
        apiCallFn: getStatSalaires,
        trendType: 'salaire',
        apiEndpoint: 'salaire-rome-fap',
        itRomeCodes,
        runtime
    });

    await collectDynamiqueEmploi({
        apiCallFn: getStatDynamiqueEmploi,
        regions,
        runtime
    });

    await collectTrendsByRomeAndRegion({
        typeName: 'hiring data (EMB_1)',
        apiCallFn: getStatEmbauches,
        trendType: 'embauche',
        apiEndpoint: 'stat-embauches',
        extraParams: { dateDeb, dateFin },
        itRomeCodes,
        regions,
        runtime
    });

    await collectTrendsByRomeAndRegion({
        typeName: 'job offers (OFF_1)',
        apiCallFn: getStatOffres,
        trendType: 'offre',
        apiEndpoint: 'stat-offres',
        extraParams: { dateDeb, dateFin },
        itRomeCodes,
        regions,
        runtime
    });

    await collectTrendsByRomeAndRegion({
        typeName: 'job seekers (DE_1)',
        apiCallFn: getStatDemandeurs,
        trendType: 'demandeur',
        apiEndpoint: 'stat-demandeurs',
        extraParams: { dateDeb, dateFin },
        itRomeCodes,
        regions,
        runtime
    });

    await collectTrendsByRomeAndRegion({
        typeName: 'new job seekers (DE_5)',
        apiCallFn: getStatDemandeursEntrants,
        trendType: 'demandeur_entrant',
        apiEndpoint: 'stat-demandeurs-entrant',
        extraParams: { dateDeb, dateFin },
        itRomeCodes,
        regions,
        runtime
    });

    if (runtime.criticalError) {
        throw new Error(runtime.criticalError);
    }

    const totalCount = onTrendCollected ? runtime.savedCount : runtime.trends.length;
    const collectionReport = await generateCollectionReport(quarter, collectionDate);

    safeLog('info', 'MarketTrends: Collection completed', {
        totalTrends: totalCount,
        savedImmediately: runtime.savedCount,
        report: collectionReport
    });

    return onTrendCollected ? [] : runtime.trends;
}

export { storeTrend, generateCollectionReport } from './persistence.js';
