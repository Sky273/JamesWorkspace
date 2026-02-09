import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

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

async function checkMetadata() {
    try {
        // Get one sample of each type with metadata
        const types = ['tension', 'salaire', 'embauche', 'offre', 'demandeur', 'demandeur_entrant', 'dynamique_emploi'];
        
        for (const type of types) {
            const result = await pool.query(`
                SELECT type, code_rome, region, value, 
                       jsonb_pretty(metadata) as metadata_pretty,
                       metadata->'listeValeursParPeriode'->0 as first_periode
                FROM market_trends 
                WHERE type = $1 AND metadata IS NOT NULL
                LIMIT 1
            `, [type]);
            
            if (result.rows[0]) {
                console.log(`\n=== ${type.toUpperCase()} ===`);
                console.log('Value stored:', result.rows[0].value);
                console.log('First periode:', JSON.stringify(result.rows[0].first_periode, null, 2));
            } else {
                console.log(`\n=== ${type.toUpperCase()} === No data found`);
            }
        }
        
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await pool.end();
    }
}

checkMetadata();
