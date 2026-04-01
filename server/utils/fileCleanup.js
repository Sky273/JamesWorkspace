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

// Directory configurations with TTL (time-to-live)
const CLEANUP_DIRS = {
    uploads: {
        path: UPLOAD_DIR,
        maxAgeMs: 60 * 60 * 1000,  // 1 hour
        description: 'Uploaded files'
    },
    batchExports: {
        path: path.join(os.tmpdir(), 'batch-exports'),
        maxAgeMs: 24 * 60 * 60 * 1000,  // 24 hours
        description: 'Batch export ZIPs'
    },
    serverTemp: {
        path: path.join(__dirname, '..', 'temp'),
        maxAgeMs: 60 * 60 * 1000,  // 1 hour
        description: 'Server temp files'
    },
    sharedPdfs: {
        path: path.join(UPLOAD_DIR, 'shared'),
        maxAgeMs: SHARE_LINK_TTL_MS,
        description: 'Shared PDF files'
    }
};

// Store timer reference for cleanup
let fileCleanupTimer = null;
let lastCleanupTime = null;
let totalFilesDeleted = 0;
let cleanupStats = {};

/**
 * Stop the periodic file cleanup timer
 */
export function stopPeriodicCleanup() {
    if (fileCleanupTimer) {
        clearInterval(fileCleanupTimer);
        fileCleanupTimer = null;
        safeLog('info', 'File cleanup timer stopped');
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
        const now = Date.now();
        let deletedCount = 0;

        // Ensure directory exists
        try {
            await fs.access(directory);
        } catch {
            safeLog('info', 'Upload directory does not exist, creating it', { directory });
            await fs.mkdir(directory, { recursive: true });
            return 0;
        }

        const files = await fs.readdir(directory);

        for (const file of files) {
            try {
                const filePath = path.join(directory, file);
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
                directory
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

/**
 * Clean all configured directories with their respective TTLs
 * Also cleans up old batch jobs and their file_data
 * @returns {Promise<Object>} Cleanup results per directory
 */
async function cleanupAllDirectories() {
    const results = {};

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
    
    for (const [key, config] of Object.entries(CLEANUP_DIRS)) {
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
}

/**
 * Start periodic cleanup of temporary files across all directories
 * @param {number} intervalMs - Cleanup interval in milliseconds (default: 1 hour)
 * @param {number} _maxAgeMs - Deprecated: each directory uses its own TTL from CLEANUP_DIRS
 * @returns {NodeJS.Timeout} - Interval timer
 */
export function startPeriodicCleanup(intervalMs = 60 * 60 * 1000, _maxAgeMs = 60 * 60 * 1000) {
    const dirCount = Object.keys(CLEANUP_DIRS).length;
    safeLog('info', 'Starting periodic file cleanup for all directories', {
        intervalMinutes: intervalMs / 60000,
        directories: dirCount,
        configs: Object.entries(CLEANUP_DIRS).map(([key, config]) => ({
            name: key,
            path: config.path,
            maxAgeHours: Math.round(config.maxAgeMs / (60 * 60 * 1000))
        }))
    });

    // Run cleanup immediately on startup for all directories
    cleanupAllDirectories().then(results => {
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
        cleanupAllDirectories().then(results => {
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

    return timer;
}

/**
 * Clean up all files in upload directory (use with caution)
 * @returns {Promise<number>} - Number of files deleted
 */
export async function cleanupAllFiles() {
    try {
        const files = await fs.readdir(UPLOAD_DIR);
        let deletedCount = 0;

        for (const file of files) {
            try {
                const filePath = path.join(UPLOAD_DIR, file);
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
