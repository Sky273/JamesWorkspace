/**
 * Backup Service
 * Handles database backups via pg_dump with FTP/SFTP upload
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createGzip, createGunzip } from 'zlib';
import { pipeline } from 'stream/promises';
import { query } from '../config/database.js';
import { safeLog } from '../utils/logger.backend.js';

const execAsync = promisify(exec);

// ============================================
// LAZY-LOADED FTP/SFTP MODULES
// Cache modules to avoid repeated dynamic imports
// ============================================

let SftpClientModule = null;
let basicFtpModule = null;

/**
 * Get SFTP client class (lazy loaded and cached)
 */
async function getSftpClient() {
    if (!SftpClientModule) {
        SftpClientModule = (await import('ssh2-sftp-client')).default;
        safeLog('debug', 'ssh2-sftp-client module loaded');
    }
    return SftpClientModule;
}

/**
 * Get basic-ftp module (lazy loaded and cached)
 */
async function getBasicFtp() {
    if (!basicFtpModule) {
        basicFtpModule = await import('basic-ftp');
        safeLog('debug', 'basic-ftp module loaded');
    }
    return basicFtpModule;
}
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BACKUP_DIR = path.join(__dirname, '..', 'backups');
const TEMP_DIR = path.join(__dirname, '..', 'temp');

// PostgreSQL binary paths (Docker uses /usr/lib/postgresql/18/bin/)
const PG_BIN_PATHS = [
    '/usr/lib/postgresql/18/bin',
    '/usr/lib/postgresql/17/bin',
    '/usr/lib/postgresql/16/bin',
    '/usr/bin',
    ''  // System PATH
];

/**
 * Find PostgreSQL binary (pg_dump or psql)
 */
function findPgBinary(binaryName) {
    for (const binPath of PG_BIN_PATHS) {
        const fullPath = binPath ? path.join(binPath, binaryName) : binaryName;
        try {
            // Check if file exists (for absolute paths)
            if (binPath && fs.existsSync(fullPath)) {
                return fullPath;
            }
        } catch (e) {
            // Continue to next path
        }
    }
    // Return just the binary name and hope it's in PATH
    return binaryName;
}

// Ensure directories exist
if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
}
if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
}

/**
 * Initialize backup tables if they don't exist
 * Called at server startup
 */
