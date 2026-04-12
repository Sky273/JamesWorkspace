import fs from 'fs/promises';
import os from 'os';
import path from 'path';
/**
 * Batch Jobs - Maintenance Operations
 * Cleanup old jobs and statistics
 */

import { query } from '../../config/database.js';
import { safeLog } from '../../utils/logger.backend.js';
import { clearJobExportReference, deleteOldJobs } from './jobCrud.js';
import { clearProcessedJobItemFileData } from './itemCrud.js';

const EXPORTS_DIR = path.join(os.tmpdir(), 'batch-exports');
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function isManagedBatchExportPath(filePath) {
    if (typeof filePath !== 'string' || filePath.trim().length === 0) {
        return false;
    }

    const resolvedExportsDir = path.resolve(EXPORTS_DIR);
    const resolvedFilePath = path.resolve(filePath);
    const relativePath = path.relative(resolvedExportsDir, resolvedFilePath);
    return relativePath !== ''
        && !relativePath.startsWith('..')
        && !path.isAbsolute(relativePath);
}

async function deleteExportArtifact(filePath) {
    if (!filePath) {
        return false;
    }

    if (!isManagedBatchExportPath(filePath)) {
        safeLog('warn', 'Rejected deletion of unmanaged batch export artifact', { filePath });
        return false;
    }

    try {
        await fs.unlink(filePath);
        return true;
    } catch (error) {
        if (error?.code !== 'ENOENT') {
            safeLog('warn', 'Failed to delete batch export artifact', { filePath, error: error.message });
        }
        return false;
    }
}

/**
 * Cleanup old completed/failed jobs and their items
 * Removes jobs older than specified days and clears file_data from processed items
 * @param {number} maxAgeDays - Maximum age in days for completed jobs (default: 7)
 * @returns {Promise<{deletedJobs: number, clearedFileData: number}>}
 */
export async function cleanupJobExportArtifacts(maxAgeDays = 7) {
    const safeDays = Math.max(1, Math.floor(Number(maxAgeDays) || 7));
    let orphanExportFilesDeleted = 0;
    let staleExportRefsCleared = 0;
    const maxAgeMs = safeDays * MS_PER_DAY;

    try {
        const result = await query(`
            SELECT id, export_file_path
            FROM batch_jobs
            WHERE export_file_path IS NOT NULL
        `);

        for (const row of result.rows) {
            const filePath = row.export_file_path;
            if (!filePath) continue;

            if (!isManagedBatchExportPath(filePath)) {
                safeLog('warn', 'Clearing unmanaged batch export metadata', {
                    jobId: row.id,
                    filePath
                });
                await clearJobExportReference(row.id);
                staleExportRefsCleared++;
                continue;
            }

            let stats;
            try {
                stats = await fs.stat(filePath);
            } catch (error) {
                if (error?.code !== 'ENOENT') {
                    safeLog('warn', 'Failed to stat batch export artifact', { jobId: row.id, filePath, error: error.message });
                    continue;
                }

                await clearJobExportReference(row.id);
                staleExportRefsCleared++;
                continue;
            }

            try {
                const fileAgeMs = Date.now() - stats.mtimeMs;
                if (fileAgeMs > maxAgeMs) {
                    await fs.unlink(filePath);
                    orphanExportFilesDeleted++;
                    await clearJobExportReference(row.id);
                    staleExportRefsCleared++;
                }
            } catch (error) {
                safeLog('warn', 'Failed to process batch export artifact', { jobId: row.id, filePath, error: error.message });
            }
        }

        let exportFiles = [];
        try {
            exportFiles = await fs.readdir(EXPORTS_DIR);
        } catch (error) {
            if (error?.code !== 'ENOENT') {
                safeLog('warn', 'Failed to read batch exports directory', { directory: EXPORTS_DIR, error: error.message });
            }
        }

        if (exportFiles.length > 0) {
            const referencedExportPaths = new Set(
                result.rows
                    .map((row) => row.export_file_path)
                    .filter(Boolean)
            );

            for (const fileName of exportFiles) {
                const filePath = path.join(EXPORTS_DIR, fileName);
                try {
                    const stats = await fs.stat(filePath);
                    if (stats.isDirectory()) {
                        continue;
                    }

                    const referenced = referencedExportPaths.has(filePath);
                    const fileAgeMs = Date.now() - stats.mtimeMs;
                    if (!referenced && fileAgeMs > maxAgeMs) {
                        await fs.unlink(filePath);
                        orphanExportFilesDeleted++;
                    }
                } catch (error) {
                    safeLog('warn', 'Failed to inspect orphan batch export file', { filePath, error: error.message });
                }
            }
        }

        return { orphanExportFilesDeleted, staleExportRefsCleared };
    } catch (error) {
        safeLog('error', 'Failed to cleanup batch export artifacts', { error: error.message });
        return { orphanExportFilesDeleted: 0, staleExportRefsCleared: 0 };
    }
}

