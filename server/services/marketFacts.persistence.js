import { safeLog } from '../utils/logger.backend.js';
import { query as dbQuery } from '../config/database.js';

export async function getStoredRomeCodes() {
    try {
        const result = await dbQuery('SELECT code_rome FROM rome_metiers ORDER BY code_rome ASC');
        const codes = result.rows.map((row) => row.code_rome).filter(Boolean);
        safeLog('info', 'MarketFacts: Retrieved ROME codes from stored métiers', { count: codes.length });
        return codes;
    } catch (error) {
        safeLog('error', 'MarketFacts: Failed to get stored ROME codes', { error: error.message });
        return [];
    }
}

export async function storeFact(fact) {
    try {
        const enrichedMetadata = {
            ...fact.metadata,
            type: fact.type || null,
            regionCode: fact.regionCode || null,
            romeCode: fact.romeCode || null
        };

        const result = await dbQuery(
            `INSERT INTO market_facts (date, source, keyword, location, job_count, mean_salary, metadata)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (keyword, location, source, date)
            DO UPDATE SET job_count = EXCLUDED.job_count, mean_salary = EXCLUDED.mean_salary, metadata = EXCLUDED.metadata, updated_at = NOW()
            RETURNING *`,
            [
                fact.date,
                fact.source,
                fact.keyword || fact.romeCode || null,
                fact.region || fact.location || null,
                fact.jobCount || 0,
                fact.meanSalary || null,
                JSON.stringify(enrichedMetadata)
            ]
        );

        return result.rows[0];
    } catch (error) {
        safeLog('error', 'MarketFacts: Failed to store fact', {
            error: error.message,
            fact: { type: fact.type, source: fact.source }
        });
        throw error;
    }
}

export async function storeFacts(facts) {
    const results = { success: 0, failed: 0, errors: [] };

    for (const fact of facts) {
        try {
            await storeFact(fact);
            results.success++;
        } catch (error) {
            results.failed++;
            results.errors.push({
                fact: { keyword: fact.keyword, source: fact.source },
                error: error.message
            });
        }
    }

    safeLog('info', 'MarketFacts: Storage completed', results);
    return results;
}

export async function getLatestFacts(type, source = null) {
    try {
        let query = 'SELECT * FROM market_facts';
        const params = [];

        if (source) {
            query += ' WHERE source = $1';
            params.push(source);
        }

        query += ' ORDER BY date DESC LIMIT 100';
        const result = await dbQuery(query, params);

        return result.rows.map((row) => ({
            id: row.id,
            Source: row.source,
            Date: row.date,
            Keyword: row.keyword,
            Location: row.location,
            Region: row.region,
            JobCount: row.job_count,
            MeanSalary: row.mean_salary,
            Metadata: row.metadata
        }));
    } catch (error) {
        safeLog('error', 'MarketFacts: Failed to get latest facts', { error: error.message });
        throw error;
    }
}

export async function getKeywordTrend(keyword, days = 30) {
    try {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const result = await dbQuery(
            `SELECT date, source, job_count, mean_salary 
             FROM market_facts 
             WHERE keyword = $1 AND date >= $2 
             ORDER BY date ASC`,
            [keyword, startDate]
        );

        const trend = result.rows.map((row) => ({
            date: row.date,
            source: row.source,
            jobCount: row.job_count,
            meanSalary: row.mean_salary
        }));

        return { keyword, days, dataPoints: trend.length, trend };
    } catch (error) {
        safeLog('error', 'MarketFacts: Failed to get keyword trend', { error: error.message });
        throw error;
    }
}

export async function getRegionalComparison(date, source = null) {
    try {
        let query = 'SELECT * FROM market_facts WHERE date = $1';
        const params = [date];

        if (source) {
            query += ' AND source = $2';
            params.push(source);
        }

        query += ' ORDER BY job_count DESC';
        const result = await dbQuery(query, params);

        return result.rows.map((row) => ({
            id: row.id,
            location: row.location,
            keyword: row.keyword,
            jobCount: row.job_count,
            meanSalary: row.mean_salary,
            source: row.source
        }));
    } catch (error) {
        safeLog('error', 'MarketFacts: Failed to get regional comparison', { error: error.message });
        throw error;
    }
}
