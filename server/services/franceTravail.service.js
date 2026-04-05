/**
 * France Travail API Service
 * Handles OAuth2 authentication and job offers data collection
 * API Documentation: https://francetravail.io/
 */

import axios from 'axios';
import { 
    FRANCE_TRAVAIL_CLIENT_ID, 
    FRANCE_TRAVAIL_CLIENT_SECRET,
    FRANCE_TRAVAIL_TOKEN_URL,
    FRANCE_TRAVAIL_API_URL
} from '../config/constants.js';
import { createModuleLogger } from '../utils/logger.backend.js';
import {
    isFranceTravailTokenError,
    buildFranceTravailSearchParams,
    normalizeFranceTravailSearchResponse
} from './franceTravail.helpers.js';

// Module logger
const log = createModuleLogger('franceTravail');

// ============================================
// TOKEN MANAGEMENT
// ============================================

let accessToken = null;
let tokenExpiresAt = 0;

function invalidateCachedToken() {
    accessToken = null;
    tokenExpiresAt = 0;
}

async function retryFranceTravailRequest({ error, label, retryFn, isRetried }) {
    if (!isFranceTravailTokenError(error) || isRetried) {
        return { retried: false };
    }

    log.warn(label);
    invalidateCachedToken();
    return {
        retried: true,
        result: await retryFn()
    };
}

/**
 * Get OAuth2 access token from France Travail
 * Token is cached and refreshed when expired
 */
async function getAccessToken() {
    // Return cached token if still valid (with 60s buffer)
    if (accessToken && Date.now() < tokenExpiresAt - 60000) {
        return accessToken;
    }

    if (!FRANCE_TRAVAIL_CLIENT_ID || !FRANCE_TRAVAIL_CLIENT_SECRET) {
        log.error('API credentials not configured');

        throw new Error('France Travail API credentials not configured. Set FRANCE_TRAVAIL_CLIENT_ID and FRANCE_TRAVAIL_CLIENT_SECRET in environment variables.');
    }

    try {
        log.info('Requesting new access token');
        
        const params = new URLSearchParams();
        params.append('grant_type', 'client_credentials');
        params.append('client_id', FRANCE_TRAVAIL_CLIENT_ID);
        params.append('client_secret', FRANCE_TRAVAIL_CLIENT_SECRET);
        // Scopes: offres d'emploi + ROME fiches métiers
        params.append('scope', 'api_offresdemploiv2 o2dsoffre api_rome-fiches-metiersv1 nomenclatureRome');

        const response = await axios.post(FRANCE_TRAVAIL_TOKEN_URL, params, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            timeout: 30000 // 30 second timeout
        });

        accessToken = response.data.access_token;
        // Token typically expires in 1500 seconds (25 minutes)
        const expiresIn = response.data.expires_in || 1500;
        tokenExpiresAt = Date.now() + (expiresIn * 1000);

        log.info('Access token obtained', { expiresIn, scope: response.data.scope });
        return accessToken;
    } catch (error) {
        log.error('Failed to get access token', {
            message: error.message,
            code: error.code,
            status: error.response?.status,
            statusText: error.response?.statusText
        });
        
        // Provide more specific error messages
        if (error.response?.status === 400) {
            throw new Error(`France Travail authentication failed: Invalid credentials or request (400). Check CLIENT_ID and CLIENT_SECRET.`);
        } else if (error.response?.status === 401) {
            throw new Error(`France Travail authentication failed: Unauthorized (401). Credentials may be invalid or expired.`);
        } else if (error.response?.status === 403) {
            throw new Error(`France Travail authentication failed: Forbidden (403). Your application may not have access to this API.`);
        } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
            throw new Error(`France Travail authentication failed: Cannot connect to ${FRANCE_TRAVAIL_TOKEN_URL}`);
        }
        
        throw new Error(`France Travail authentication failed: ${error.message}`);
    }
}

// ============================================
// API CALLS
// ============================================

/**
 * Search job offers with given criteria
 * @param {Object} params - Search parameters
 * @param {string} params.motsCles - Keywords (e.g., "développeur javascript")
 * @param {string} params.codeROME - ROME code for job type
 * @param {string} params.departement - Department code (e.g., "75" for Paris)
 * @param {string} params.region - Region code
 * @param {number} params.range - Range for pagination (e.g., "0-149")
 * @returns {Object} - Search results with offers and aggregates
 */
async function searchOffers(params = {}) {
    const token = await getAccessToken();

    try {
        const queryParams = buildFranceTravailSearchParams(params);

        const url = `${FRANCE_TRAVAIL_API_URL}/offres/search?${queryParams.toString()}`;
        
        log.debug('Searching offers', { url });

        const response = await axios.get(url, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json'
            }
        });

        const normalizedResponse = normalizeFranceTravailSearchResponse(response);

        log.info('Search completed', {
            resultsCount: normalizedResponse.results.length,
            totalCount: normalizedResponse.totalCount
        });

        return normalizedResponse;
    } catch (error) {
        log.error('Search failed', {
            message: error.message,
            status: error.response?.status
        });
        
        const retryOutcome = await retryFranceTravailRequest({
            error,
            label: 'Token expired, retrying...',
            isRetried: params._retried,
            retryFn: () => searchOffers({ ...params, _retried: true })
        });

        if (retryOutcome.retried) {
            return retryOutcome.result;
        }

        throw error;
    }
}