export async function cleanupOldJobs(maxAgeDays = 7) {
    try {
        // First, clear file_data from all processed items (success/error) to free memory
        // Keep file_data only for pending items that haven't been processed yet
        const clearedFileData = await clearProcessedJobItemFileData();

        const safeDays = Math.max(1, Math.floor(Number(maxAgeDays) || 7));
        const exportCleanup = await cleanupJobExportArtifacts(safeDays);
        const staleJobsResult = await query(`
            SELECT id, export_file_path
            FROM batch_jobs
            WHERE status IN ('completed', 'failed', 'cancelled')
            AND completed_at < NOW() - INTERVAL '1 day' * $1
        `, [safeDays]);

        let deletedExportFiles = 0;
        for (const staleJob of staleJobsResult.rows) {
            if (await deleteExportArtifact(staleJob.export_file_path)) {
                deletedExportFiles++;
            }
        }

        // Delete old completed/failed/cancelled jobs
        const deletedJobs = await deleteOldJobs(safeDays);

        if (clearedFileData > 0 || deletedJobs > 0 || deletedExportFiles > 0 || exportCleanup.orphanExportFilesDeleted > 0 || exportCleanup.staleExportRefsCleared > 0) {
            safeLog('info', 'Batch jobs cleanup completed', { 
                clearedFileData, 
                deletedJobs,
                deletedExportFiles,
                maxAgeDays: safeDays,
                ...exportCleanup
            });
        }

        return { deletedJobs, clearedFileData, deletedExportFiles, ...exportCleanup };
    } catch (error) {
        safeLog('error', 'Failed to cleanup old batch jobs', { error: error.message });
        return { deletedJobs: 0, clearedFileData: 0, deletedExportFiles: 0, orphanExportFilesDeleted: 0, staleExportRefsCleared: 0 };
    }
}

/**
 * Get batch jobs statistics
 * @returns {Promise<Object>} Statistics about batch jobs
 */
export async function getBatchJobsStats() {
    try {
        const result = await query(`
            SELECT 
                COUNT(*) FILTER (WHERE status = 'pending') as pending_jobs,
                COUNT(*) FILTER (WHERE status = 'processing') as processing_jobs,
                COUNT(*) FILTER (WHERE status = 'completed') as completed_jobs,
                COUNT(*) FILTER (WHERE status = 'failed') as failed_jobs,
                COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_jobs,
                (SELECT COUNT(*) FROM batch_job_items WHERE status = 'pending') as pending_items,
                (SELECT COUNT(*) FROM batch_job_items WHERE file_data IS NOT NULL) as items_with_file_data,
                (SELECT COALESCE(SUM(LENGTH(file_data)), 0) FROM batch_job_items WHERE file_data IS NOT NULL) as total_file_data_bytes
            FROM batch_jobs
        `);

        const stats = result.rows[0];
        return {
            jobs: {
                pending: parseInt(stats.pending_jobs) || 0,
                processing: parseInt(stats.processing_jobs) || 0,
                completed: parseInt(stats.completed_jobs) || 0,
                failed: parseInt(stats.failed_jobs) || 0,
                cancelled: parseInt(stats.cancelled_jobs) || 0
            },
            items: {
                pending: parseInt(stats.pending_items) || 0,
                withFileData: parseInt(stats.items_with_file_data) || 0,
                fileDataSizeMB: Math.round((parseInt(stats.total_file_data_bytes) || 0) / (1024 * 1024) * 100) / 100
            }
        };
    } catch (error) {
        safeLog('error', 'Failed to get batch jobs stats', { error: error.message });
        return null;
    }
}
