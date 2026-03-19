/**
 * Tests for Backup History Service
 * Tests cleanupStaleRunningEntries, createHistoryEntry, updateHistoryEntry,
 * getBackupHistory, deleteHistoryEntry
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
    cleanupStaleRunningEntries,
    createHistoryEntry,
    updateHistoryEntry,
    getBackupHistory,
    deleteHistoryEntry
} from '../../services/backup/history.service.js';

describe('Backup History Service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('cleanupStaleRunningEntries', () => {
        it('should mark stale running entries as failed', async () => {
            query.mockResolvedValueOnce({ rows: [{ id: 'h1' }] });

            await cleanupStaleRunningEntries();

            expect(query.mock.calls[0][0]).toContain("status = 'failed'");
            expect(query.mock.calls[0][0]).toContain("30 minutes");
        });

        it('should handle no stale entries', async () => {
            query.mockResolvedValueOnce({ rows: [] });
            await expect(cleanupStaleRunningEntries()).resolves.toBeUndefined();
        });

        it('should not throw on error', async () => {
            query.mockRejectedValueOnce(new Error('DB error'));
            await expect(cleanupStaleRunningEntries()).resolves.toBeUndefined();
        });
    });

    describe('createHistoryEntry', () => {
        it('should cleanup stale entries and insert new entry', async () => {
            // cleanupStaleRunningEntries query
            query.mockResolvedValueOnce({ rows: [] });
            // INSERT query
            query.mockResolvedValueOnce({ rows: [{ id: 'h1', status: 'running', filename: 'backup.sql.gz' }] });

            const result = await createHistoryEntry('daily', 'backup.sql.gz');

            expect(result.id).toBe('h1');
            expect(result.status).toBe('running');
            expect(query.mock.calls[1][0]).toContain('INSERT INTO backup_history');
            expect(query.mock.calls[1][1]).toEqual(['daily', 'backup.sql.gz']);
        });
    });

    describe('updateHistoryEntry', () => {
        it('should update specified fields', async () => {
            query.mockResolvedValueOnce({ rows: [] });

            await updateHistoryEntry('h1', { status: 'completed', size_bytes: 12345 });

            expect(query.mock.calls[0][0]).toContain('status = $1');
            expect(query.mock.calls[0][0]).toContain('size_bytes = $2');
            expect(query.mock.calls[0][1]).toEqual(['completed', 12345, 'h1']);
        });

        it('should handle single field update', async () => {
            query.mockResolvedValueOnce({ rows: [] });

            await updateHistoryEntry('h1', { error_message: 'timeout' });

            expect(query.mock.calls[0][1]).toEqual(['timeout', 'h1']);
        });
    });

    describe('getBackupHistory', () => {
        it('should return history with total count', async () => {
            // cleanupStaleRunningEntries
            query.mockResolvedValueOnce({ rows: [] });
            // SELECT history
            query.mockResolvedValueOnce({ rows: [{ id: 'h1' }, { id: 'h2' }] });
            // COUNT
            query.mockResolvedValueOnce({ rows: [{ count: '10' }] });

            const result = await getBackupHistory(50, 0);

            expect(result.items).toHaveLength(2);
            expect(result.total).toBe(10);
        });

        it('should pass limit and offset', async () => {
            query.mockResolvedValueOnce({ rows: [] }); // cleanup
            query.mockResolvedValueOnce({ rows: [] }); // select
            query.mockResolvedValueOnce({ rows: [{ count: '0' }] }); // count

            await getBackupHistory(10, 20);

            expect(query.mock.calls[1][1]).toEqual([10, 20]);
        });
    });

    describe('deleteHistoryEntry', () => {
        it('should delete by id', async () => {
            query.mockResolvedValueOnce({ rows: [] });

            await deleteHistoryEntry('h1');

            expect(query.mock.calls[0][0]).toContain('DELETE FROM backup_history');
            expect(query.mock.calls[0][1]).toEqual(['h1']);
        });
    });
});
