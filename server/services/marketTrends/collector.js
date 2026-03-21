/**
 * Market Trends Data Collection & Storage
 * Handles collecting trends from France Travail API and storing them in PostgreSQL
 */

import { safeLog } from '../../utils/logger.backend.js';
import { query as dbQuery } from '../../config/database.js';
import { FRENCH_REGIONS } from '../franceTravail.service.js';
import { getStoredMetiers } from '../rome.service.js';

import {
    getStatEmbauches,
    getStatDynamiqueEmploi,
    getStatTensions,
    getStatSalaires,
    getStatOffres,
    getStatDemandeurs,
    getStatDemandeursEntrants
} from './apiClient.js';

// IS/IT Family code filter (M18 = Systèmes d'information et de télécommunication)
const IT_FAMILLE_CODE = 'M18';

// PostgreSQL table name
const MARKET_TRENDS_TABLE = 'market_trends';

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

// ============================================
// DATA STORAGE HELPERS
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
 * Generate MD5 hash of API response for verification
 */
function generateResponseHash(data) {
    if (!data) return null;
    try {
        const crypto = require('crypto');
        const jsonStr = JSON.stringify(data);
        return crypto.createHash('md5').update(jsonStr).digest('hex');
    } catch (_error) {
        return null;
    }
}

/**
 * Store a market trend record in PostgreSQL (upsert)
 * Ensures uniqueness by Type + RegionCode + CodeRome
 * Now includes audit/traceability fields
 */
