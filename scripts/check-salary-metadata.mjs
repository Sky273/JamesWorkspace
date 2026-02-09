import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Use DATABASE_URL if available, otherwise individual vars
const connectionConfig = process.env.DATABASE_URL 
    ? { connectionString: process.env.DATABASE_URL }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'resume_converter',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || ''
    };

const pool = new pg.Pool(connectionConfig);

async function checkSalaryMetadata() {
    try {
        const result = await pool.query(
            `SELECT id, metadata FROM market_trends WHERE type = 'salaire' LIMIT 1`
        );
        
        if (result.rows[0]) {
            const m = result.rows[0].metadata;
            console.log('=== Salary Metadata Structure ===');
            console.log('Top-level keys:', Object.keys(m));
            console.log('listeValeursParPeriode:', m.listeValeursParPeriode ? `exists, length=${m.listeValeursParPeriode.length}` : 'MISSING');
            
            if (m.listeValeursParPeriode?.[0]) {
                const p = m.listeValeursParPeriode[0];
                console.log('\nFirst periode keys:', Object.keys(p));
                
                if (p.salaireValeurMontant) {
                    console.log('\nsalaireValeurMontant:', JSON.stringify(p.salaireValeurMontant, null, 2));
                } else {
                    console.log('\nNo salaireValeurMontant found');
                    console.log('Full first periode:', JSON.stringify(p, null, 2).substring(0, 1000));
                }
            }
        } else {
            console.log('No salary records found');
        }
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await pool.end();
    }
}

checkSalaryMetadata();
