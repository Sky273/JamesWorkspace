/**
 * Rome 4.0 API Service
 * Handles fetching métiers and compétences from France Travail APIs
 * - Referentiel API for list of métiers
 * - Fiches Métiers API v1 for detailed information
 */

import { createModuleLogger } from '../utils/logger.backend.js';
import {
    fetchFicheMetierForCollection,
    getCompetencesByMetier as getCompetencesByMetierFromApi,
    getDomaines as getDomainesFromApi,
    getGrandsDomaines as getGrandsDomainesFromApi,
    getITMetiers as getITMetiersFromApi,
    getMetierByCode as getMetierByCodeFromApi,
    getMetiers as getMetiersFromApi,
    searchMetiers as searchMetiersFromApi
} from './rome/api.js';
import {
    cleanupMetiersCache as cleanupMetiersCacheStorage,
    destroyMetiersCache as destroyMetiersCacheStorage,
    getCachedMetiers,
    getMetiersCacheStats,
    updateMetiersCache,
    withPagination
} from './rome/cache.js';
import {
    getMetiersStats as getMetiersStatsFromDb,
    queryStoredMetiers,
    storeMetier as storeMetierInDb
} from './rome/persistence.js';

const log = createModuleLogger('rome');

const IT_FAMILLE_CODE = 'M18';
const IT_GRAND_DOMAINE = 'M';

function getMetiers() {
    return getMetiersFromApi(log);
}

function getMetierByCode(codeRome, allFiches = null) {
    return getMetierByCodeFromApi(codeRome, log, allFiches);
}

function getCompetencesByMetier(codeRome) {
    return getCompetencesByMetierFromApi(codeRome, log);
}

function getGrandsDomaines() {
    return getGrandsDomainesFromApi(log);
}

function getDomaines(codeGrandDomaine = null) {
    return getDomainesFromApi(codeGrandDomaine, log);
}

function searchMetiers(keyword) {
    return searchMetiersFromApi(keyword, log);
}

function getITMetiers() {
    return getITMetiersFromApi(log);
}

function storeMetier(metier) {
    return storeMetierInDb(metier, log);
}

async function collectITMetiers({ onProgress } = {}) {
    const summary = {
        total: 0,
        created: 0,
        updated: 0,
        failed: 0,
        errors: []
    };

    try {
        log.info('Starting IT métiers collection');

        const metiers = await getITMetiers();
        summary.total = metiers.length;
        log.info('IT métiers list fetched', { count: metiers.length });

        if (onProgress) {
            try {
                await onProgress(summary);
            } catch {
                // ignore progress callback errors
            }
        }

        const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
        log.info('Fetching fiches métiers individually');

        for (const metier of metiers) {
            try {
                const code = metier.code || metier.codeRome;
                let details = null;

                try {
                    details = await fetchFicheMetierForCollection(code, log);
                } catch (ficheError) {
                    log.debug('Fiche fetch failed, using basic info', { code, error: ficheError.message });
                    details = { ...metier };
                }

                const result = await storeMetier(details);
                if (result.action === 'created') {
                    summary.created++;
                } else {
                    summary.updated++;
                }

                log.debug('Stored métier', { code, action: result.action });
                await delay(1000);
            } catch (error) {
                summary.failed++;
                summary.errors.push({
                    code: metier.code || metier.codeRome,
                    error: error.message
                });
                log.warn('Failed to store métier', { code: metier.code, error: error.message });
            }

            if (onProgress) {
                try {
                    await onProgress(summary);
                } catch {
                    // ignore progress callback errors
                }
            }
        }

        log.info('IT métiers collection completed', summary);
        return summary;
    } catch (error) {
        log.error('Collection failed', { error: error.message });
        throw error;
    }
}

async function getStoredMetiers(filters = {}) {
    try {
        const cached = getCachedMetiers(filters, log);
        if (cached) {
            return cached;
        }

        const allMetiers = await queryStoredMetiers(filters);
        updateMetiersCache(filters, allMetiers, log);
        return withPagination(allMetiers, filters);
    } catch (error) {
        log.error('Failed to get stored métiers', { error: error.message });
        throw error;
    }
}

function getMetiersStats() {
    return getMetiersStatsFromDb(log);
}

function cleanupMetiersCache() {
    cleanupMetiersCacheStorage(log);
}

function destroyMetiersCache() {
    destroyMetiersCacheStorage(log);
}

export {
    getMetiers,
    getMetierByCode,
    getCompetencesByMetier,
    getGrandsDomaines,
    getDomaines,
    searchMetiers,
    getITMetiers,
    storeMetier,
    collectITMetiers,
    getStoredMetiers,
    getMetiersStats,
    cleanupMetiersCache,
    destroyMetiersCache,
    getMetiersCacheStats,
    IT_FAMILLE_CODE,
    IT_GRAND_DOMAINE
};
