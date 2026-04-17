/**
 * Backup Core Service
 * Handles database backup creation, restoration, and local file management
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { query } from '../../config/database.js';
import { safeLog } from '../../utils/logger.backend.js';
import { getBackupSettings } from './settings.service.js';
import { createHistoryEntry, updateHistoryEntry } from './history.service.js';
import { uploadFile, downloadFile, cleanupOldRemoteBackups } from './ftp.service.js';
import {
    safeUnlink,
    createBackupArtifact,
    restoreBackupArtifact,
    cleanupBackupArtifacts
} from './artifacts.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const BACKUP_DIR = path.join(__dirname, '..', '..', 'backups');
export const TEMP_DIR = path.join(__dirname, '..', '..', 'temp');

const SAFE_BACKUP_FILENAME_PATTERN = /^backup-(daily|weekly|monthly|manual)-[A-Za-z0-9_-]+-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.sql\.gz$/;

async function ensureBackupDirectories() {
    await Promise.all([
        fs.promises.mkdir(BACKUP_DIR, { recursive: true }),
        fs.promises.mkdir(TEMP_DIR, { recursive: true })
    ]);
}

function assertSafeBackupFilename(filename) {
    if (typeof filename !== 'string' || !SAFE_BACKUP_FILENAME_PATTERN.test(filename)) {
        throw new Error('Invalid backup filename');
    }

    if (path.basename(filename) !== filename) {
        throw new Error('Invalid backup filename');
    }

    return filename;
}

function buildSafePath(baseDir, filename) {
    const resolvedBaseDir = path.resolve(baseDir);
    const resolvedPath = path.resolve(resolvedBaseDir, filename);

    if (resolvedPath !== resolvedBaseDir && !resolvedPath.startsWith(`${resolvedBaseDir}${path.sep}`)) {
        throw new Error('Invalid backup filename');
    }

    return resolvedPath;
}

async function getBackupFilesMatching(pattern) {
    const files = await fs.promises.readdir(BACKUP_DIR);
    const matchingFiles = await Promise.all(
        files
            .filter((fileName) => pattern.test(fileName))
            .map(async (fileName) => {
                const filePath = path.join(BACKUP_DIR, fileName);
                const stats = await fs.promises.stat(filePath);
                return {
                    name: fileName,
                    path: filePath,
                    size: stats.size,
                    mtime: stats.mtime
                };
            })
    );

    return matchingFiles.sort((a, b) => b.mtime - a.mtime);
}

/**
 * Cleanup old local backup files based on retention policy
 */
