import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { UPLOAD_DIR } from '../config/constants.js';
import { safeLog } from './logger.backend.js';
import { metrics } from '../services/metrics.service.js';
import { SHARE_LINK_TTL_MS } from '../services/shareResume.service.js';

/**
 * Utility for cleaning up temporary files across multiple directories
 */

// ES module __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BATCH_EXPORT_RETENTION_DAYS = 7;
const RESOLVED_UPLOAD_DIR = path.resolve(UPLOAD_DIR);
const MANAGED_CLEANUP_ROOTS = Object.freeze([
    RESOLVED_UPLOAD_DIR,
    path.join(os.tmpdir(), 'batch-exports'),
    path.resolve(path.join(__dirname, '..', 'temp'))
]);

function isPathWithinRoot(candidatePath, rootPath) {
    const relativePath = path.relative(rootPath, candidatePath);
    return relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath));
}

function isManagedCleanupPath(candidatePath) {
    const resolvedPath = path.resolve(candidatePath);
    return MANAGED_CLEANUP_ROOTS.some((rootPath) => isPathWithinRoot(resolvedPath, rootPath));
}

function resolveManagedCleanupPath(candidatePath) {
    const resolvedPath = path.resolve(candidatePath);
    if (!isManagedCleanupPath(resolvedPath)) {
        return {
            ok: false,
            resolvedPath
        };
    }

    return {
        ok: true,
        resolvedPath
    };
}

// Directory configurations with TTL (time-to-live)
const CLEANUP_DIRS = {
    uploads: {
        path: RESOLVED_UPLOAD_DIR,
        maxAgeMs: 60 * 60 * 1000,  // 1 hour
        description: 'Uploaded files'
    },
    batchJobsUploads: {
        path: path.join(RESOLVED_UPLOAD_DIR, 'batch-jobs'),
        maxAgeMs: 24 * 60 * 60 * 1000,  // 24 hours
        description: 'Batch job uploaded files'
    },
    batchExports: {
        path: path.join(os.tmpdir(), 'batch-exports'),
        maxAgeMs: BATCH_EXPORT_RETENTION_DAYS * 24 * 60 * 60 * 1000,
        description: 'Batch export ZIPs'
    },
    serverTemp: {
        path: path.join(__dirname, '..', 'temp'),
        maxAgeMs: 60 * 60 * 1000,  // 1 hour
        description: 'Server temp files'
    },
    sharedPdfs: {
        path: path.join(RESOLVED_UPLOAD_DIR, 'shared'),
        maxAgeMs: SHARE_LINK_TTL_MS,
        description: 'Shared PDF files'
    }
};

const OCR_TEMP_ENTRY_PREFIXES = [
    'resume-ocr-',
    'resume-word-ocr-'
];
const OCR_TEMP_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const OCR_TEMP_CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

// Store timer reference for cleanup
let fileCleanupTimer = null;
let ocrCleanupTimer = null;
let lastCleanupTime = null;
let totalFilesDeleted = 0;
let cleanupStats = {};
let cleanupAllDirectoriesRunning = false;

/**
 * Stop the periodic file cleanup timer
 */
export function stopPeriodicCleanup() {
    if (fileCleanupTimer) {
        clearInterval(fileCleanupTimer);
        fileCleanupTimer = null;
        safeLog('info', 'File cleanup timer stopped');
    }
    if (ocrCleanupTimer) {
        clearInterval(ocrCleanupTimer);
        ocrCleanupTimer = null;
        safeLog('info', 'OCR cleanup timer stopped');
    }
}

/**
 * Destroy file cleanup (alias for stopPeriodicCleanup for consistency)
 */
export function destroyFileCleanup() {
    stopPeriodicCleanup();
    lastCleanupTime = null;
    totalFilesDeleted = 0;
    safeLog('info', 'File cleanup destroyed');
}

/**
 * Get file cleanup statistics
 */
export function getFileCleanupStats() {
    return {
        timerActive: !!fileCleanupTimer,
        ocrTimerActive: !!ocrCleanupTimer,
        lastCleanupTime: lastCleanupTime ? new Date(lastCleanupTime).toISOString() : null,
        totalFilesDeleted,
        directories: CLEANUP_DIRS,
        cleanupStats
    };
}

/**
 * Get directory size and file count
 * @param {string} directory - Directory path
 * @returns {Promise<{fileCount: number, totalSize: number}>}
 */
