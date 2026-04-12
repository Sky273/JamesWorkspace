/**
 * Tests for Backup Services
 * Tests settings, history, and re-export index
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('../../config/database.js', () => ({
    query: vi.fn()
}));

vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn()
}));

vi.mock('../../services/cache.service.js', () => ({
    CACHE_KEYS: {
        backupSettings: {
            CURRENT: 'backupSettings:current'
        }
    },
    backupSettingsCache: {
        getOrLoad: vi.fn(async (_key, loader) => await loader()),
        get: vi.fn(async () => null)
    },
    invalidateBackupSettingsCaches: vi.fn(async () => {})
}));

import { query } from '../../config/database.js';

// ============================================
// Settings Service
// ============================================
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
                        return Promise.resolve({ rows: [
                            { column_name: 'backup_target' },
                            { column_name: 'daily_retention' },
                            { column_name: 'weekly_retention' },
                            { column_name: 'monthly_retention' }
                        ] });
                    }
                    return Promise.resolve({ rows: [
                        { column_name: 'backup_type' },
                        { column_name: 'file_size' },
                        { column_name: 'size_bytes' }
                    ] });
                }
                if (sql.includes('pg_indexes')) {
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

        it('should throw on database error', async () => {
            query.mockRejectedValueOnce(new Error('DB unavailable'));

            await expect(initBackupTables()).rejects.toThrow('DB unavailable');
        });
    });

    describe('getBackupSettings', () => {
        it('should return settings if they exist', async () => {
            const settings = { id: 'set-1', backup_target: 'local', daily_enabled: true };
            query.mockResolvedValueOnce({ rows: [settings] });

            const result = await getBackupSettings();

            expect(result).toEqual({ ...settings, password: '' });
            expect(query).toHaveBeenCalledWith('SELECT * FROM backup_settings LIMIT 1');
        });

        it('should return null if no settings', async () => {
            query.mockResolvedValueOnce({ rows: [] });

            const result = await getBackupSettings();

            expect(result).toBeNull();
        });

        it('should throw on database error', async () => {
            query.mockRejectedValueOnce(new Error('Connection lost'));

            await expect(getBackupSettings()).rejects.toThrow('Connection lost');
        });
    });

    describe('saveBackupSettings', () => {
        const newSettings = {
            backup_target: 'remote',
            protocol: 'sftp',
            tls_mode: 'none',
            host: 'backup.example.com',
            port: 22,
            username: 'backup_user',
            password: 'secret',
            remote_path: '/backups/rc',
            daily_enabled: true,
            daily_time: '03:00',
            daily_retention: 14,
            weekly_enabled: true,
            weekly_day: 0,
            weekly_time: '04:00',
            weekly_retention: 8,
            monthly_enabled: false,
            monthly_day: 1,
            monthly_time: '05:00',
            monthly_retention: 6
        };

        it('should INSERT when no existing settings', async () => {
            // getBackupSettings returns null
            query.mockResolvedValueOnce({ rows: [] });
            // INSERT returns created row
            const createdRow = { id: 'new-1', ...newSettings };
            query.mockResolvedValueOnce({ rows: [createdRow] });

            const result = await saveBackupSettings(newSettings);

            expect(result.id).toBe('new-1');
            expect(query).toHaveBeenLastCalledWith(
                expect.stringContaining('INSERT INTO backup_settings'),
                expect.arrayContaining(['remote', 'sftp'])
            );
        });

        it('should UPDATE when settings already exist', async () => {
            // getBackupSettings returns existing
            query.mockResolvedValueOnce({ rows: [{ id: 'existing-1', backup_target: 'local' }] });
            // UPDATE returns updated row
            const updatedRow = { id: 'existing-1', ...newSettings };
            query.mockResolvedValueOnce({ rows: [updatedRow] });

            const result = await saveBackupSettings(newSettings);

            expect(result.id).toBe('existing-1');
            expect(query).toHaveBeenLastCalledWith(
                expect.stringContaining('UPDATE backup_settings SET'),
                expect.arrayContaining(['remote', 'sftp', 'existing-1'])
            );
        });

        it('should use defaults for missing fields', async () => {
            query.mockResolvedValueOnce({ rows: [] }); // no existing
            query.mockResolvedValueOnce({ rows: [{ id: 'def-1' }] });

            await saveBackupSettings({});

            const insertArgs = query.mock.calls[1][1];
            expect(insertArgs[0]).toBe('local'); // default backup_target
            expect(insertArgs[1]).toBe('ftp');   // default protocol
            expect(insertArgs[4]).toBe(21);      // default port
        });

        it('should throw on database error', async () => {
            query.mockResolvedValueOnce({ rows: [] }); // getBackupSettings
            query.mockRejectedValueOnce(new Error('Constraint violation'));

            await expect(saveBackupSettings(newSettings)).rejects.toThrow('Constraint violation');
        });
    });
});

// ============================================
// History Service
// ============================================
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
            query.mockResolvedValueOnce({ rows: [{ id: 'stale-1' }, { id: 'stale-2' }] });

            await cleanupStaleRunningEntries();

            expect(query).toHaveBeenCalledWith(
                expect.stringContaining("SET status = 'failed'")
            );
        });

        it('should handle no stale entries gracefully', async () => {
            query.mockResolvedValueOnce({ rows: [] });

            await cleanupStaleRunningEntries();

            expect(query).toHaveBeenCalledTimes(1);
        });

        it('should not throw on error', async () => {
            query.mockRejectedValueOnce(new Error('DB error'));

            // Should not throw - logs error instead
            await expect(cleanupStaleRunningEntries()).resolves.toBeUndefined();
        });
    });

    describe('createHistoryEntry', () => {
        it('should create entry with running status', async () => {
            // cleanupStaleRunningEntries query
            query.mockResolvedValueOnce({ rows: [] });
            // INSERT query
            query.mockResolvedValueOnce({
                rows: [{ id: 'hist-1', backup_type: 'daily', filename: 'backup-2026.sql.gz', status: 'running' }]
            });

            const result = await createHistoryEntry('daily', 'backup-2026.sql.gz');

            expect(result.id).toBe('hist-1');
            expect(result.status).toBe('running');
            expect(query).toHaveBeenLastCalledWith(
                expect.stringContaining("INSERT INTO backup_history"),
                ['daily', 'backup-2026.sql.gz']
            );
        });
    });

    describe('updateHistoryEntry', () => {
        it('should update allowed columns only', async () => {
            query.mockResolvedValueOnce({ rows: [] });

            await updateHistoryEntry('hist-1', {
                status: 'completed',
                size_bytes: 1024000,
                completed_at: new Date('2026-03-20'),
                malicious_column: 'DROP TABLE' // should be ignored
            });

            const sql = query.mock.calls[0][0];
            expect(sql).toContain('status = $1');
            expect(sql).toContain('size_bytes = $2');
            expect(sql).toContain('completed_at = $3');
            expect(sql).not.toContain('malicious_column');
            expect(query.mock.calls[0][1]).toHaveLength(4); // 3 allowed cols + id
        });

        it('should handle error_message column', async () => {
            query.mockResolvedValueOnce({ rows: [] });

            await updateHistoryEntry('hist-1', {
                status: 'failed',
                error_message: 'Disk full'
            });

            expect(query.mock.calls[0][1]).toContain('failed');
            expect(query.mock.calls[0][1]).toContain('Disk full');
        });
    });

    describe('getBackupHistory', () => {
        it('should return paginated history with total count', async () => {
            // cleanupStaleRunningEntries
            query.mockResolvedValueOnce({ rows: [] });
            // SELECT history
            query.mockResolvedValueOnce({
                rows: [
                    { id: 'h1', status: 'completed', filename: 'b1.sql.gz' },
                    { id: 'h2', status: 'failed', filename: 'b2.sql.gz' }
                ]
            });
            // COUNT
            query.mockResolvedValueOnce({ rows: [{ count: '25' }] });

            const result = await getBackupHistory(10, 0);

            expect(result.items).toHaveLength(2);
            expect(result.total).toBe(25);
        });

        it('should use default limit and offset', async () => {
            query.mockResolvedValueOnce({ rows: [] }); // cleanup
            query.mockResolvedValueOnce({ rows: [] }); // SELECT
            query.mockResolvedValueOnce({ rows: [{ count: '0' }] }); // COUNT

            await getBackupHistory();

            // Default limit=50, offset=0
            expect(query.mock.calls[1][1]).toEqual([50, 0]);
        });
    });

    describe('deleteHistoryEntry', () => {
        it('should delete entry by id', async () => {
            query.mockResolvedValueOnce({ rows: [] });

            await deleteHistoryEntry('hist-1');

            expect(query).toHaveBeenCalledWith(
                'DELETE FROM backup_history WHERE id = $1',
                ['hist-1']
            );
        });
    });
});

// ============================================
// Index (re-exports)
// ============================================
describe('Backup index re-exports', () => {
    it('should export all expected functions', async () => {
        const backup = await import('../../services/backup/index.js');

        // Settings
        expect(backup.initBackupTables).toBeDefined();
        expect(backup.getBackupSettings).toBeDefined();
        expect(backup.saveBackupSettings).toBeDefined();

        // History
        expect(backup.getBackupHistory).toBeDefined();
        expect(backup.deleteHistoryEntry).toBeDefined();
        expect(backup.createHistoryEntry).toBeDefined();
        expect(backup.updateHistoryEntry).toBeDefined();
        expect(backup.cleanupStaleRunningEntries).toBeDefined();

        // FTP
        expect(backup.testConnection).toBeDefined();
        expect(backup.listRemoteBackups).toBeDefined();
        expect(backup.uploadFile).toBeDefined();
        expect(backup.downloadFile).toBeDefined();
        expect(backup.cleanupOldRemoteBackups).toBeDefined();

        // Core
        expect(backup.createBackup).toBeDefined();
        expect(backup.restoreBackup).toBeDefined();
        expect(backup.cleanupAllLocalBackups).toBeDefined();
        expect(backup.getLocalBackupStats).toBeDefined();
        expect(backup.cleanupOldLocalBackups).toBeDefined();
        expect(backup.BACKUP_DIR).toBeDefined();
        expect(backup.TEMP_DIR).toBeDefined();
    });

});
