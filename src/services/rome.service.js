/**
 * Rome 4.0 API Service
 * Handles fetching métiers and compétences from France Travail APIs
 * - Referentiel API for list of métiers
 * - Fiches Métiers API v1 for detailed information
 */

import axios from 'axios';
import { ROME_FICHES_METIERS_API_URL } from '../config/constants.js';
import { createModuleLogger } from '../utils/logger.backend.js';
import { query as dbQuery } from '../config/database.js';
// Reuse France Travail service for token and referentiel (which works)
import { getAccessToken, getReferentiel } from './franceTravail.service.js';

// Module logger
const log = createModuleLogger('rome');

// ============================================
// API CALLS
// 1. Référentiel Offres d'emploi : liste des métiers (fonctionne avec scope actuel)
// 2. ROME 4.0 - Fiches Métiers : fiches détaillées
// ============================================

/**
 * Get all métiers from Offres d'emploi referentiel (works with current scope)
 * @returns {Array} - List of métiers (code + libelle)
 */
async function getMetiers() {
    try {
        log.info('Fetching métiers from referentiel');
        const metiers = await getReferentiel('metiers');
        log.info('Métiers fetched', { count: metiers?.length || 0 });
        return metiers || [];
    } catch (error) {
        log.error('Failed to fetch métiers', { error: error.message });
        throw error;
    }
}

/**
 * Get ALL fiches métiers in a single API call (to avoid rate limiting)
 * @returns {Array} - All fiches métiers
 */
async function getAllFichesMetiers() {
    const token = await getAccessToken();
    
    try {
        // Single call to get all fiches métiers
        const url = `${ROME_FICHES_METIERS_API_URL}/metier`;
        
        log.info('Fetching ALL fiches métiers', { url });
        
        const response = await axios.get(url, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json'
            },
            timeout: 60000 // Longer timeout for bulk request
        });
        
        log.info('All fiches métiers fetched', { count: response.data?.length || 0 });
        return response.data || [];
    } catch (error) {
        log.error('Failed to fetch all fiches métiers', { error: error.message, status: error.response?.status });
        throw error;
    }
}

/**
 * Get métier details by code ROME from cached fiches or API
 * @param {string} codeRome - Code ROME (ex: M1805)
 * @param {Array} allFiches - Pre-fetched fiches métiers (optional)
 * @returns {Object} - Métier details with compétences, contextes, appellations
 */
async function getMetierByCode(codeRome, allFiches = null) {
    // If we have pre-fetched fiches, use them
    if (allFiches) {
        const fiche = allFiches.find(f => f.code === codeRome || f.codeRome === codeRome);
        if (fiche) {
            return fiche;
        }
    }
    
    // Fallback to individual API call
    const token = await getAccessToken();
    
    try {
        const url = `${ROME_FICHES_METIERS_API_URL}/metier/${codeRome}`;
        
        log.debug('Fetching fiche métier', { codeRome });
        
        const response = await axios.get(url, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json'
            },
            timeout: 30000
        });
        
        return response.data;
    } catch (error) {
        if (error.response?.status === 401 || error.response?.status === 403) {
            log.warn('Fiches Métiers API access denied', { codeRome, status: error.response?.status });
            // Return basic info as fallback
            return { code: codeRome, libelle: 'Unknown' };
        }
        log.error('Failed to fetch fiche métier', { codeRome, error: error.message });
        throw error;
    }
}

/**
 * Get compétences for a métier from Fiches Métiers API
 * @param {string} codeRome - Code ROME
 * @returns {Array} - List of compétences
 */
async function getCompetencesByMetier(codeRome) {
    try {
        const ficheMetier = await getMetierByCode(codeRome);
        // Extract compétences from fiche métier response
        return ficheMetier?.competences || 
               ficheMetier?.competencesMobilisees || 
               ficheMetier?.savoirFaire || 
               [];
    } catch (error) {
        log.warn('Failed to get compétences', { codeRome, error: error.message });
        return [];
    }
}

/**
 * Get all grands domaines
 * @returns {Array} - List of grands domaines
 */
async function getGrandsDomaines() {
    try {
        // Extract unique grands domaines from métiers
        const metiers = await getReferentiel('metiers');
        const grandsDomaines = new Map();
        metiers?.forEach(m => {
            if (m.codeGrandDomaine && !grandsDomaines.has(m.codeGrandDomaine)) {
                grandsDomaines.set(m.codeGrandDomaine, {
                    code: m.codeGrandDomaine,
                    libelle: m.libelleGrandDomaine || m.codeGrandDomaine
                });
            }
        });
        return Array.from(grandsDomaines.values());
    } catch (error) {
        log.error('Failed to fetch grands domaines', { error: error.message });
        throw error;
    }
}

