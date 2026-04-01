#!/usr/bin/env node
/**
 * Database Backup Script
 * Creates a backup of the PostgreSQL database
 * 
 * Usage:
 *   node scripts/backup-db.js
 *   node scripts/backup-db.js --output ./backups/my-backup.sql
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const {
    POSTGRES_HOST = 'localhost',
    POSTGRES_PORT = '5432',
    POSTGRES_DB = 'resumeconverter',
    POSTGRES_USER = 'postgres',
    POSTGRES_PASSWORD
} = process.env;

// Parse command line arguments
const args = process.argv.slice(2);
const outputIndex = args.indexOf('--output');
let outputPath = null;

if (outputIndex !== -1 && args[outputIndex + 1]) {
    outputPath = args[outputIndex + 1];
}

// Default backup directory
const BACKUP_DIR = path.join(__dirname, '..', 'backups');

async function createBackup() {
    console.log('🗄️  Database Backup Script');
    console.log('========================\n');
    
    // Ensure backup directory exists
    if (!fs.existsSync(BACKUP_DIR)) {
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
        console.log(`📁 Created backup directory: ${BACKUP_DIR}`);
    }
    
    // Generate backup filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const backupFile = outputPath || path.join(BACKUP_DIR, `backup-${POSTGRES_DB}-${timestamp}.sql`);
    
    console.log(`📊 Database: ${POSTGRES_DB}`);
    console.log(`🖥️  Host: ${POSTGRES_HOST}:${POSTGRES_PORT}`);
    console.log(`👤 User: ${POSTGRES_USER}`);
    console.log(`📄 Output: ${backupFile}\n`);
    
    // Check if pg_dump is available
    try {
        await execAsync('pg_dump --version');
    } catch {
        console.error('❌ pg_dump not found. Please install PostgreSQL client tools.');
        console.error('   On Windows: Install PostgreSQL and add bin folder to PATH');
        console.error('   On macOS: brew install postgresql');
        console.error('   On Ubuntu: sudo apt install postgresql-client');
        process.exit(1);
    }
    
    // Build pg_dump command
    const env = { ...process.env, PGPASSWORD: POSTGRES_PASSWORD };
    const command = `pg_dump -h ${POSTGRES_HOST} -p ${POSTGRES_PORT} -U ${POSTGRES_USER} -d ${POSTGRES_DB} -F p -f "${backupFile}"`;
    
    console.log('⏳ Creating backup...');
    const startTime = Date.now();
    
    try {
        await execAsync(command, { env });
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        
        // Get file size
        const stats = fs.statSync(backupFile);
        const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
        
        console.log(`\n✅ Backup completed successfully!`);
        console.log(`   📄 File: ${backupFile}`);
        console.log(`   📦 Size: ${sizeMB} MB`);
        console.log(`   ⏱️  Duration: ${duration}s`);
        
        // Cleanup old backups (keep last 10)
        await cleanupOldBackups();
        
    } catch (error) {
        console.error('\n❌ Backup failed:', error.message);
        if (error.stderr) {
            console.error('   Details:', error.stderr);
        }
        process.exit(1);
    }
}

async function cleanupOldBackups() {
    const files = fs.readdirSync(BACKUP_DIR)
        .filter(f => f.startsWith('backup-') && f.endsWith('.sql'))
        .map(f => ({
            name: f,
            path: path.join(BACKUP_DIR, f),
            time: fs.statSync(path.join(BACKUP_DIR, f)).mtime.getTime()
        }))
        .sort((a, b) => b.time - a.time);
    
    const MAX_BACKUPS = 10;
    
    if (files.length > MAX_BACKUPS) {
        const toDelete = files.slice(MAX_BACKUPS);
        console.log(`\n🧹 Cleaning up old backups (keeping last ${MAX_BACKUPS})...`);
        
        for (const file of toDelete) {
            fs.unlinkSync(file.path);
            console.log(`   Deleted: ${file.name}`);
        }
    }
}

// Run backup
createBackup().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
