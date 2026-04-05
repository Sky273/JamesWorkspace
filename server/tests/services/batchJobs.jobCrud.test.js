/**
 * Tests for Batch Jobs - Job CRUD Operations
 * Tests createJob, getJob, getJobsByFirm, getAllJobs, updateJobStatus,
 * cancelJob, deleteJob, getPendingJobs, updateJobCounters, updateJobExportFile, isJobComplete
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../config/database.js', () => ({
    query: vi.fn()
}));

vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn()
}));

import { query } from '../../config/database.js';
import {
    createJob,
    getJob,
    getJobStatus,
    getJobsByFirm,
    getAllJobs,
    updateJobStatus,
    cancelJob,
    deleteJob,
    getPendingJobs,
    updateJobCounters,
    updateJobExportFile,
    isJobComplete
} from '../../services/batchJobs/jobCrud.js';

describe('Batch Jobs - Job CRUD', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('createJob', () => {
        it('should create a job with default type', async () => {
            const job = { id: 'j1', firm_id: 'f1', status: 'pending' };
            query.mockResolvedValueOnce({ rows: [job] });

            const result = await createJob({ firmId: 'f1', userId: 'u1' });

            expect(result).toEqual(job);
            expect(query.mock.calls[0][0]).toContain('INSERT INTO batch_jobs');
            expect(query.mock.calls[0][1]).toContain('import');
        });

        it('should create a job with custom type and options', async () => {
            const job = { id: 'j2', job_type: 'export' };
            query.mockResolvedValueOnce({ rows: [job] });

            await createJob({ firmId: 'f1', userId: 'u1', jobType: 'export', options: { format: 'zip' } });

            expect(query.mock.calls[0][1][2]).toBe('export');
            expect(query.mock.calls[0][1][3]).toContain('zip');
        });

        it('should throw on DB error', async () => {
            query.mockRejectedValueOnce(new Error('DB error'));
            await expect(createJob({ firmId: 'f1', userId: 'u1' })).rejects.toThrow('DB error');
        });
    });

    describe('getJob', () => {
        it('should return job with user and firm names', async () => {
            query.mockResolvedValueOnce({ rows: [{ id: 'j1', user_name: 'John', firm_name: 'Acme' }] });

            const result = await getJob('j1');

            expect(result.id).toBe('j1');
            expect(result.user_name).toBe('John');
            expect(query.mock.calls[0][1]).toEqual(['j1']);
        });

        it('should return null if not found', async () => {
            query.mockResolvedValueOnce({ rows: [] });
            expect(await getJob('missing')).toBeNull();
        });

        it('should throw on DB error', async () => {
            query.mockRejectedValueOnce(new Error('DB error'));
            await expect(getJob('j1')).rejects.toThrow();
        });
    });

    describe('getJobsByFirm', () => {
        it('should return jobs for a firm', async () => {
            query.mockResolvedValueOnce({ rows: [{ id: 'j1' }, { id: 'j2' }] });

            const result = await getJobsByFirm('f1');

            expect(result).toHaveLength(2);
            expect(query.mock.calls[0][1][0]).toBe('f1');
        });

        it('should apply status filter', async () => {
            query.mockResolvedValueOnce({ rows: [] });

            await getJobsByFirm('f1', { status: 'completed' });

            expect(query.mock.calls[0][0]).toContain('status');
            expect(query.mock.calls[0][1]).toContain('completed');
        });

        it('should apply limit and offset', async () => {
            query.mockResolvedValueOnce({ rows: [] });

            await getJobsByFirm('f1', { limit: 10, offset: 20 });

            expect(query.mock.calls[0][1]).toContain(10);
            expect(query.mock.calls[0][1]).toContain(20);
        });
    });

    describe('getAllJobs', () => {
        it('should return all jobs with user and firm names', async () => {
            query.mockResolvedValueOnce({ rows: [{ id: 'j1' }] });

            const result = await getAllJobs();

            expect(result).toHaveLength(1);
            expect(query.mock.calls[0][0]).toContain('batch_jobs');
        });

        it('should apply status filter', async () => {
            query.mockResolvedValueOnce({ rows: [] });

            await getAllJobs({ status: 'failed' });

            expect(query.mock.calls[0][1]).toContain('failed');
        });
    });

    describe('updateJobStatus', () => {
        it('should update status', async () => {
            query.mockResolvedValueOnce({ rows: [] });

            await updateJobStatus('j1', 'processing');

            expect(query.mock.calls[0][0]).toContain('status = $2');
            expect(query.mock.calls[0][1]).toEqual(['j1', 'processing']);
        });

        it('should set started_at for processing status', async () => {
            query.mockResolvedValueOnce({ rows: [] });

            await updateJobStatus('j1', 'processing');

            expect(query.mock.calls[0][0]).toContain('started_at = NOW()');
        });

        it('should set completed_at for terminal statuses', async () => {
            query.mockResolvedValueOnce({ rows: [] });

            await updateJobStatus('j1', 'completed');

            expect(query.mock.calls[0][0]).toContain('completed_at = NOW()');
        });

        it('should include error_message if provided', async () => {
            query.mockResolvedValueOnce({ rows: [] });

            await updateJobStatus('j1', 'failed', { error_message: 'timeout' });

            expect(query.mock.calls[0][0]).toContain('error_message');
            expect(query.mock.calls[0][1]).toContain('timeout');
        });

        it('should include counters if provided', async () => {
            query.mockResolvedValueOnce({ rows: [] });

            await updateJobStatus('j1', 'completed', { processed_items: 10, success_count: 8, error_count: 2 });

            expect(query.mock.calls[0][0]).toContain('processed_items');
            expect(query.mock.calls[0][0]).toContain('success_count');
            expect(query.mock.calls[0][0]).toContain('error_count');
        });
    });

    describe('cancelJob', () => {
        it('should update job status and mark pending items as skipped', async () => {
            query.mockResolvedValue({ rows: [] });

            await cancelJob('j1');

            // First call: updateJobStatus (which calls query)
            expect(query.mock.calls[0][0]).toContain('UPDATE batch_jobs');
            // Second call: mark pending items as skipped
            expect(query.mock.calls[1][0]).toContain('UPDATE batch_job_items');
            expect(query.mock.calls[1][1]).toContain('skipped');
        });
    });

    describe('deleteJob', () => {
        it('should delete the job', async () => {
            query.mockResolvedValueOnce({ rows: [] });

            await deleteJob('j1');

            expect(query.mock.calls[0][0]).toContain('DELETE FROM batch_jobs');
            expect(query.mock.calls[0][1]).toEqual(['j1']);
        });
    });

    describe('getJobStatus', () => {
        it('should return current job status', async () => {
            query.mockResolvedValueOnce({ rows: [{ status: 'processing' }] });

            const result = await getJobStatus('j1');

            expect(result).toBe('processing');
            expect(query.mock.calls[0][1]).toEqual(['j1']);
        });

        it('should return null when job is missing', async () => {
            query.mockResolvedValueOnce({ rows: [] });

            await expect(getJobStatus('missing')).resolves.toBeNull();
        });
    });

    describe('getPendingJobs', () => {
        it('should atomically claim pending jobs and hydrate them', async () => {
            query
                .mockResolvedValueOnce({ rows: [{ id: 'j1', status: 'processing' }] })
                .mockResolvedValueOnce({ rows: [{ id: 'j1', status: 'processing', user_name: 'John', firm_name: 'Acme' }] });

            const result = await getPendingJobs();

            expect(result).toHaveLength(1);
            expect(query.mock.calls[0][0]).toContain('FOR UPDATE SKIP LOCKED');
            expect(query.mock.calls[0][1]).toContain('pending');
            expect(query.mock.calls[0][1]).toContain('processing');
            expect(query.mock.calls[1][1]).toEqual([['j1']]);
        });

        it('should also reclaim already-processing jobs for subsequent batches', async () => {
            query
                .mockResolvedValueOnce({ rows: [{ id: 'j2', status: 'processing' }] })
                .mockResolvedValueOnce({ rows: [{ id: 'j2', status: 'processing', user_name: 'Jane', firm_name: 'Acme' }] });

            const result = await getPendingJobs();

            expect(result).toHaveLength(1);
            expect(query.mock.calls[0][0]).toContain('bj.status IN ($1, $2)');
            expect(query.mock.calls[0][1][0]).toBe('pending');
            expect(query.mock.calls[0][1][1]).toBe('processing');
        });

        it('should return empty array when no jobs were claimed', async () => {
            query.mockResolvedValueOnce({ rows: [] });

            const result = await getPendingJobs();

            expect(result).toEqual([]);
            expect(query).toHaveBeenCalledTimes(1);
        });

        it('should return empty array on error', async () => {
            query.mockRejectedValueOnce(new Error('DB error'));
            expect(await getPendingJobs()).toEqual([]);
        });
    });

    describe('updateJobCounters', () => {
        it('should update counters from items subquery', async () => {
            query.mockResolvedValueOnce({ rows: [] });

            await updateJobCounters('j1');

            expect(query.mock.calls[0][0]).toContain('processed_items');
            expect(query.mock.calls[0][0]).toContain('success_count');
            expect(query.mock.calls[0][0]).toContain('error_count');
        });

        it('should not throw on error', async () => {
            query.mockRejectedValueOnce(new Error('DB error'));
            await expect(updateJobCounters('j1')).resolves.toBeUndefined();
        });
    });

    describe('updateJobExportFile', () => {
        it('should update export file info', async () => {
            query.mockResolvedValueOnce({ rows: [] });

            await updateJobExportFile('j1', '/tmp/export.zip', 'export.zip');

            expect(query.mock.calls[0][0]).toContain('export_file_path');
            expect(query.mock.calls[0][1]).toEqual(['/tmp/export.zip', 'export.zip', 'j1']);
        });

        it('should throw on error', async () => {
            query.mockRejectedValueOnce(new Error('DB error'));
            await expect(updateJobExportFile('j1', '/f', 'f')).rejects.toThrow();
        });
    });

    describe('isJobComplete', () => {
        it('should return true when all items processed', async () => {
            query.mockResolvedValueOnce({ rows: [{ total: '5', processed: '5' }] });
            expect(await isJobComplete('j1')).toBe(true);
        });

        it('should return false when items still pending', async () => {
            query.mockResolvedValueOnce({ rows: [{ total: '5', processed: '3' }] });
            expect(await isJobComplete('j1')).toBe(false);
        });

        it('should return false when no items yet', async () => {
            query.mockResolvedValueOnce({ rows: [{ total: '0', processed: '0' }] });
            expect(await isJobComplete('j1')).toBe(false);
        });

        it('should return false on error', async () => {
            query.mockRejectedValueOnce(new Error('DB error'));
            expect(await isJobComplete('j1')).toBe(false);
        });
    });
});