/**
 * Get reference data (ROME codes, regions, etc.)
 * @param {string} referentiel - Type of reference data
 * @returns {Array} - Reference data
 */
async function getReferentiel(referentiel, _retried = false) {
    const token = await getAccessToken();

    try {
        const url = `${FRANCE_TRAVAIL_API_URL}/referentiel/${referentiel}`;
        
        const response = await axios.get(url, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json'
            }
        });

        return response.data;
    } catch (error) {
        const retryOutcome = await retryFranceTravailRequest({
            error,
            label: 'Token expired in getReferentiel, retrying...',
            isRetried: _retried,
            retryFn: () => getReferentiel(referentiel, true)
        });

        if (retryOutcome.retried) {
            return retryOutcome.result;
        }
        
        log.error('Referentiel fetch failed', { referentiel, error: error.message });
        throw error;
    }
}

// ============================================
// DATA COLLECTION FOR MARKET RADAR
// ============================================

// IT/IS related ROME codes
const IT_ROME_CODES = [
    'M1801', // Administration de systèmes d'information
    'M1802', // Expertise et support en systèmes d'information
    'M1803', // Direction des systèmes d'information
    'M1804', // Études et développement de réseaux de télécoms
    'M1805', // Études et développement informatique
    'M1806', // Conseil et maîtrise d'ouvrage en systèmes d'information
    'M1810', // Production et exploitation de systèmes d'information
    'E1101', // Animation de site multimédia
    'E1104', // Conception de contenus multimédias
    'E1205'  // Réalisation de contenus multimédias
];

// French regions with their codes
const FRENCH_REGIONS = [
    { code: '84', name: 'Auvergne-Rhône-Alpes' },
    { code: '27', name: 'Bourgogne-Franche-Comté' },
    { code: '53', name: 'Bretagne' },
    { code: '24', name: 'Centre-Val de Loire' },
    { code: '94', name: 'Corse' },
    { code: '44', name: 'Grand Est' },
    { code: '32', name: 'Hauts-de-France' },
    { code: '11', name: 'Île-de-France' },
    { code: '28', name: 'Normandie' },
    { code: '75', name: 'Nouvelle-Aquitaine' },
    { code: '76', name: 'Occitanie' },
    { code: '52', name: 'Pays de la Loire' },
    { code: '93', name: 'Provence-Alpes-Côte d\'Azur' }
];

// IT Skills/Keywords to track
const IT_KEYWORDS = [
    'javascript', 'typescript', 'react', 'angular', 'vue',
    'node.js', 'python', 'java', 'c#', '.net',
    'php', 'ruby', 'go', 'rust', 'kotlin',
    'aws', 'azure', 'gcp', 'cloud', 'devops',
    'docker', 'kubernetes', 'terraform', 'ansible',
    'sql', 'postgresql', 'mongodb', 'redis',
    'machine learning', 'data science', 'ia', 'intelligence artificielle',
    'cybersécurité', 'sécurité informatique',
    'agile', 'scrum', 'product owner', 'scrum master',
    'fullstack', 'frontend', 'backend', 'mobile',
    'ios', 'android', 'react native', 'flutter'
];

/**
 * Collect market facts for IT jobs
 * @param {Object} options - Collection options
 * @param {Array} options.regions - Region codes to collect (default: all)
 * @param {Array} options.romeCodes - ROME codes to collect (default: IT codes)
 * @param {Array} options.keywords - Keywords to search (default: IT keywords)
 * @param {Function} options.onFactCollected - Callback to save each fact immediately
 * @returns {Array} - Collected facts
 */
