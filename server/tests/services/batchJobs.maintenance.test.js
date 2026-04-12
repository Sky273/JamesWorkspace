/**
 * Tests for Batch Jobs - Maintenance Operations
 * Tests cleanupOldJobs, cleanupJobExportArtifacts and getBatchJobsStats
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import os from 'os';
import path from 'path';

vi.mock('../../config/database.js', () => ({
    query: vi.fn()
}));

vi.mock('fs/promises', () => ({
    default: {
        stat: vi.fn(),
        readdir: vi.fn(),
        unlink: vi.fn()
    },
    stat: vi.fn(),
    readdir: vi.fn(),
    unlink: vi.fn()
}));

vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn()
}));

const mockClearJobExportReference = vi.fn();
const mockDeleteOldJobs = vi.fn();
const mockClearProcessedJobItemFileData = vi.fn();

vi.mock('../../services/batchJobs/jobCrud.js', () => ({
    clearJobExportReference: (...args) => mockClearJobExportReference(...args),
    deleteOldJobs: (...args) => mockDeleteOldJobs(...args)
}));

vi.mock('../../services/batchJobs/itemCrud.js', () => ({
    clearProcessedJobItemFileData: (...args) => mockClearProcessedJobItemFileData(...args)
}));

import { query } from '../../config/database.js';
import fs from 'fs/promises';
import {
    cleanupJobExportArtifacts,
    cleanupOldJobs,
    getBatchJobsStats
} from '../../services/batchJobs/maintenance.js';

const managedExportPath = path.join(os.tmpdir(), 'batch-exports', 'export.zip');
const managedStaleJobExportPath = path.join(os.tmpdir(), 'batch-exports', 'stale-job-export.zip');

describe('Batch Jobs - Maintenance', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockClearJobExportReference.mockImplementation((jobId) => query(`
            UPDATE batch_jobs
            SET export_file_path = NULL, export_file_name = NULL
            WHERE id = $1
        `, [jobId]));
        mockDeleteOldJobs.mockImplementation((maxAgeDays) => query(`
            DELETE FROM batch_jobs 
            WHERE status IN ('completed', 'failed', 'cancelled')
            AND completed_at < NOW() - INTERVAL '1 day' * $1
            RETURNING id
        `, [maxAgeDays]).then((result) => result.rowCount || 0));
        mockClearProcessedJobItemFileData.mockImplementation(() => query(`
            UPDATE batch_job_items 
            SET file_data = NULL 
            WHERE file_data IS NOT NULL 
            AND status IN ('success', 'error', 'skipped', 'pending_name')
        `).then((result) => result.rowCount || 0));
        vi.mocked(fs.readdir).mockRejectedValue(Object.assign(new Error('missing'), { code: 'ENOENT' }));
    });

    describe('cleanupOldJobs', () => {
        it('should clear file_data, cleanup export refs, and delete old jobs', async () => {
            query.mockResolvedValueOnce({ rowCount: 5 });
            query.mockResolvedValueOnce({ rows: [{ id: 'job-1', export_file_path: managedExportPath }] });
            query.mockResolvedValueOnce({ rows: [] });
            query.mockResolvedValueOnce({ rows: [{ id: 'job-2', export_file_path: managedStaleJobExportPath }] });
            query.mockResolvedValueOnce({ rowCount: 2 });
            vi.mocked(fs.stat).mockResolvedValueOnce({
                isDirectory: () => false,
                mtimeMs: Date.now() - (8 * 24 * 60 * 60 * 1000)
            });
            vi.mocked(fs.unlink).mockResolvedValueOnce(undefined);
            vi.mocked(fs.unlink).mockResolvedValueOnce(undefined);

            const result = await cleanupOldJobs(7);

            expect(result).toEqual({
                deletedJobs: 2,
                clearedFileData: 5,
                deletedExportFiles: 1,
                orphanExportFilesDeleted: 1,
                staleExportRefsCleared: 1
            });
            expect(query.mock.calls[0][0]).toContain('file_data = NULL');
            expect(query.mock.calls[0][0]).toContain('pending_name');
            expect(query.mock.calls[4][0]).toContain('DELETE FROM batch_jobs');
        });

        it('should use default maxAgeDays of 7', async () => {
            query.mockResolvedValueOnce({ rowCount: 0 });
            query.mockResolvedValueOnce({ rows: [] });
            query.mockResolvedValueOnce({ rows: [] });
            query.mockResolvedValueOnce({ rowCount: 0 });

            await cleanupOldJobs();

            expect(query.mock.calls.at(-1)?.[1]).toEqual([7]);
        });

        it('should fallback to 7 days when given 0', async () => {
            query.mockResolvedValueOnce({ rowCount: 0 });
            query.mockResolvedValueOnce({ rows: [] });
            query.mockResolvedValueOnce({ rows: [] });
            query.mockResolvedValueOnce({ rowCount: 0 });

            await cleanupOldJobs(0);

            expect(query.mock.calls.at(-1)?.[1]).toEqual([7]);
        });

        it('should return zeros on error', async () => {
            query.mockRejectedValueOnce(new Error('DB error'));

            const result = await cleanupOldJobs();

            expect(result).toEqual({
                deletedJobs: 0,
                clearedFileData: 0,
                deletedExportFiles: 0,
                orphanExportFilesDeleted: 0,
                staleExportRefsCleared: 0
            });
        });
    });

    describe('cleanupJobExportArtifacts', () => {
        it('should clear stale DB references when the export file is missing', async () => {
            query
                .mockResolvedValueOnce({ rows: [{ id: 'job-1', export_file_path: managedExportPath }] })
                .mockResolvedValueOnce({ rows: [] });
            vi.mocked(fs.stat).mockRejectedValueOnce(Object.assign(new Error('not found'), { code: 'ENOENT' }));

            const result = await cleanupJobExportArtifacts(7);

            expect(result).toEqual({ orphanExportFilesDeleted: 0, staleExportRefsCleared: 1 });
            expect(query.mock.calls[1][0]).toContain('SET export_file_path = NULL, export_file_name = NULL');
        });

        it('should delete expired referenced export files and clear their DB refs', async () => {
            query
                .mockResolvedValueOnce({ rows: [{ id: 'job-1', export_file_path: managedExportPath }] })
                .mockResolvedValueOnce({ rows: [] });
            vi.mocked(fs.stat).mockResolvedValueOnce({
                isDirectory: () => false,
                mtimeMs: Date.now() - (8 * 24 * 60 * 60 * 1000)
            });
            vi.mocked(fs.unlink).mockResolvedValueOnce(undefined);

            const result = await cleanupJobExportArtifacts(7);

            expect(result).toEqual({ orphanExportFilesDeleted: 1, staleExportRefsCleared: 1 });
            expect(fs.unlink).toHaveBeenCalledWith(managedExportPath);
        });
    });

    describe('getBatchJobsStats', () => {
        it('should return formatted stats', async () => {
            query.mockResolvedValueOnce({
                rows: [{
                    pending_jobs: '3',
                    processing_jobs: '1',
                    completed_jobs: '10',
                    failed_jobs: '2',
                    cancelled_jobs: '0',
                    pending_items: '15',
                    items_with_file_data: '5',
                    total_file_data_bytes: '10485760'
                }]
            });

            const result = await getBatchJobsStats();

            expect(result.jobs.pending).toBe(3);
            expect(result.jobs.processing).toBe(1);
            expect(result.jobs.completed).toBe(10);
            expect(result.jobs.failed).toBe(2);
            expect(result.jobs.cancelled).toBe(0);
            expect(result.items.pending).toBe(15);
            expect(result.items.withFileData).toBe(5);
            expect(result.items.fileDataSizeMB).toBe(10);
        });

        it('should handle null/zero values', async () => {
            query.mockResolvedValueOnce({
                rows: [{
                    pending_jobs: null,
                    processing_jobs: null,
                    completed_jobs: null,
                    failed_jobs: null,
                    cancelled_jobs: null,
                    pending_items: null,
                    items_with_file_data: null,
                    total_file_data_bytes: null
                }]
            });

            const result = await getBatchJobsStats();

            expect(result.jobs.pending).toBe(0);
            expect(result.items.fileDataSizeMB).toBe(0);
        });

        it('should return null on error', async () => {
            query.mockRejectedValueOnce(new Error('DB error'));
            expect(await getBatchJobsStats()).toBeNull();
        });
    });
});
