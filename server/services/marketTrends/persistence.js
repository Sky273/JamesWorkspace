import crypto from 'crypto';
import { safeLog } from '../../utils/logger.backend.js';
import { query as dbQuery } from '../../config/database.js';

export const MARKET_TRENDS_TABLE = 'market_trends';

function safeSerializeMetadata(metadata) {
    if (!metadata) return null;

    try {
        const cleaned = JSON.parse(JSON.stringify(metadata, (_key, value) => {
            if (value === undefined) return null;
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

function generateResponseHash(data) {
    if (!data) return null;
    try {
        const jsonStr = JSON.stringify(data);
        return crypto.createHash('md5').update(jsonStr).digest('hex');
    } catch {
        return null;
    }
}

export async function storeTrend(trend) {
    try {
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

            if (previousValue && newValue && previousValue !== 0) {
                const changePercent = Math.abs((newValue - previousValue) / previousValue) * 100;
                if (changePercent > 50) {
                    safeLog('warn', 'MarketTrends: Significant value change detected', {
                        type: trend.type,
                        regionCode: trend.regionCode,
                        codeRome: trend.codeRome,
                        previousValue,
                        newValue,
                        changePercent: `${changePercent.toFixed(1)}%`
                    });
                }
            }

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
        }

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
    } catch (error) {
        safeLog('error', 'MarketTrends: Failed to store trend', {
            error: error.message,
            trendType: trend?.type,
            regionCode: trend?.regionCode,
            codeRome: trend?.codeRome
        });

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

export async function generateCollectionReport(quarterPeriod, collectionDate) {
    try {
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
                byType: summaryResult.rows.map((row) => ({
                    type: row.type,
                    totalRecords: parseInt(row.total_records),
                    recordsWithValue: parseInt(row.records_with_value),
                    totalValue: parseFloat(row.total_value) || 0,
                    avgValue: parseFloat(row.avg_value) || 0,
                    updatedRecords: parseInt(row.updated_records),
                    significantChanges: parseInt(row.significant_changes)
                })),
                totalRecordsCollected: summaryResult.rows.reduce((sum, row) => sum + parseInt(row.total_records), 0),
                totalSignificantChanges: summaryResult.rows.reduce((sum, row) => sum + parseInt(row.significant_changes), 0)
            },
            topChanges: changesResult.rows.map((row) => ({
                type: row.type,
                regionCode: row.region_code,
                codeRome: row.code_rome,
                romeLabel: row.rome_label,
                previousValue: parseFloat(row.previous_value),
                currentValue: parseFloat(row.value),
                changePercent: parseFloat(row.change_percent)
            }))
        };

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
