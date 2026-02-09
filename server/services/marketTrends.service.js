/**
 * Market Trends Service
 * Handles France Travail "Stats Offres Demandes Emploi" API for labor market statistics
 * OpenAPI: https://api.francetravail.io/partenaire/stats-offres-demandes-emploi
 * 
 * Required scopes: offresetdemandesemploi api_stats-offres-demandes-emploiv1
 */

import axios from 'axios';
import { FRENCH_REGIONS } from './franceTravail.service.js';
import { getStoredMetiers } from './rome.service.js';

import { safeLog } from '../utils/logger.backend.js';
import { query as dbQuery } from '../config/database.js';

// IS/IT Family code filter (M18 = Systèmes d'information et de télécommunication)
const IT_FAMILLE_CODE = 'M18';

/**
 * Calculate the last complete quarter dates
 * Example: If current date is February 2026, returns Q4 2025 (Oct 1 - Dec 31, 2025)
 * @returns {Object} { dateDeb: 'YYYY-MM-DD', dateFin: 'YYYY-MM-DD', quarter: 'Q4 2025' }
 */
function getLastCompleteQuarter() {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-indexed (0 = January)
    
    // Determine which quarter we're currently in (0-indexed)
    // Q1: Jan-Mar (months 0-2), Q2: Apr-Jun (3-5), Q3: Jul-Sep (6-8), Q4: Oct-Dec (9-11)
    const currentQuarter = Math.floor(currentMonth / 3);
    
    // Calculate last complete quarter
    let lastQuarter, lastQuarterYear;
    
    if (currentQuarter === 0) {
        // We're in Q1, so last complete quarter is Q4 of previous year
        lastQuarter = 3;
        lastQuarterYear = currentYear - 1;
    } else {
        // Last complete quarter is the previous quarter of current year
        lastQuarter = currentQuarter - 1;
        lastQuarterYear = currentYear;
    }
    
    // Calculate start and end dates for the quarter
    const startMonth = lastQuarter * 3; // 0, 3, 6, or 9
    const endMonth = startMonth + 2; // 2, 5, 8, or 11
    
    // First day of first month of quarter
    const dateDeb = `${lastQuarterYear}-${String(startMonth + 1).padStart(2, '0')}-01`;
    
    // Last day of last month of quarter
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

// PostgreSQL table name
const MARKET_TRENDS_TABLE = 'market_trends';

// API Base URL
const MARKET_API_BASE = 'https://api.francetravail.io/partenaire/stats-offres-demandes-emploi/v1';

// Token management
const FRANCE_TRAVAIL_CLIENT_ID = process.env.FRANCE_TRAVAIL_CLIENT_ID;
const FRANCE_TRAVAIL_CLIENT_SECRET = process.env.FRANCE_TRAVAIL_CLIENT_SECRET;
const FRANCE_TRAVAIL_TOKEN_URL = 'https://entreprise.francetravail.fr/connexion/oauth2/access_token?realm=/partenaire';

let marketToken = null;
let marketTokenExpiresAt = 0;

// Required scopes per OpenAPI spec
const MARKET_SCOPE = 'offresetdemandesemploi api_stats-offres-demandes-emploiv1';

/**
 * Get access token for Market Trends API (Stats Offres Demandes Emploi)
 */
async function getMarketAccessToken() {
    // Return cached token if still valid
    if (marketToken && Date.now() < marketTokenExpiresAt - 60000) {
        return marketToken;
    }

    if (!FRANCE_TRAVAIL_CLIENT_ID || !FRANCE_TRAVAIL_CLIENT_SECRET) {
        throw new Error('France Travail API credentials not configured.');
    }

    try {
        safeLog('info', 'MarketTrends: Requesting access token', { scope: MARKET_SCOPE });
        
        const params = new URLSearchParams();
        params.append('grant_type', 'client_credentials');
        params.append('client_id', FRANCE_TRAVAIL_CLIENT_ID);
        params.append('client_secret', FRANCE_TRAVAIL_CLIENT_SECRET);
        params.append('scope', MARKET_SCOPE);

        const response = await axios.post(FRANCE_TRAVAIL_TOKEN_URL, params, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            timeout: 30000
        });

        marketToken = response.data.access_token;
        const expiresIn = response.data.expires_in || 1500;
        marketTokenExpiresAt = Date.now() + (expiresIn * 1000);

        safeLog('info', 'MarketTrends: Access token obtained', { 
            scope: response.data.scope, 
            expiresIn 
        });
        return marketToken;
    } catch (error) {
        safeLog('error', 'MarketTrends: Failed to get access token', {
            error: error.message,
            status: error.response?.status,
            data: error.response?.data
        });
        throw error;
    }
}

// ============================================
// API CALLS - Stats Offres Demandes Emploi
// All endpoints use POST with JSON body per OpenAPI spec
// ============================================

/**
 * POST /v1/indicateur/stat-embauches (EMB_1)
 * Stats sur les embauches par métier et secteur
 * @param {Object} params - Parameters including dateDeb and dateFin
 */
async function getStatEmbauches(params) {
    const token = await getMarketAccessToken();
    
    const body = {
        codeTypeTerritoire: params.codeTypeTerritoire || 'REG',
        codeTerritoire: params.codeTerritoire,
        codeTypeActivite: 'ROME',
        codeActivite: params.codeRome,
        codeTypePeriode: 'TRIMESTRE',
        codeTypeNomenclature: 'CATCANDxDUREEEMP',
        dateDeb: params.dateDeb,
        dateFin: params.dateFin
    };
    
    try {
        const response = await axios.post(`${MARKET_API_BASE}/indicateur/stat-embauches`, body, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            timeout: 30000
        });
        return response.data;
    } catch (error) {
        safeLog('error', 'MarketTrends: Failed to get stat-embauches', {
            error: error.message,
            status: error.response?.status,
            data: error.response?.data
        });
        throw error;
    }
}

/**
 * POST /v1/indicateur/stat-dynamique-emploi (DYN_1) - OLD API (deprecated)
 * Now uses dataemploi.francetravail.fr public API
 * Indicateur de dynamique de l'emploi
 * @param {Object} params - Parameters for the API call
 */
async function getStatDynamiqueEmploi(params) {
    // Use the public dataemploi API (no authentication required)
    const DATAEMPLOI_API_BASE = 'https://dataemploi.francetravail.fr/emploi/api-statemploi/v1';
    
    // Build request body matching the working payload format
    const body = {
        codeTypeTerritoire: params.codeTypeTerritoire || 'REG',
        codeTerritoire: params.codeTerritoire,
        codeTypeActivite: params.codeTypeActivite || 'MOYENNE',
        codeActivite: params.codeActivite || 'MOYENNE',
        codeTypePeriode: params.codeTypePeriode || 'TRIMESTRE',
        dernierePeriode: params.dernierePeriode !== undefined ? params.dernierePeriode : true,
        sansCaracteristiques: params.sansCaracteristiques !== undefined ? params.sansCaracteristiques : true
    };
    
    try {
        safeLog('debug', 'MarketTrends: Calling dataemploi stat-dynamique-emploi', {
            codeTerritoire: params.codeTerritoire,
            body
        });
        
        const response = await axios.post(`${DATAEMPLOI_API_BASE}/dynamique/stat-dynamique-emploi`, body, {
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            timeout: 30000
        });
        
        safeLog('debug', 'MarketTrends: stat-dynamique-emploi response received', {
            codeTerritoire: params.codeTerritoire,
            hasData: !!response.data
        });
        
        return response.data;
    } catch (error) {
        // Failover: Log error and return null to continue collection gracefully
        safeLog('warn', 'MarketTrends: stat-dynamique-emploi failed', {
            codeTerritoire: params.codeTerritoire,
            error: error.message,
            status: error.response?.status,
            responseData: error.response?.data,
            requestBody: body
        });
        
        // Return null instead of throwing to allow collection to continue
        return null;
    }
}

