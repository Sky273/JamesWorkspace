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
        it('should create tables and indexes', async () => {
            query.mockResolvedValue({ rows: [] });

            await initBackupTables();

            const allSql = query.mock.calls.map(c => c[0]).join(' ');
            expect(allSql).toContain('CREATE TABLE IF NOT EXISTS backup_settings');
            expect(allSql).toContain('CREATE TABLE IF NOT EXISTS backup_history');
            expect(allSql).toContain('CREATE INDEX');
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