async function getDirectoryStats(directory) {
    try {
        await fs.access(directory);
        const files = await fs.readdir(directory);
        let fileCount = 0;
        let totalSize = 0;

        for (const file of files) {
            try {
                const filePath = path.join(directory, file);
                const stats = await fs.stat(filePath);
                if (!stats.isDirectory()) {
                    fileCount++;
                    totalSize += stats.size;
                }
            } catch {
                // Ignore errors for individual files
            }
        }

        return { fileCount, totalSize };
    } catch {
        return { fileCount: 0, totalSize: 0 };
    }
}

/**
 * Get storage usage for all managed directories
 * @returns {Promise<Object>} Storage stats per directory
 */
export async function getStorageStats() {
    const stats = {};
    
    for (const [key, config] of Object.entries(CLEANUP_DIRS)) {
        const dirStats = await getDirectoryStats(config.path);
        stats[key] = {
            path: config.path,
            description: config.description,
            maxAgeHours: Math.round(config.maxAgeMs / (60 * 60 * 1000)),
            ...dirStats,
            totalSizeMB: Math.round(dirStats.totalSize / (1024 * 1024) * 100) / 100
        };
    }
    
    return stats;
}

/**
 * Clean up files older than specified age
 * @param {string} directory - Directory to clean
 * @param {number} maxAgeMs - Maximum age in milliseconds
 * @returns {Promise<number>} - Number of files deleted
 */
export async function cleanupOldFiles(directory, maxAgeMs = 60 * 60 * 1000) {
    try {
        const managedPath = resolveManagedCleanupPath(directory);
        if (!managedPath.ok) {
            safeLog('warn', 'Skipping cleanup for unmanaged directory', {
                directory,
                resolvedPath: managedPath.resolvedPath
            });
            return 0;
        }

        const directoryPath = managedPath.resolvedPath;
        const now = Date.now();
        let deletedCount = 0;

        // Ensure directory exists
        try {
            await fs.access(directoryPath);
        } catch {
            safeLog('info', 'Upload directory does not exist, creating it', { directory: directoryPath });
            await fs.mkdir(directoryPath, { recursive: true });
            return 0;
        }

        const files = await fs.readdir(directoryPath);

        for (const file of files) {
            try {
                const filePath = path.join(directoryPath, file);
                const stats = await fs.stat(filePath);

                // Skip directories
                if (stats.isDirectory()) {
                    continue;
                }

                const fileAge = now - stats.mtimeMs;

                if (fileAge > maxAgeMs) {
                    await fs.unlink(filePath);
                    deletedCount++;
                    safeLog('debug', 'Deleted old temporary file', {
                        file,
                        ageMinutes: Math.round(fileAge / 60000)
                    });
                }
            } catch (error) {
                // File might have been deleted by another process, ignore
                if (error.code !== 'ENOENT') {
                    safeLog('warn', 'Error processing file during cleanup', {
                        file,
                        error: error.message
                    });
                }
            }
        }

        if (deletedCount > 0) {
            safeLog('info', 'Temporary file cleanup completed', {
                deletedCount,
                directory: directoryPath
            });
        }

        // Update stats
        lastCleanupTime = Date.now();
        totalFilesDeleted += deletedCount;

        return deletedCount;
    } catch (error) {
        safeLog('error', 'Error during file cleanup', {
            directory,
            error: error.message
        });
        return 0;
    }
}

export async function cleanupOcrTempArtifacts(maxAgeMs = OCR_TEMP_MAX_AGE_MS) {
    const tmpDirectory = os.tmpdir();

    try {
        const entries = await fs.readdir(tmpDirectory);
        const now = Date.now();
        let deletedCount = 0;

        for (const entry of entries) {
            if (!OCR_TEMP_ENTRY_PREFIXES.some(prefix => entry.startsWith(prefix))) {
                continue;
            }

            const entryPath = path.join(tmpDirectory, entry);

            try {
                const stats = await fs.stat(entryPath);
                const entryAge = now - stats.mtimeMs;

                if (entryAge <= maxAgeMs) {
                    continue;
                }

                if (stats.isDirectory()) {
                    await fs.rm(entryPath, { recursive: true, force: true });
                } else {
                    await fs.unlink(entryPath);
                }

                deletedCount++;
            } catch (error) {
                if (error.code !== 'ENOENT') {
                    safeLog('warn', 'Error processing OCR temporary artifact during cleanup', {
                        entry,
                        error: error.message
                    });
                }
            }
        }

        cleanupStats.ocrTempArtifacts = {
            lastCleanup: new Date().toISOString(),
            deletedCount,
            tmpDirectory,
            maxAgeHours: Math.round(maxAgeMs / (60 * 60 * 1000))
        };
        lastCleanupTime = Date.now();
        totalFilesDeleted += deletedCount;

        if (deletedCount > 0) {
            safeLog('info', 'OCR temporary artifact cleanup completed', {
                deletedCount,
                tmpDirectory
            });
        }

        return deletedCount;
    } catch (error) {
        safeLog('error', 'Error during OCR temporary artifact cleanup', {
            tmpDirectory,
            error: error.message
        });
        return 0;
    }
}