/**
 * Get domaines professionnels
 * @param {string} codeGrandDomaine - Optional grand domaine code filter
 * @returns {Array} - List of domaines
 */
async function getDomaines(codeGrandDomaine = null) {
    try {
        const metiers = await getReferentiel('metiers');
        const domaines = new Map();
        metiers?.forEach(m => {
            if (m.codeDomaineProfessionnel && !domaines.has(m.codeDomaineProfessionnel)) {
                if (!codeGrandDomaine || m.codeGrandDomaine === codeGrandDomaine) {
                    domaines.set(m.codeDomaineProfessionnel, {
                        code: m.codeDomaineProfessionnel,
                        libelle: m.libelleDomaineProfessionnel || m.codeDomaineProfessionnel,
                        codeGrandDomaine: m.codeGrandDomaine
                    });
                }
            }
        });
        return Array.from(domaines.values());
    } catch (error) {
        log.error('Failed to fetch domaines', { error: error.message });
        throw error;
    }
}

/**
 * Search métiers by keyword
 * @param {string} keyword - Search keyword
 * @returns {Array} - Matching métiers
 */
async function searchMetiers(keyword) {
    try {
        const metiers = await getReferentiel('metiers');
        const lowerKeyword = keyword.toLowerCase();
        return metiers?.filter(m => 
            m.libelle?.toLowerCase().includes(lowerKeyword) ||
            m.code?.toLowerCase().includes(lowerKeyword)
        ) || [];
    } catch (error) {
        log.error('Search failed', { keyword, error: error.message });
        throw error;
    }
}

// ============================================
// IT/INFORMATIQUE SPECIFIC
// ============================================

// Grand domaine "M" = Support à l'entreprise (includes IT)
// Code famille "M18" = Systèmes d'information et de télécommunication
const IT_FAMILLE_CODE = 'M18';
const IT_GRAND_DOMAINE = 'M';

/**
 * Get all IT métiers (Informatique et télécommunications)
 * Step 1: Get list from referentiel (works with current scope)
 * Step 2: Filter on M18xx family (Systèmes d'information et télécommunication)
 * @returns {Array} - IT métiers (code + libelle)
 */
async function getITMetiers() {
    try {
        log.info('Fetching IT métiers from referentiel');
        
        // Step 1: Get all métiers from referentiel
        const allMetiers = await getReferentiel('metiers');
        
        log.info('Total métiers from referentiel', { count: allMetiers?.length || 0 });
        
        // Step 2: Filter métiers that match IT family (M18xx)
        const itMetiers = allMetiers?.filter(m => 
            m.code?.startsWith('M18')
        ) || [];
        
        log.info('IT métiers filtered', { count: itMetiers.length });
        return itMetiers;
    } catch (error) {
        log.error('Failed to fetch IT métiers', { error: error.message });
        throw error;
    }
}

// ============================================
// AIRTABLE STORAGE
// ============================================

/**
 * Extract compétences from métier data (new API structure)
 * @param {Object} metier - Métier data from Fiches Métiers API
 * @returns {Object} - Object with competencesDetaillees, macroSavoirFaire, and enjeux
 */
function extractCompetencesFromFiche(metier) {
    const result = {
        competencesDetaillees: [],
        macroSavoirFaire: [],
        enjeux: []
    };
    
    const groupes = metier.groupesCompetencesMobilisees;
    if (!groupes || !Array.isArray(groupes)) {
        return result;
    }
    
    const enjeuxSet = new Set();
    
    for (const groupe of groupes) {
        // Collect enjeux
        if (groupe.enjeu) {
            const enjeuKey = `${groupe.enjeu.code}|${groupe.enjeu.libelle}`;
            if (!enjeuxSet.has(enjeuKey)) {
                enjeuxSet.add(enjeuKey);
                result.enjeux.push({
                    code: groupe.enjeu.code,
                    libelle: groupe.enjeu.libelle
                });
            }
        }
        
        // Collect competences by type
        if (groupe.competences && Array.isArray(groupe.competences)) {
            for (const comp of groupe.competences) {
                const competence = {
                    code: comp.code,
                    libelle: comp.libelle,
                    enjeu: groupe.enjeu?.libelle || null
                };
                
                if (comp.type === 'COMPETENCE-DETAILLEE') {
                    result.competencesDetaillees.push(competence);
                } else if (comp.type === 'MACRO-SAVOIR-FAIRE') {
                    result.macroSavoirFaire.push(competence);
                }
            }
        }
    }
    
    return result;
}