/**
 * POST /v1/indicateur/stat-perspective-employeur (PERSP_2)
 * Stats sur les difficultés de recrutement (indicateur de tension)
 */
async function getStatTensions(params) {
    const token = await getMarketAccessToken();
    
    const body = {
        codeTypeTerritoire: params.codeTypeTerritoire || 'REG',
        codeTerritoire: params.codeTerritoire,
        codeTypeActivite: 'ROME',
        codeActivite: params.codeRome,
        codeTypePeriode: 'ANNEE',
        codeTypeNomenclature: 'TYPE_TENSION',
        dernierePeriode: true
    };
    
    try {
        const response = await axios.post(`${MARKET_API_BASE}/indicateur/stat-perspective-employeur`, body, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            timeout: 30000
        });
        return response.data;
    } catch (error) {
        safeLog('error', 'MarketTrends: Failed to get stat-perspective-employeur', {
            error: error.message,
            status: error.response?.status
        });
        throw error;
    }
}

/**
 * GET /v1/indicateur/salaire-rome-fap/{codeTypeTerritoire}/{codeTerritoire} (SAL_3)
 * Stats sur les salaires par métier
 */
async function getStatSalaires(params) {
    const token = await getMarketAccessToken();
    
    const codeTypeTerritoire = params.codeTypeTerritoire || 'NAT';
    const codeTerritoire = params.codeTerritoire || 'FR';
    
    try {
        const url = `${MARKET_API_BASE}/indicateur/salaire-rome-fap/${codeTypeTerritoire}/${codeTerritoire}?codeRome=${params.codeRome}`;
        const response = await axios.get(url, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json'
            },
            timeout: 30000
        });
        return response.data;
    } catch (error) {
        safeLog('error', 'MarketTrends: Failed to get salaire-rome-fap', {
            error: error.message,
            status: error.response?.status
        });
        throw error;
    }
}

/**
 * POST /v1/indicateur/stat-offres (OFF_1)
 * Stats sur les offres d'emploi
 * @param {Object} params - Parameters including dateDeb and dateFin
 */
async function getStatOffres(params) {
    const token = await getMarketAccessToken();
    
    const body = {
        codeTypeTerritoire: params.codeTypeTerritoire || 'REG',
        codeTerritoire: params.codeTerritoire,
        codeTypeActivite: 'ROME',
        codeActivite: params.codeRome,
        codeTypePeriode: 'TRIMESTRE',
        codeTypeNomenclature: 'ORIGINEOFF',
        dateDeb: params.dateDeb,
        dateFin: params.dateFin
    };
    
    try {
        const response = await axios.post(`${MARKET_API_BASE}/indicateur/stat-offres`, body, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            timeout: 30000
        });
        return response.data;
    } catch (error) {
        safeLog('error', 'MarketTrends: Failed to get stat-offres', {
            error: error.message,
            status: error.response?.status
        });
        throw error;
    }
}

/**
 * POST /v1/indicateur/stat-demandeurs (DE_1)
 * Stats des demandeurs d'emploi inscrits en fin de trimestre
 * @param {Object} params - Parameters including dateDeb and dateFin
 */
async function getStatDemandeurs(params) {
    const token = await getMarketAccessToken();
    
    const body = {
        codeTypeTerritoire: params.codeTypeTerritoire || 'REG',
        codeTerritoire: params.codeTerritoire,
        codeTypeActivite: 'ROME',
        codeActivite: params.codeRome,
        codeTypePeriode: 'TRIMESTRE',
        codeTypeNomenclature: 'CATCAND',
        dateDeb: params.dateDeb,
        dateFin: params.dateFin
    };
    
    try {
        const response = await axios.post(`${MARKET_API_BASE}/indicateur/stat-demandeurs`, body, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            timeout: 30000
        });
        return response.data;
    } catch (error) {
        safeLog('error', 'MarketTrends: Failed to get stat-demandeurs', {
            error: error.message,
            status: error.response?.status
        });
        throw error;
    }
}

/**
 * POST /v1/indicateur/stat-demandeurs-entrant (DE_5)
 * Stats des demandeurs d'emploi nouveaux inscrits
 * @param {Object} params - Parameters including dateDeb and dateFin
 */
async function getStatDemandeursEntrants(params) {
    const token = await getMarketAccessToken();
    
    const body = {
        codeTypeTerritoire: params.codeTypeTerritoire || 'REG',
        codeTerritoire: params.codeTerritoire,
        codeTypeActivite: 'ROME',
        codeActivite: params.codeRome,
        codeTypePeriode: 'TRIMESTRE',
        codeTypeNomenclature: 'CATCAND',
        dateDeb: params.dateDeb,
        dateFin: params.dateFin
    };
    
    try {
        const response = await axios.post(`${MARKET_API_BASE}/indicateur/stat-demandeurs-entrant`, body, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            timeout: 30000
        });
        return response.data;
    } catch (error) {
        safeLog('error', 'MarketTrends: Failed to get stat-demandeurs-entrant', {
            error: error.message,
            status: error.response?.status
        });
        throw error;
    }
}

// ============================================
// DATA COLLECTION & STORAGE
// ============================================

/**
 * Safely serialize metadata for PostgreSQL storage
 * Handles circular references and undefined values
 * Note: PostgreSQL JSONB has no practical size limit, so no truncation needed
 */
function safeSerializeMetadata(metadata) {
    if (!metadata) return null;
    
    try {
        // Handle circular references and clean up problematic values
        const cleaned = JSON.parse(JSON.stringify(metadata, (key, value) => {
            // Remove undefined values
            if (value === undefined) return null;
            // Remove functions
            if (typeof value === 'function') return null;
            return value;
        }));
        
        return JSON.stringify(cleaned);
    } catch (error) {
        safeLog('error', 'MarketTrends: Failed to serialize metadata', {
            error: error.message,
            metadataType: typeof metadata
        });
        return JSON.stringify({ error: 'Serialization failed', type: typeof metadata });
    }
}

/**
 * Store a market trend record in PostgreSQL (upsert)
 * Ensures uniqueness by Type + RegionCode + CodeRome
 */
