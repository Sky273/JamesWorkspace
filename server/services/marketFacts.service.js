/**
 * Market Facts Service
 * Handles storage and retrieval of market radar data in PostgreSQL
 * Table: market_facts
 */

import { safeLog } from '../utils/logger.backend.js';
import { collectMarketFacts as collectFranceTravailFacts } from './franceTravail.service.js';
import { collectMarketFacts as collectAdzunaFacts } from './adzuna.service.js';
import {
    cleanupFactsCache,
    destroyFactsCache,
    getFactsByDateRange,
    getFactsCacheStats,
    getFactsFilterOptions,
    getFactsSummary,
    invalidateFactsCache,
    loadFactsCache,
    startFactsCacheCleanup
} from './marketFacts.cache.js';
import {
    getKeywordTrend,
    getLatestFacts,
    getRegionalComparison,
    getStoredRomeCodes,
    storeFact,
    storeFacts
} from './marketFacts.persistence.js';

async function runFullCollection(options = {}) {
    const { onProgress } = options;
    const summary = {
        startTime: new Date().toISOString(),
        sources: {},
        totalFacts: 0,
        stored: 0,
        failed: 0
    };

    safeLog('info', 'MarketFacts: Starting full collection');

    let romeCodes = null;
    if (options.useStoredRomeCodes !== false) {
        romeCodes = await getStoredRomeCodes();
        if (romeCodes.length > 0) {
            safeLog('info', 'MarketFacts: Using ROME codes from stored métiers', { count: romeCodes.length });
            summary.romeCodesUsed = romeCodes.length;
        } else {
            safeLog('warn', 'MarketFacts: No stored ROME codes found, using default IT codes');
        }
    }

    let ftStoredCount = 0;
    let ftFailedCount = 0;

    try {
        safeLog('info', 'MarketFacts: Collecting from France Travail (with immediate storage)');
        const ftOptions = options.franceTravail || {};
        if (romeCodes && romeCodes.length > 0) {
            ftOptions.romeCodes = romeCodes;
        }
        ftOptions.onTotalEstimated = async (total) => {
            summary.totalFacts = total;
            if (onProgress) {
                try { await onProgress(summary); } catch { /* ignore */ }
            }
        };

        let lastProgressUpdate = 0;
        const PROGRESS_INTERVAL_MS = 5000;
        ftOptions.onFactCollected = async (fact) => {
            try {
                await storeFact(fact);
                ftStoredCount++;
                summary.stored = ftStoredCount;
            } catch (err) {
                ftFailedCount++;
                summary.failed = ftFailedCount;
                safeLog('error', 'MarketFacts: Failed to store fact', { error: err.message });
            }

            if (onProgress) {
                const now = Date.now();
                if (now - lastProgressUpdate > PROGRESS_INTERVAL_MS) {
                    lastProgressUpdate = now;
                    try { await onProgress(summary); } catch { /* ignore */ }
                }
            }
        };

        const ftFacts = await collectFranceTravailFacts(ftOptions);
        summary.sources.franceTravail = {
            collected: ftFacts.length,
            stored: ftStoredCount,
            failed: ftFailedCount,
            status: 'success'
        };
        summary.stored += ftStoredCount;
        summary.failed += ftFailedCount;
        summary.totalFacts += ftFacts.length;
    } catch (error) {
        safeLog('error', 'MarketFacts: France Travail collection failed', { error: error.message });
        summary.sources.franceTravail = {
            collected: 0,
            stored: ftStoredCount,
            failed: ftFailedCount,
            status: 'error',
            error: error.message
        };
    }

    try {
        safeLog('info', 'MarketFacts: Collecting from Adzuna');
        const adzunaFacts = await collectAdzunaFacts(options.adzuna || {});
        summary.sources.adzuna = {
            collected: adzunaFacts.length,
            status: 'success'
        };

        if (adzunaFacts.length > 0) {
            const adzunaStored = await storeFacts(adzunaFacts);
            summary.sources.adzuna.stored = adzunaStored.success;
            summary.sources.adzuna.failed = adzunaStored.failed;
            summary.stored += adzunaStored.success;
            summary.failed += adzunaStored.failed;
        }

        summary.totalFacts += adzunaFacts.length;
    } catch (error) {
        safeLog('error', 'MarketFacts: Adzuna collection failed', { error: error.message });
        summary.sources.adzuna = {
            status: 'error',
            error: error.message
        };
    }

    summary.endTime = new Date().toISOString();
    summary.duration = new Date(summary.endTime) - new Date(summary.startTime);

    invalidateFactsCache();
    safeLog('info', 'MarketFacts: Full collection completed', summary);

    return summary;
}

async function runSourceCollection(source, options = {}) {
    const { onProgress } = options;
    const summary = {
        source,
        startTime: new Date().toISOString(),
        collected: 0,
        stored: 0,
        failed: 0
    };

    let storedCount = 0;
    let failedCount = 0;

    try {
        if (options.useStoredRomeCodes !== false && !options.romeCodes) {
            const storedCodes = await getStoredRomeCodes();
            if (storedCodes.length > 0) {
                options.romeCodes = storedCodes;
                summary.romeCodesUsed = storedCodes.length;
                safeLog('info', `MarketFacts: Using ${storedCodes.length} ROME codes from stored métiers for ${source}`);
            }
        }

        options.onTotalEstimated = async (total) => {
            summary.totalExpected = total;
            if (onProgress) {
                try { await onProgress(summary); } catch { /* ignore */ }
            }
        };

        let lastProgressUpdate = 0;
        const PROGRESS_INTERVAL_MS = 5000;
        options.onFactCollected = async (fact) => {
            try {
                await storeFact(fact);
                storedCount++;
                summary.stored = storedCount;
            } catch (err) {
                failedCount++;
                summary.failed = failedCount;
                safeLog('error', 'MarketFacts: Failed to store fact', { error: err.message });
            }

            if (onProgress) {
                const now = Date.now();
                if (now - lastProgressUpdate > PROGRESS_INTERVAL_MS) {
                    lastProgressUpdate = now;
                    try { await onProgress(summary); } catch { /* ignore */ }
                }
            }
        };

        let facts = [];
        if (source === 'france_travail') {
            facts = await collectFranceTravailFacts(options);
        } else if (source === 'adzuna') {
            facts = await collectAdzunaFacts(options);
        } else {
            throw new Error(`Unknown source: ${source}`);
        }

        summary.collected = facts.length;
        summary.stored = storedCount;
        summary.failed = failedCount;
        summary.status = 'success';
    } catch (error) {
        summary.status = 'error';
        summary.error = error.message;
        summary.stored = storedCount;
        summary.failed = failedCount;
        safeLog('error', `MarketFacts: ${source} collection failed`, { error: error.message });
    }

    summary.endTime = new Date().toISOString();
    summary.duration = new Date(summary.endTime) - new Date(summary.startTime);

    invalidateFactsCache();
    return summary;
}

export {
    storeFact,
    storeFacts,
    getFactsByDateRange,
    getLatestFacts,
    getKeywordTrend,
    getRegionalComparison,
    runFullCollection,
    runSourceCollection,
    getStoredRomeCodes,
    invalidateFactsCache,
    loadFactsCache,
    getFactsFilterOptions,
    getFactsSummary,
    startFactsCacheCleanup,
    cleanupFactsCache,
    destroyFactsCache,
    getFactsCacheStats
};
