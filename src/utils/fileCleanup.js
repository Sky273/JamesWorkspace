import fs from 'fs/promises';
import path from 'path';
import { UPLOAD_DIR } from '../config/constants.js';
import { safeLog } from './logger.backend.js';

/**
 * Utility for cleaning up temporary files
 */

// Store timer reference for cleanup
let fileCleanupTimer = null;
let lastCleanupTime = null;
let totalFilesDeleted = 0;

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
        uploadDir: UPLOAD_DIR
    };
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
 * Start periodic cleanup of temporary files
 * @param {number} intervalMs - Cleanup interval in milliseconds (default: 1 hour)
 * @param {number} maxAgeMs - Maximum file age in milliseconds (default: 1 hour)
 * @returns {NodeJS.Timeout} - Interval timer
 */
export function startPeriodicCleanup(intervalMs = 60 * 60 * 1000, maxAgeMs = 60 * 60 * 1000) {
    safeLog('info', 'Starting periodic file cleanup', {
        intervalMinutes: intervalMs / 60000,
        maxAgeMinutes: maxAgeMs / 60000,
        directory: UPLOAD_DIR
    });

    // Run cleanup immediately on startup
    cleanupOldFiles(UPLOAD_DIR, maxAgeMs).catch(error => {
        safeLog('error', 'Initial cleanup failed', { error: error.message });
    });

    // Schedule periodic cleanup
    const timer = setInterval(() => {
        cleanupOldFiles(UPLOAD_DIR, maxAgeMs).catch(error => {
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