async function collectMarketFacts(options = {}) {
    const regions = options.regions || FRENCH_REGIONS;
    const romeCodes = options.romeCodes || IT_ROME_CODES;
    const keywords = options.keywords || IT_KEYWORDS.slice(0, 10); // Limit to avoid rate limiting
    const onFactCollected = options.onFactCollected || null; // Callback for immediate save
    const onTotalEstimated = options.onTotalEstimated || null; // Callback when total is known
    
    const facts = [];
    const collectionDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    
    // Calculate expected total upfront: (romeCodes × regions) + keywords
    const expectedTotal = (romeCodes.length * regions.length) + keywords.length;
    
    log.info('Starting market facts collection', {
        regionsCount: regions.length,
        romeCodesCount: romeCodes.length,
        keywordsCount: keywords.length,
        expectedTotal,
        immediateStorage: !!onFactCollected
    });

    // Report expected total before starting
    if (onTotalEstimated) {
        try { await onTotalEstimated(expectedTotal); } catch { /* ignore */ }
    }

    // Rate limiting: 3 requests per second max
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    
    // Flag to stop on critical errors (403, 401)
    let criticalError = null;
    let savedCount = 0;

    // Collect by ROME code and region
    for (const rome of romeCodes) {
        if (criticalError) break;
        
        for (const region of regions) {
            if (criticalError) break;
            
            try {
                await delay(350); // ~3 requests per second
                
                const result = await searchOffers({
                    codeROME: rome,
                    region: region.code,
                    range: '0-0' // Just get count, not full results
                });

                const fact = {
                    date: collectionDate,
                    source: 'france_travail',
                    type: 'rome_region',
                    region: region.name,
                    regionCode: region.code,
                    romeCode: rome,
                    jobCount: result.totalCount,
                    metadata: {
                        filters: result.filters
                    }
                };

                facts.push(fact);

                // Save immediately if callback provided
                if (onFactCollected) {
                    try {
                        await onFactCollected(fact);
                        savedCount++;
                        log.debug(`Saved fact ${savedCount}`, { rome, region: region.name, count: result.totalCount });
                    } catch (saveError) {
                        log.error('Failed to save fact', { rome, region: region.name, error: saveError.message });
                    }
                }
            } catch (error) {
                // Stop immediately on 403 (Forbidden) or 401 (Unauthorized)
                if (error.response?.status === 403 || error.response?.status === 401) {
                    criticalError = `API access denied (${error.response.status}). Check France Travail application permissions.`;
                    log.error('Critical error - stopping collection', { status: error.response.status });
                    break;
                }
                
                log.warn('Failed to collect fact', { rome, region: region.name, error: error.message });
            }
        }
    }

    // Collect by keyword (national level)
    for (const keyword of keywords) {
        if (criticalError) break;
        
        try {
            await delay(350);
            
            const result = await searchOffers({
                motsCles: keyword,
                range: '0-0'
            });

            const fact = {
                date: collectionDate,
                source: 'france_travail',
                type: 'keyword_national',
                keyword: keyword,
                jobCount: result.totalCount,
                metadata: {
                    filters: result.filters
                }
            };

            facts.push(fact);

            // Save immediately if callback provided
            if (onFactCollected) {
                try {
                    await onFactCollected(fact);
                    savedCount++;
                    log.debug(`Saved keyword fact ${savedCount}`, { keyword, count: result.totalCount });
                } catch (saveError) {
                    log.error('Failed to save keyword fact', { keyword, error: saveError.message });
                }
            }
        } catch (error) {
            // Stop immediately on 403 (Forbidden) or 401 (Unauthorized)
            if (error.response?.status === 403 || error.response?.status === 401) {
                criticalError = `API access denied (${error.response.status}). Check France Travail application permissions.`;
                log.error('Critical error - stopping collection', { status: error.response.status });
                break;
            }
            
            log.warn('Failed to collect keyword fact', { keyword, error: error.message });
        }
    }
    
    log.info('Collection progress', { collected: facts.length, savedImmediately: savedCount });
    
    // If critical error occurred, throw it
    if (criticalError) {
        throw new Error(criticalError);
    }

    log.info('Market facts collection completed', { totalFacts: facts.length });

    return facts;
}

/**
 * Get salary statistics from job offers (estimated from offer descriptions)
 * Note: France Travail API doesn't provide direct salary aggregates
 * This function collects offers with salary info for analysis
 */
async function collectSalaryData(romeCode, region = null) {
    const _token = await getAccessToken();
    const allOffers = [];
    
    try {
        // Collect up to 1000 offers with salary info
        for (let start = 0; start < 1000; start += 150) {
            const params = {
                codeROME: romeCode,
                range: `${start}-${start + 149}`
            };
            if (region) params.region = region;

            const result = await searchOffers(params);
            
            // Filter offers with salary information
            const offersWithSalary = result.results.filter(offer => 
                offer.salaire && (offer.salaire.libelle || offer.salaire.complement1)
            );
            
            allOffers.push(...offersWithSalary);
            
            if (result.results.length < 150) break; // No more results
            
            await new Promise(resolve => setTimeout(resolve, 350)); // Rate limiting
        }

        return {
            romeCode,
            region,
            offersWithSalary: allOffers.length,
            offers: allOffers.map(o => ({
                id: o.id,
                title: o.intitule,
                salary: o.salaire,
                contract: o.typeContrat,
                experience: o.experienceExige
            }))
        };
    } catch (error) {
        log.error('Salary data collection failed', { error: error.message });
        throw error;
    }
}

export {
    getAccessToken,
    searchOffers,
    getReferentiel,
    collectMarketFacts,
    collectSalaryData,
    IT_ROME_CODES,
    FRENCH_REGIONS,
    IT_KEYWORDS
};
