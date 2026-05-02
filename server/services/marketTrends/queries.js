/**
 * Market Trends Data Queries
 * PostgreSQL queries for retrieving stored trends data
 */

import { safeLog } from '../../utils/logger.backend.js';
import { query as dbQuery } from '../../config/database.js';
import { toNumber } from './extractors.js';

// PostgreSQL table name
const MARKET_TRENDS_TABLE = 'market_trends';

/**
 * Helper to parse PostgreSQL DECIMAL values to numbers
 */
function parseValue(value) {
    return toNumber(value) ?? 0;
}

/**
 * Map a database record to frontend format
 */
function mapRecordToFrontend(record, includeMetadata = false) {
    const mapped = {
        id: record.id,
        Type: record.type,
        CodeRome: record.code_rome,
        RomeLabel: record.rome_label,
        Region: record.region,
        RegionCode: record.region_code,
        Date: record.date,
        Value: parseValue(record.value),
        ValueLabel: record.value_label
    };
    if (includeMetadata) {
        mapped.Metadata = record.metadata || null;
    }
    if (record.collected_at !== undefined) {
        mapped.CollectedAt = record.collected_at;
    }
    if (record.api_endpoint !== undefined) {
        mapped.ApiEndpoint = record.api_endpoint;
    }
    if (record.quarter_period !== undefined) {
        mapped.QuarterPeriod = record.quarter_period;
    }
    return mapped;
}

/**
 * Get stored trends WITHOUT metadata (lightweight version for map)
 * Uses direct PostgreSQL query - NO cache, NO metadata
 * Optimized for large datasets with server-side filtering
 * @param {Object} options - Filter options
 */
export async function getStoredTrendsLight(options = {}) {
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
        // Includes audit fields for freshness display
        const query = `
            SELECT id, type, code_rome, rome_label, region, region_code, date, value, value_label,
                   collected_at, api_endpoint, quarter_period
            FROM ${MARKET_TRENDS_TABLE}
            ${whereClause}
            ORDER BY date DESC
        `;
        
        const result = await dbQuery(query, params);
        
        const trends = result.rows.map(record => mapRecordToFrontend(record));
        
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
export async function getStoredTrendsWithMetadata(options = {}) {
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
        
        const trends = result.rows.map(record => mapRecordToFrontend(record, true));
        
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
export async function getTrendMetadata(trendId) {
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
        
        return mapRecordToFrontend(result.rows[0], true);
    } catch (error) {
        safeLog('error', 'MarketTrends: Failed to get trend metadata', { error: error.message, trendId });
        throw error;
    }
}

/**
 * Fetch metadata for specific trend IDs (on-demand)
 * @param {string[]} ids - Array of trend IDs to fetch metadata for
 * @returns {Object} - Map of id -> metadata
 */
/**
 * Get trends audit report (freshness, significant changes, overall stats)
 * @returns {Promise<Object>} { freshness, significantChanges, overall }
 */
export async function getTrendsAuditReport() {
    const freshnessResult = await dbQuery(`
        SELECT 
            type,
            COUNT(*) as total_records,
            MIN(collected_at) as oldest_collection,
            MAX(collected_at) as newest_collection,
            COUNT(CASE WHEN collected_at > NOW() - INTERVAL '7 days' THEN 1 END) as fresh_count,
            COUNT(CASE WHEN collected_at > NOW() - INTERVAL '30 days' AND collected_at <= NOW() - INTERVAL '7 days' THEN 1 END) as recent_count,
            COUNT(CASE WHEN collected_at <= NOW() - INTERVAL '30 days' OR collected_at IS NULL THEN 1 END) as stale_count,
            COUNT(CASE WHEN previous_value IS NOT NULL THEN 1 END) as updated_records,
            AVG(CASE WHEN previous_value IS NOT NULL AND previous_value != 0 
                THEN ABS((value - previous_value) / previous_value) * 100 
                ELSE NULL END) as avg_change_percent
        FROM ${MARKET_TRENDS_TABLE}
        GROUP BY type
        ORDER BY type
    `);

    const changesResult = await dbQuery(`
        SELECT type, region_code, code_rome, rome_label, 
               previous_value, value,
               ROUND(ABS((value - previous_value) / NULLIF(previous_value, 0)) * 100, 1) as change_percent,
               collected_at
        FROM ${MARKET_TRENDS_TABLE}
        WHERE previous_value IS NOT NULL 
          AND previous_value != 0
          AND ABS((value - previous_value) / previous_value) > 0.5
        ORDER BY ABS((value - previous_value) / previous_value) DESC
        LIMIT 20
    `);

    const overallResult = await dbQuery(`
        SELECT 
            COUNT(*) as total_records,
            COUNT(DISTINCT type) as total_types,
            COUNT(DISTINCT region_code) as total_regions,
            COUNT(DISTINCT code_rome) as total_rome_codes,
            MIN(collected_at) as oldest_data,
            MAX(collected_at) as newest_data
        FROM ${MARKET_TRENDS_TABLE}
    `);

    return {
        freshness: freshnessResult.rows,
        significantChanges: changesResult.rows,
        overall: overallResult.rows[0]
    };
}

export async function fetchMetadataForIds(ids) {
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