export async function initBackupTables() {
    try {
        // Create backup_settings table
        await query(`
            CREATE TABLE IF NOT EXISTS backup_settings (
                id uuid DEFAULT public.uuid_generate_v4() PRIMARY KEY,
                protocol VARCHAR(10) DEFAULT 'ftp' CHECK (protocol IN ('ftp', 'ftps', 'sftp')),
                tls_mode VARCHAR(10) DEFAULT 'explicit' CHECK (tls_mode IN ('none', 'explicit', 'implicit')),
                host VARCHAR(255),
                port INTEGER DEFAULT 21,
                username VARCHAR(255),
                password VARCHAR(255),
                remote_path VARCHAR(500) DEFAULT '/',
                daily_enabled BOOLEAN DEFAULT false,
                daily_time VARCHAR(5) DEFAULT '02:00',
                weekly_enabled BOOLEAN DEFAULT false,
                weekly_day INTEGER DEFAULT 0 CHECK (weekly_day >= 0 AND weekly_day <= 6),
                weekly_time VARCHAR(5) DEFAULT '03:00',
                monthly_enabled BOOLEAN DEFAULT false,
                monthly_day INTEGER DEFAULT 1 CHECK (monthly_day >= 1 AND monthly_day <= 28),
                monthly_time VARCHAR(5) DEFAULT '04:00',
                retention_days INTEGER DEFAULT 30,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Create backup_history table
        await query(`
            CREATE TABLE IF NOT EXISTS backup_history (
                id uuid DEFAULT public.uuid_generate_v4() PRIMARY KEY,
                type VARCHAR(20) NOT NULL,
                filename VARCHAR(255) NOT NULL,
                size_bytes BIGINT,
                status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
                started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                completed_at TIMESTAMP WITH TIME ZONE,
                error_message TEXT,
                uploaded BOOLEAN DEFAULT false
            )
        `);
        
        // Create indexes
        await query(`CREATE INDEX IF NOT EXISTS idx_backup_history_started_at ON backup_history(started_at DESC)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_backup_history_status ON backup_history(status)`);
        
        safeLog('info', 'Backup tables initialized');
    } catch (error) {
        safeLog('error', 'Failed to initialize backup tables', { error: error.message });
        throw error;
    }
}

/**
 * Get backup settings from database
 */
export async function getBackupSettings() {
    try {
        const result = await query('SELECT * FROM backup_settings LIMIT 1');
        if (result.rows.length === 0) {
            return null;
        }
        return result.rows[0];
    } catch (error) {
        safeLog('error', 'Failed to get backup settings', { error: error.message });
        throw error;
    }
}

/**
 * Save backup settings to database
 */
export async function saveBackupSettings(settings) {
    try {
        const existingSettings = await getBackupSettings();
        
        if (existingSettings) {
            const result = await query(`
                UPDATE backup_settings SET
                    protocol = $1,
                    tls_mode = $2,
                    host = $3,
                    port = $4,
                    username = $5,
                    password = $6,
                    remote_path = $7,
                    daily_enabled = $8,
                    daily_time = $9,
                    daily_retention = $10,
                    weekly_enabled = $11,
                    weekly_day = $12,
                    weekly_time = $13,
                    weekly_retention = $14,
                    monthly_enabled = $15,
                    monthly_day = $16,
                    monthly_time = $17,
                    monthly_retention = $18
                WHERE id = $19
                RETURNING *
            `, [
                settings.protocol || 'ftp',
                settings.tls_mode || 'explicit',
                settings.host,
                settings.port || 21,
                settings.username,
                settings.password,
                settings.remote_path || '/backups',
                settings.daily_enabled || false,
                settings.daily_time || '02:00',
                settings.daily_retention || 7,
                settings.weekly_enabled || false,
                settings.weekly_day || 0,
                settings.weekly_time || '03:00',
                settings.weekly_retention || 4,
                settings.monthly_enabled || false,
                settings.monthly_day || 1,
                settings.monthly_time || '04:00',
                settings.monthly_retention || 12,
                existingSettings.id
            ]);
            return result.rows[0];
        } else {
            const result = await query(`
                INSERT INTO backup_settings (
                    protocol, tls_mode, host, port, username, password, remote_path,
                    daily_enabled, daily_time, daily_retention,
                    weekly_enabled, weekly_day, weekly_time, weekly_retention,
                    monthly_enabled, monthly_day, monthly_time, monthly_retention
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
                RETURNING *
            `, [
                settings.protocol || 'ftp',
                settings.tls_mode || 'explicit',
                settings.host,
                settings.port || 21,
                settings.username,
                settings.password,
                settings.remote_path || '/backups',
                settings.daily_enabled || false,
                settings.daily_time || '02:00',
                settings.daily_retention || 7,
                settings.weekly_enabled || false,
                settings.weekly_day || 0,
                settings.weekly_time || '03:00',
                settings.weekly_retention || 4,
                settings.monthly_enabled || false,
                settings.monthly_day || 1,
                settings.monthly_time || '04:00',
                settings.monthly_retention || 12
            ]);
            return result.rows[0];
        }
    } catch (error) {
        safeLog('error', 'Failed to save backup settings', { error: error.message });
        throw error;
    }
}

/**
 * Cleanup stale "running" entries that have been stuck for more than 30 minutes
 * This handles cases where the backup process crashed without updating the status
 */
async function cleanupStaleRunningEntries() {
    try {
        const result = await query(`
            UPDATE backup_history 
            SET status = 'failed', 
                error_message = 'Backup process timed out or crashed',
                completed_at = NOW()
            WHERE status = 'running' 
            AND started_at < NOW() - INTERVAL '30 minutes'
            RETURNING id
        `);
        if (result.rows.length > 0) {
            safeLog('info', 'Cleaned up stale running backup entries', { 
                count: result.rows.length,
                ids: result.rows.map(r => r.id)
            });
        }
    } catch (error) {
        safeLog('error', 'Failed to cleanup stale running entries', { error: error.message });
    }
}

/**
 * Create a backup history entry
 */
async function createHistoryEntry(type, filename) {
    // First, cleanup any stale running entries
    await cleanupStaleRunningEntries();
    
    const result = await query(`
        INSERT INTO backup_history (backup_type, filename, status)
        VALUES ($1, $2, 'running')
        RETURNING *
    `, [type, filename]);
    return result.rows[0];
}

/**
 * Update backup history entry
 */
async function updateHistoryEntry(id, updates) {
    const setClauses = [];
    const values = [];
    let paramIndex = 1;
    
    for (const [key, value] of Object.entries(updates)) {
        setClauses.push(`${key} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
    }
    
    values.push(id);
    
    await query(`
        UPDATE backup_history SET ${setClauses.join(', ')}
        WHERE id = $${paramIndex}
    `, values);
}

/**
 * Get backup history
 */
export async function getBackupHistory(limit = 50, offset = 0) {
    // Cleanup stale running entries before returning history
    await cleanupStaleRunningEntries();
    
    const result = await query(`
        SELECT * FROM backup_history
        ORDER BY started_at DESC
        LIMIT $1 OFFSET $2
    `, [limit, offset]);
    
    const countResult = await query('SELECT COUNT(*) FROM backup_history');
    
    return {
        items: result.rows,
        total: parseInt(countResult.rows[0].count, 10)
    };
}

/**
 * Delete a backup history entry
 */
export async function deleteHistoryEntry(id) {
    await query('DELETE FROM backup_history WHERE id = $1', [id]);
}

/**
 * Get FTP client based on protocol
 */
async function getClient(settings) {
    if (settings.protocol === 'sftp') {
        const SftpClient = await getSftpClient();
        const client = new SftpClient();
        await client.connect({
            host: settings.host,
            port: settings.port || 22,
            username: settings.username,
            password: settings.password
        });
        return { client, type: 'sftp' };
    } else {
        const ftp = await getBasicFtp();
        const client = new ftp.Client();
        // Enable verbose logging only in development
        client.ftp.verbose = process.env.NODE_ENV === 'development';
        
        // TLS options: accept self-signed certificates
        const secureOptions = {
            rejectUnauthorized: false  // Accept self-signed certificates
        };
        
        // Determine secure mode based on protocol and tls_mode setting:
        // - protocol 'ftps' implies TLS (use tls_mode to determine explicit vs implicit)
        // - protocol 'ftp' with tls_mode 'none' = plain FTP
        // - protocol 'ftp' with tls_mode 'explicit' = AUTH TLS (like FileZilla)
        // - protocol 'ftp' with tls_mode 'implicit' = direct TLS (port 990)
        let tlsMode = settings.tls_mode;
        
        // Default to 'explicit' if tls_mode is not set or is invalid
        if (!tlsMode || !['none', 'explicit', 'implicit'].includes(tlsMode)) {
            tlsMode = 'explicit';
        }
        
        // If protocol is 'ftps', force TLS mode (default to explicit if not specified or 'none')
        if (settings.protocol === 'ftps') {
            if (tlsMode === 'none') {
                tlsMode = 'explicit';
            }
        }
        
        let secure = false;
        
        // basic-ftp documentation:
        // - secure: true = Explicit FTPS (AUTH TLS before login)
        // - secure: "implicit" = Implicit FTPS (direct TLS connection, port 990)
        // - secure: false = Plain FTP (no encryption)
        if (tlsMode === 'explicit') {
            secure = true;  // AUTH TLS - sends AUTH TLS before USER
        } else if (tlsMode === 'implicit') {
            secure = 'implicit';  // Implicit TLS (direct TLS connection on port 990)
        }
        // tlsMode === 'none' => secure = false (plain FTP, no encryption)
        
        safeLog('info', 'FTP connection params', { 
            host: settings.host, 
            port: settings.port,
            tlsMode,
            secure,
            protocol: settings.protocol,
            username: settings.username,
            hasPassword: !!settings.password,
            passwordLength: settings.password ? settings.password.length : 0
        });
        
        const accessParams = {
            host: settings.host,
            port: settings.port || (tlsMode === 'implicit' ? 990 : 21),
            user: settings.username,
            password: settings.password,
            secure: secure,
            secureOptions: secure ? secureOptions : undefined
        };
        
        safeLog('info', 'FTP access params', {
            host: accessParams.host,
            port: accessParams.port,
            user: accessParams.user,
            hasPassword: !!accessParams.password,
            secure: accessParams.secure,
            secureType: typeof accessParams.secure
        });
        
        await client.access(accessParams);
        
        return { client, type: 'ftp' };
    }
}

/**
 * Test connection to FTP/SFTP server
 */
export async function testConnection(settings) {
    let clientWrapper = null;
    try {
        clientWrapper = await getClient(settings);
        
        if (clientWrapper.type === 'sftp') {
            await clientWrapper.client.list(settings.remote_path || '/');
        } else {
            await clientWrapper.client.ensureDir(settings.remote_path || '/backups');
        }
        
        safeLog('info', 'Backup connection test successful', { 
            protocol: settings.protocol, 
            host: settings.host 
        });
        
        return { success: true, message: 'Connection successful' };
    } catch (error) {
        safeLog('error', 'Backup connection test failed', { 
            error: error.message,
            protocol: settings.protocol,
            host: settings.host
        });
        return { success: false, message: error.message };
    } finally {
        if (clientWrapper) {
            try {
                if (clientWrapper.type === 'sftp') {
                    await clientWrapper.client.end();
                } else {
                    clientWrapper.client.close();
                }
            } catch (e) {
                // Ignore close errors
            }
        }
    }
}

/**
 * Upload file to remote server
 */
async function uploadFile(settings, localPath, remotePath) {
    let clientWrapper = null;
    try {
        clientWrapper = await getClient(settings);
        
        if (clientWrapper.type === 'sftp') {
            await clientWrapper.client.put(localPath, remotePath);
        } else {
            await clientWrapper.client.uploadFrom(localPath, remotePath);
        }
        
        safeLog('info', 'File uploaded successfully', { localPath, remotePath });
        return true;
    } finally {
        if (clientWrapper) {
            try {
                if (clientWrapper.type === 'sftp') {
                    await clientWrapper.client.end();
                } else {
                    clientWrapper.client.close();
                }
            } catch (e) {
                // Ignore close errors
            }
        }
    }
}

/**
 * Download file from remote server
 */
async function downloadFile(settings, remotePath, localPath) {
    let clientWrapper = null;
    try {
        clientWrapper = await getClient(settings);
        
        if (clientWrapper.type === 'sftp') {
            await clientWrapper.client.get(remotePath, localPath);
        } else {
            await clientWrapper.client.downloadTo(localPath, remotePath);
        }
        
        safeLog('info', 'File downloaded successfully', { remotePath, localPath });
        return true;
    } finally {
        if (clientWrapper) {
            try {
                if (clientWrapper.type === 'sftp') {
                    await clientWrapper.client.end();
                } else {
                    clientWrapper.client.close();
                }
            } catch (e) {
                // Ignore close errors
            }
        }
    }
}

/**
 * List remote backups
 */
export async function listRemoteBackups(settings) {
    let clientWrapper = null;
    try {
        if (!settings || !settings.host) {
            return { success: false, files: [], message: 'No backup settings configured' };
        }
        
        clientWrapper = await getClient(settings);
        let files = [];
        
        if (clientWrapper.type === 'sftp') {
            const list = await clientWrapper.client.list(settings.remote_path || '/backups');
            files = list
                .filter(f => f.name.endsWith('.sql.gz'))
                .map(f => ({
                    name: f.name,
                    size: f.size,
                    date: new Date(f.modifyTime)
                }));
        } else {
            await clientWrapper.client.cd(settings.remote_path || '/backups');
            const list = await clientWrapper.client.list();
            files = list
                .filter(f => f.name.endsWith('.sql.gz'))
                .map(f => ({
                    name: f.name,
                    size: f.size,
                    date: f.modifiedAt
                }));
        }
        
        files.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        return { success: true, files };
    } catch (error) {
        safeLog('error', 'Failed to list remote backups', { error: error.message });
        return { success: false, files: [], message: error.message };
    } finally {
        if (clientWrapper) {
            try {
                if (clientWrapper.type === 'sftp') {
                    await clientWrapper.client.end();
                } else {
                    clientWrapper.client.close();
                }
            } catch (e) {
                // Ignore close errors
            }
        }
    }
}

/**
 * Delete old backups based on retention policy
 */
async function cleanupOldBackups(settings, type, retention) {
    let clientWrapper = null;
    try {
        clientWrapper = await getClient(settings);
        const prefix = `backup-${type}-`;
        let files = [];
        
        if (clientWrapper.type === 'sftp') {
            const list = await clientWrapper.client.list(settings.remote_path || '/backups');
            files = list
                .filter(f => f.name.startsWith(prefix) && f.name.endsWith('.sql.gz'))
                .map(f => ({
                    name: f.name,
                    date: new Date(f.modifyTime)
                }))
                .sort((a, b) => b.date - a.date);
        } else {
            await clientWrapper.client.cd(settings.remote_path || '/backups');
            const list = await clientWrapper.client.list();
            files = list
                .filter(f => f.name.startsWith(prefix) && f.name.endsWith('.sql.gz'))
                .map(f => ({
                    name: f.name,
                    date: f.modifiedAt
                }))
                .sort((a, b) => new Date(b.date) - new Date(a.date));
        }
        
        if (files.length > retention) {
            const toDelete = files.slice(retention);
            for (const file of toDelete) {
                const remotePath = path.posix.join(settings.remote_path || '/backups', file.name);
                if (clientWrapper.type === 'sftp') {
                    await clientWrapper.client.delete(remotePath);
                } else {
                    await clientWrapper.client.remove(remotePath);
                }
                safeLog('info', 'Deleted old backup', { filename: file.name });
            }
        }
    } catch (error) {
        safeLog('error', 'Failed to cleanup old backups', { error: error.message });
    } finally {
        if (clientWrapper) {
            try {
                if (clientWrapper.type === 'sftp') {
                    await clientWrapper.client.end();
                } else {
                    clientWrapper.client.close();
                }
            } catch (e) {
                // Ignore close errors
            }
        }
    }
}

/**
 * Create database backup
 */
export async function createBackup(type = 'manual') {
    const {
        POSTGRES_HOST = 'localhost',
        POSTGRES_PORT = '5432',
        POSTGRES_DB = 'resumeconverter',
        POSTGRES_USER = 'postgres',
        POSTGRES_PASSWORD
    } = process.env;
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `backup-${type}-${POSTGRES_DB}-${timestamp}.sql`;
    const compressedFilename = `${filename}.gz`;
    const localPath = path.join(BACKUP_DIR, filename);
    const compressedPath = path.join(BACKUP_DIR, compressedFilename);
    
    let historyEntry = null;
    
    try {
        // Create history entry
        historyEntry = await createHistoryEntry(type, compressedFilename);
        
        safeLog('info', 'Starting database backup', { type, filename: compressedFilename });
        
        // Find pg_dump binary
        const pgDumpBin = findPgBinary('pg_dump');
        
        // Check if pg_dump is available
        try {
            await execAsync(`"${pgDumpBin}" --version`);
        } catch (error) {
            throw new Error('pg_dump not found. Please install PostgreSQL client tools.');
        }
        
        // Build pg_dump command
        // --clean: Include DROP commands before CREATE
        // --if-exists: Add IF EXISTS to DROP commands (avoids errors on first restore)
        const env = { ...process.env, PGPASSWORD: POSTGRES_PASSWORD };
        const command = `"${pgDumpBin}" -h ${POSTGRES_HOST} -p ${POSTGRES_PORT} -U ${POSTGRES_USER} -d ${POSTGRES_DB} -F p --clean --if-exists -f "${localPath}"`;
        
        // Execute pg_dump
        await execAsync(command, { env });
        
        // Compress the backup
        const source = fs.createReadStream(localPath);
        const destination = fs.createWriteStream(compressedPath);
        const gzip = createGzip();
        
        await pipeline(source, gzip, destination);
        
        // Remove uncompressed file
        fs.unlinkSync(localPath);
        
        // Get file size
        const stats = fs.statSync(compressedPath);
        const fileSize = stats.size;
        
        // Get settings and upload
        const settings = await getBackupSettings();
        let uploaded = false;
        
        if (settings && settings.host) {
            try {
                const remotePath = path.posix.join(settings.remote_path || '/backups', compressedFilename);
                await uploadFile(settings, compressedPath, remotePath);
                uploaded = true;
                
                // Cleanup old backups based on retention
                let retention = 7;
                if (type === 'daily') retention = settings.daily_retention || 7;
                else if (type === 'weekly') retention = settings.weekly_retention || 4;
                else if (type === 'monthly') retention = settings.monthly_retention || 12;
                
                await cleanupOldBackups(settings, type, retention);
                
                // Remove local file after successful upload
                fs.unlinkSync(compressedPath);
            } catch (uploadError) {
                safeLog('error', 'Failed to upload backup', { error: uploadError.message });
                // Keep local file if upload fails
            }
        }
        
        // Update history entry
        try {
            await updateHistoryEntry(historyEntry.id, {
                status: 'success',
                file_size: fileSize,
                completed_at: new Date().toISOString(),
                uploaded
            });
        } catch (updateError) {
            safeLog('error', 'Failed to update history entry to success', { 
                historyId: historyEntry.id, 
                error: updateError.message 
            });
            // Don't throw - backup was successful, just logging failed
        }
        
        safeLog('info', 'Database backup completed', { 
            type, 
            filename: compressedFilename, 
            size: fileSize,
            uploaded 
        });
        
        return {
            success: true,
            filename: compressedFilename,
            size: fileSize,
            uploaded
        };
        
    } catch (error) {
        safeLog('error', 'Database backup failed', { type, error: error.message, stack: error.stack });
        
        if (historyEntry) {
            try {
                await updateHistoryEntry(historyEntry.id, {
                    status: 'failed',
                    error_message: error.message,
                    completed_at: new Date().toISOString()
                });
            } catch (updateError) {
                safeLog('error', 'Failed to update history entry status', { 
                    historyId: historyEntry.id, 
                    error: updateError.message 
                });
            }
        }
        
        // Cleanup temp files
        try {
            if (fs.existsSync(localPath)) fs.unlinkSync(localPath);
            if (fs.existsSync(compressedPath)) fs.unlinkSync(compressedPath);
        } catch (e) {
            // Ignore cleanup errors
        }
        
        throw error;
    }
}

/**
 * Restore database from backup
 */
export async function restoreBackup(filename) {
    const {
        POSTGRES_HOST = 'localhost',
        POSTGRES_PORT = '5432',
        POSTGRES_DB = 'resumeconverter',
        POSTGRES_USER = 'postgres',
        POSTGRES_PASSWORD
    } = process.env;
    
    const settings = await getBackupSettings();
    if (!settings || !settings.host) {
        throw new Error('Backup settings not configured');
    }
    
    const remotePath = path.posix.join(settings.remote_path || '/backups', filename);
    const localCompressedPath = path.join(TEMP_DIR, filename);
    const localPath = path.join(TEMP_DIR, filename.replace('.gz', ''));
    
    try {
        safeLog('info', 'Starting database restore', { filename });
        
        // Download backup file
        await downloadFile(settings, remotePath, localCompressedPath);
        
        // Decompress
        const source = fs.createReadStream(localCompressedPath);
        const destination = fs.createWriteStream(localPath);
        const gunzip = createGunzip();
        
        await pipeline(source, gunzip, destination);
        
        // Remove compressed file
        fs.unlinkSync(localCompressedPath);
        
        // Find psql binary
        const psqlBin = findPgBinary('psql');
        
        // Check if psql is available
        try {
            await execAsync(`"${psqlBin}" --version`);
        } catch (error) {
            throw new Error('psql not found. Please install PostgreSQL client tools.');
        }
        
        // Build psql command
        const env = { ...process.env, PGPASSWORD: POSTGRES_PASSWORD };
        
        // First, check if the backup file contains DROP commands (new format with --clean)
        const backupContent = fs.readFileSync(localPath, 'utf8').slice(0, 5000);
        const hasDropCommands = backupContent.includes('DROP TABLE') || backupContent.includes('DROP SCHEMA');
        
        if (!hasDropCommands) {
            // Old backup format without DROP commands - need to truncate tables first
            safeLog('info', 'Old backup format detected, truncating tables before restore');
            
            // Get list of tables and truncate them (in reverse dependency order)
            const truncateCommand = `"${psqlBin}" -h ${POSTGRES_HOST} -p ${POSTGRES_PORT} -U ${POSTGRES_USER} -d ${POSTGRES_DB} -c "DO $$ DECLARE r RECORD; BEGIN FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP EXECUTE 'TRUNCATE TABLE ' || quote_ident(r.tablename) || ' CASCADE'; END LOOP; END $$;"`;
            
            try {
                await execAsync(truncateCommand, { env });
                safeLog('info', 'Tables truncated successfully');
            } catch (truncateError) {
                safeLog('warn', 'Failed to truncate tables, continuing with restore', { error: truncateError.message });
            }
        }
        
        const command = `"${psqlBin}" -h ${POSTGRES_HOST} -p ${POSTGRES_PORT} -U ${POSTGRES_USER} -d ${POSTGRES_DB} -f "${localPath}"`;
        
        // Execute restore
        await execAsync(command, { env });
        
        // Cleanup
        fs.unlinkSync(localPath);
        
        safeLog('info', 'Database restore completed', { filename });
        
        return { success: true, message: 'Database restored successfully' };
        
    } catch (error) {
        safeLog('error', 'Database restore failed', { filename, error: error.message });
        
        // Cleanup temp files
        try {
            if (fs.existsSync(localCompressedPath)) fs.unlinkSync(localCompressedPath);
            if (fs.existsSync(localPath)) fs.unlinkSync(localPath);
        } catch (e) {
            // Ignore cleanup errors
        }
        
        throw error;
    }
}

export default {
    getBackupSettings,
    saveBackupSettings,
    getBackupHistory,
    deleteHistoryEntry,
    testConnection,
    listRemoteBackups,
    createBackup,
    restoreBackup
};
