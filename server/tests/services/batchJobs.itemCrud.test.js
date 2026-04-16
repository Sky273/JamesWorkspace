/**
 * Tests for Batch Jobs - Item CRUD Operations
 * Tests addJobItems, addJobResumeIds, addJobExportItems, getJobItems,
 * updateJobItemStatus, getJobItem, resumeItemWithName, getItemsPendingName, getPendingItems
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../config/database.js', () => ({
    query: vi.fn()
}));

vi.mock('fs/promises', () => ({
    default: {
        readFile: vi.fn(),
        unlink: vi.fn()
    },
    readFile: vi.fn(),
    unlink: vi.fn()
}));

vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn()
}));

import { query } from '../../config/database.js';
import fs from 'fs/promises';
import {
    addJobItems,
    addJobItemsFromUploadedFiles,
    addJobResumeIds,
    addJobExportItems,
    getJobItems,
    updateJobItemStatus,
    getJobItem,
    resumeItemWithName,
    getItemsPendingName,
    getPendingItems,
    claimPendingItems,
    getJobItemFilePayload,
    clearJobItemFileData
} from '../../services/batchJobs/itemCrud.js';

describe('Batch Jobs - Item CRUD', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('addJobItems', () => {
        it('should insert items and update total count', async () => {
            // Bulk insert + final total_items update
            query.mockResolvedValue({ rows: [] });

            const items = [
                { fileName: 'cv1.pdf', fileData: Buffer.from('data1'), fileMimeType: 'application/pdf' },
                { fileName: 'cv2.pdf', fileData: Buffer.from('data2'), fileMimeType: 'application/pdf', relativePath: '/docs/cv2.pdf' }
            ];

            const count = await addJobItems('j1', items);

            expect(count).toBe(2);
            expect(query).toHaveBeenCalledTimes(2);
            expect(query.mock.calls[0][0]).toContain('INSERT INTO batch_job_items');
            expect(query.mock.calls[1][0]).toContain('UPDATE batch_jobs');
        });

        it('should throw on DB error', async () => {
            query.mockRejectedValueOnce(new Error('DB error'));
            await expect(addJobItems('j1', [{ fileName: 'cv.pdf' }])).rejects.toThrow();
        });

        it('should stage uploaded files in bounded batches and cleanup temp files', async () => {
            query.mockResolvedValue({ rows: [] });
            fs.readFile.mockResolvedValueOnce(Buffer.from('data1')).mockResolvedValueOnce(Buffer.from('data2'));
            fs.unlink.mockResolvedValue(undefined);

            const count = await addJobItemsFromUploadedFiles('j1', [
                { path: '/tmp/a.pdf', originalname: 'a.pdf', mimetype: 'application/pdf' },
                { path: '/tmp/b.pdf', originalname: 'b.pdf', mimetype: 'application/pdf' }
            ]);

            expect(count).toBe(2);
            expect(fs.readFile).toHaveBeenCalledTimes(2);
            expect(fs.unlink).toHaveBeenCalledTimes(2);
            expect(query).toHaveBeenCalledTimes(2);
        });
    });

    describe('addJobResumeIds', () => {
        it('should look up resume names and insert items', async () => {
            // First call: SELECT Name for resume 1
            query.mockResolvedValueOnce({ rows: [{ name: 'John Doe' }] });
            // Second call: INSERT item
            query.mockResolvedValueOnce({ rows: [] });
            // Third call: UPDATE total_items
            query.mockResolvedValueOnce({ rows: [] });

            const count = await addJobResumeIds('j1', ['r1']);

            expect(count).toBe(1);
            expect(query.mock.calls[0][0]).toContain('SELECT name FROM resumes');
            expect(query.mock.calls[1][0]).toContain('INSERT INTO batch_job_items');
        });

        it('should use fallback name if resume not found', async () => {
            query.mockResolvedValueOnce({ rows: [] }); // no resume found
            query.mockResolvedValueOnce({ rows: [] }); // insert
            query.mockResolvedValueOnce({ rows: [] }); // update total

            await addJobResumeIds('j1', ['r1']);

            // fileName should be fallback
            expect(query.mock.calls[1][1][2]).toContain('Resume');
        });
    });

    describe('addJobExportItems', () => {
        it('should insert export items with source type', async () => {
            query.mockResolvedValue({ rows: [] });

            const items = [{
                resumeId: 'r1',
                adaptationId: null,
                sourceType: 'resume',
                fileName: 'cv.pdf',
                relativePath: '/exports/cv.pdf',
                originalName: 'John Doe'
            }];

            const count = await addJobExportItems('j1', items);

            expect(count).toBe(1);
            expect(query.mock.calls[0][0]).toContain('source_type');
            expect(query.mock.calls[0][1]).toContain('resume');
        });
    });

    describe('getJobItems', () => {
        it('should return items for a job ordered by created_at', async () => {
            query.mockResolvedValueOnce({ rows: [{ id: 'i1' }, { id: 'i2' }] });

            const result = await getJobItems('j1');

            expect(result).toHaveLength(2);
            expect(query.mock.calls[0][0]).toContain('ORDER BY created_at ASC');
            expect(query.mock.calls[0][1]).toEqual(['j1']);
        });

        it('should throw on error', async () => {
            query.mockRejectedValueOnce(new Error('DB error'));
            await expect(getJobItems('j1')).rejects.toThrow();
        });
    });

    describe('updateJobItemStatus', () => {
        it('should update status', async () => {
            query.mockResolvedValueOnce({ rows: [] });

            await updateJobItemStatus('i1', 'success');

            expect(query.mock.calls[0][0]).toContain('status = $2');
            expect(query.mock.calls[0][0]).toContain('processed_at = NOW()');
        });

        it('should include progress if provided', async () => {
            query.mockResolvedValueOnce({ rows: [] });

            await updateJobItemStatus('i1', 'processing', { progress: 50 });

            expect(query.mock.calls[0][0]).toContain('progress');
            expect(query.mock.calls[0][1]).toContain(50);
        });

        it('should include error_message if provided', async () => {
            query.mockResolvedValueOnce({ rows: [] });

            await updateJobItemStatus('i1', 'error', { error_message: 'parse failed' });

            expect(query.mock.calls[0][0]).toContain('error_message');
            expect(query.mock.calls[0][1]).toContain('parse failed');
        });

        it('should strip null characters from direct string updates', async () => {
            query.mockResolvedValueOnce({ rows: [] });

            await updateJobItemStatus('i1', 'success', {
                error_message: 'parse\u0000 failed',
                original_name: 'Jo\u0000hn',
                display_name: 'John\u0000 Doe'
            });

            expect(query.mock.calls[0][1]).toContain('parse failed');
            expect(query.mock.calls[0][1]).toContain('John');
            expect(query.mock.calls[0][1]).toContain('John Doe');
        });

        it('should include resume_id, original_name, display_name', async () => {
            query.mockResolvedValueOnce({ rows: [] });

            await updateJobItemStatus('i1', 'success', {
                resume_id: 'r1',
                original_name: 'John',
                display_name: 'John Doe'
            });

            expect(query.mock.calls[0][0]).toContain('resume_id');
            expect(query.mock.calls[0][0]).toContain('original_name');
            expect(query.mock.calls[0][0]).toContain('display_name');
        });

        it('should store pending_data for pending_name items', async () => {
            query.mockResolvedValueOnce({ rows: [] });

            await updateJobItemStatus('i1', 'pending_name', {
                pending_analysis: '{"skills":["js"]}',
                pending_text: 'some text',
                pending_improve: true
            });

            expect(query.mock.calls[0][0]).toContain('pending_data');
        });

        it('should strip null characters from pending data payloads', async () => {
            query.mockResolvedValueOnce({ rows: [] });

            await updateJobItemStatus('i1', 'pending_name', {
                pending_analysis: '{"name":"Jo\\u0000hn","skills":["ja\\u0000va"]}',
                pending_text: 'some\u0000 text',
                pending_improve: true
            });

            const serializedPendingData = query.mock.calls[0][1].find((value) => typeof value === 'string' && value.includes('"analysis"'));
            expect(serializedPendingData).toContain('"name":"John"');
            expect(serializedPendingData).toContain('"skills":["java"]');
            expect(serializedPendingData).toContain('"text":"some text"');
        });
    });

    describe('getJobItem', () => {
        it('should return item with job info', async () => {
            query.mockResolvedValueOnce({ rows: [{ id: 'i1', firm_id: 'f1', options: '{}' }] });

            const result = await getJobItem('i1');

            expect(result.id).toBe('i1');
            expect(query.mock.calls[0][0]).toContain('JOIN batch_jobs');
        });

        it('should return null if not found', async () => {
            query.mockResolvedValueOnce({ rows: [] });
            expect(await getJobItem('missing')).toBeNull();
        });
    });

    describe('resumeItemWithName', () => {
        it('should update item from pending_name to pending with name', async () => {
            // getJobItem query
            query.mockResolvedValueOnce({ rows: [{ id: 'i1', status: 'pending_name', firm_id: 'f1', options: '{}' }] });
            // update query
            query.mockResolvedValueOnce({ rows: [] });

            const result = await resumeItemWithName('i1', 'Jane Doe');

            expect(result.status).toBe('pending');
            expect(result.original_name).toBe('Jane Doe');
            expect(query.mock.calls[1][1]).toContain('Jane Doe');
        });

        it('should throw if item not found', async () => {
            query.mockResolvedValueOnce({ rows: [] });
            await expect(resumeItemWithName('missing', 'Name')).rejects.toThrow('Item not found');
        });

        it('should throw if item is not in pending_name status', async () => {
            query.mockResolvedValueOnce({ rows: [{ id: 'i1', status: 'success', firm_id: 'f1', options: '{}' }] });
            await expect(resumeItemWithName('i1', 'Name')).rejects.toThrow('not waiting for name');
        });
    });

    describe('getItemsPendingName', () => {
        it('should return items with pending_name status', async () => {
            query.mockResolvedValueOnce({ rows: [{ id: 'i1', file_name: 'cv.pdf' }] });

            const result = await getItemsPendingName('j1');

            expect(result).toHaveLength(1);
            expect(query.mock.calls[0][1]).toContain('pending_name');
        });
    });

    describe('getPendingItems', () => {
        it('should return pending items limited by BATCH_SIZE', async () => {
            query.mockResolvedValueOnce({ rows: [{ id: 'i1' }] });

            const result = await getPendingItems('j1');

            expect(result).toHaveLength(1);
            expect(query.mock.calls[0][0]).toContain('LIMIT $3');
            expect(query.mock.calls[0][0]).not.toContain('SELECT *');
            expect(query.mock.calls[0][1][1]).toBe('pending');
        });

        it('should return empty array on error', async () => {
            query.mockRejectedValueOnce(new Error('DB error'));
            expect(await getPendingItems('j1')).toEqual([]);
        });
    });

    describe('claimPendingItems', () => {
        it('should atomically claim pending items with row locking', async () => {
            query.mockResolvedValueOnce({ rows: [{ id: 'i1', status: 'processing' }] });

            const result = await claimPendingItems('j1');

            expect(result).toHaveLength(1);
            expect(query.mock.calls[0][0]).toContain('FOR UPDATE SKIP LOCKED');
            expect(query.mock.calls[0][0]).toContain('UPDATE batch_job_items bji');
            expect(query.mock.calls[0][1]).toEqual(['j1', 'pending', 100, 'processing']);
        });

        it('should return empty array on claim error', async () => {
            query.mockRejectedValueOnce(new Error('DB error'));
            expect(await claimPendingItems('j1')).toEqual([]);
        });
    });

    describe('getJobItemFilePayload', () => {
        it('should return only the file payload for an item', async () => {
            query.mockResolvedValueOnce({ rows: [{ file_data: Buffer.from('data'), file_mime_type: 'application/pdf' }] });

            const result = await getJobItemFilePayload('i1');

            expect(result.file_mime_type).toBe('application/pdf');
            expect(query.mock.calls[0][0]).toContain('SELECT file_data, file_mime_type');
            expect(query.mock.calls[0][1]).toEqual(['i1']);
        });
    });

    describe('clearJobItemFileData', () => {
        it('should null out stored file_data for an item', async () => {
            query.mockResolvedValueOnce({ rows: [] });

            await clearJobItemFileData('i1');

            expect(query.mock.calls[0][0]).toContain('SET file_data = NULL');
            expect(query.mock.calls[0][1]).toEqual(['i1']);
        });
    });
});
