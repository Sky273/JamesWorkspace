/**
 * Tests for backup/core.service.js
 * cleanupOldLocalBackups, createBackup, restoreBackup, cleanupAllLocalBackups, getLocalBackupStats
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use vi.hoisted so mock refs are available in vi.mock factories
const {
    mockExecAsync, mockFs, mockQuery,
    mockGetBackupSettings, mockCreateHistoryEntry, mockUpdateHistoryEntry,
    mockUploadFile, mockDownloadFile, mockCleanupOldRemoteBackups
} = vi.hoisted(() => ({
    mockExecAsync: vi.fn(),
    mockFs: {
        existsSync: vi.fn(() => true),
        mkdirSync: vi.fn(),
        readdirSync: vi.fn(() => []),
        statSync: vi.fn(() => ({ size: 1024, mtime: new Date('2024-06-01') })),
        unlinkSync: vi.fn(),
        readFileSync: vi.fn(() => ''),
        createReadStream: vi.fn(() => ({ pipe: vi.fn().mockReturnThis() })),
        createWriteStream: vi.fn(() => ({ pipe: vi.fn().mockReturnThis() }))
    },
    mockQuery: vi.fn(),
    mockGetBackupSettings: vi.fn(),
    mockCreateHistoryEntry: vi.fn(),
    mockUpdateHistoryEntry: vi.fn(),
    mockUploadFile: vi.fn(),
    mockDownloadFile: vi.fn(),
    mockCleanupOldRemoteBackups: vi.fn()
}));

vi.mock('../../utils/logger.backend.js', () => ({ safeLog: vi.fn() }));

vi.mock('child_process', () => ({
    execFile: vi.fn((file, args, opts, cb) => {
        if (typeof args === 'function') {
            cb = args;
            args = [];
            opts = {};
        } else if (typeof opts === 'function') {
            cb = opts;
            opts = {};
        }
        const result = mockExecAsync(file, args, opts);
        if (result instanceof Error) {
            cb(result);
        } else {
            cb(null, { stdout: result || '', stderr: '' });
        }
    })
}));

vi.mock('fs', () => ({
    default: mockFs,
    existsSync: (...a) => mockFs.existsSync(...a),
    mkdirSync: (...a) => mockFs.mkdirSync(...a),
    readdirSync: (...a) => mockFs.readdirSync(...a),
    statSync: (...a) => mockFs.statSync(...a),
    unlinkSync: (...a) => mockFs.unlinkSync(...a),
    readFileSync: (...a) => mockFs.readFileSync(...a),
    createReadStream: (...a) => mockFs.createReadStream(...a),
    createWriteStream: (...a) => mockFs.createWriteStream(...a)
}));

vi.mock('stream/promises', () => ({
    pipeline: vi.fn(() => Promise.resolve())
}));

vi.mock('zlib', () => ({
    createGzip: vi.fn(() => ({})),
    createGunzip: vi.fn(() => ({}))
}));

vi.mock('../../config/database.js', () => ({
    query: (...a) => mockQuery(...a)
}));

vi.mock('../../services/backup/settings.service.js', () => ({
    getBackupSettings: (...a) => mockGetBackupSettings(...a)
}));

vi.mock('../../services/backup/history.service.js', () => ({
    createHistoryEntry: (...a) => mockCreateHistoryEntry(...a),
    updateHistoryEntry: (...a) => mockUpdateHistoryEntry(...a)
}));

vi.mock('../../services/backup/ftp.service.js', () => ({
    uploadFile: (...a) => mockUploadFile(...a),
    downloadFile: (...a) => mockDownloadFile(...a),
    cleanupOldRemoteBackups: (...a) => mockCleanupOldRemoteBackups(...a)
}));

import {
    cleanupOldLocalBackups,
    createBackup,
    restoreBackup,
    cleanupAllLocalBackups,
    getLocalBackupStats
} from '../../services/backup/core.service.js';

describe('Backup Core Service', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        mockFs.existsSync.mockReturnValue(true);
        mockFs.readdirSync.mockReturnValue([]);
        mockFs.statSync.mockReturnValue({ size: 1024, mtime: new Date('2024-06-01') });
    });

    describe('cleanupOldLocalBackups', () => {
        it('should not delete files when within retention limit', async () => {
            mockFs.readdirSync.mockReturnValue([
                'backup-daily-testdb-2024-06-01.sql.gz',
                'backup-daily-testdb-2024-06-02.sql.gz'
            ]);

            await cleanupOldLocalBackups('daily', 5);

            expect(mockFs.unlinkSync).not.toHaveBeenCalled();
        });

        it('should delete oldest files exceeding retention', async () => {
            const files = [
                'backup-daily-testdb-2024-06-01.sql.gz',
                'backup-daily-testdb-2024-06-02.sql.gz',
                'backup-daily-testdb-2024-06-03.sql.gz'
            ];
            mockFs.readdirSync.mockReturnValue(files);

            // Newer files first in statSync
            let callCount = 0;
            mockFs.statSync.mockImplementation(() => {
                callCount++;
                return { size: 1024, mtime: new Date(Date.now() - callCount * 86400000) };
            });

            await cleanupOldLocalBackups('daily', 1);

            // Should delete 2 files (keep only 1)
            expect(mockFs.unlinkSync).toHaveBeenCalledTimes(2);
        });

        it('should only match files of the specified type', async () => {
            mockFs.readdirSync.mockReturnValue([
                'backup-daily-testdb-2024-06-01.sql.gz',
                'backup-weekly-testdb-2024-06-01.sql.gz',
                'backup-daily-testdb-2024-06-02.sql.gz'
            ]);
            mockFs.statSync.mockReturnValue({ size: 1024, mtime: new Date('2024-01-01') });

            await cleanupOldLocalBackups('daily', 1);

            // Only 1 daily file should be deleted (2 daily, keep 1)
            expect(mockFs.unlinkSync).toHaveBeenCalledTimes(1);
        });

        it('should handle errors gracefully', async () => {
            mockFs.readdirSync.mockImplementation(() => { throw new Error('Permission denied'); });

            // Should not throw
            await cleanupOldLocalBackups('daily', 3);
        });
    });

    describe('createBackup', () => {
        beforeEach(() => {
            process.env.POSTGRES_HOST = 'localhost';
            process.env.POSTGRES_PORT = '5432';
            process.env.POSTGRES_DB = 'testdb';
            process.env.POSTGRES_USER = 'testuser';
            process.env.POSTGRES_PASSWORD = 'testpass';

            mockCreateHistoryEntry.mockResolvedValue({ id: 'h1' });
            mockUpdateHistoryEntry.mockResolvedValue({});
            mockExecAsync.mockReturnValue('pg_dump (PostgreSQL) 16.0');
            mockFs.statSync.mockReturnValue({ size: 2048 });
            mockGetBackupSettings.mockResolvedValue(null);
        });

        it('should create a local backup successfully', async () => {
            const result = await createBackup('manual');

            expect(result.success).toBe(true);
            expect(result.filename).toContain('backup-manual-testdb-');
            expect(result.filename).toContain('.sql.gz');
            expect(result.size).toBe(2048);
            expect(result.uploaded).toBe(false);
            expect(mockCreateHistoryEntry).toHaveBeenCalledWith('manual', expect.any(String));
            expect(mockUpdateHistoryEntry).toHaveBeenCalledWith('h1', expect.objectContaining({ status: 'success' }));
        });

        it('should upload to remote when settings configured', async () => {
            mockGetBackupSettings.mockResolvedValue({
                backup_target: 'remote',
                host: 'ftp.example.com',
                remote_path: '/backups',
                daily_retention: 5
            });
            mockUploadFile.mockResolvedValue();
            mockCleanupOldRemoteBackups.mockResolvedValue();

            const result = await createBackup('daily');

            expect(result.uploaded).toBe(true);
            expect(mockUploadFile).toHaveBeenCalled();
            expect(mockCleanupOldRemoteBackups).toHaveBeenCalled();
        });

        it('should handle upload failure gracefully (keeps local copy)', async () => {
            mockGetBackupSettings.mockResolvedValue({
                backup_target: 'remote',
                host: 'ftp.example.com',
                remote_path: '/backups'
            });
            mockUploadFile.mockRejectedValue(new Error('Connection refused'));

            const result = await createBackup('weekly');

            // Backup still succeeds locally
            expect(result.success).toBe(true);
            expect(result.uploaded).toBe(false);
        });

        it('should throw and update history on pg_dump failure', async () => {
            mockExecAsync.mockImplementation(() => { throw new Error('pg_dump failed'); });

            await expect(createBackup('manual')).rejects.toThrow();

            expect(mockUpdateHistoryEntry).toHaveBeenCalledWith('h1', expect.objectContaining({
                status: 'failed',
                error_message: expect.any(String)
            }));
        });

        it('should use correct retention for each backup type', async () => {
            mockGetBackupSettings.mockResolvedValue({
                backup_target: 'remote',
                host: 'ftp.example.com',
                daily_retention: 10,
                weekly_retention: 6,
                monthly_retention: 24
            });
            mockUploadFile.mockResolvedValue();
            mockCleanupOldRemoteBackups.mockResolvedValue();

            await createBackup('monthly');

            expect(mockCleanupOldRemoteBackups).toHaveBeenCalledWith(
                expect.anything(), 'monthly', 24
            );
        });
    });

    describe('restoreBackup', () => {
        beforeEach(() => {
            process.env.POSTGRES_HOST = 'localhost';
            process.env.POSTGRES_PORT = '5432';
            process.env.POSTGRES_DB = 'testdb';
            process.env.POSTGRES_USER = 'testuser';
            process.env.POSTGRES_PASSWORD = 'testpass';

            mockExecAsync.mockReturnValue('psql (PostgreSQL) 16.0');
            mockDownloadFile.mockResolvedValue();
            mockFs.readFileSync.mockReturnValue('DROP TABLE IF EXISTS resumes;');
        });

        it('should throw when settings not configured', async () => {
            mockGetBackupSettings.mockResolvedValue(null);

            await expect(restoreBackup('backup-daily-testdb-2024-06-01T10-00-00.sql.gz')).rejects.toThrow('Backup settings not configured');
        });

        it('should throw when no host in settings', async () => {
            mockGetBackupSettings.mockResolvedValue({ host: null });

            await expect(restoreBackup('backup-daily-testdb-2024-06-01T10-00-00.sql.gz')).rejects.toThrow('Backup settings not configured');
        });

        it('should restore backup with DROP commands (no truncate)', async () => {
            mockGetBackupSettings.mockResolvedValue({ host: 'ftp.example.com', remote_path: '/backups' });
            mockFs.readFileSync.mockReturnValue('DROP TABLE IF EXISTS resumes CASCADE;');

            const result = await restoreBackup('backup-daily-testdb-2024-06-01T10-00-00.sql.gz');

            expect(result.success).toBe(true);
            expect(mockDownloadFile).toHaveBeenCalled();
        });

        it('should truncate tables for old backup format (no DROP commands)', async () => {
            mockGetBackupSettings.mockResolvedValue({ host: 'ftp.example.com', remote_path: '/backups' });
            mockFs.readFileSync.mockReturnValue('INSERT INTO resumes VALUES (1);');

            const result = await restoreBackup('backup-manual-testdb-2024-06-01T10-00-00.sql.gz');

            expect(result.success).toBe(true);
            // execAsync called 3 times: psql --version, truncate command, restore command
            expect(mockExecAsync).toHaveBeenCalledTimes(3);
        });

        it('should reject unsafe backup filenames', async () => {
            mockGetBackupSettings.mockResolvedValue({ host: 'ftp.example.com', remote_path: '/backups' });

            await expect(restoreBackup('../backup.sql.gz')).rejects.toThrow('Invalid backup filename');
        });
    });

    describe('cleanupAllLocalBackups', () => {
        it('should return zeros when no settings', async () => {
            mockGetBackupSettings.mockResolvedValue(null);

            const result = await cleanupAllLocalBackups();

            expect(result).toEqual({ daily: 0, weekly: 0, monthly: 0, manual: 0 });
        });

        it('should skip when target is remote', async () => {
            mockGetBackupSettings.mockResolvedValue({ backup_target: 'remote' });

            const result = await cleanupAllLocalBackups();

            expect(result).toEqual({ daily: 0, weekly: 0, monthly: 0, manual: 0 });
        });

        it('should cleanup local backups for each type', async () => {
            mockGetBackupSettings.mockResolvedValue({
                backup_target: 'local',
                daily_retention: 1,
                weekly_retention: 1,
                monthly_retention: 1
            });

            // Return files for daily, none for others
            mockFs.readdirSync.mockReturnValue([
                'backup-daily-testdb-2024-06-01.sql.gz',
                'backup-daily-testdb-2024-06-02.sql.gz'
            ]);

            let callIdx = 0;
            mockFs.statSync.mockImplementation(() => {
                callIdx++;
                return { size: 1024, mtime: new Date(Date.now() - callIdx * 86400000) };
            });
            mockQuery.mockResolvedValue({ rows: [] });

            const result = await cleanupAllLocalBackups();

            // 1 daily file deleted (2 files, retention=1), repeated for 4 types but only daily matches
            expect(result.daily).toBe(1);
        });
    });

    describe('getLocalBackupStats', () => {
        it('should return stats for each backup type', async () => {
            const now = new Date();
            const yesterday = new Date(Date.now() - 86400000);

            mockFs.readdirSync.mockReturnValue([
                'backup-daily-testdb-2024-06-01.sql.gz',
                'backup-daily-testdb-2024-06-02.sql.gz',
                'backup-weekly-testdb-2024-06-01.sql.gz',
                'other-file.txt'
            ]);

            let statCallIdx = 0;
            mockFs.statSync.mockImplementation(() => {
                statCallIdx++;
                return {
                    size: statCallIdx * 500,
                    mtime: statCallIdx === 1 ? now : yesterday
                };
            });

            const stats = await getLocalBackupStats();

            expect(stats.daily.count).toBe(2);
            expect(stats.weekly.count).toBe(1);
            expect(stats.monthly.count).toBe(0);
            expect(stats.manual.count).toBe(0);
        });

        it('should return null on error', async () => {
            mockFs.readdirSync.mockImplementation(() => { throw new Error('fail'); });

            const result = await getLocalBackupStats();

            expect(result).toBeNull();
        });

        it('should handle empty backup directory', async () => {
            mockFs.readdirSync.mockReturnValue([]);

            const stats = await getLocalBackupStats();

            expect(stats.daily.count).toBe(0);
            expect(stats.daily.oldest).toBeNull();
            expect(stats.daily.newest).toBeNull();
        });
    });
});