export async function storeTrend(trend) {
    try {
        // Check if record already exists and get previous value for change tracking
        const existing = await dbQuery(
            `SELECT id, value FROM ${MARKET_TRENDS_TABLE} 
             WHERE type = $1 AND COALESCE(region_code, '') = $2 AND COALESCE(code_rome, '') = $3`,
            [trend.type, trend.regionCode || '', trend.codeRome || '']
        );
        
        const metadata = safeSerializeMetadata(trend.metadata);
        const apiResponseHash = generateResponseHash(trend.metadata);
        
        if (existing.rows.length > 0) {
            const previousValue = existing.rows[0].value;
            const newValue = trend.value;
            
            // Detect significant changes (>50%) and log warning
            if (previousValue && newValue && previousValue !== 0) {
                const changePercent = Math.abs((newValue - previousValue) / previousValue) * 100;
                if (changePercent > 50) {
                    safeLog('warn', 'MarketTrends: Significant value change detected', {
                        type: trend.type,
                        regionCode: trend.regionCode,
                        codeRome: trend.codeRome,
                        previousValue,
                        newValue,
                        changePercent: changePercent.toFixed(1) + '%'
                    });
                }
            }
            
            // Update existing record with audit fields
            const result = await dbQuery(
                `UPDATE ${MARKET_TRENDS_TABLE} SET
                    date = $1, rome_label = $2, region = $3, secteur = $4,
                    value = $5, value_label = $6, metadata = $7, updated_at = NOW(),
                    collected_at = NOW(), api_endpoint = $9, quarter_period = $10,
                    api_response_hash = $11, previous_value = $12
                WHERE id = $8 RETURNING *`,
                [trend.date, trend.romeLabel, trend.region, trend.secteur, 
                 trend.value, trend.valueLabel, metadata, existing.rows[0].id,
                 trend.apiEndpoint || null, trend.quarterPeriod || null,
                 apiResponseHash, previousValue]
            );
            
            safeLog('debug', 'MarketTrends: Updated existing trend', {
                type: trend.type, regionCode: trend.regionCode, codeRome: trend.codeRome
            });
            
            return { record: result.rows[0], action: 'updated', previousValue };
        } else {
            // Create new record with audit fields
            const result = await dbQuery(
                `INSERT INTO ${MARKET_TRENDS_TABLE} 
                    (type, code_rome, rome_label, region, region_code, secteur, date, value, value_label, metadata,
                     collected_at, api_endpoint, quarter_period, api_response_hash)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), $11, $12, $13) RETURNING *`,
                [trend.type, trend.codeRome, trend.romeLabel, trend.region, 
                 trend.regionCode, trend.secteur, trend.date, trend.value, trend.valueLabel, metadata,
                 trend.apiEndpoint || null, trend.quarterPeriod || null, apiResponseHash]
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

// ============================================
// VALUE EXTRACTION HELPERS
// ============================================

/** Convert value to number (handles strings and numbers) */
function toNumber(val) {
    if (val === null || val === undefined) return null;
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
        const parsed = parseFloat(val);
        return isNaN(parsed) ? null : parsed;
    }
    return null;
}

/**
 * Extract raw value from API response - no recalculation
 * Tries common API response fields in order of priority
 * @param {Object} data - API response data
 * @returns {number|null} - Raw value from API
 */
function extractRawValue(data) {
    if (!data) return null;
    
    // Try root level fields first
    let value = toNumber(data.valeurPrincipaleNombre)
        ?? toNumber(data.valeurPrincipaleDecimale)
        ?? toNumber(data.valeurPrincipaleMontant)
        ?? toNumber(data.valeurPrincipaleTaux)
        ?? toNumber(data.valeur)
        ?? toNumber(data.indicateur);
    
    if (value !== null) return value;
    
    // Try listeValeursParPeriode - take LAST period (most recent)
    if (data.listeValeursParPeriode?.length > 0) {
        const lastPeriode = data.listeValeursParPeriode[data.listeValeursParPeriode.length - 1];
        
        value = toNumber(lastPeriode?.valeurPrincipaleNombre)
            ?? toNumber(lastPeriode?.valeurPrincipaleDecimale)
            ?? toNumber(lastPeriode?.valeurPrincipaleMontant)
            ?? toNumber(lastPeriode?.valeurPrincipaleTaux)
            ?? toNumber(lastPeriode?.valeur)
            ?? toNumber(lastPeriode?.indicateur);
        
        if (value !== null) return value;
        
        // For salary data, try salaireValeurMontant (SAL3 preferred)
        if (lastPeriode?.salaireValeurMontant?.length > 0) {
            // Try SAL3 first (average all levels)
            const sal3 = lastPeriode.salaireValeurMontant.find(s => s.codeNomenclature === 'SAL3');
            if (sal3) {
                value = toNumber(sal3.valeurPrincipaleMontant);
                if (value !== null) return value;
            }
            // Fallback to first salary value
            value = toNumber(lastPeriode.salaireValeurMontant[0]?.valeurPrincipaleMontant);
            if (value !== null) return value;
        }
    }
    
    return null;
}

/**
 * Extract value label from API response
 */
function extractValueLabel(data) {
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
}

// ============================================
// MAIN COLLECTION FUNCTION
// ============================================

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
    
    // Calculate expected total upfront:
    // 5 types by rome×region (tension, embauche, offre, demandeur, demandeur_entrant)
    // + 1 type by rome only (salaire)
    // + 1 type by region only (dynamique_emploi)
    const regionsCount = FRENCH_REGIONS.length;
    const romeCount = itRomeCodes.length;
    const expectedTotal = (5 * romeCount * regionsCount) + romeCount + regionsCount;
    
    safeLog('info', 'MarketTrends: Starting collection', {
        quarter,
        dateDeb,
        dateFin,
        regionsCount,
        romeCodesCount: romeCount,
        expectedTotal
    });

    // Report expected total before starting
    if (onTotalEstimated) {
        try { await onTotalEstimated(expectedTotal); } catch (_) { /* ignore */ }
    }

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

    // Helper to collect a single trend type across ROME codes and regions
    const collectTrendsByRomeAndRegion = async (typeName, apiCallFn, trendType, apiEndpoint, extraParams = {}) => {
        safeLog('info', `MarketTrends: Collecting ${typeName}...`);
        for (const rome of itRomeCodes) {
            if (criticalError) break;
            
            for (const region of FRENCH_REGIONS) {
                if (criticalError) break;
                
                try {
                    await delay(350);
                    const data = await apiCallFn({
                        codeRome: rome,
                        codeTerritoire: region.code,
                        ...extraParams
                    });
                    
                    const trend = {
                        date: collectionDate,
                        type: trendType,
                        codeRome: rome,
                        romeLabel: getRomeLabel(rome),
                        region: region.name,
                        regionCode: region.code,
                        value: extractRawValue(data),
                        valueLabel: extractValueLabel(data),
                        metadata: prepareMetadata(data, rome),
                        apiEndpoint,
                        quarterPeriod: quarter
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
                    safeLog('warn', `MarketTrends: Failed to collect ${trendType}`, {
                        rome, region: region.name, error: error.message
                    });
                }
            }
        }
    };

    // Helper to collect a single trend type across ROME codes only (national level)
    const collectTrendsByRome = async (typeName, apiCallFn, trendType, apiEndpoint) => {
        safeLog('info', `MarketTrends: Collecting ${typeName}...`);
        for (const rome of itRomeCodes) {
            if (criticalError) break;
            
            try {
                await delay(350);
                const data = await apiCallFn({ codeRome: rome });
                
                const trend = {
                    date: collectionDate,
                    type: trendType,
                    codeRome: rome,
                    romeLabel: getRomeLabel(rome),
                    value: extractRawValue(data),
                    valueLabel: extractValueLabel(data),
                    metadata: prepareMetadata(data, rome),
                    apiEndpoint,
                    quarterPeriod: quarter
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
                safeLog('warn', `MarketTrends: Failed to collect ${trendType}`, {
                    rome, error: error.message
                });
            }
        }
    };

    // 1. Collect tensions (recruitment difficulties) by ROME code and region
    await collectTrendsByRomeAndRegion('tensions (PERSP_2)', getStatTensions, 'tension', 'stat-perspective-employeur');

    // 2. Collect salaries by ROME code (national level)
    await collectTrendsByRome('salaries (SAL_3)', getStatSalaires, 'salaire', 'salaire-rome-fap');

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
                value: extractRawValue(data),
                valueLabel: extractDynamiqueLabel(data),
                metadata: prepareMetadata(data, null),
                apiEndpoint: 'stat-dynamique-emploi',
                quarterPeriod: quarter
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
    await collectTrendsByRomeAndRegion('hiring data (EMB_1)', getStatEmbauches, 'embauche', 'stat-embauches', { dateDeb, dateFin });

    // 5. Collect job offers by ROME code and region (OFF_1)
    await collectTrendsByRomeAndRegion('job offers (OFF_1)', getStatOffres, 'offre', 'stat-offres', { dateDeb, dateFin });

    // 6. Collect job seekers by ROME code and region (DE_1)
    await collectTrendsByRomeAndRegion('job seekers (DE_1)', getStatDemandeurs, 'demandeur', 'stat-demandeurs', { dateDeb, dateFin });

    // 7. Collect new job seekers by ROME code and region (DE_5)
    await collectTrendsByRomeAndRegion('new job seekers (DE_5)', getStatDemandeursEntrants, 'demandeur_entrant', 'stat-demandeurs-entrant', { dateDeb, dateFin });

    if (criticalError) {
        throw new Error(criticalError);
    }

    const totalCount = onTrendCollected ? savedCount : trends.length;
    
    // Generate collection summary report
    const collectionReport = await generateCollectionReport(quarter, collectionDate);
    
    safeLog('info', 'MarketTrends: Collection completed', {
        totalTrends: totalCount,
        savedImmediately: savedCount,
        report: collectionReport
    });

    // Return empty array if using callback (data already saved), otherwise return accumulated trends
    return onTrendCollected ? [] : trends;
}

/**
 * Generate a summary report after collection
 * Compares current data with previous values and identifies anomalies
 */
export async function generateCollectionReport(quarterPeriod, collectionDate) {
    try {
        // Get summary statistics by type
        const summaryQuery = `
            SELECT 
                type,
                COUNT(*) as total_records,
                COUNT(CASE WHEN value IS NOT NULL THEN 1 END) as records_with_value,
                SUM(CASE WHEN value IS NOT NULL THEN value ELSE 0 END) as total_value,
                AVG(CASE WHEN value IS NOT NULL THEN value ELSE NULL END) as avg_value,
                COUNT(CASE WHEN previous_value IS NOT NULL THEN 1 END) as updated_records,
                COUNT(CASE WHEN previous_value IS NOT NULL AND previous_value != 0 
                      AND ABS((value - previous_value) / previous_value) > 0.5 THEN 1 END) as significant_changes
            FROM ${MARKET_TRENDS_TABLE}
            WHERE DATE(collected_at) = $1
            GROUP BY type
            ORDER BY type
        `;
        
        const summaryResult = await dbQuery(summaryQuery, [collectionDate]);
        
        // Get top significant changes
        const changesQuery = `
            SELECT type, region_code, code_rome, rome_label,
                   previous_value, value,
                   ROUND(ABS((value - previous_value) / NULLIF(previous_value, 0)) * 100, 1) as change_percent
            FROM ${MARKET_TRENDS_TABLE}
            WHERE DATE(collected_at) = $1
              AND previous_value IS NOT NULL 
              AND previous_value != 0
              AND ABS((value - previous_value) / previous_value) > 0.5
            ORDER BY ABS((value - previous_value) / previous_value) DESC
            LIMIT 10
        `;
        
        const changesResult = await dbQuery(changesQuery, [collectionDate]);
        
        const report = {
            quarterPeriod,
            collectionDate,
            generatedAt: new Date().toISOString(),
            summary: {
                byType: summaryResult.rows.map(row => ({
                    type: row.type,
                    totalRecords: parseInt(row.total_records),
                    recordsWithValue: parseInt(row.records_with_value),
                    totalValue: parseFloat(row.total_value) || 0,
                    avgValue: parseFloat(row.avg_value) || 0,
                    updatedRecords: parseInt(row.updated_records),
                    significantChanges: parseInt(row.significant_changes)
                })),
                totalRecordsCollected: summaryResult.rows.reduce((sum, r) => sum + parseInt(r.total_records), 0),
                totalSignificantChanges: summaryResult.rows.reduce((sum, r) => sum + parseInt(r.significant_changes), 0)
            },
            topChanges: changesResult.rows.map(row => ({
                type: row.type,
                regionCode: row.region_code,
                codeRome: row.code_rome,
                romeLabel: row.rome_label,
                previousValue: parseFloat(row.previous_value),
                currentValue: parseFloat(row.value),
                changePercent: parseFloat(row.change_percent)
            }))
        };
        
        // Log warnings for significant changes
        if (report.summary.totalSignificantChanges > 0) {
            safeLog('warn', 'MarketTrends: Collection report - Significant changes detected', {
                totalSignificantChanges: report.summary.totalSignificantChanges,
                topChanges: report.topChanges.slice(0, 5)
            });
        }
        
        return report;
    } catch (error) {
        safeLog('error', 'MarketTrends: Failed to generate collection report', { error: error.message });
        return {
            quarterPeriod,
            collectionDate,
            error: error.message
        };
    }
}