async function storeTrend(trend) {
    try {
        // Check if record already exists
        const existing = await dbQuery(
            `SELECT id FROM ${MARKET_TRENDS_TABLE} 
             WHERE type = $1 AND COALESCE(region_code, '') = $2 AND COALESCE(code_rome, '') = $3`,
            [trend.type, trend.regionCode || '', trend.codeRome || '']
        );
        
        const metadata = safeSerializeMetadata(trend.metadata);
        
        if (existing.rows.length > 0) {
            // Update existing record
            const result = await dbQuery(
                `UPDATE ${MARKET_TRENDS_TABLE} SET
                    date = $1, rome_label = $2, region = $3, secteur = $4,
                    value = $5, value_label = $6, metadata = $7, updated_at = NOW()
                WHERE id = $8 RETURNING *`,
                [trend.date, trend.romeLabel, trend.region, trend.secteur, 
                 trend.value, trend.valueLabel, metadata, existing.rows[0].id]
            );
            
            safeLog('debug', 'MarketTrends: Updated existing trend', {
                type: trend.type, regionCode: trend.regionCode, codeRome: trend.codeRome
            });
            
            return { record: result.rows[0], action: 'updated' };
        } else {
            // Create new record
            const result = await dbQuery(
                `INSERT INTO ${MARKET_TRENDS_TABLE} 
                    (type, code_rome, rome_label, region, region_code, secteur, date, value, value_label, metadata)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
                [trend.type, trend.codeRome, trend.romeLabel, trend.region, 
                 trend.regionCode, trend.secteur, trend.date, trend.value, trend.valueLabel, metadata]
            );
            
            safeLog('debug', 'MarketTrends: Created new trend', {
                type: trend.type, regionCode: trend.regionCode, codeRome: trend.codeRome
            });
            
            return { record: result.rows[0], action: 'created' };
        }
    } catch (error) {
        safeLog('error', 'MarketTrends: Failed to store trend', {
            error: error.message,
            trendType: trend?.type,
            regionCode: trend?.regionCode,
            codeRome: trend?.codeRome
        });
        
        // Don't throw - return error info instead to allow collection to continue
        return { 
            error: error.message, 
            action: 'failed',
            trend: {
                type: trend?.type,
                regionCode: trend?.regionCode,
                codeRome: trend?.codeRome
            }
        };
    }
}

/**
 * Collect all market trends for IT jobs
 * Uses the correct API endpoints per OpenAPI spec
 * @param {Object} options - Collection options
 * @param {Function} options.onTrendCollected - Callback for immediate storage
 */
async function collectMarketTrends(options = {}) {
    const onTrendCollected = options.onTrendCollected || null;
    const collectionDate = new Date().toISOString().split('T')[0];
    
    // Calculate last complete quarter once for all API calls
    const { dateDeb, dateFin, quarter } = getLastCompleteQuarter();
    
    // Only accumulate trends in memory if no callback is provided
    // This prevents heap overflow when collecting large datasets
    const trends = onTrendCollected ? null : [];
    let savedCount = 0;
    let criticalError = null;
    let batchCount = 0;
    const BATCH_SIZE = 50; // Trigger memory cleanup every 50 records
    
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    
    // Helper to trigger garbage collection and log memory usage
    const cleanupMemory = () => {
        batchCount++;
        if (batchCount % BATCH_SIZE === 0) {
            // Force garbage collection if available (requires --expose-gc flag)
            if (global.gc) {
                global.gc();
            }
            const memUsage = process.memoryUsage();
            safeLog('debug', 'MarketTrends: Memory checkpoint', {
                batchCount,
                heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024),
                heapTotalMB: Math.round(memUsage.heapTotal / 1024 / 1024)
            });
        }
    };
    
    // Load IS/IT métiers from RomeMetiers table (filtered by M18 family)
    let itRomeCodes = [];
    let romeLabelsMap = {};
    try {
        const metiers = await getStoredMetiers();
        // Filter métiers by M18 family (Systèmes d'information et de télécommunication)
        const itMetiers = metiers.filter(m => m.CodeRome?.startsWith(IT_FAMILLE_CODE));
        itRomeCodes = itMetiers.map(m => m.CodeRome);
        romeLabelsMap = itMetiers.reduce((acc, m) => {
            if (m.CodeRome && m.Libelle) {
                acc[m.CodeRome] = m.Libelle;
            }
            return acc;
        }, {});
        safeLog('info', 'MarketTrends: Loaded IS/IT ROME codes (M18 family)', { 
            count: itRomeCodes.length,
            codes: itRomeCodes 
        });
    } catch (error) {
        safeLog('error', 'MarketTrends: Failed to load IS/IT métiers, cannot proceed', { error: error.message });
        throw new Error('Cannot collect trends without IS/IT métiers. Please run métiers collection first.');
    }
    
    if (itRomeCodes.length === 0) {
        throw new Error('No IS/IT métiers found (M18 family). Please run métiers collection first.');
    }
    
    safeLog('info', 'MarketTrends: Starting collection', {
        quarter,
        dateDeb,
        dateFin,
        regionsCount: FRENCH_REGIONS.length,
        romeCodesCount: itRomeCodes.length
    });

    // Helper to get ROME label
    const getRomeLabel = (codeRome) => romeLabelsMap[codeRome] || null;

    // Helper to prepare metadata for storage (keeps full data, adds romeLabel)
    // PostgreSQL JSONB handles large objects efficiently, no need to truncate
    const prepareMetadata = (data, codeRome) => {
        if (!data) return null;
        
        // Return full API response with added romeLabel
        // Spread operator is more memory-efficient than JSON.parse(JSON.stringify())
        return {
            ...data,
            romeLabel: romeLabelsMap[codeRome] || null
        };
    };

    // Helper to convert value to number (handles strings and numbers)
    const toNumber = (val) => {
        if (val === null || val === undefined) return null;
        if (typeof val === 'number') return val;
        if (typeof val === 'string') {
            const parsed = parseFloat(val);
            return isNaN(parsed) ? null : parsed;
        }
        return null;
    };
    
    // Helper to extract value from API response
    // For count types (demandeur, offre, embauche): SUM all categories (A, B, C, etc.)
    // For index types (tension, dynamique): take FIRST value only
    const extractValue = (data, shouldSum = true) => {
        if (!data) return null;
        
        if (data.listeValeursParPeriode?.length) {
            if (shouldSum) {
                // SUM all values (for demandeur, offre, embauche - each entry is a category)
                let total = 0;
                let hasValue = false;
                
                for (const periode of data.listeValeursParPeriode) {
                    const rawValue = periode.valeurPrincipaleNombre 
                        ?? periode.valeurPrincipaleMontant 
                        ?? periode.valeurPrincipaleTaux
                        ?? periode.valeur 
                        ?? periode.nombre
                        ?? null;
                    const value = toNumber(rawValue);
                    if (value !== null) {
                        total += value;
                        hasValue = true;
                    }
                }
                
                if (hasValue) return total;
            } else {
                // Take FIRST value only (for tension, dynamique_emploi - single indicator)
                const firstPeriode = data.listeValeursParPeriode[0];
                const rawValue = firstPeriode.valeurPrincipaleNombre 
                    ?? firstPeriode.valeurPrincipaleMontant 
                    ?? firstPeriode.valeurPrincipaleTaux
                    ?? firstPeriode.valeur 
                    ?? firstPeriode.nombre
                    ?? null;
                const value = toNumber(rawValue);
                if (value !== null) return value;
            }
            
            // Log first periode structure for debugging
            safeLog('debug', 'MarketTrends: listeValeursParPeriode found but no numeric values', {
                firstPeriodeKeys: Object.keys(data.listeValeursParPeriode[0] || {}),
                firstPeriode: JSON.stringify(data.listeValeursParPeriode[0]).substring(0, 500)
            });
        }
        
        // Try direct value fields at root level
        const rootValue = toNumber(data.valeurPrincipaleNombre) 
            ?? toNumber(data.valeurPrincipaleMontant) 
            ?? toNumber(data.valeurPrincipaleTaux) 
            ?? toNumber(data.valeur) 
            ?? toNumber(data.nombre) 
            ?? toNumber(data.total) 
            ?? toNumber(data.count);
        
        if (rootValue !== null) return rootValue;
        
        // Log for debugging if no value found
        safeLog('warn', 'MarketTrends: No value found in API response', { 
            keys: Object.keys(data),
            hasListeValeursParPeriode: !!data.listeValeursParPeriode,
            sampleData: JSON.stringify(data).substring(0, 500)
        });
        
        return null;
    };
    
    // Wrapper for sum types (demandeur, offre, embauche, demandeur_entrant)
    const extractSumValue = (data) => extractValue(data, true);
    
    // Wrapper for single value types (tension, dynamique_emploi)
    const extractSingleValue = (data) => extractValue(data, false);
    
    // Helper to extract salary value - prioritizes SAL3 (average salary all levels)
    // Falls back to average of all salary values if SAL3 not found
    const extractSalaireValue = (data) => {
        if (!data) return null;
        
        // Salary API returns: listeValeursParPeriode[].salaireValeurMontant[]
        // Each salaireValeurMontant has: codeNomenclature (SAL1/SAL2/SAL3), valeurPrincipaleMontant
        // SAL1 = débutant, SAL2 = expérimenté, SAL3 = moyen (tous niveaux)
        
        const allSalaires = [];
        let sal3Value = null;
        
        if (data.listeValeursParPeriode?.length) {
            for (const periode of data.listeValeursParPeriode) {
                if (periode.salaireValeurMontant?.length) {
                    for (const sv of periode.salaireValeurMontant) {
                        const montant = toNumber(sv.valeurPrincipaleMontant);
                        if (montant !== null) {
                            allSalaires.push(montant);
                            // Prioritize SAL3 (average salary all levels/experiences)
                            if (sv.codeNomenclature === 'SAL3') {
                                sal3Value = montant;
                            }
                        }
                    }
                }
            }
        }
        
        // Return SAL3 if found, otherwise return average of all salaries
        if (sal3Value !== null) return sal3Value;
        if (allSalaires.length > 0) {
            return Math.round(allSalaires.reduce((a, b) => a + b, 0) / allSalaires.length);
        }
        
        // Fallback to generic extraction
        return extractValue(data);
    };
    
    // Helper to extract value label from API response
    const extractValueLabel = (data) => {
        if (!data) return null;
        
        // Try root level first
        if (data.libIndicateur) return data.libIndicateur;
        if (data.libelle) return data.libelle;
        if (data.label) return data.label;
        
        // Try inside listeValeursParPeriode
        if (data.listeValeursParPeriode?.length > 0) {
            const periode = data.listeValeursParPeriode[0];
            if (periode.libIndicateur) return periode.libIndicateur;
            if (periode.libelle) return periode.libelle;
            if (periode.libPeriode) return periode.libPeriode;
        }
        
        // Try libTypeValeur or other common fields
        if (data.libTypeValeur) return data.libTypeValeur;
        if (data.libelleIndicateur) return data.libelleIndicateur;
        
        return null;
    };

    // 1. Collect tensions (recruitment difficulties) by ROME code and region
    safeLog('info', 'MarketTrends: Collecting tensions (PERSP_2)...');
    for (const rome of itRomeCodes) {
        if (criticalError) break;
        
        for (const region of FRENCH_REGIONS) {
            if (criticalError) break;
            
            try {
                await delay(350);
                const data = await getStatTensions({
                    codeRome: rome,
                    codeTerritoire: region.code
                });
                
                const trend = {
                    date: collectionDate,
                    type: 'tension',
                    codeRome: rome,
                    romeLabel: getRomeLabel(rome),
                    region: region.name,
                    regionCode: region.code,
                    value: extractSingleValue(data),
                    valueLabel: extractValueLabel(data),
                    metadata: prepareMetadata(data, rome)
                };
                
                if (onTrendCollected) {
                    await onTrendCollected(trend);
                    savedCount++;
                    cleanupMemory();
                } else {
                    trends.push(trend);
                }
            } catch (error) {
                if (error.response?.status === 403 || error.response?.status === 401) {
                    criticalError = `API access denied (${error.response.status})`;
                    break;
                }
                safeLog('warn', 'MarketTrends: Failed to collect tension', {
                    rome, region: region.name, error: error.message
                });
            }
        }
    }

    // 2. Collect salaries by ROME code (national level)
    safeLog('info', 'MarketTrends: Collecting salaries (SAL_3)...');
    for (const rome of itRomeCodes) {
        if (criticalError) break;
        
        try {
            await delay(350);
            const data = await getStatSalaires({ codeRome: rome });
            
            const trend = {
                date: collectionDate,
                type: 'salaire',
                codeRome: rome,
                romeLabel: getRomeLabel(rome),
                value: extractSalaireValue(data), // Use SAL3 (average all levels) for salaries
                valueLabel: extractValueLabel(data),
                metadata: prepareMetadata(data, rome)
            };
            
            if (onTrendCollected) {
                await onTrendCollected(trend);
                savedCount++;
                cleanupMemory();
            } else {
                trends.push(trend);
            }
        } catch (error) {
            if (error.response?.status === 403 || error.response?.status === 401) {
                criticalError = `API access denied (${error.response.status})`;
                break;
            }
            safeLog('warn', 'MarketTrends: Failed to collect salaire', {
                rome, error: error.message
            });
        }
    }

    // 3. Collect employment dynamics by region (DYN_1) - Using dataemploi.francetravail.fr API
    let dynSkippedCount = 0;
    let dynSuccessCount = 0;
    safeLog('info', 'MarketTrends: Collecting employment dynamics (DYN_1) via dataemploi API...', {
        totalRegions: FRENCH_REGIONS.length
    });
    for (const region of FRENCH_REGIONS) {
        if (criticalError) break;
        
        try {
            await delay(350);
            // Use dataemploi API with MOYENNE activity (general employment dynamics)
            let data = await getStatDynamiqueEmploi({ 
                codeTerritoire: region.code,
                codeTypeTerritoire: 'REG',
                codeTypeActivite: 'MOYENNE',
                codeActivite: 'MOYENNE',
                codeTypePeriode: 'TRIMESTRE',
                dernierePeriode: true,
                sansCaracteristiques: true
            });
            
            // Skip if API returned null (endpoint unavailable)
            if (!data) {
                dynSkippedCount++;
                safeLog('debug', 'MarketTrends: DYN_1 no data for region', {
                    region: region.name,
                    regionCode: region.code
                });
                continue;
            }
            
            // Extract value from dataemploi response format
            // Response format: { listeValeursParPeriode: [{ valeurPrincipaleNombre: 1, ... }] }
            const extractDynamiqueValue = (apiData) => {
                if (!apiData) return null;
                
                // Primary: listeValeursParPeriode (main format from dataemploi API)
                if (apiData.listeValeursParPeriode?.length > 0) {
                    const periode = apiData.listeValeursParPeriode[0];
                    // Try all possible value fields in order of priority
                    if (periode.valeurPrincipaleNombre !== undefined) return periode.valeurPrincipaleNombre;
                    if (periode.valeurPrincipaleMontant !== undefined) return periode.valeurPrincipaleMontant;
                    if (periode.valeurPrincipaleTaux !== undefined) return periode.valeurPrincipaleTaux;
                    if (periode.valeur !== undefined) return periode.valeur;
                    if (periode.indicateur !== undefined) return periode.indicateur;
                }
                
                // Fallback: root level fields
                if (apiData.valeurPrincipaleNombre !== undefined) return apiData.valeurPrincipaleNombre;
                if (apiData.valeur !== undefined) return apiData.valeur;
                if (apiData.indicateur !== undefined) return apiData.indicateur;
                if (apiData.tauxEvolution !== undefined) return apiData.tauxEvolution;
                
                return null;
            };
            
            const extractDynamiqueLabel = (apiData) => {
                if (!apiData) return null;
                
                // Try root level first
                if (apiData.libIndicateur) return apiData.libIndicateur;
                if (apiData.libelle) return apiData.libelle;
                
                // Try inside listeValeursParPeriode
                if (apiData.listeValeursParPeriode?.length > 0) {
                    const periode = apiData.listeValeursParPeriode[0];
                    if (periode.libPeriode) return `Dynamique emploi - ${periode.libPeriode}`;
                    if (periode.libTerritoire) return `Dynamique emploi - ${periode.libTerritoire}`;
                }
                
                return 'Dynamique de l\'emploi';
            };
            
            const trend = {
                date: collectionDate,
                type: 'dynamique_emploi',
                region: region.name,
                regionCode: region.code,
                value: extractDynamiqueValue(data),
                valueLabel: extractDynamiqueLabel(data),
                metadata: prepareMetadata(data, null)
            };
            
            // Explicit cleanup of API response
            data = null;
            
            if (onTrendCollected) {
                await onTrendCollected(trend);
                savedCount++;
                dynSuccessCount++;
                cleanupMemory();
            } else {
                trends.push(trend);
                dynSuccessCount++;
            }
        } catch (error) {
            if (error.response?.status === 403 || error.response?.status === 401) {
                criticalError = `API access denied (${error.response.status})`;
                break;
            }
            safeLog('warn', 'MarketTrends: Failed to collect dynamique', {
                region: region.name, error: error.message
            });
        }
    }
    
    // Log DYN_1 summary
    safeLog('info', 'MarketTrends: DYN_1 collection summary', {
        totalRegions: FRENCH_REGIONS.length,
        success: dynSuccessCount,
        skipped: dynSkippedCount,
        accountingMatch: (dynSuccessCount + dynSkippedCount) === FRENCH_REGIONS.length ? 'OK' : 'MISMATCH'
    });

    // 4. Collect hiring data by ROME code and region (EMB_1)
    safeLog('info', 'MarketTrends: Collecting hiring data (EMB_1)...');
    for (const rome of itRomeCodes) {
        if (criticalError) break;
        
        for (const region of FRENCH_REGIONS) {
            if (criticalError) break;
            
            try {
                await delay(350);
                const data = await getStatEmbauches({
                    codeRome: rome,
                    codeTerritoire: region.code,
                    dateDeb,
                    dateFin
                });
                
                const trend = {
                    date: collectionDate,
                    type: 'embauche',
                    codeRome: rome,
                    romeLabel: getRomeLabel(rome),
                    region: region.name,
                    regionCode: region.code,
                    value: extractSumValue(data),
                    valueLabel: extractValueLabel(data),
                    metadata: prepareMetadata(data, rome)
                };
                
                if (onTrendCollected) {
                    await onTrendCollected(trend);
                    savedCount++;
                    cleanupMemory();
                } else {
                    trends.push(trend);
                }
            } catch (error) {
                if (error.response?.status === 403 || error.response?.status === 401) {
                    criticalError = `API access denied (${error.response.status})`;
                    break;
                }
                safeLog('warn', 'MarketTrends: Failed to collect embauche', {
                    rome, region: region.name, error: error.message
                });
            }
        }
    }

    // 5. Collect job offers by ROME code and region (OFF_1)
    safeLog('info', 'MarketTrends: Collecting job offers (OFF_1)...');
    for (const rome of itRomeCodes) {
        if (criticalError) break;
        
        for (const region of FRENCH_REGIONS) {
            if (criticalError) break;
            
            try {
                await delay(350);
                const data = await getStatOffres({
                    codeRome: rome,
                    codeTerritoire: region.code,
                    dateDeb,
                    dateFin
                });
                
                const trend = {
                    date: collectionDate,
                    type: 'offre',
                    codeRome: rome,
                    romeLabel: getRomeLabel(rome),
                    region: region.name,
                    regionCode: region.code,
                    value: extractSumValue(data),
                    valueLabel: extractValueLabel(data),
                    metadata: prepareMetadata(data, rome)
                };
                
                if (onTrendCollected) {
                    await onTrendCollected(trend);
                    savedCount++;
                    cleanupMemory(); // Ajouté ici
                } else {
                    trends.push(trend);
                }
            } catch (error) {
                if (error.response?.status === 403 || error.response?.status === 401) {
                    criticalError = `API access denied (${error.response.status})`;
                    break;
                }
                safeLog('warn', 'MarketTrends: Failed to collect offre', {
                    rome, region: region.name, error: error.message
                });
            }
        }
    }

    // 6. Collect job seekers by ROME code and region (DE_1)
    safeLog('info', 'MarketTrends: Collecting job seekers (DE_1)...');
    for (const rome of itRomeCodes) {
        if (criticalError) break;
        
        for (const region of FRENCH_REGIONS) {
            if (criticalError) break;
            
            try {
                await delay(350);
                const data = await getStatDemandeurs({
                    codeRome: rome,
                    codeTerritoire: region.code,
                    dateDeb,
                    dateFin
                });
                
                const trend = {
                    date: collectionDate,
                    type: 'demandeur',
                    codeRome: rome,
                    romeLabel: getRomeLabel(rome),
                    region: region.name,
                    regionCode: region.code,
                    value: extractSumValue(data),
                    valueLabel: extractValueLabel(data),
                    metadata: prepareMetadata(data, rome)
                };
                
                if (onTrendCollected) {
                    await onTrendCollected(trend);
                    savedCount++;
                    cleanupMemory();
                } else {
                    trends.push(trend);
                }
            } catch (error) {
                if (error.response?.status === 403 || error.response?.status === 401) {
                    criticalError = `API access denied (${error.response.status})`;
                    break;
                }
                safeLog('warn', 'MarketTrends: Failed to collect demandeur', {
                    rome, region: region.name, error: error.message
                });
            }
        }
    }

    // 7. Collect new job seekers by ROME code and region (DE_5)
    safeLog('info', 'MarketTrends: Collecting new job seekers (DE_5)...');
    for (const rome of itRomeCodes) {
        if (criticalError) break;
        
        for (const region of FRENCH_REGIONS) {
            if (criticalError) break;
            
            try {
                await delay(350);
                const data = await getStatDemandeursEntrants({
                    codeRome: rome,
                    codeTerritoire: region.code,
                    dateDeb,
                    dateFin
                });
                
                const trend = {
                    date: collectionDate,
                    type: 'demandeur_entrant',
                    codeRome: rome,
                    romeLabel: getRomeLabel(rome),
                    region: region.name,
                    regionCode: region.code,
                    value: extractSumValue(data),
                    valueLabel: extractValueLabel(data),
                    metadata: prepareMetadata(data, rome)
                };
                
                if (onTrendCollected) {
                    await onTrendCollected(trend);
                    savedCount++;
                    cleanupMemory();
                } else {
                    trends.push(trend);
                }
            } catch (error) {
                if (error.response?.status === 403 || error.response?.status === 401) {
                    criticalError = `API access denied (${error.response.status})`;
                    break;
                }
                safeLog('warn', 'MarketTrends: Failed to collect demandeur_entrant', {
                    rome, region: region.name, error: error.message
                });
            }
        }
    }

    if (criticalError) {
        throw new Error(criticalError);
    }

    const totalCount = onTrendCollected ? savedCount : trends.length;
    safeLog('info', 'MarketTrends: Collection completed', {
        totalTrends: totalCount,
        savedImmediately: savedCount
    });

    // Return empty array if using callback (data already saved), otherwise return accumulated trends
    return onTrendCollected ? [] : trends;
}

/**
 * Get stored market trends with server-side filtering and pagination
 * Uses in-memory cache for instant response
 * @param {Object} options - Query options
 * @param {string} options.type - Filter by trend type
 * @param {string} options.codeRome - Filter by ROME code
 * @param {string} options.regionCode - Filter by region code
 * @param {string} options.sortField - Field to sort by
 * @param {string} options.sortDirection - 'asc' or 'desc'
 * @param {number} options.page - Page number (1-indexed)
 * @param {number} options.pageSize - Number of records per page
 */
async function getStoredTrends(options = {}) {
    try {
        const {
            type,
            codeRome,
            regionCode,
            sortField = 'Date',
            sortDirection = 'desc',
            page = 1,
            pageSize = 20
        } = options;

        // Ensure cache is loaded
        const allTrends = await getTrendsCache();
        
        // Apply filters in memory (very fast)
        let filtered = allTrends;
        
        if (type) {
            filtered = filtered.filter(t => t.Type === type);
        }
        if (codeRome) {
            filtered = filtered.filter(t => t.CodeRome === codeRome);
        }
        if (regionCode) {
            filtered = filtered.filter(t => t.RegionCode === regionCode);
        }
        
        // Sort in memory
        const sortDir = sortDirection === 'asc' ? 1 : -1;
        filtered.sort((a, b) => {
            const aVal = a[sortField] || '';
            const bVal = b[sortField] || '';
            if (aVal < bVal) return -sortDir;
            if (aVal > bVal) return sortDir;
            return 0;
        });
        
        // Paginate
        const parsedPage = parseInt(page) || 1;
        const parsedPageSize = parseInt(pageSize) || 20;
        const totalCount = filtered.length;
        const totalPages = Math.ceil(totalCount / parsedPageSize);
        const startIndex = (parsedPage - 1) * parsedPageSize;
        const paginatedTrends = filtered.slice(startIndex, startIndex + parsedPageSize);
        
        // Fetch metadata only for the paginated records (on-demand)
        const trendIds = paginatedTrends.map(t => t.id);
        const metadataMap = await fetchMetadataForIds(trendIds);
        
        // Merge metadata into trends
        const trendsWithMetadata = paginatedTrends.map(t => ({
            ...t,
            Metadata: metadataMap[t.id] || null
        }));

        return {
            trends: trendsWithMetadata,
            totalCount,
            pagination: {
                page: parsedPage,
                pageSize: parsedPageSize,
                totalCount,
                totalPages
            }
        };
    } catch (error) {
        safeLog('error', 'MarketTrends: Failed to get stored trends', { error: error.message });
        throw error;
    }
}

/**
 * Get stored trends WITHOUT metadata (lightweight version for map)
 * Uses direct PostgreSQL query - NO cache, NO metadata
 * Optimized for large datasets with server-side filtering
 * @param {Object} options - Filter options
 */
async function getStoredTrendsLight(options = {}) {
    try {
        const startTime = Date.now();
        const {
            type,
            codeRome,
            regionCode
        } = options;

        // Build dynamic WHERE clause for PostgreSQL
        const conditions = [];
        const params = [];
        let paramIndex = 1;
        
        if (type) {
            conditions.push(`type = $${paramIndex++}`);
            params.push(type);
        }
        if (codeRome) {
            conditions.push(`code_rome = $${paramIndex++}`);
            params.push(codeRome);
        }
        if (regionCode) {
            conditions.push(`region_code = $${paramIndex++}`);
            params.push(regionCode);
        }
        
        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        
        // Direct PostgreSQL query - NO metadata column (saves memory)
        // Uses indexes for fast filtering
        const query = `
            SELECT id, type, code_rome, rome_label, region, region_code, date, value, value_label
            FROM ${MARKET_TRENDS_TABLE}
            ${whereClause}
            ORDER BY date DESC
        `;
        
        const result = await dbQuery(query, params);
        
        const trends = result.rows.map(record => ({
            id: record.id,
            Type: record.type,
            CodeRome: record.code_rome,
            RomeLabel: record.rome_label,
            Region: record.region,
            RegionCode: record.region_code,
            Date: record.date,
            Value: record.value,
            ValueLabel: record.value_label
            // NO Metadata - not needed for map
        }));
        
        const duration = Date.now() - startTime;
        safeLog('debug', `MarketTrends: Light query completed in ${duration}ms`, {
            count: trends.length,
            filters: { type, codeRome, regionCode }
        });
        
        return {
            trends,
            totalCount: trends.length
        };
    } catch (error) {
        safeLog('error', 'MarketTrends: Failed to get stored trends (light)', { error: error.message });
        throw error;
    }
}

/**
 * Get stored trends WITH metadata for map view
 * Includes full metadata for hover display
 * @param {Object} options - Filter options
 */
async function getStoredTrendsWithMetadata(options = {}) {
    try {
        const startTime = Date.now();
        const {
            type,
            codeRome,
            regionCode
        } = options;

        // Build dynamic WHERE clause for PostgreSQL
        const conditions = [];
        const params = [];
        let paramIndex = 1;
        
        if (type) {
            conditions.push(`type = $${paramIndex++}`);
            params.push(type);
        }
        if (codeRome) {
            conditions.push(`code_rome = $${paramIndex++}`);
            params.push(codeRome);
        }
        if (regionCode) {
            conditions.push(`region_code = $${paramIndex++}`);
            params.push(regionCode);
        }
        
        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        
        // Direct PostgreSQL query - WITH metadata column
        const query = `
            SELECT id, type, code_rome, rome_label, region, region_code, date, value, value_label, metadata
            FROM ${MARKET_TRENDS_TABLE}
            ${whereClause}
            ORDER BY date DESC
        `;
        
        const result = await dbQuery(query, params);
        
        const trends = result.rows.map(record => ({
            id: record.id,
            Type: record.type,
            CodeRome: record.code_rome,
            RomeLabel: record.rome_label,
            Region: record.region,
            RegionCode: record.region_code,
            Date: record.date,
            Value: record.value,
            ValueLabel: record.value_label,
            Metadata: record.metadata // Include metadata for hover display
        }));
        
        const duration = Date.now() - startTime;
        safeLog('debug', `MarketTrends: Full query with metadata completed in ${duration}ms`, {
            count: trends.length,
            filters: { type, codeRome, regionCode }
        });
        
        return {
            trends,
            totalCount: trends.length
        };
    } catch (error) {
        safeLog('error', 'MarketTrends: Failed to get stored trends with metadata', { error: error.message });
        throw error;
    }
}

/**
 * Get metadata for a specific trend by ID
 * Used for on-demand loading when hovering over a trend in the map
 * @param {string} trendId - The trend ID
 */
async function getTrendMetadata(trendId) {
    try {
        const result = await dbQuery(
            `SELECT id, type, code_rome, rome_label, region, region_code, date, value, value_label, metadata
             FROM ${MARKET_TRENDS_TABLE}
             WHERE id = $1`,
            [trendId]
        );
        
        if (result.rows.length === 0) {
            return null;
        }
        
        const record = result.rows[0];
        return {
            id: record.id,
            Type: record.type,
            CodeRome: record.code_rome,
            RomeLabel: record.rome_label,
            Region: record.region,
            RegionCode: record.region_code,
            Date: record.date,
            Value: record.value,
            ValueLabel: record.value_label,
            Metadata: record.metadata
        };
    } catch (error) {
        safeLog('error', 'MarketTrends: Failed to get trend metadata', { error: error.message, trendId });
        throw error;
    }
}

// ============================================
// OPTIMIZED DATA CACHE SYSTEM
// ============================================

// Lightweight cache for filtering/pagination (NO metadata - too heavy)
let trendsLightCache = null;
let trendsCacheTime = 0;
const TRENDS_CACHE_TTL = 10 * 60 * 1000; // 10 minutes
const TRENDS_CACHE_MAX_SIZE = 100000; // Max records (light cache is ~5KB per record)

// Derived caches (computed from light cache)
let filterOptionsCache = null;
let summaryCache = null;

/**
 * Load lightweight trends cache (NO metadata for memory efficiency)
 * Metadata is fetched on-demand for displayed records only
 */
async function loadTrendsCache() {
    const startTime = Date.now();
    safeLog('info', 'MarketTrends: Loading lightweight trends cache (no metadata)...');
    
    // Only load essential fields - NO metadata (saves ~90% memory)
    const result = await dbQuery(
        `SELECT id, type, code_rome, rome_label, region, region_code, date, value, value_label
         FROM ${MARKET_TRENDS_TABLE} ORDER BY date DESC`
    );
    
    const allTrends = result.rows.map(record => ({
        id: record.id,
        Type: record.type,
        CodeRome: record.code_rome,
        RomeLabel: record.rome_label,
        Region: record.region,
        RegionCode: record.region_code,
        Date: record.date,
        Value: record.value,
        ValueLabel: record.value_label
        // NO Metadata here - fetched on demand
    }));
    
    // Update cache
    if (allTrends.length <= TRENDS_CACHE_MAX_SIZE) {
        trendsLightCache = allTrends;
        trendsCacheTime = Date.now();
        
        // Compute derived caches
        computeFilterOptions();
        await computeSummary();
        
        const duration = Date.now() - startTime;
        const memUsage = process.memoryUsage();
        safeLog('info', `MarketTrends: Light cache loaded - ${allTrends.length} records in ${duration}ms`, {
            heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024)
        });
    } else {
        safeLog('warn', `MarketTrends: Limiting cache - ${allTrends.length} records exceeds limit`);
        trendsLightCache = allTrends.slice(0, TRENDS_CACHE_MAX_SIZE);
        trendsCacheTime = Date.now();
        computeFilterOptions();
        await computeSummary();
    }
    
    return allTrends;
}

/**
 * Fetch metadata for specific trend IDs (on-demand)
 * @param {string[]} ids - Array of trend IDs to fetch metadata for
 * @returns {Object} - Map of id -> metadata
 */
async function fetchMetadataForIds(ids) {
    if (!ids || ids.length === 0) return {};
    
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
    const result = await dbQuery(
        `SELECT id, metadata FROM ${MARKET_TRENDS_TABLE} WHERE id IN (${placeholders})`,
        ids
    );
    
    const metadataMap = {};
    result.rows.forEach(row => {
        metadataMap[row.id] = row.metadata;
    });
    
    return metadataMap;
}

/**
 * Get trends cache (load if needed)
 */
async function getTrendsCache() {
    if (!trendsLightCache || (Date.now() - trendsCacheTime) > TRENDS_CACHE_TTL) {
        await loadTrendsCache();
    }
    return trendsLightCache;
}

/**
 * Invalidate cache (call after collection)
 */
function invalidateTrendsCache() {
    trendsLightCache = null;
    trendsCacheTime = 0;
    filterOptionsCache = null;
    summaryCache = null;
    safeLog('info', 'MarketTrends: Cache invalidated');
}

// Periodic cache cleanup - auto-expire if not accessed for 2x TTL
const trendsCacheCleanupInterval = setInterval(() => {
    if (trendsCacheTime && Date.now() - trendsCacheTime > TRENDS_CACHE_TTL * 2) {
        trendsLightCache = null;
        filterOptionsCache = null;
        summaryCache = null;
        trendsCacheTime = 0;
        safeLog('debug', 'MarketTrends: Cache auto-expired (inactive)');
    }
}, TRENDS_CACHE_TTL);

/**
 * Destroy trends cache and cleanup interval (for graceful shutdown)
 */
function destroyTrendsCache() {
    if (trendsCacheCleanupInterval) {
        clearInterval(trendsCacheCleanupInterval);
    }
    trendsLightCache = null;
    filterOptionsCache = null;
    summaryCache = null;
    trendsCacheTime = 0;
    safeLog('info', 'MarketTrends: Cache destroyed');
}

/**
 * Get trends cache statistics
 */
function getTrendsCacheStats() {
    return {
        size: trendsLightCache?.length || 0,
        maxSize: TRENDS_CACHE_MAX_SIZE,
        ttlMinutes: TRENDS_CACHE_TTL / (60 * 1000),
        ageMs: trendsCacheTime ? Date.now() - trendsCacheTime : null,
        hasFilterOptions: !!filterOptionsCache,
        hasSummary: !!summaryCache
    };
}

/**
 * Compute filter options from cache
 */
function computeFilterOptions() {
    if (!trendsLightCache) return;
    
    const types = new Set();
    const regions = new Map();
    const romeCodes = new Set();
    
    trendsLightCache.forEach(t => {
        if (t.Type) types.add(t.Type);
        if (t.RegionCode && t.Region) regions.set(t.RegionCode, t.Region);
        if (t.CodeRome) romeCodes.add(t.CodeRome);
    });
    
    filterOptionsCache = {
        types: Array.from(types).sort(),
        regions: Array.from(regions.entries())
            .map(([code, name]) => ({ code, name }))
            .sort((a, b) => a.name.localeCompare(b.name)),
        romeCodes: Array.from(romeCodes).sort()
    };
}

/**
 * Compute summary from cache
 * Calculates aggregated statistics (sums and averages) by type
 * For salaries, fetches metadata to calculate average SAL3 (all experience levels)
 */
async function computeSummary() {
    if (!trendsLightCache) return;
    
    const byType = {};
    const regions = new Set();
    const romeCodes = new Set();
    const salaireIds = [];  // Collect salary record IDs for metadata fetch
    
    // Types that should be summed (counts)
    const sumTypes = ['embauche', 'demandeur', 'demandeur_entrant', 'offre'];
    
    trendsLightCache.forEach(t => {
        if (t.Type) {
            if (!byType[t.Type]) {
                byType[t.Type] = { 
                    count: 0, 
                    latestDate: null,
                    totalValue: 0,
                    valueCount: 0
                };
            }
            byType[t.Type].count++;
            if (!byType[t.Type].latestDate || t.Date > byType[t.Type].latestDate) {
                byType[t.Type].latestDate = t.Date;
            }
            
            // Collect salary IDs for metadata-based calculation
            if (t.Type === 'salaire') {
                salaireIds.push(t.id);
            } else {
                // Accumulate values for statistics (non-salary types)
                // Convert to number explicitly (value may be string from database)
                const numValue = t.Value !== null && t.Value !== undefined ? parseFloat(t.Value) : null;
                if (numValue !== null && !isNaN(numValue)) {
                    byType[t.Type].totalValue += numValue;
                    byType[t.Type].valueCount++;
                }
            }
        }
        if (t.Region) regions.add(t.Region);
        if (t.CodeRome) romeCodes.add(t.CodeRome);
    });
    
    // For salaries: fetch metadata and calculate average SAL3 (all experience levels)
    // Each salary record = 1 ROME code, we take only ONE SAL3 per record (first found)
    if (salaireIds.length > 0 && byType['salaire']) {
        try {
            const metadataMap = await fetchMetadataForIds(salaireIds);
            let totalSal3 = 0;
            let sal3Count = 0;
            
            for (const id of salaireIds) {
                const metadata = metadataMap[id];
                let sal3Found = null;
                
                // Find first SAL3 value in this record's metadata
                // API may use either listeValeursParPeriode or valeursParPeriode
                const periodes = metadata?.listeValeursParPeriode || metadata?.valeursParPeriode;
                if (periodes?.length) {
                    outerLoop:
                    for (const periode of periodes) {
                        if (periode.salaireValeurMontant?.length) {
                            for (const sv of periode.salaireValeurMontant) {
                                // SAL3 = salaire moyen tous niveaux d'expérience
                                if (sv.codeNomenclature === 'SAL3' && sv.valeurPrincipaleMontant !== undefined) {
                                    const montant = parseFloat(sv.valeurPrincipaleMontant);
                                    if (!isNaN(montant)) {
                                        sal3Found = montant;
                                        break outerLoop;  // Take only first SAL3 per record
                                    }
                                }
                            }
                        }
                    }
                }
                
                // Add this record's SAL3 to total (one per record)
                if (sal3Found !== null) {
                    totalSal3 += sal3Found;
                    sal3Count++;
                }
            }
            
            if (sal3Count > 0) {
                byType['salaire'].totalValue = totalSal3;
                byType['salaire'].valueCount = sal3Count;
            }
            
            safeLog('debug', `MarketTrends: Salary SAL3 calculation - found ${sal3Count} SAL3 values from ${salaireIds.length} records`);
        } catch (error) {
            safeLog('warn', 'MarketTrends: Failed to fetch salary metadata for summary', { error: error.message });
        }
    }
    
    summaryCache = {
        totalRecords: trendsLightCache.length,
        types: Object.entries(byType).map(([type, data]) => {
            // For sum types: return total sum
            // For average types (indices/rates/salaries): return average
            const isSumType = sumTypes.includes(type);
            let aggregatedValue = 0;
            if (data.valueCount > 0 && data.totalValue !== null && !isNaN(data.totalValue)) {
                aggregatedValue = isSumType ? data.totalValue : data.totalValue / data.valueCount;
            }
            // Ensure we never return NaN or null
            const roundedValue = Math.round(aggregatedValue * 100) / 100;
            const finalValue = isNaN(roundedValue) ? 0 : roundedValue;
            
            return {
                type,
                count: data.count,
                latestDate: data.latestDate,
                aggregatedValue: finalValue,
                isSumType,
                valueCount: data.valueCount  // Number of records with valid (non-null) values
            };
        }),
        regions: Array.from(regions),
        romeCodes: Array.from(romeCodes)
    };
    
    safeLog('debug', 'MarketTrends: Summary computed', {
        totalRecords: summaryCache.totalRecords,
        typesCount: summaryCache.types.length
    });
}

/**
 * Get unique values for filters (types, regions, rome codes)
 * Uses cache for instant response
 */
async function getTrendFilterOptions() {
    try {
        // Ensure cache is loaded
        await getTrendsCache();
        
        if (filterOptionsCache) {
            safeLog('debug', 'MarketTrends: Returning cached filter options');
            return filterOptionsCache;
        }
        
        // Fallback: compute from scratch if cache failed
        const types = new Set();
        const regions = new Map();
        const romeCodes = new Set();
        
        // Query PostgreSQL for unique values
        const dbResult = await dbQuery(
            `SELECT DISTINCT type, region, region_code, code_rome FROM ${MARKET_TRENDS_TABLE}`
        );
        
        dbResult.rows.forEach(r => {
            if (r.type) types.add(r.type);
            if (r.region_code && r.region) {
                regions.set(r.region_code, r.region);
            }
            if (r.code_rome) romeCodes.add(r.code_rome);
        });
        
        const result = {
            types: Array.from(types).sort(),
            regions: Array.from(regions.entries()).map(([code, name]) => ({ code, name })).sort((a, b) => a.name.localeCompare(b.name)),
            romeCodes: Array.from(romeCodes).sort()
        };
        
        // Update cache
        filterOptionsCache = result;
        filterOptionsCacheTime = Date.now();
        safeLog('info', 'MarketTrends: Cached filter options');
        
        return result;
    } catch (error) {
        safeLog('error', 'MarketTrends: Failed to get filter options', { error: error.message });
        throw error;
    }
}

/**
 * Get trends grouped by type with limited items per type
 * Used when no type filter is selected to show all types with their own sections
 * @param {Object} options - Filter options
 */
async function getStoredTrendsGroupedByType(options = {}) {
    try {
        const {
            codeRome,
            regionCode,
            itemsPerType = 5
        } = options;

        // Ensure cache is loaded
        const allTrends = await getTrendsCache();
        
        // Apply non-type filters
        let filtered = allTrends;
        
        if (codeRome) {
            filtered = filtered.filter(t => t.CodeRome === codeRome);
        }
        if (regionCode) {
            filtered = filtered.filter(t => t.RegionCode === regionCode);
        }
        
        // Group by type
        const byType = {};
        const countsByType = {};
        
        filtered.forEach(t => {
            if (!byType[t.Type]) {
                byType[t.Type] = [];
                countsByType[t.Type] = 0;
            }
            countsByType[t.Type]++;
            // Only keep first N items per type (already sorted by date desc from cache)
            if (byType[t.Type].length < itemsPerType) {
                byType[t.Type].push(t);
            }
        });
        
        // Fetch metadata for all displayed trends
        const allDisplayedIds = Object.values(byType).flat().map(t => t.id);
        const metadataMap = await fetchMetadataForIds(allDisplayedIds);
        
        // Merge metadata into trends
        const groupedWithMetadata = {};
        for (const [type, trends] of Object.entries(byType)) {
            groupedWithMetadata[type] = trends.map(t => ({
                ...t,
                Metadata: metadataMap[t.id] || null
            }));
        }

        return {
            groupedTrends: groupedWithMetadata,
            countsByType,
            totalCount: filtered.length
        };
    } catch (error) {
        safeLog('error', 'MarketTrends: Failed to get grouped trends', { error: error.message });
        throw error;
    }
}

/**
 * Get trends summary using cache for instant response
 */
async function getTrendsSummary() {
    try {
        // Ensure cache is loaded
        await getTrendsCache();
        
        if (summaryCache) {
            safeLog('debug', 'MarketTrends: Returning cached summary');
            return summaryCache;
        }
        
        // Fallback: compute from cache
        await computeSummary();
        return summaryCache;
    } catch (error) {
        safeLog('error', 'MarketTrends: Failed to get summary', { error: error.message });
        throw error;
    }
}

/**
 * Cleanup function for graceful shutdown
 * Clears all caches and releases memory
 */
function cleanupTrendsCache() {
    trendsLightCache = null;
    trendsCacheTime = 0;
    filterOptionsCache = null;
    summaryCache = null;
    // Clear token cache
    marketToken = null;
    marketTokenExpiresAt = 0;
    safeLog('info', 'MarketTrends: Cache cleaned up for shutdown');
}

export {
    getStatEmbauches,
    getStatDynamiqueEmploi,
    getStatTensions,
    getStatSalaires,
    getStatOffres,
    getStatDemandeurs,
    getStatDemandeursEntrants,
    storeTrend,
    collectMarketTrends,
    getStoredTrends,
    getStoredTrendsLight,
    getStoredTrendsWithMetadata,
    getStoredTrendsGroupedByType,
    getTrendMetadata,
    getTrendFilterOptions,
    getTrendsSummary,
    invalidateTrendsCache,
    loadTrendsCache,
    cleanupTrendsCache,
    destroyTrendsCache,
    getTrendsCacheStats
};
