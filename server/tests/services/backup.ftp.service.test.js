/**
 * Tests for Backup FTP/SFTP Service
 * getClient, closeClient, testConnection, uploadFile, downloadFile, listRemoteBackups, cleanupOldRemoteBackups
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSftpConnect = vi.fn();
const mockSftpEnd = vi.fn();
const mockSftpList = vi.fn();
const mockSftpPut = vi.fn();
const mockSftpGet = vi.fn();
const mockSftpDelete = vi.fn();

const mockFtpAccess = vi.fn();
const mockFtpQuit = vi.fn();
const mockFtpClose = vi.fn();
const mockFtpEnsureDir = vi.fn();
const mockFtpUploadFrom = vi.fn();
const mockFtpDownloadTo = vi.fn();
const mockFtpCd = vi.fn();
const mockFtpList = vi.fn();
const mockFtpRemove = vi.fn();

class MockSftpClient {
    connect(...args) { return mockSftpConnect(...args); }
    end(...args) { return mockSftpEnd(...args); }
    list(...args) { return mockSftpList(...args); }
    put(...args) { return mockSftpPut(...args); }
    get(...args) { return mockSftpGet(...args); }
    delete(...args) { return mockSftpDelete(...args); }
}

vi.mock('ssh2-sftp-client', () => ({ default: MockSftpClient }));
class MockFtpClient {
    constructor() {
        this.ftp = { verbose: false };
    }
    access(...args) { return mockFtpAccess(...args); }
    quit(...args) { return mockFtpQuit(...args); }
    close(...args) { return mockFtpClose(...args); }
    ensureDir(...args) { return mockFtpEnsureDir(...args); }
    uploadFrom(...args) { return mockFtpUploadFrom(...args); }
    downloadTo(...args) { return mockFtpDownloadTo(...args); }
    cd(...args) { return mockFtpCd(...args); }
    list(...args) { return mockFtpList(...args); }
    remove(...args) { return mockFtpRemove(...args); }
}

vi.mock('basic-ftp', () => ({
    Client: MockFtpClient
}));
vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn()
}));

const mockAssertSafeOutboundHost = vi.fn(async (host) => {
    if (host === '127.0.0.1') {
        throw new Error('Private or loopback hosts are not allowed');
    }
    return true;
});

vi.mock('../../utils/networkHostSecurity.js', () => ({
    assertSafeOutboundHost: (...args) => mockAssertSafeOutboundHost(...args)
}));

import {
    getClient,
    closeClient,
    testConnection,
    uploadFile,
    downloadFile,
    listRemoteBackups,
    cleanupOldRemoteBackups
} from '../../services/backup/ftp.service.js';

describe('Backup FTP/SFTP Service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const sftpSettings = { protocol: 'sftp', host: 'sftp.example.com', port: 22, username: 'user', password: 'pass', remote_path: '/backups' };
    const ftpSettings = { protocol: 'ftp', host: 'ftp.example.com', port: 21, username: 'user', password: 'pass', remote_path: '/backups' };

    describe('getClient', () => {
        it('should create SFTP client', async () => {
            mockSftpConnect.mockResolvedValueOnce(undefined);

            const result = await getClient(sftpSettings);

            expect(result.type).toBe('sftp');
            expect(mockAssertSafeOutboundHost).toHaveBeenCalledWith('sftp.example.com', expect.objectContaining({
                allowPrivateHostsEnvVar: 'BACKUP_ALLOW_PRIVATE_HOSTS',
                allowPrivateAddresses: true
            }));
            expect(mockSftpConnect).toHaveBeenCalledWith(expect.objectContaining({
                host: 'sftp.example.com',
                port: 22,
                username: 'user',
                password: 'pass'
            }));
        });

        it('should create FTP client with explicit TLS by default', async () => {
            mockFtpAccess.mockResolvedValueOnce(undefined);

            const result = await getClient(ftpSettings);

            expect(result.type).toBe('ftp');
            expect(mockFtpAccess).toHaveBeenCalledWith(expect.objectContaining({
                host: 'ftp.example.com',
                secure: true // explicit TLS
            }));
        });

        it('should use implicit TLS when configured', async () => {
            mockFtpAccess.mockResolvedValueOnce(undefined);

            const { port: _port, ...noPortSettings } = ftpSettings;
            await getClient({ ...noPortSettings, tls_mode: 'implicit' });

            expect(mockFtpAccess).toHaveBeenCalledWith(expect.objectContaining({
                secure: 'implicit',
                port: 990
            }));
        });

        it('should use no TLS for ftp with tls_mode none', async () => {
            mockFtpAccess.mockResolvedValueOnce(undefined);

            await getClient({ ...ftpSettings, tls_mode: 'none' });

            expect(mockFtpAccess).toHaveBeenCalledWith(expect.objectContaining({
                secure: false
            }));
        });

        it('should throw on SFTP connection failure', async () => {
            mockSftpConnect.mockRejectedValueOnce(new Error('Auth failed'));

            await expect(getClient(sftpSettings)).rejects.toThrow('Auth failed');
        });

        it('should throw on FTP connection failure', async () => {
            mockFtpAccess.mockRejectedValueOnce(new Error('Connection refused'));

            await expect(getClient(ftpSettings)).rejects.toThrow('Connection refused');
        });

        it('should reject loopback hosts before connecting', async () => {
            await expect(getClient({ ...ftpSettings, host: '127.0.0.1' })).rejects.toThrow('Private or loopback hosts are not allowed');
            expect(mockFtpAccess).not.toHaveBeenCalled();
        });

        it('should allow private backup hosts before connecting', async () => {
            mockFtpAccess.mockResolvedValueOnce(undefined);

            const result = await getClient({ ...ftpSettings, host: '10.0.0.5' });

            expect(result.type).toBe('ftp');
            expect(mockAssertSafeOutboundHost).toHaveBeenCalledWith('10.0.0.5', expect.objectContaining({
                allowPrivateHostsEnvVar: 'BACKUP_ALLOW_PRIVATE_HOSTS',
                allowPrivateAddresses: true
            }));
            expect(mockFtpAccess).toHaveBeenCalled();
        });
    });

    describe('closeClient', () => {
        it('should close SFTP client', async () => {
            mockSftpEnd.mockResolvedValueOnce(undefined);
            await closeClient({ client: new MockSftpClient(), type: 'sftp' });
            expect(mockSftpEnd).toHaveBeenCalled();
        });

        it('should close FTP client with quit then close', async () => {
            mockFtpQuit.mockResolvedValueOnce(undefined);
            const ftp = { quit: mockFtpQuit, close: mockFtpClose };
            await closeClient({ client: ftp, type: 'ftp' });
            expect(mockFtpQuit).toHaveBeenCalled();
            expect(mockFtpClose).toHaveBeenCalled();
        });

        it('should handle null input', async () => {
            await closeClient(null);
            // No error
        });

        it('should not throw on close errors', async () => {
            mockSftpEnd.mockRejectedValueOnce(new Error('Already closed'));
            await closeClient({ client: new MockSftpClient(), type: 'sftp' });
            // No error thrown
        });
    });

    describe('testConnection', () => {
        it('should test SFTP connection successfully', async () => {
            mockSftpConnect.mockResolvedValueOnce(undefined);
            mockSftpList.mockResolvedValueOnce([]);
            mockSftpEnd.mockResolvedValueOnce(undefined);

            const result = await testConnection(sftpSettings);

            expect(result.success).toBe(true);
            expect(mockSftpList).toHaveBeenCalledWith('/backups');
        });

        it('should test FTP connection successfully', async () => {
            mockFtpAccess.mockResolvedValueOnce(undefined);
            mockFtpEnsureDir.mockResolvedValueOnce(undefined);
            mockFtpQuit.mockResolvedValueOnce(undefined);

            const result = await testConnection(ftpSettings);

            expect(result.success).toBe(true);
        });

        it('should return failure on connection error', async () => {
            mockSftpConnect.mockRejectedValueOnce(new Error('Timeout'));

            const result = await testConnection(sftpSettings);

            expect(result.success).toBe(false);
            expect(result.message).toContain('expiré');
        });

        it('should normalize self-signed certificate errors', async () => {
            const error = new Error('self-signed certificate');
            error.code = 'DEPTH_ZERO_SELF_SIGNED_CERT';
            mockSftpConnect.mockRejectedValueOnce(error);

            const result = await testConnection(sftpSettings);

            expect(result.success).toBe(false);
            expect(result.message).toContain('certificat TLS');
            expect(result.message).not.toContain('self-signed certificate');
        });
    });

    describe('uploadFile', () => {
        it('should upload via SFTP', async () => {
            mockSftpConnect.mockResolvedValueOnce(undefined);
            mockSftpPut.mockResolvedValueOnce(undefined);
            mockSftpEnd.mockResolvedValueOnce(undefined);

            const result = await uploadFile(sftpSettings, '/local/file.sql.gz', '/remote/file.sql.gz');

            expect(result).toBe(true);
            expect(mockSftpPut).toHaveBeenCalledWith('/local/file.sql.gz', '/remote/file.sql.gz');
        });

        it('should upload via FTP', async () => {
            mockFtpAccess.mockResolvedValueOnce(undefined);
            mockFtpUploadFrom.mockResolvedValueOnce(undefined);
            mockFtpQuit.mockResolvedValueOnce(undefined);

            const result = await uploadFile(ftpSettings, '/local/f.gz', '/remote/f.gz');

            expect(result).toBe(true);
            expect(mockFtpUploadFrom).toHaveBeenCalledWith('/local/f.gz', '/remote/f.gz');
        });

        it('should throw on upload error', async () => {
            mockSftpConnect.mockResolvedValueOnce(undefined);
            mockSftpPut.mockRejectedValueOnce(new Error('Disk full'));
            mockSftpEnd.mockResolvedValueOnce(undefined);

            await expect(uploadFile(sftpSettings, '/l', '/r')).rejects.toThrow('Disk full');
        });
    });

    describe('downloadFile', () => {
        it('should download via SFTP', async () => {
            mockSftpConnect.mockResolvedValueOnce(undefined);
            mockSftpGet.mockResolvedValueOnce(undefined);
            mockSftpEnd.mockResolvedValueOnce(undefined);

            const result = await downloadFile(sftpSettings, '/remote/f.gz', '/local/f.gz');

            expect(result).toBe(true);
            expect(mockSftpGet).toHaveBeenCalledWith('/remote/f.gz', '/local/f.gz');
        });

        it('should download via FTP', async () => {
            mockFtpAccess.mockResolvedValueOnce(undefined);
            mockFtpDownloadTo.mockResolvedValueOnce(undefined);
            mockFtpQuit.mockResolvedValueOnce(undefined);

            const result = await downloadFile(ftpSettings, '/remote/f.gz', '/local/f.gz');

            expect(result).toBe(true);
            expect(mockFtpDownloadTo).toHaveBeenCalledWith('/local/f.gz', '/remote/f.gz');
        });
    });

    describe('listRemoteBackups', () => {
        it('should return empty for missing settings', async () => {
            const result = await listRemoteBackups(null);
            expect(result.success).toBe(false);
            expect(result.files).toEqual([]);
        });

        it('should return empty for settings without host', async () => {
            const result = await listRemoteBackups({ protocol: 'sftp' });
            expect(result.success).toBe(false);
        });

        it('should list SFTP backups sorted by date desc', async () => {
            mockSftpConnect.mockResolvedValueOnce(undefined);
            mockSftpList.mockResolvedValueOnce([
                { name: 'backup-daily-2024-01-01.sql.gz', size: 1000, modifyTime: '2024-01-01T00:00:00Z' },
                { name: 'backup-daily-2024-01-02.sql.gz', size: 2000, modifyTime: '2024-01-02T00:00:00Z' },
                { name: 'readme.txt', size: 50, modifyTime: '2024-01-01T00:00:00Z' }
            ]);
            mockSftpEnd.mockResolvedValueOnce(undefined);

            const result = await listRemoteBackups(sftpSettings);

            expect(result.success).toBe(true);
            expect(result.files).toHaveLength(2); // Only .sql.gz files
            expect(result.files[0].name).toBe('backup-daily-2024-01-02.sql.gz');
        });

        it('should list FTP backups', async () => {
            mockFtpAccess.mockResolvedValueOnce(undefined);
            mockFtpCd.mockResolvedValueOnce(undefined);
            mockFtpList.mockResolvedValueOnce([
                { name: 'backup-daily-2024-01-01.sql.gz', size: 1000, modifiedAt: new Date('2024-01-01') }
            ]);
            mockFtpQuit.mockResolvedValueOnce(undefined);

            const result = await listRemoteBackups(ftpSettings);

            expect(result.success).toBe(true);
            expect(result.files).toHaveLength(1);
        });

        it('should return failure on error', async () => {
            mockSftpConnect.mockRejectedValueOnce(new Error('Network error'));

            const result = await listRemoteBackups(sftpSettings);

            expect(result.success).toBe(false);
            expect(result.message).toBe('Network error');
        });
    });

    describe('cleanupOldRemoteBackups', () => {
        it('should delete old SFTP backups beyond retention', async () => {
            mockSftpConnect.mockResolvedValueOnce(undefined);
            mockSftpList.mockResolvedValueOnce([
                { name: 'backup-daily-2024-01-03.sql.gz', modifyTime: '2024-01-03T00:00:00Z' },
                { name: 'backup-daily-2024-01-02.sql.gz', modifyTime: '2024-01-02T00:00:00Z' },
                { name: 'backup-daily-2024-01-01.sql.gz', modifyTime: '2024-01-01T00:00:00Z' }
            ]);
            mockSftpDelete.mockResolvedValue(undefined);
            mockSftpEnd.mockResolvedValueOnce(undefined);

            await cleanupOldRemoteBackups(sftpSettings, 'daily', 2);

            // Should delete the oldest (only 1 beyond retention of 2)
            expect(mockSftpDelete).toHaveBeenCalledTimes(1);
            expect(mockSftpDelete).toHaveBeenCalledWith(expect.stringContaining('2024-01-01'));
        });

        it('should not delete if within retention', async () => {
            mockSftpConnect.mockResolvedValueOnce(undefined);
            mockSftpList.mockResolvedValueOnce([
                { name: 'backup-daily-2024-01-02.sql.gz', modifyTime: '2024-01-02T00:00:00Z' }
            ]);
            mockSftpEnd.mockResolvedValueOnce(undefined);

            await cleanupOldRemoteBackups(sftpSettings, 'daily', 5);

            expect(mockSftpDelete).not.toHaveBeenCalled();
        });

        it('should handle cleanup errors gracefully', async () => {
            mockSftpConnect.mockRejectedValueOnce(new Error('Cleanup fail'));

            // Should not throw
            await cleanupOldRemoteBackups(sftpSettings, 'daily', 2);
        });
    });
});
