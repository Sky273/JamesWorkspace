/**
 * Backup Service Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock database
vi.mock('../../config/database.js', () => ({
    query: vi.fn()
}));

// Mock logger
vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn()
}));

vi.mock('../../utils/secretCrypto.js', () => ({
    encryptSecret: vi.fn((value) => value ? `enc:v1:test:${value}` : ''),
    decryptSecret: vi.fn((value) => value?.startsWith('enc:v1:test:') ? value.slice('enc:v1:test:'.length) : value)
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

// Mock fs
vi.mock('fs', () => ({
    default: {
        existsSync: vi.fn(() => true),
        mkdirSync: vi.fn(),
        createReadStream: vi.fn(),
        createWriteStream: vi.fn(),
        unlinkSync: vi.fn(),
        statSync: vi.fn(() => ({ size: 1024 })),
        readdirSync: vi.fn(() => [])
    },
    existsSync: vi.fn(() => true),
    mkdirSync: vi.fn(),
    createReadStream: vi.fn(),
    createWriteStream: vi.fn(),
    unlinkSync: vi.fn(),
    statSync: vi.fn(() => ({ size: 1024 })),
    readdirSync: vi.fn(() => [])
}));

// Mock child_process
vi.mock('child_process', () => ({
    exec: vi.fn((cmd, callback) => callback(null, { stdout: '', stderr: '' })),
    execFile: vi.fn((cmd, args, options, callback) => {
        const normalizedCallback = typeof options === 'function' ? options : callback;
        normalizedCallback?.(null, { stdout: '', stderr: '' });
    })
}));

import { query } from '../../config/database.js';
import {
    getBackupSettings,
    saveBackupSettings
} from '../../services/backup.service.js';

describe('Backup Service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('getBackupSettings', () => {
        it('should return null when no settings exist', async () => {
            query.mockResolvedValueOnce({ rows: [] });
            
            const result = await getBackupSettings();
            
            expect(result).toBeNull();
            expect(query).toHaveBeenCalledWith('SELECT * FROM backup_settings LIMIT 1');
        });

        it('should return settings when they exist', async () => {
            const mockSettings = {
                id: 1,
                protocol: 'sftp',
                host: 'backup.example.com',
                port: 22,
                username: 'backup_user',
                password: 'enc:v1:test:secret',
                daily_enabled: true,
                daily_time: '02:00'
            };
            query.mockResolvedValueOnce({ rows: [mockSettings] });
            
            const result = await getBackupSettings();
            
            expect(result).toEqual({ ...mockSettings, password: 'secret' });
        });

        it('should throw error on database failure', async () => {
            query.mockRejectedValueOnce(new Error('Database error'));
            
            await expect(getBackupSettings()).rejects.toThrow('Database error');
        });
    });

    describe('saveBackupSettings', () => {
        it('should insert new settings when none exist', async () => {
            // First call: check existing settings
            query.mockResolvedValueOnce({ rows: [] });
            // Second call: insert new settings
            const newSettings = {
                id: 1,
                protocol: 'ftp',
                host: 'ftp.example.com',
                port: 21
            };
            query.mockResolvedValueOnce({ rows: [newSettings] });
            
            const result = await saveBackupSettings({
                protocol: 'ftp',
                host: 'ftp.example.com',
                port: 21
            });
            
            expect(result).toEqual(newSettings);
            expect(query).toHaveBeenCalledTimes(2);
        });

        it('should update existing settings', async () => {
            // First call: check existing settings
            query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
            // Second call: update settings
            const updatedSettings = {
                id: 1,
                protocol: 'sftp',
                host: 'sftp.example.com',
                port: 22
            };
            query.mockResolvedValueOnce({ rows: [updatedSettings] });
            
            const result = await saveBackupSettings({
                protocol: 'sftp',
                host: 'sftp.example.com',
                port: 22
            });
            
            expect(result).toEqual(updatedSettings);
        });

        it('should use default values for missing fields', async () => {
            query.mockResolvedValueOnce({ rows: [] });
            query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
            
            await saveBackupSettings({ host: 'test.com' });
            
            // Verify INSERT was called with defaults
            const insertCall = query.mock.calls[1];
            expect(insertCall[1]).toContain('ftp'); // default protocol
            expect(insertCall[1]).toContain(21); // default port
            expect(insertCall[1]).toContain('/backups'); // default remote_path
        });
    });

});
