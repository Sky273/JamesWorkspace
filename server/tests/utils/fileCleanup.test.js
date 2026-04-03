/**
 * Tests for file cleanup utilities
 * Tests the actual exported functions from fileCleanup.js
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock fs/promises (async API used by fileCleanup.js)
vi.mock('fs/promises', () => ({
    default: {
        access: vi.fn(),
        readdir: vi.fn(),
        stat: vi.fn(),
        unlink: vi.fn(),
        mkdir: vi.fn(),
        rm: vi.fn()
    },
    access: vi.fn(),
    readdir: vi.fn(),
    stat: vi.fn(),
    unlink: vi.fn(),
    mkdir: vi.fn(),
    rm: vi.fn()
}));

// Mock logger
vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn(),
    createModuleLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() })
}));

// Mock constants
vi.mock('../../config/constants.js', () => ({
    UPLOAD_DIR: '/tmp/test-uploads'
}));

vi.mock('../../services/metrics.service.js', () => ({
    metrics: {
        trackCleanupActivity: vi.fn()
    }
}));

// Mock dynamic imports for batch jobs and backup services
vi.mock('../../services/batchJobs.service.js', () => ({
    cleanupOldJobs: vi.fn().mockResolvedValue({ deletedJobs: 0, deletedItems: 0 })
}));

vi.mock('../../services/backup.service.js', () => ({
    cleanupAllLocalBackups: vi.fn().mockResolvedValue({ daily: 0, weekly: 0 })
}));

vi.mock('../../services/shareResume.service.js', () => ({
    SHARE_LINK_TTL_MS: 7 * 24 * 60 * 60 * 1000,
    cleanupExpiredShareArtifacts: vi.fn().mockResolvedValue({
        expiredPdfLinksCleared: 0,
        expiredFileLinksCleared: 0,
        expiredPdfFilesDeleted: 0
    })
}));

import fs from 'fs/promises';
import {
    cleanupOldFiles,
    cleanupOcrTempArtifacts,
    cleanupAllFiles,
    getStorageStats,
    getFileCleanupStats,
    startPeriodicCleanup,
    stopPeriodicCleanup,
    destroyFileCleanup
} from '../../utils/fileCleanup.js';
import { cleanupOldJobs } from '../../services/batchJobs.service.js';
import { cleanupExpiredShareArtifacts } from '../../services/shareResume.service.js';

describe('File Cleanup Utilities', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        // Reset module state
        destroyFileCleanup();
    });

    afterEach(() => {
        stopPeriodicCleanup();
        vi.useRealTimers();
    });

    // =============================================
    // cleanupOldFiles
    // =============================================
    describe('cleanupOldFiles', () => {
        it('should create directory and return 0 if it does not exist', async () => {
            fs.access.mockRejectedValue(new Error('ENOENT'));
            fs.mkdir.mockResolvedValue(undefined);

            const result = await cleanupOldFiles('/tmp/nonexistent', 3600000);

            expect(result).toBe(0);
            expect(fs.mkdir).toHaveBeenCalledWith('/tmp/nonexistent', { recursive: true });
        });

        it('should delete files older than maxAge', async () => {
            const now = Date.now();
            fs.access.mockResolvedValue(undefined);
            fs.readdir.mockResolvedValue(['old-file.txt', 'new-file.txt']);
            fs.stat.mockImplementation(async (filePath) => {
                if (filePath.includes('old-file')) {
                    return { mtimeMs: now - 7200000, isDirectory: () => false }; // 2 hours old
                }
                return { mtimeMs: now - 1800000, isDirectory: () => false }; // 30 minutes old
            });
            fs.unlink.mockResolvedValue(undefined);

            const result = await cleanupOldFiles('/tmp/uploads', 3600000); // 1 hour max age

            expect(result).toBe(1);
            expect(fs.unlink).toHaveBeenCalledTimes(1);
            expect(fs.unlink).toHaveBeenCalledWith(expect.stringContaining('old-file.txt'));
        });

        it('should not delete files newer than maxAge', async () => {
            const now = Date.now();
            fs.access.mockResolvedValue(undefined);
            fs.readdir.mockResolvedValue(['new-file.txt']);
            fs.stat.mockResolvedValue({ mtimeMs: now - 1800000, isDirectory: () => false });

            const result = await cleanupOldFiles('/tmp/uploads', 3600000);

            expect(result).toBe(0);
            expect(fs.unlink).not.toHaveBeenCalled();
        });

        it('should skip directories', async () => {
            const now = Date.now();
            fs.access.mockResolvedValue(undefined);
            fs.readdir.mockResolvedValue(['subdir', 'old-file.txt']);
            fs.stat.mockImplementation(async (filePath) => {
                if (filePath.includes('subdir')) {
                    return { mtimeMs: now - 7200000, isDirectory: () => true };
                }
                return { mtimeMs: now - 7200000, isDirectory: () => false };
            });
            fs.unlink.mockResolvedValue(undefined);

            const result = await cleanupOldFiles('/tmp/uploads', 3600000);

            expect(result).toBe(1);
            // Only old-file.txt should be deleted, not subdir
            expect(fs.unlink).toHaveBeenCalledTimes(1);
        });

        it('should handle empty directory', async () => {
            fs.access.mockResolvedValue(undefined);
            fs.readdir.mockResolvedValue([]);

            const result = await cleanupOldFiles('/tmp/uploads', 3600000);

            expect(result).toBe(0);
        });

        it('should handle per-file errors gracefully (ENOENT)', async () => {
            const now = Date.now();
            fs.access.mockResolvedValue(undefined);
            fs.readdir.mockResolvedValue(['file.txt']);
            fs.stat.mockResolvedValue({ mtimeMs: now - 7200000, isDirectory: () => false });
            fs.unlink.mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));

            const result = await cleanupOldFiles('/tmp/uploads', 3600000);

            // ENOENT errors are silently ignored
            expect(result).toBe(0);
        });

        it('should handle per-file errors gracefully (non-ENOENT)', async () => {
            const now = Date.now();
            fs.access.mockResolvedValue(undefined);
            fs.readdir.mockResolvedValue(['file.txt']);
            fs.stat.mockResolvedValue({ mtimeMs: now - 7200000, isDirectory: () => false });
            fs.unlink.mockRejectedValue(Object.assign(new Error('Permission denied'), { code: 'EPERM' }));

            const result = await cleanupOldFiles('/tmp/uploads', 3600000);

            expect(result).toBe(0);
        });

        it('should return 0 when readdir fails', async () => {
            fs.access.mockResolvedValue(undefined);
            fs.readdir.mockRejectedValue(new Error('I/O error'));

            const result = await cleanupOldFiles('/tmp/uploads', 3600000);

            expect(result).toBe(0);
        });

        it('should use default maxAge of 1 hour', async () => {
            const now = Date.now();
            fs.access.mockResolvedValue(undefined);
            fs.readdir.mockResolvedValue(['file.txt']);
            fs.stat.mockResolvedValue({ mtimeMs: now - 30 * 60 * 1000, isDirectory: () => false }); // 30 min old

            const result = await cleanupOldFiles('/tmp/uploads');

            expect(result).toBe(0); // 30 min < 1 hour default, should not be deleted
        });
    });

    // =============================================
    // cleanupOcrTempArtifacts
    // =============================================
    describe('cleanupOcrTempArtifacts', () => {
        it('should delete stale OCR temp files and directories from the OS temp directory', async () => {
            const now = Date.now();
            fs.readdir.mockResolvedValue([
                'resume-ocr-123-page-1.png',
                'resume-ocr-variants-123',
                'resume-word-ocr-456',
                'keep-me.txt'
            ]);
            fs.stat.mockImplementation(async (entryPath) => {
                if (entryPath.endsWith('keep-me.txt')) {
                    return { mtimeMs: now - (48 * 60 * 60 * 1000), isDirectory: () => false };
                }
                if (entryPath.endsWith('resume-ocr-variants-123') || entryPath.endsWith('resume-word-ocr-456')) {
                    return { mtimeMs: now - (48 * 60 * 60 * 1000), isDirectory: () => true };
                }
                return { mtimeMs: now - (48 * 60 * 60 * 1000), isDirectory: () => false };
            });
            fs.unlink.mockResolvedValue(undefined);
            fs.rm.mockResolvedValue(undefined);

            const result = await cleanupOcrTempArtifacts(24 * 60 * 60 * 1000);

            expect(result).toBe(3);
            expect(fs.unlink).toHaveBeenCalledWith(expect.stringContaining('resume-ocr-123-page-1.png'));
            expect(fs.rm).toHaveBeenCalledTimes(2);
            expect(fs.rm).toHaveBeenCalledWith(expect.stringContaining('resume-ocr-variants-123'), {
                recursive: true,
                force: true
            });
            expect(fs.rm).toHaveBeenCalledWith(expect.stringContaining('resume-word-ocr-456'), {
                recursive: true,
                force: true
            });
        });

        it('should keep recent OCR artifacts and unrelated temp files', async () => {
            const now = Date.now();
            fs.readdir.mockResolvedValue([
                'resume-ocr-123-page-1.png',
                'other-temp-file.png'
            ]);
            fs.stat.mockResolvedValue({ mtimeMs: now - (60 * 60 * 1000), isDirectory: () => false });

            const result = await cleanupOcrTempArtifacts(24 * 60 * 60 * 1000);

            expect(result).toBe(0);
            expect(fs.unlink).not.toHaveBeenCalled();
            expect(fs.rm).not.toHaveBeenCalled();
        });
    });

    // =============================================
    // cleanupAllFiles
    // =============================================
    describe('cleanupAllFiles', () => {
        it('should delete all files in UPLOAD_DIR', async () => {
            fs.readdir.mockResolvedValue(['file1.txt', 'file2.pdf']);
            fs.stat.mockResolvedValue({ isDirectory: () => false });
            fs.unlink.mockResolvedValue(undefined);

            const result = await cleanupAllFiles();

            expect(result).toBe(2);
            expect(fs.unlink).toHaveBeenCalledTimes(2);
        });

        it('should skip directories', async () => {
            fs.readdir.mockResolvedValue(['subdir', 'file.txt']);
            fs.stat.mockImplementation(async (filePath) => {
                if (filePath.includes('subdir')) {
                    return { isDirectory: () => true };
                }
                return { isDirectory: () => false };
            });
            fs.unlink.mockResolvedValue(undefined);

            const result = await cleanupAllFiles();

            expect(result).toBe(1);
        });

        it('should handle empty directory', async () => {
            fs.readdir.mockResolvedValue([]);

            const result = await cleanupAllFiles();

            expect(result).toBe(0);
        });

        it('should return 0 on readdir error', async () => {
            fs.readdir.mockRejectedValue(new Error('Directory not found'));

            const result = await cleanupAllFiles();

            expect(result).toBe(0);
        });

        it('should ignore ENOENT errors for individual files', async () => {
            fs.readdir.mockResolvedValue(['file.txt']);
            fs.stat.mockResolvedValue({ isDirectory: () => false });
            fs.unlink.mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));

            const result = await cleanupAllFiles();

            expect(result).toBe(0);
        });
    });

    // =============================================
    // getStorageStats
    // =============================================
    describe('getStorageStats', () => {
        it('should return stats for all configured directories', async () => {
            fs.access.mockResolvedValue(undefined);
            fs.readdir.mockResolvedValue(['file1.txt', 'file2.txt']);
            fs.stat.mockResolvedValue({ size: 1024, isDirectory: () => false });

            const stats = await getStorageStats();

            expect(stats).toHaveProperty('uploads');
            expect(stats).toHaveProperty('batchExports');
            expect(stats).toHaveProperty('serverTemp');
            expect(stats).toHaveProperty('sharedPdfs');
            expect(stats.uploads.fileCount).toBe(2);
            expect(stats.uploads.totalSizeMB).toBeCloseTo(0, 1);
        });

        it('should return 0 stats for non-existent directories', async () => {
            fs.access.mockRejectedValue(new Error('ENOENT'));

            const stats = await getStorageStats();

            expect(stats.uploads.fileCount).toBe(0);
            expect(stats.uploads.totalSize).toBe(0);
        });
    });

    // =============================================
    // getFileCleanupStats
    // =============================================
    describe('getFileCleanupStats', () => {
        it('should return initial stats', () => {
            const stats = getFileCleanupStats();

            expect(stats.timerActive).toBe(false);
            expect(stats.lastCleanupTime).toBeNull();
            expect(stats.totalFilesDeleted).toBe(0);
            expect(stats.directories).toBeDefined();
        });

        it('should reflect timer state after startPeriodicCleanup', async () => {
            // Mock cleanup to prevent actual directory operations
            fs.access.mockRejectedValue(new Error('ENOENT'));
            fs.mkdir.mockResolvedValue(undefined);
            fs.readdir.mockResolvedValue([]);

            startPeriodicCleanup(60000);

            // Let the initial cleanup promise settle
            await vi.advanceTimersByTimeAsync(10);

            const stats = getFileCleanupStats();
            expect(stats.timerActive).toBe(true);
            expect(stats.ocrTimerActive).toBe(true);
            expect(stats.cleanupStats).toHaveProperty('sharedLinks');
        });

        it('should reflect timer stopped after stopPeriodicCleanup', async () => {
            fs.access.mockRejectedValue(new Error('ENOENT'));
            fs.mkdir.mockResolvedValue(undefined);

            startPeriodicCleanup(60000);
            await vi.advanceTimersByTimeAsync(10);
            stopPeriodicCleanup();

            const stats = getFileCleanupStats();
            expect(stats.timerActive).toBe(false);
        });

        it('should track totalFilesDeleted after cleanupOldFiles', async () => {
            const now = Date.now();
            fs.access.mockResolvedValue(undefined);
            fs.readdir.mockResolvedValue(['old.txt']);
            fs.stat.mockResolvedValue({ mtimeMs: now - 7200000, isDirectory: () => false });
            fs.unlink.mockResolvedValue(undefined);

            await cleanupOldFiles('/tmp/test', 3600000);

            const stats = getFileCleanupStats();
            expect(stats.totalFilesDeleted).toBe(1);
            expect(stats.lastCleanupTime).not.toBeNull();
        });
    });

    // =============================================
    // startPeriodicCleanup / stopPeriodicCleanup / destroyFileCleanup
    // =============================================
    describe('startPeriodicCleanup', () => {
        it('should return a timer', async () => {
            fs.access.mockRejectedValue(new Error('ENOENT'));
            fs.mkdir.mockResolvedValue(undefined);
            fs.readdir.mockResolvedValue([]);

            const timer = startPeriodicCleanup(60000);

            expect(timer).toBeDefined();
        });

        it('should run cleanup on interval', async () => {
            fs.access.mockRejectedValue(new Error('ENOENT'));
            fs.mkdir.mockResolvedValue(undefined);
            fs.readdir.mockResolvedValue([]);

            startPeriodicCleanup(1000);

            // Initial cleanup
            await vi.advanceTimersByTimeAsync(10);

            const callsAfterInit = fs.access.mock.calls.length;

            // Trigger interval
            await vi.advanceTimersByTimeAsync(1000);

            // Should have additional access calls from the interval cleanup
            expect(fs.access.mock.calls.length).toBeGreaterThan(callsAfterInit);
        });

        it('should skip DB-backed cleanup tasks when database tasks are disabled', async () => {
            fs.access.mockRejectedValue(new Error('ENOENT'));
            fs.mkdir.mockResolvedValue(undefined);
            fs.readdir.mockResolvedValue([]);

            startPeriodicCleanup(60000, 3600000, { enableDatabaseTasks: false });
            await vi.advanceTimersByTimeAsync(10);

            expect(cleanupOldJobs).not.toHaveBeenCalled();
            expect(cleanupExpiredShareArtifacts).not.toHaveBeenCalled();
        });

        it('should run OCR cleanup on its dedicated daily interval', async () => {
            const now = Date.now();
            fs.access.mockRejectedValue(new Error('ENOENT'));
            fs.mkdir.mockResolvedValue(undefined);
            fs.readdir.mockResolvedValue(['resume-ocr-123-page-1.png']);
            fs.stat.mockResolvedValue({ mtimeMs: now - (48 * 60 * 60 * 1000), isDirectory: () => false });
            fs.unlink.mockResolvedValue(undefined);

            startPeriodicCleanup(60000, 3600000, { ocrCleanupIntervalMs: 2000 });
            await vi.advanceTimersByTimeAsync(10);

            const callsAfterInit = fs.unlink.mock.calls.length;
            await vi.advanceTimersByTimeAsync(2000);

            expect(fs.unlink.mock.calls.length).toBeGreaterThan(callsAfterInit);
        });
    });

    describe('stopPeriodicCleanup', () => {
        it('should stop the timer', async () => {
            fs.access.mockRejectedValue(new Error('ENOENT'));
            fs.mkdir.mockResolvedValue(undefined);
            fs.readdir.mockResolvedValue([]);

            startPeriodicCleanup(1000);
            await vi.advanceTimersByTimeAsync(10);

            stopPeriodicCleanup();

            const callsAfterStop = fs.access.mock.calls.length;
            const ocrCallsAfterStop = fs.unlink.mock.calls.length;

            await vi.advanceTimersByTimeAsync(5000);

            // No new calls after stopping
            expect(fs.access.mock.calls.length).toBe(callsAfterStop);
            expect(fs.unlink.mock.calls.length).toBe(ocrCallsAfterStop);
        });

        it('should be safe to call when no timer is active', () => {
            expect(() => stopPeriodicCleanup()).not.toThrow();
        });
    });

    describe('destroyFileCleanup', () => {
        it('should stop timer and reset stats', async () => {
            const now = Date.now();
            fs.access.mockResolvedValue(undefined);
            fs.readdir.mockResolvedValue(['old.txt']);
            fs.stat.mockResolvedValue({ mtimeMs: now - 7200000, isDirectory: () => false });
            fs.unlink.mockResolvedValue(undefined);

            // Generate some stats
            await cleanupOldFiles('/tmp/test', 3600000);

            let stats = getFileCleanupStats();
            expect(stats.totalFilesDeleted).toBe(1);

            // Destroy
            destroyFileCleanup();

            stats = getFileCleanupStats();
            expect(stats.timerActive).toBe(false);
            expect(stats.totalFilesDeleted).toBe(0);
            expect(stats.lastCleanupTime).toBeNull();
        });
    });
});
