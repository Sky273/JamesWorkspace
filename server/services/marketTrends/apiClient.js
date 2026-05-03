/**
 * Market Trends API Client
 * Handles France Travail "Stats Offres Demandes Emploi" API calls
 * OpenAPI: https://api.francetravail.io/partenaire/stats-offres-demandes-emploi
 * 
 * Required scopes: offresetdemandesemploi api_stats-offres-demandes-emploiv1
 */

import axios from 'axios';
import { safeLog } from '../../utils/logger.backend.js';

// API Base URL
const MARKET_API_BASE = 'https://api.francetravail.io/partenaire/stats-offres-demandes-emploi/v1';
const DATAEMPLOI_API_BASE = 'https://dataemploi.francetravail.fr/emploi/api-statemploi/v1';
const DATAEMPLOI_TOKEN_URL = 'https://dataemploi.francetravail.fr/emploi/token';

// Token management
const FRANCE_TRAVAIL_CLIENT_ID = process.env.FRANCE_TRAVAIL_CLIENT_ID;
const FRANCE_TRAVAIL_CLIENT_SECRET = process.env.FRANCE_TRAVAIL_CLIENT_SECRET;
const FRANCE_TRAVAIL_TOKEN_URL = 'https://entreprise.francetravail.fr/connexion/oauth2/access_token?realm=/partenaire';

let marketToken = null;
let marketTokenExpiresAt = 0;
let marketTokenRequestPromise = null;
let dataEmploiToken = null;
let dataEmploiTokenExpiresAt = 0;
let nationalTensionByRomeCache = null;

// Required scopes per OpenAPI spec
const MARKET_SCOPE = 'offresetdemandesemploi api_stats-offres-demandes-emploiv1';

function createTokenAcquisitionError(error) {
    const wrapped = new Error(`France Travail access token unavailable: ${error.message}`);
    wrapped.cause = error;
    wrapped.response = error.response;
    wrapped.code = error.code;
    wrapped.isFranceTravailTokenError = true;
    return wrapped;
}

/**
 * Get access token for Market Trends API (Stats Offres Demandes Emploi)
 */
async function getMarketAccessToken() {
    // Return cached token if still valid
    if (marketToken && Date.now() < marketTokenExpiresAt - 60000) {
        return marketToken;
    }

    if (!FRANCE_TRAVAIL_CLIENT_ID || !FRANCE_TRAVAIL_CLIENT_SECRET) {
        const error = new Error('France Travail API credentials not configured.');
        error.isFranceTravailTokenError = true;
        throw error;
    }

    if (marketTokenRequestPromise) {
        return marketTokenRequestPromise;
    }

    marketTokenRequestPromise = requestMarketAccessToken();

    try {
        return await marketTokenRequestPromise;
    } finally {
        marketTokenRequestPromise = null;
    }
}

async function requestMarketAccessToken() {
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
        throw createTokenAcquisitionError(error);
    }
}

async function getDataEmploiAccessToken() {
    if (dataEmploiToken && Date.now() < dataEmploiTokenExpiresAt - 60000) {
        return dataEmploiToken;
    }

    const response = await axios.get(DATAEMPLOI_TOKEN_URL, { timeout: 30000 });
    dataEmploiToken = response.data.access_token;
    const expiresIn = response.data.expires_in || 1500;
    dataEmploiTokenExpiresAt = Date.now() + (expiresIn * 1000);
    nationalTensionByRomeCache = null;
    return dataEmploiToken;
}

/**
 * Clear token cache (used during cleanup)
 */
export function clearTokenCache() {
    marketToken = null;
    marketTokenExpiresAt = 0;
    marketTokenRequestPromise = null;
    dataEmploiToken = null;
    dataEmploiTokenExpiresAt = 0;
    nationalTensionByRomeCache = null;
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
export async function getStatEmbauches(params) {
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
export async function getStatDynamiqueEmploi(params) {
    // Use the public dataemploi API (no authentication required)
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
export async function getStatTensions(params) {
    try {
        const tensionByRome = await getNationalTensionsByRome();
        const match = tensionByRome.get(params.codeRome);

        if (!match) {
            return null;
        }

        const principal = match.statsDemandeurOffre?.persp2;
        return {
            datMaj: match.indicateurRetour?.datMaj,
            codeIndicateur: 'PERSP_2',
            codeFamille: 'PERSPECTIVES',
            libIndicateur: principal?.libelleNomenclature || 'Indicateur principal tension',
            codeTypeTerritoire: 'NAT',
            codeTerritoire: 'FR',
            libTerritoire: 'France',
            activite: match.activite,
            statsDemandeurOffre: match.statsDemandeurOffre,
            valeurPrincipaleDecimale: principal?.valPrincDec,
            valeurPrincipaleNombre: principal?.valPrincDec === undefined ? principal?.valPrincPersp : undefined,
            valueLabel: principal?.libelleNomenclature || 'Indicateur principal tension'
        };
    } catch (error) {
        safeLog('error', 'MarketTrends: Failed to get Data Emploi tensions', {
            error: error.message,
            status: error.response?.status
        });
        throw error;
    }
}

async function getNationalTensionsByRome() {
    if (nationalTensionByRomeCache) {
        return nationalTensionByRomeCache;
    }

    const token = await getDataEmploiAccessToken();
    const url = `${DATAEMPLOI_API_BASE}/top/activite/demandeurs-offres-flux/PERSP_2/ROME/NAT/FR?maxResult=5000&tri=DESC`;

    const response = await axios.get(url, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
        },
        timeout: 30000
    });

    nationalTensionByRomeCache = new Map(
        (response.data?.topActivite || [])
            .filter((item) => item?.activite?.codeActivite)
            .map((item) => [item.activite.codeActivite, item])
    );

    safeLog('info', 'MarketTrends: Loaded Data Emploi national tensions', {
        count: nationalTensionByRomeCache.size
    });

    return nationalTensionByRomeCache;
}

/**
 * GET /v1/indicateur/salaire-rome-fap/{codeTypeTerritoire}/{codeTerritoire} (SAL_3)
 * Stats sur les salaires par métier
 */
export async function getStatSalaires(params) {
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
export async function getStatOffres(params) {
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
export async function getStatDemandeurs(params) {
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
export async function getStatDemandeursEntrants(params) {
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
