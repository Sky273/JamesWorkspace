import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Build connection from individual env vars if DATABASE_URL not set
const connectionConfig = process.env.DATABASE_URL 
    ? { connectionString: process.env.DATABASE_URL }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME || 'resumeconverter',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || ''
    };

const pool = new pg.Pool(connectionConfig);

async function checkDemandeurs() {
    try {
        // Compare demandeur vs demandeur_entrant
        const result = await pool.query(`
            SELECT 
                type, 
                COUNT(*) as record_count, 
                SUM(CASE WHEN value IS NOT NULL THEN value ELSE 0 END)::numeric as total_value,
                AVG(CASE WHEN value IS NOT NULL THEN value ELSE NULL END)::numeric as avg_value,
                COUNT(CASE WHEN value IS NULL THEN 1 END) as null_count
            FROM market_trends 
            WHERE type IN ('demandeur', 'demandeur_entrant') 
            GROUP BY type 
            ORDER BY type
        `);
        
        console.log('\n=== Comparaison demandeur vs demandeur_entrant ===\n');
        console.table(result.rows);
        
        // Check a sample of metadata to see the actual API response structure
        const sampleDemandeur = await pool.query(`
            SELECT type, code_rome, region, value, metadata 
            FROM market_trends 
            WHERE type = 'demandeur' AND value IS NOT NULL 
            LIMIT 1
        `);
        
        const sampleEntrant = await pool.query(`
            SELECT type, code_rome, region, value, metadata 
            FROM market_trends 
            WHERE type = 'demandeur_entrant' AND value IS NOT NULL 
            LIMIT 1
        `);
        
        console.log('\n=== Sample demandeur (DE_1) ===');
        if (sampleDemandeur.rows[0]) {
            console.log('Type:', sampleDemandeur.rows[0].type);
            console.log('ROME:', sampleDemandeur.rows[0].code_rome);
            console.log('Region:', sampleDemandeur.rows[0].region);
            console.log('Value:', sampleDemandeur.rows[0].value);
            console.log('Metadata keys:', Object.keys(sampleDemandeur.rows[0].metadata || {}));
            if (sampleDemandeur.rows[0].metadata?.listeValeursParPeriode) {
                console.log('listeValeursParPeriode[0]:', JSON.stringify(sampleDemandeur.rows[0].metadata.listeValeursParPeriode[0], null, 2));
            }
        }
        
        console.log('\n=== Sample demandeur_entrant (DE_5) ===');
        if (sampleEntrant.rows[0]) {
            console.log('Type:', sampleEntrant.rows[0].type);
            console.log('ROME:', sampleEntrant.rows[0].code_rome);
            console.log('Region:', sampleEntrant.rows[0].region);
            console.log('Value:', sampleEntrant.rows[0].value);
            console.log('Metadata keys:', Object.keys(sampleEntrant.rows[0].metadata || {}));
            if (sampleEntrant.rows[0].metadata?.listeValeursParPeriode) {
                console.log('listeValeursParPeriode[0]:', JSON.stringify(sampleEntrant.rows[0].metadata.listeValeursParPeriode[0], null, 2));
            }
        }
        
        // Compare same ROME code and region
        console.log('\n=== Comparaison pour un même ROME/Region ===');
        const comparison = await pool.query(`
            SELECT 
                d.code_rome,
                d.region,
                d.value as demandeur_value,
                e.value as entrant_value,
                CASE WHEN d.value > 0 THEN ROUND((e.value / d.value * 100)::numeric, 1) ELSE NULL END as ratio_pct
            FROM market_trends d
            JOIN market_trends e ON d.code_rome = e.code_rome AND d.region = e.region
            WHERE d.type = 'demandeur' AND e.type = 'demandeur_entrant'
            AND d.value IS NOT NULL AND e.value IS NOT NULL
            ORDER BY d.value DESC
            LIMIT 10
        `);
        console.table(comparison.rows);
        
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await pool.end();
    }
}

checkDemandeurs();
