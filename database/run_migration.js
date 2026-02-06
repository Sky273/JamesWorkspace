/**
 * Run a SQL migration file
 * Usage: node database/run_migration.js <migration_file.sql>
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const { Pool } = pg;

const pool = new Pool({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    database: process.env.POSTGRES_DB || 'resumeconverter',
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD
});

async function runMigration(sqlFile) {
    const client = await pool.connect();
    try {
        const sqlPath = path.resolve(__dirname, sqlFile);
        if (!fs.existsSync(sqlPath)) {
            throw new Error(`Migration file not found: ${sqlPath}`);
        }
        
        const sql = fs.readFileSync(sqlPath, 'utf8');
        console.log(`Running migration: ${sqlFile}`);
        console.log('---');
        
        await client.query(sql);
        
        console.log('---');
        console.log('Migration completed successfully!');
    } catch (error) {
        console.error('Migration failed:', error.message);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

// Get migration file from command line args
const migrationFile = process.argv[2];
if (!migrationFile) {
    console.log('Usage: node database/run_migration.js <migration_file.sql>');
    console.log('Example: node database/run_migration.js migrations/add_templates_popular.sql');
    process.exit(1);
}

runMigration(migrationFile);