/**
 * Clean all configured directories with their respective TTLs
 * Also cleans up old batch jobs and their file_data
 * @returns {Promise<Object>} Cleanup results per directory
 */
async function cleanupAllDirectories(options = {}) {
    if (cleanupAllDirectoriesRunning) {
        safeLog('warn', 'File cleanup already in progress, skipping overlapping run');
        return {
            cleanup: {
                success: false,
                skipped: true,
                reason: 'cleanup_in_progress'
            }
        };
    }

    cleanupAllDirectoriesRunning = true;
    const { enableDatabaseTasks = true } = options;
    const results = {};

    try {
        if (enableDatabaseTasks) {
            try {
                const { cleanupExpiredShareArtifacts } = await import('../services/shareResume.service.js');
                const shareCleanup = await cleanupExpiredShareArtifacts();
                results.sharedLinks = { success: true, ...shareCleanup };
                cleanupStats.sharedLinks = {
                    lastCleanup: new Date().toISOString(),
                    ...shareCleanup
                };
            } catch (error) {
                results.sharedLinks = { success: false, error: error.message };
                safeLog('debug', 'Expired share cleanup skipped', { error: error.message });
            }
        } else {
            results.sharedLinks = { success: false, skipped: true, reason: 'database_unavailable' };
        }
        
        for (const [key, config] of Object.entries(CLEANUP_DIRS)) {
            if (key === 'batchExports') {
                results[key] = {
                    success: false,
                    skipped: true,
                    reason: 'managed_by_batch_jobs'
                };
                cleanupStats[key] = {
                    lastCleanup: new Date().toISOString(),
                    skipped: true,
                    reason: 'managed_by_batch_jobs'
                };
                continue;
            }

            try {
                const deletedCount = await cleanupOldFiles(config.path, config.maxAgeMs);
                results[key] = { success: true, deletedCount };
                cleanupStats[key] = { 
                    lastCleanup: new Date().toISOString(), 
                    deletedCount 
                };
            } catch (error) {
                results[key] = { success: false, error: error.message };
                safeLog('error', `Cleanup failed for ${config.description}`, { 
                    directory: config.path, 
                    error: error.message 
                });
            }
        }
        
        // Also cleanup batch jobs file_data and old jobs
        if (enableDatabaseTasks) {
            try {
                const { cleanupOldJobs } = await import('../services/batchJobs.service.js');
                const batchCleanup = await cleanupOldJobs(7); // Keep jobs for 7 days
                metrics.trackCleanupActivity({
                    filesDeleted: batchCleanup.deletedJobs || 0,
                    orphanExportFilesDeleted: batchCleanup.orphanExportFilesDeleted || 0,
                    staleExportRefsCleared: batchCleanup.staleExportRefsCleared || 0,
                    metadata: { source: 'batchJobs' }
                });
                results.batchJobs = { success: true, ...batchCleanup };
                cleanupStats.batchJobs = {
                    lastCleanup: new Date().toISOString(),
                    ...batchCleanup
                };
            } catch (error) {
                results.batchJobs = { success: false, error: error.message };
                safeLog('debug', 'Batch jobs cleanup skipped', { error: error.message });
            }
        } else {
            results.batchJobs = { success: false, skipped: true, reason: 'database_unavailable' };
        }
        
        // Cleanup old local backup files based on retention settings
        try {
            const { cleanupAllLocalBackups } = await import('../services/backup.service.js');
            const backupCleanup = await cleanupAllLocalBackups();
            const totalDeleted = Object.values(backupCleanup).reduce((a, b) => a + b, 0);
            results.localBackups = { success: true, deleted: totalDeleted, ...backupCleanup };
            cleanupStats.localBackups = {
                lastCleanup: new Date().toISOString(),
                ...backupCleanup
            };
        } catch (error) {
            results.localBackups = { success: false, error: error.message };
            safeLog('debug', 'Local backups cleanup skipped', { error: error.message });
        }
        
        const totalDirectoryDeletes = Object.values(results)
            .filter(result => result.success && typeof result.deletedCount === 'number')
            .reduce((sum, result) => sum + result.deletedCount, 0);

        metrics.trackCleanupActivity({
            filesDeleted: totalDirectoryDeletes,
            metadata: { source: 'fileCleanup' }
        });

        return results;
    } finally {
        cleanupAllDirectoriesRunning = false;
    }
}

