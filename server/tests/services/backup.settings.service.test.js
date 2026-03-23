/**
 * Tests for Backup Settings Service
 * Tests initBackupTables, getBackupSettings, saveBackupSettings
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
    initBackupTables,
    getBackupSettings,
    saveBackupSettings
} from '../../services/backup/settings.service.js';

describe('Backup Settings Service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('initBackupTables', () => {
        it('should verify tables, columns, and indexes', async () => {
            query.mockImplementation((sql, params) => {
                if (sql.includes('information_schema.tables')) {
                    expect(params).toEqual([['backup_settings', 'backup_history']]);
                    return Promise.resolve({ rows: [
                        { table_name: 'backup_settings' },
                        { table_name: 'backup_history' }
                    ] });
                }
                if (sql.includes('information_schema.columns')) {
                    if (params[0] === 'backup_settings') {
                        expect(params).toEqual(['backup_settings', ['backup_target', 'daily_retention', 'weekly_retention', 'monthly_retention']]);
                        return Promise.resolve({ rows: [
                            { column_name: 'backup_target' },
                            { column_name: 'daily_retention' },
                            { column_name: 'weekly_retention' },
                            { column_name: 'monthly_retention' }
                        ] });
                    }
                    expect(params).toEqual(['backup_history', ['backup_type', 'file_size', 'size_bytes']]);
                    return Promise.resolve({ rows: [
                        { column_name: 'backup_type' },
                        { column_name: 'file_size' },
                        { column_name: 'size_bytes' }
                    ] });
                }
                if (sql.includes('pg_indexes')) {
                    expect(params).toEqual([['idx_backup_history_started_at', 'idx_backup_history_status']]);
                    return Promise.resolve({ rows: [
                        { indexname: 'idx_backup_history_started_at' },
                        { indexname: 'idx_backup_history_status' }
                    ] });
                }
                return Promise.resolve({ rows: [] });
            });

            await initBackupTables();

            expect(query).toHaveBeenCalledTimes(4);
        });

        it('should throw on DB error', async () => {
            query.mockRejectedValueOnce(new Error('DB error'));
            await expect(initBackupTables()).rejects.toThrow('DB error');
        });
    });

    describe('getBackupSettings', () => {
        it('should return settings row', async () => {
            const settings = { id: 's1', daily_enabled: true, daily_time: '02:00' };
            query.mockResolvedValueOnce({ rows: [settings] });

            const result = await getBackupSettings();

            expect(result).toEqual(settings);
        });

        it('should return null if no settings', async () => {
            query.mockResolvedValueOnce({ rows: [] });
            expect(await getBackupSettings()).toBeNull();
        });

        it('should throw on DB error', async () => {
            query.mockRejectedValueOnce(new Error('DB error'));
            await expect(getBackupSettings()).rejects.toThrow();
        });
    });

    describe('saveBackupSettings', () => {
        it('should update existing settings', async () => {
            // getBackupSettings call
            query.mockResolvedValueOnce({ rows: [{ id: 's1' }] });
            // UPDATE call
            query.mockResolvedValueOnce({ rows: [{ id: 's1', daily_enabled: true }] });

            const result = await saveBackupSettings({ daily_enabled: true, daily_time: '03:00' });

            expect(result.id).toBe('s1');
            expect(query.mock.calls[1][0]).toContain('UPDATE backup_settings');
        });

        it('should insert new settings if none exist', async () => {
            // getBackupSettings returns null
            query.mockResolvedValueOnce({ rows: [] });
            // INSERT call
            query.mockResolvedValueOnce({ rows: [{ id: 's2', daily_enabled: false }] });

            const result = await saveBackupSettings({ daily_enabled: false });

            expect(result.id).toBe('s2');
            expect(query.mock.calls[1][0]).toContain('INSERT INTO backup_settings');
        });

        it('should use defaults for missing fields', async () => {
            query.mockResolvedValueOnce({ rows: [] });
            query.mockResolvedValueOnce({ rows: [{ id: 's3' }] });

            await saveBackupSettings({});

            const params = query.mock.calls[1][1];
            expect(params).toContain('local');   // backup_target default
            expect(params).toContain('ftp');      // protocol default
            expect(params).toContain(21);         // port default
        });

        it('should throw on DB error', async () => {
            query.mockRejectedValueOnce(new Error('DB error'));
            await expect(saveBackupSettings({})).rejects.toThrow();
        });
    });
});