export async function cleanupOldLocalBackups(type, retention) {
    try {
        await ensureBackupDirectories();
        const pattern = new RegExp(`^backup-${type}-.*\\.sql\\.gz$`);
        const matchingFiles = await getBackupFilesMatching(pattern);
        
        if (matchingFiles.length > retention) {
            const filesToDelete = matchingFiles.slice(retention);
            
            for (const file of filesToDelete) {
                try {
                    await safeUnlink(file.path);
                    safeLog('info', 'Deleted old local backup', { 
                        filename: file.name, 
                        type,
                        age: Math.round((Date.now() - file.mtime.getTime()) / (1000 * 60 * 60 * 24)) + ' days'
                    });
                } catch (deleteError) {
                    safeLog('error', 'Failed to delete old local backup', { 
                        filename: file.name, 
                        error: deleteError.message 
                    });
                }
            }
            
            safeLog('info', 'Local backup cleanup completed', { 
                type, 
                retention,
                kept: retention,
                deleted: filesToDelete.length 
            });
        }
    } catch (error) {
        safeLog('error', 'Failed to cleanup old local backups', { type, error: error.message });
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
        await ensureBackupDirectories();
        historyEntry = await createHistoryEntry(type, compressedFilename);
        
        safeLog('info', 'Starting database backup', { type, filename: compressedFilename });
        
        const env = { ...process.env, PGPASSWORD: POSTGRES_PASSWORD };
        await createBackupArtifact({
            versionErrorMessage: 'pg_dump not found. Please install PostgreSQL client tools.',
            dumpArgs: [
                '-h', POSTGRES_HOST,
                '-p', POSTGRES_PORT,
                '-U', POSTGRES_USER,
                '-d', POSTGRES_DB,
                '-F', 'p',
                '--clean',
                '--if-exists',
                '-f', localPath
            ],
            env,
            localPath,
            compressedPath
        });
        
        const stats = await fs.promises.stat(compressedPath);
        const fileSize = stats.size;
        
        const settings = await getBackupSettings();
        let uploaded = false;
        
        const shouldUpload = settings && settings.backup_target === 'remote' && settings.host;
        
        if (shouldUpload) {
            try {
                const remotePath = path.posix.join(settings.remote_path || '/backups', compressedFilename);
                await uploadFile(settings, compressedPath, remotePath);
                uploaded = true;
                
                let retention = 7;
                if (type === 'daily') retention = settings.daily_retention || 7;
                else if (type === 'weekly') retention = settings.weekly_retention || 4;
                else if (type === 'monthly') retention = settings.monthly_retention || 12;
                
                await cleanupOldRemoteBackups(settings, type, retention);
                
                await safeUnlink(compressedPath);
                safeLog('info', 'Backup uploaded to remote server', { filename: compressedFilename });
            } catch (uploadError) {
                safeLog('error', 'BACKUP UPLOAD FAILED - Backup created locally but upload to remote server failed', { 
                    error: uploadError.message,
                    stack: uploadError.stack,
                    code: uploadError.code,
                    filename: compressedFilename,
                    host: settings.host,
                    protocol: settings.protocol
                });
            }
        } else {
            safeLog('info', 'Backup stored locally', { 
                filename: compressedFilename, 
                path: compressedPath,
                target: settings?.backup_target || 'local'
            });
            
            if (settings) {
                let retention = 7;
                if (type === 'daily') retention = settings.daily_retention || 7;
                else if (type === 'weekly') retention = settings.weekly_retention || 4;
                else if (type === 'monthly') retention = settings.monthly_retention || 12;
                
                await cleanupOldLocalBackups(type, retention);
            }
        }
        
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
        
        await cleanupBackupArtifacts([localPath, compressedPath]);
        
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
    
    const safeFilename = assertSafeBackupFilename(filename);
    const remotePath = path.posix.join(settings.remote_path || '/backups', safeFilename);
    const localCompressedPath = buildSafePath(TEMP_DIR, safeFilename);
    const localPath = buildSafePath(TEMP_DIR, safeFilename.replace(/\.gz$/i, ''));
    
    try {
        await ensureBackupDirectories();
        safeLog('info', 'Starting database restore', { filename });
        
        await downloadFile(settings, remotePath, localCompressedPath);
        
        const env = { ...process.env, PGPASSWORD: POSTGRES_PASSWORD };
        await restoreBackupArtifact({
            versionErrorMessage: 'psql not found. Please install PostgreSQL client tools.',
            env,
            localCompressedPath,
            localPath,
            restoreArgs: [
                '-h', POSTGRES_HOST,
                '-p', POSTGRES_PORT,
                '-U', POSTGRES_USER,
                '-d', POSTGRES_DB,
                '-f', localPath
            ],
            legacyTruncateArgs: [
                '-h', POSTGRES_HOST,
                '-p', POSTGRES_PORT,
                '-U', POSTGRES_USER,
                '-d', POSTGRES_DB,
                '-c',
                "DO $$ DECLARE r RECORD; BEGIN FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP EXECUTE 'TRUNCATE TABLE ' || quote_ident(r.tablename) || ' CASCADE'; END LOOP; END $$;"
            ]
        });
        
        safeLog('info', 'Database restore completed', { filename });
        
        return { success: true, message: 'Database restored successfully' };
        
    } catch (error) {
        safeLog('error', 'Database restore failed', { filename, error: error.message });
        
        await cleanupBackupArtifacts([localCompressedPath, localPath]);
        
        throw error;
    }
}

/**
 * Cleanup all old local backups based on retention settings
 */
export async function cleanupAllLocalBackups() {
    const settings = await getBackupSettings();
    const results = { daily: 0, weekly: 0, monthly: 0, manual: 0 };
    
    if (!settings) {
        safeLog('debug', 'No backup settings found, skipping local backup cleanup');
        return results;
    }
    
    if (settings.backup_target !== 'local') {
        safeLog('debug', 'Backup target is remote, skipping local backup cleanup');
        return results;
    }

    await ensureBackupDirectories();
    
    const types = [
        { type: 'daily', retention: settings.daily_retention || 7 },
        { type: 'weekly', retention: settings.weekly_retention || 4 },
        { type: 'monthly', retention: settings.monthly_retention || 12 },
        { type: 'manual', retention: 10 }
    ];
    
    for (const { type, retention } of types) {
        try {
            const pattern = new RegExp(`^backup-${type}-.*\\.sql\\.gz$`);
            const matchingFiles = await getBackupFilesMatching(pattern);
            
            if (matchingFiles.length > retention) {
                const filesToDelete = matchingFiles.slice(retention);
                
                for (const file of filesToDelete) {
                    try {
                        await safeUnlink(file.path);
                        results[type]++;
                        
                        await query(`
                            DELETE FROM backup_history 
                            WHERE filename = $1
                        `, [file.name]);
                    } catch (delErr) {
                        safeLog('error', 'Failed to delete backup file', { file: file.name, error: delErr.message });
                    }
                }
            }
        } catch (cleanupErr) {
            safeLog('error', `Failed to cleanup ${type} backups`, { error: cleanupErr.message });
        }
    }
    
    const totalDeleted = Object.values(results).reduce((a, b) => a + b, 0);
    if (totalDeleted > 0) {
        safeLog('info', 'Local backup cleanup completed', { results, totalDeleted });
    }
    
    return results;
}

/**
 * Get local backup statistics
 */
export async function getLocalBackupStats() {
    try {
        await ensureBackupDirectories();
        const files = await fs.promises.readdir(BACKUP_DIR);
        const stats = {
            daily: { count: 0, totalSize: 0, oldest: null, newest: null },
            weekly: { count: 0, totalSize: 0, oldest: null, newest: null },
            monthly: { count: 0, totalSize: 0, oldest: null, newest: null },
            manual: { count: 0, totalSize: 0, oldest: null, newest: null }
        };
        
        for (const type of ['daily', 'weekly', 'monthly', 'manual']) {
            const pattern = new RegExp(`^backup-${type}-.*\\.sql\\.gz$`);
            const matchingFiles = await Promise.all(
                files
                    .filter((fileName) => pattern.test(fileName))
                    .map(async (fileName) => {
                        const filePath = path.join(BACKUP_DIR, fileName);
                        const fileStat = await fs.promises.stat(filePath);
                        return { name: fileName, size: fileStat.size, mtime: fileStat.mtime };
                    })
            );
            matchingFiles.sort((a, b) => b.mtime - a.mtime);
            
            stats[type].count = matchingFiles.length;
            stats[type].totalSize = matchingFiles.reduce((sum, f) => sum + f.size, 0);
            if (matchingFiles.length > 0) {
                stats[type].newest = matchingFiles[0].mtime;
                stats[type].oldest = matchingFiles[matchingFiles.length - 1].mtime;
            }
        }
        
        return stats;
    } catch (error) {
        safeLog('error', 'Failed to get local backup stats', { error: error.message });
        return null;
    }
}