/**
 * Start periodic cleanup of temporary files across all directories
 * @param {number} intervalMs - Cleanup interval in milliseconds (default: 1 hour)
 * @param {number} _maxAgeMs - Deprecated: each directory uses its own TTL from CLEANUP_DIRS
 * @returns {NodeJS.Timeout} - Interval timer
 */
export function startPeriodicCleanup(intervalMs = 60 * 60 * 1000, _maxAgeMs = 60 * 60 * 1000, options = {}) {
    stopPeriodicCleanup();

    const {
        enableDatabaseTasks = true,
        enableDailyOcrCleanup = true,
        ocrCleanupIntervalMs = OCR_TEMP_CLEANUP_INTERVAL_MS,
        ocrMaxAgeMs = OCR_TEMP_MAX_AGE_MS
    } = options;
    const dirCount = Object.keys(CLEANUP_DIRS).length;
    safeLog('info', 'Starting periodic file cleanup for all directories', {
        intervalMinutes: intervalMs / 60000,
        directories: dirCount,
        enableDatabaseTasks,
        enableDailyOcrCleanup,
        ocrCleanupIntervalHours: Math.round(ocrCleanupIntervalMs / (60 * 60 * 1000)),
        ocrMaxAgeHours: Math.round(ocrMaxAgeMs / (60 * 60 * 1000)),
        configs: Object.entries(CLEANUP_DIRS).map(([key, config]) => ({
            name: key,
            path: config.path,
            maxAgeHours: Math.round(config.maxAgeMs / (60 * 60 * 1000))
        }))
    });

    // Run cleanup immediately on startup for all directories
    cleanupAllDirectories({ enableDatabaseTasks }).then(results => {
        const totalDeleted = Object.values(results)
            .filter(r => r.success)
            .reduce((sum, r) => sum + r.deletedCount, 0);
        if (totalDeleted > 0) {
            safeLog('info', 'Initial cleanup completed', { totalDeleted, results });
        }
    }).catch(error => {
        safeLog('error', 'Initial cleanup failed', { error: error.message });
    });

    // Schedule periodic cleanup for all directories
    const timer = setInterval(() => {
        cleanupAllDirectories({ enableDatabaseTasks }).then(results => {
            const totalDeleted = Object.values(results)
                .filter(r => r.success)
                .reduce((sum, r) => sum + r.deletedCount, 0);
            if (totalDeleted > 0) {
                safeLog('info', 'Periodic cleanup completed', { totalDeleted });
            }
        }).catch(error => {
            safeLog('error', 'Periodic cleanup failed', { error: error.message });
        });
    }, intervalMs);

    // Store timer reference for external cleanup
    fileCleanupTimer = timer;

    if (enableDailyOcrCleanup) {
        cleanupOcrTempArtifacts(ocrMaxAgeMs).catch(error => {
            safeLog('error', 'Initial OCR cleanup failed', { error: error.message });
        });

        ocrCleanupTimer = setInterval(() => {
            cleanupOcrTempArtifacts(ocrMaxAgeMs).catch(error => {
                safeLog('error', 'Scheduled OCR cleanup failed', { error: error.message });
            });
        }, ocrCleanupIntervalMs);
    }

    return timer;
}

/**
 * Clean up all files in upload directory (use with caution)
 * @returns {Promise<number>} - Number of files deleted
 */
export async function cleanupAllFiles() {
    try {
        const managedUploadDir = resolveManagedCleanupPath(UPLOAD_DIR);
        if (!managedUploadDir.ok) {
            safeLog('error', 'Upload directory is outside managed cleanup roots', {
                directory: UPLOAD_DIR,
                resolvedPath: managedUploadDir.resolvedPath
            });
            return 0;
        }

        const uploadDir = managedUploadDir.resolvedPath;
        const files = await fs.readdir(uploadDir);
        let deletedCount = 0;

        for (const file of files) {
            try {
                const filePath = path.join(uploadDir, file);
                const stats = await fs.stat(filePath);

                // Skip directories
                if (stats.isDirectory()) {
                    continue;
                }

                await fs.unlink(filePath);
                deletedCount++;
            } catch (error) {
                if (error.code !== 'ENOENT') {
                    safeLog('warn', 'Error deleting file', {
                        file,
                        error: error.message
                    });
                }
            }
        }

        safeLog('info', 'All temporary files cleaned up', { deletedCount });
        return deletedCount;
    } catch (error) {
        safeLog('error', 'Error cleaning up all files', { error: error.message });
        return 0;
    }
}
