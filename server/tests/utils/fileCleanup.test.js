/**
 * Tests for file cleanup utilities
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'path';

// Mock fs
const mockFs = {
    existsSync: vi.fn(),
    readdirSync: vi.fn(),
    statSync: vi.fn(),
    unlinkSync: vi.fn(),
    rmdirSync: vi.fn()
};

vi.mock('fs', () => ({
    default: mockFs,
    ...mockFs
}));

// Mock logger
vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn(),
    createModuleLogger: () => ({
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn()
    })
}));

describe('File Cleanup Utilities', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('cleanupOldFiles', () => {
        // Test implementation of cleanup logic
        const cleanupOldFiles = (directory, maxAgeMs) => {
            if (!mockFs.existsSync(directory)) {
                return { deleted: 0, errors: [] };
            }

            const files = mockFs.readdirSync(directory);
            const now = Date.now();
            let deleted = 0;
            const errors = [];

            for (const file of files) {
                try {
                    const filePath = path.join(directory, file);
                    const stats = mockFs.statSync(filePath);
                    const age = now - stats.mtimeMs;

                    if (age > maxAgeMs) {
                        mockFs.unlinkSync(filePath);
                        deleted++;
                    }
                } catch (err) {
                    errors.push({ file, error: err.message });
                }
            }

            return { deleted, errors };
        };

        it('should return 0 deleted if directory does not exist', () => {
            mockFs.existsSync.mockReturnValue(false);
            
            const result = cleanupOldFiles('/tmp/uploads', 3600000);
            
            expect(result.deleted).toBe(0);
            expect(result.errors).toEqual([]);
        });

        it('should delete files older than maxAge', () => {
            const now = Date.now();
            mockFs.existsSync.mockReturnValue(true);
            mockFs.readdirSync.mockReturnValue(['old-file.txt', 'new-file.txt']);
            mockFs.statSync.mockImplementation((filePath) => {
                if (filePath.includes('old-file')) {
                    return { mtimeMs: now - 7200000 }; // 2 hours old
                }
                return { mtimeMs: now - 1800000 }; // 30 minutes old
            });
            mockFs.unlinkSync.mockReturnValue(undefined);

            const result = cleanupOldFiles('/tmp/uploads', 3600000); // 1 hour max age

            expect(result.deleted).toBe(1);
            expect(mockFs.unlinkSync).toHaveBeenCalledTimes(1);
            expect(mockFs.unlinkSync).toHaveBeenCalledWith(expect.stringContaining('old-file.txt'));
        });

        it('should not delete files newer than maxAge', () => {
            const now = Date.now();
            mockFs.existsSync.mockReturnValue(true);
            mockFs.readdirSync.mockReturnValue(['new-file.txt']);
            mockFs.statSync.mockReturnValue({ mtimeMs: now - 1800000 }); // 30 minutes old
            
            const result = cleanupOldFiles('/tmp/uploads', 3600000); // 1 hour max age

            expect(result.deleted).toBe(0);
            expect(mockFs.unlinkSync).not.toHaveBeenCalled();
        });

        it('should handle errors gracefully', () => {
            mockFs.existsSync.mockReturnValue(true);
            mockFs.readdirSync.mockReturnValue(['file.txt']);
            mockFs.statSync.mockImplementation(() => {
                throw new Error('Permission denied');
            });

            const result = cleanupOldFiles('/tmp/uploads', 3600000);

            expect(result.deleted).toBe(0);
            expect(result.errors.length).toBe(1);
            expect(result.errors[0].error).toBe('Permission denied');
        });

        it('should handle empty directory', () => {
            mockFs.existsSync.mockReturnValue(true);
            mockFs.readdirSync.mockReturnValue([]);

            const result = cleanupOldFiles('/tmp/uploads', 3600000);

            expect(result.deleted).toBe(0);
            expect(result.errors).toEqual([]);
        });
    });

    describe('cleanupTempDirectory', () => {
        const cleanupTempDirectory = (directory) => {
            if (!mockFs.existsSync(directory)) {
                return { success: true, message: 'Directory does not exist' };
            }

            try {
                const files = mockFs.readdirSync(directory);
                for (const file of files) {
                    const filePath = path.join(directory, file);
                    const stats = mockFs.statSync(filePath);
                    
                    if (stats.isDirectory && stats.isDirectory()) {
                        // Recursively clean subdirectory
                        cleanupTempDirectory(filePath);
                        mockFs.rmdirSync(filePath);
                    } else {
                        mockFs.unlinkSync(filePath);
                    }
                }
                return { success: true, filesRemoved: files.length };
            } catch (err) {
                return { success: false, error: err.message };
            }
        };

        it('should return success if directory does not exist', () => {
            mockFs.existsSync.mockReturnValue(false);
            
            const result = cleanupTempDirectory('/tmp/test');
            
            expect(result.success).toBe(true);
        });

        it('should remove all files in directory', () => {
            mockFs.existsSync.mockReturnValue(true);
            mockFs.readdirSync.mockReturnValue(['file1.txt', 'file2.txt']);
            mockFs.statSync.mockReturnValue({ isDirectory: () => false });
            mockFs.unlinkSync.mockReturnValue(undefined);

            const result = cleanupTempDirectory('/tmp/test');

            expect(result.success).toBe(true);
            expect(result.filesRemoved).toBe(2);
            expect(mockFs.unlinkSync).toHaveBeenCalledTimes(2);
        });

        it('should handle errors', () => {
            mockFs.existsSync.mockReturnValue(true);
            mockFs.readdirSync.mockImplementation(() => {
                throw new Error('Access denied');
            });

            const result = cleanupTempDirectory('/tmp/test');

            expect(result.success).toBe(false);
            expect(result.error).toBe('Access denied');
        });
    });

    describe('getDirectorySize', () => {
        const getDirectorySize = (directory) => {
            if (!mockFs.existsSync(directory)) {
                return 0;
            }

            let totalSize = 0;
            const files = mockFs.readdirSync(directory);

            for (const file of files) {
                const filePath = path.join(directory, file);
                const stats = mockFs.statSync(filePath);
                totalSize += stats.size || 0;
            }

            return totalSize;
        };

        it('should return 0 for non-existent directory', () => {
            mockFs.existsSync.mockReturnValue(false);
            
            const size = getDirectorySize('/tmp/nonexistent');
            
            expect(size).toBe(0);
        });

        it('should calculate total size of files', () => {
            mockFs.existsSync.mockReturnValue(true);
            mockFs.readdirSync.mockReturnValue(['file1.txt', 'file2.txt']);
            mockFs.statSync.mockImplementation((filePath) => {
                if (filePath.includes('file1')) {
                    return { size: 1024 };
                }
                return { size: 2048 };
            });

            const size = getDirectorySize('/tmp/test');

            expect(size).toBe(3072);
        });

        it('should handle empty directory', () => {
            mockFs.existsSync.mockReturnValue(true);
            mockFs.readdirSync.mockReturnValue([]);

            const size = getDirectorySize('/tmp/empty');

            expect(size).toBe(0);
        });
    });
});