/**
 * Extract savoirs from métier data
 * @param {Object} metier - Métier data from Fiches Métiers API
 * @returns {Array} - Array of savoirs
 */
function extractSavoirsFromFiche(metier) {
    const savoirs = [];
    const groupes = metier.groupesSavoirs;
    
    if (!groupes || !Array.isArray(groupes)) {
        return savoirs;
    }
    
    for (const groupe of groupes) {
        if (groupe.savoirs && Array.isArray(groupe.savoirs)) {
            for (const savoir of groupe.savoirs) {
                savoirs.push({
                    code: savoir.code,
                    libelle: savoir.libelle,
                    categorie: groupe.categorie?.libelle || null
                });
            }
        }
    }
    
    return savoirs;
}

/**
 * Store a métier in PostgreSQL
 * @param {Object} metier - Métier data from Fiches Métiers API v1
 * @returns {Object} - Created/updated record
 */
async function storeMetier(metier) {
    try {
        const competencesData = extractCompetencesFromFiche(metier);
        const savoirsData = extractSavoirsFromFiche(metier);
        
        const codeRome = metier.code || metier.codeRome;
        const libelle = metier.metier?.libelle || metier.libelle || null;
        const obsolete = metier.obsolete === true;
        const enjeux = competencesData.enjeux.length > 0 ? JSON.stringify(competencesData.enjeux) : null;
        const competencesDetaillees = competencesData.competencesDetaillees.length > 0 
            ? JSON.stringify(competencesData.competencesDetaillees) : null;
        const macroSavoirFaire = competencesData.macroSavoirFaire.length > 0 
            ? JSON.stringify(competencesData.macroSavoirFaire) : null;
        const savoirs = savoirsData.length > 0 ? JSON.stringify(savoirsData) : null;

        // Check if record exists
        const existing = await dbQuery(
            'SELECT id FROM rome_metiers WHERE code_rome = $1',
            [codeRome]
        );

        if (existing.rows.length > 0) {
            // Update existing record
            const result = await dbQuery(
                `UPDATE rome_metiers SET 
                    libelle = $1, obsolete = $2, enjeux = $3, 
                    competences = $4, macro_savoir_faire = $5, savoirs = $6,
                    updated_at = NOW()
                WHERE code_rome = $7 RETURNING *`,
                [libelle, obsolete, enjeux, competencesDetaillees, macroSavoirFaire, savoirs, codeRome]
            );
            return { action: 'updated', record: result.rows[0] };
        } else {
            // Create new record
            const result = await dbQuery(
                `INSERT INTO rome_metiers (code_rome, libelle, obsolete, enjeux, competences, macro_savoir_faire, savoirs)
                VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
                [codeRome, libelle, obsolete, enjeux, competencesDetaillees, macroSavoirFaire, savoirs]
            );
            return { action: 'created', record: result.rows[0] };
        }
    } catch (error) {
        log.error('Failed to store métier', { code: metier.code || metier.codeRome, error: error.message });
        throw error;
    }
}

/**
 * Collect and store all IT métiers with their compétences
 * @returns {Object} - Collection summary
 */
async function collectITMetiers() {
    const summary = {
        total: 0,
        created: 0,
        updated: 0,
        failed: 0,
        errors: []
    };

    try {
        log.info('Starting IT métiers collection');

        // Step 1: Get all IT métiers from ROME 4.0 Compétences API
        const metiers = await getITMetiers();
        summary.total = metiers.length;
        log.info('IT métiers list fetched', { count: metiers.length });

        // Step 2 & 3: For each IT métier, fetch fiche and store
        const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
        
        log.info('Fetching fiches métiers individually');

        for (const metier of metiers) {
            try {
                const code = metier.code || metier.codeRome;
                
                // Fetch fiche métier from API
                // Endpoint: /fiches-rome/fiche-metier/{CODE_ROME}
                let details = null;
                try {
                    const ficheUrl = `${ROME_FICHES_METIERS_API_URL}/fiches-rome/fiche-metier/${code}`;
                    log.debug('Fetching fiche', { url: ficheUrl });
                    
                    const token = await getAccessToken();
                    const response = await axios.get(ficheUrl, {
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Accept': 'application/json'
                        },
                        timeout: 30000
                    });
                    
                    details = response.data;
                    
                } catch (ficheError) {
                    // If fiche fetch fails, use basic info
                    log.debug('Fiche fetch failed, using basic info', { code, error: ficheError.message });
                    details = { ...metier };
                }

                // Store in Airtable
                const result = await storeMetier(details);
                
                if (result.action === 'created') {
                    summary.created++;
                } else {
                    summary.updated++;
                }

                log.debug('Stored métier', { code, action: result.action });

                // Rate limiting: 1 request per second for Fiches Métiers API
                await delay(1000);
            } catch (error) {
                summary.failed++;
                summary.errors.push({
                    code: metier.code || metier.codeRome,
                    error: error.message
                });
                log.warn('Failed to store métier', { code: metier.code, error: error.message });
            }
        }

        log.info('IT métiers collection completed', summary);
        return summary;
    } catch (error) {
        log.error('Collection failed', { error: error.message });
        throw error;
    }
}

// Cache for métiers list (refreshed every 10 minutes)
// Only caches essential fields (CodeRome, Libelle, Obsolete, LastUpdated)
// Estimated memory: ~500 bytes per record, 4000 records = ~2 MB max
let metiersCache = null;
let metiersCacheTime = 0;
const METIERS_CACHE_TTL = 10 * 60 * 1000; // 10 minutes
const METIERS_CACHE_MAX_SIZE = 5000; // Max records to cache (safety limit)

/**
 * Get all stored métiers from PostgreSQL
 * Uses caching and only fetches essential fields for list view
 * @param {Object} filters - Optional filters
 * @param {boolean} filters.includeDetails - Include full JSON details (slower)
 * @returns {Array} - Stored métiers
 */
async function getStoredMetiers(filters = {}) {
    try {
        const includeDetails = filters.includeDetails === true || filters.includeDetails === 'true';
        
        // Check cache for unfiltered requests without details
        const useCache = !filters.codeRome && !filters.grandDomaine && !filters.search && !includeDetails;
        
        if (useCache && metiersCache && (Date.now() - metiersCacheTime) < METIERS_CACHE_TTL) {
            log.debug('Returning cached métiers list');
            
            const page = filters.page ? parseInt(filters.page) : null;
            const pageSize = filters.pageSize ? parseInt(filters.pageSize) : 20;
            
            if (page) {
                const startIndex = (page - 1) * pageSize;
                return {
                    metiers: metiersCache.slice(startIndex, startIndex + pageSize),
                    totalCount: metiersCache.length,
                    pagination: {
                        page,
                        pageSize,
                        totalCount: metiersCache.length,
                        totalPages: Math.ceil(metiersCache.length / pageSize)
                    }
                };
            }
            
            return metiersCache;
        }
        
        // Build query
        let whereClause = '';
        const params = [];
        let paramIndex = 1;
        
        if (filters.codeRome) {
            whereClause = `WHERE code_rome = $${paramIndex}`;
            params.push(filters.codeRome);
            paramIndex++;
        } else if (filters.grandDomaine) {
            whereClause = `WHERE code_grand_domaine = $${paramIndex}`;
            params.push(filters.grandDomaine);
            paramIndex++;
        } else if (filters.search) {
            whereClause = `WHERE libelle ILIKE $${paramIndex} OR code_rome ILIKE $${paramIndex}`;
            params.push(`%${filters.search}%`);
            paramIndex++;
        }

        const columns = includeDetails 
            ? 'id, code_rome, libelle, obsolete, enjeux, competences, macro_savoir_faire, savoirs, updated_at'
            : 'id, code_rome, libelle, obsolete, updated_at';

        const result = await dbQuery(
            `SELECT ${columns} FROM rome_metiers ${whereClause} ORDER BY code_rome ASC`,
            params
        );

        const allMetiers = result.rows.map(record => {
            const metier = {
                id: record.id,
                CodeRome: record.code_rome,
                Libelle: record.libelle,
                Obsolete: record.obsolete || false,
                LastUpdated: record.updated_at
            };
            
            if (includeDetails) {
                metier.Enjeux = record.enjeux ? (typeof record.enjeux === 'string' ? JSON.parse(record.enjeux) : record.enjeux) : [];
                metier.CompetencesDetaillees = record.competences ? (typeof record.competences === 'string' ? JSON.parse(record.competences) : record.competences) : [];
                metier.MacroSavoirFaire = record.macro_savoir_faire ? (typeof record.macro_savoir_faire === 'string' ? JSON.parse(record.macro_savoir_faire) : record.macro_savoir_faire) : [];
                metier.Savoirs = record.savoirs ? (typeof record.savoirs === 'string' ? JSON.parse(record.savoirs) : record.savoirs) : [];
            }
            
            return metier;
        });

        // Update cache
        if (useCache && allMetiers.length <= METIERS_CACHE_MAX_SIZE) {
            metiersCache = allMetiers;
            metiersCacheTime = Date.now();
            log.info(`Cached ${allMetiers.length} métiers`);
        }

        // Handle pagination
        const page = filters.page ? parseInt(filters.page) : null;
        const pageSize = filters.pageSize ? parseInt(filters.pageSize) : 20;
        
        if (page) {
            const startIndex = (page - 1) * pageSize;
            return {
                metiers: allMetiers.slice(startIndex, startIndex + pageSize),
                totalCount: allMetiers.length,
                pagination: {
                    page,
                    pageSize,
                    totalCount: allMetiers.length,
                    totalPages: Math.ceil(allMetiers.length / pageSize)
                }
            };
        }

        return allMetiers;
    } catch (error) {
        log.error('Failed to get stored métiers', { error: error.message });
        throw error;
    }
}

/**
 * Get global statistics for métiers (total count, total competences, last update)
 * @returns {Object} - Global statistics
 */
async function getMetiersStats() {
    try {
        // Get total count and last update
        const countResult = await dbQuery(
            'SELECT COUNT(*) as total, MAX(updated_at) as last_updated FROM rome_metiers'
        );
        
        const totalMetiers = parseInt(countResult.rows[0]?.total || 0);
        const lastUpdated = countResult.rows[0]?.last_updated;
        
        // Get competences counts using JSONB array length
        const competencesResult = await dbQuery(`
            SELECT 
                COALESCE(SUM(jsonb_array_length(COALESCE(competences, '[]'::jsonb))), 0) as total_competences,
                COALESCE(SUM(jsonb_array_length(COALESCE(macro_savoir_faire, '[]'::jsonb))), 0) as total_macro,
                COALESCE(SUM(jsonb_array_length(COALESCE(savoirs, '[]'::jsonb))), 0) as total_savoirs
            FROM rome_metiers
        `);
        
        const totalCompetencesDetaillees = parseInt(competencesResult.rows[0]?.total_competences || 0);
        const totalMacroSavoirFaire = parseInt(competencesResult.rows[0]?.total_macro || 0);
        const totalSavoirs = parseInt(competencesResult.rows[0]?.total_savoirs || 0);
        
        return {
            totalMetiers,
            totalCompetences: totalCompetencesDetaillees + totalMacroSavoirFaire,
            totalCompetencesDetaillees,
            totalMacroSavoirFaire,
            totalSavoirs,
            lastUpdated
        };
    } catch (error) {
        log.error('Failed to get métiers stats', { error: error.message });
        throw error;
    }
}

// Periodic cache cleanup - auto-expire if not accessed for 2x TTL
const metiersCacheCleanupInterval = setInterval(() => {
    if (metiersCacheTime && Date.now() - metiersCacheTime > METIERS_CACHE_TTL * 2) {
        metiersCache = null;
        metiersCacheTime = 0;
        log.debug('Métiers cache auto-expired (inactive)');
    }
}, METIERS_CACHE_TTL);

/**
 * Cleanup function for graceful shutdown
 * Clears métiers cache and releases memory
 */
function cleanupMetiersCache() {
    metiersCache = null;
    metiersCacheTime = 0;
    log.info('Métiers cache cleaned up for shutdown');
}

/**
 * Destroy métiers cache and cleanup interval (for graceful shutdown)
 */
function destroyMetiersCache() {
    if (metiersCacheCleanupInterval) {
        clearInterval(metiersCacheCleanupInterval);
    }
    metiersCache = null;
    metiersCacheTime = 0;
    log.info('Métiers cache destroyed');
}

/**
 * Get métiers cache statistics
 */
function getMetiersCacheStats() {
    return {
        size: metiersCache?.length || 0,
        maxSize: METIERS_CACHE_MAX_SIZE,
        ttlMinutes: METIERS_CACHE_TTL / (60 * 1000),
        ageMs: metiersCacheTime ? Date.now() - metiersCacheTime : null
    };
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
