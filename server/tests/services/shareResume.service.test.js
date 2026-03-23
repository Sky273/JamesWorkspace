/**
 * Tests for shareResume.service.js
 * PDF sharing functionality for resumes
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('../../config/database.js', () => ({
    query: vi.fn()
}));

vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn(),
    createModuleLogger: () => ({
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn()
    })
}));

vi.mock('fs/promises', () => ({
    default: {
        mkdir: vi.fn().mockResolvedValue(undefined),
        writeFile: vi.fn().mockResolvedValue(undefined),
        access: vi.fn().mockResolvedValue(undefined)
    },
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
    access: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('crypto', () => ({
    default: {
        randomBytes: vi.fn().mockReturnValue({
            toString: () => 'a'.repeat(64)
        })
    },
    randomBytes: vi.fn().mockReturnValue({
        toString: () => 'a'.repeat(64)
    })
}));

import { query } from '../../config/database.js';
import { safeLog } from '../../utils/logger.backend.js';
import fs from 'fs/promises';
import {
    initShareResumeTable,
    storeSharedPdf,
    getSharedPdfByToken,
    getOriginalFileInfo,
    getShareStatus
} from '../../services/shareResume.service.js';

describe('shareResume.service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('initShareResumeTable', () => {
        it('should verify columns, index, and create shared directory', async () => {
            query.mockImplementation((sql, params) => {
                if (sql.includes('information_schema.tables')) {
                    expect(params).toEqual([['resumes']]);
                    return Promise.resolve({ rows: [{ table_name: 'resumes' }] });
                }
                if (sql.includes('information_schema.columns')) {
                    expect(params).toEqual(['resumes', ['shared_pdf_path', 'shared_pdf_token']]);
                    return Promise.resolve({ rows: [
                        { column_name: 'shared_pdf_path' },
                        { column_name: 'shared_pdf_token' }
                    ] });
                }
                if (sql.includes('pg_indexes')) {
                    expect(params).toEqual([['idx_resumes_shared_pdf_token']]);
                    return Promise.resolve({ rows: [{ indexname: 'idx_resumes_shared_pdf_token' }] });
                }
                return Promise.resolve({ rows: [] });
            });
            fs.mkdir.mockResolvedValue(undefined);

            const result = await initShareResumeTable();

            expect(result).toBe(true);
            expect(query).toHaveBeenCalledTimes(3);
            expect(fs.mkdir).toHaveBeenCalled();
        });

        it('should throw error on database failure', async () => {
            query.mockRejectedValue(new Error('Database error'));

            await expect(initShareResumeTable()).rejects.toThrow('Database error');
            expect(safeLog).toHaveBeenCalledWith('error', expect.any(String), expect.any(Object));
        });
    });

    describe('storeSharedPdf', () => {
        it('should store PDF and return token', async () => {
            query.mockResolvedValue({ rows: [] });
            fs.writeFile.mockResolvedValue(undefined);

            const pdfBuffer = Buffer.from('PDF content');
            const result = await storeSharedPdf('resume-123', pdfBuffer, 'my-cv.pdf');

            expect(result.token).toBeDefined();
            expect(result.token.length).toBe(64);
            expect(result.path).toContain('shared');
            expect(fs.writeFile).toHaveBeenCalled();
            expect(query).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE resumes'),
                expect.arrayContaining(['resume-123'])
            );
        });

        it('should sanitize filename', async () => {
            query.mockResolvedValue({ rows: [] });
            fs.writeFile.mockResolvedValue(undefined);

            const pdfBuffer = Buffer.from('PDF content');
            await storeSharedPdf('resume-123', pdfBuffer, 'my cv (2024).pdf');

            expect(fs.writeFile).toHaveBeenCalledWith(
                expect.stringContaining('my_cv__2024_'),
                pdfBuffer
            );
        });

        it('should throw error on write failure', async () => {
            fs.writeFile.mockRejectedValue(new Error('Write failed'));

            const pdfBuffer = Buffer.from('PDF content');
            await expect(storeSharedPdf('resume-123', pdfBuffer, 'cv.pdf'))
                .rejects.toThrow('Write failed');
        });

        it('should log success with truncated token', async () => {
            query.mockResolvedValue({ rows: [] });
            fs.writeFile.mockResolvedValue(undefined);

            const pdfBuffer = Buffer.from('PDF content');
            await storeSharedPdf('resume-123', pdfBuffer, 'cv.pdf');

            expect(safeLog).toHaveBeenCalledWith('info', 'Shared PDF stored', expect.objectContaining({
                resumeId: 'resume-123',
                token: expect.stringContaining('...')
            }));
        });
    });

    describe('getSharedPdfByToken', () => {
        it('should return PDF info when found', async () => {
            query.mockResolvedValue({
                rows: [{
                    id: 'resume-123',
                    shared_pdf_path: '/path/to/pdf.pdf',
                    name: 'John Doe CV'
                }]
            });
            fs.access.mockResolvedValue(undefined);

            const result = await getSharedPdfByToken('valid-token');

            expect(result).toEqual({
                path: '/path/to/pdf.pdf',
                resumeId: 'resume-123',
                name: 'John Doe CV'
            });
        });

        it('should return null when token not found', async () => {
            query.mockResolvedValue({ rows: [] });

            const result = await getSharedPdfByToken('invalid-token');

            expect(result).toBeNull();
        });

        it('should return null when file does not exist', async () => {
            query.mockResolvedValue({
                rows: [{
                    id: 'resume-123',
                    shared_pdf_path: '/path/to/missing.pdf',
                    name: 'CV'
                }]
            });
            fs.access.mockRejectedValue(new Error('ENOENT'));

            const result = await getSharedPdfByToken('valid-token');

            expect(result).toBeNull();
            expect(safeLog).toHaveBeenCalledWith('warn', 'Shared PDF file not found', expect.any(Object));
        });

        it('should return null on database error', async () => {
            query.mockRejectedValue(new Error('Database error'));

            const result = await getSharedPdfByToken('token');

            expect(result).toBeNull();
            expect(safeLog).toHaveBeenCalledWith('error', expect.any(String), expect.any(Object));
        });
    });

    describe('getOriginalFileInfo', () => {
        it('should return file info when resume has file', async () => {
            query.mockResolvedValue({
                rows: [{
                    id: 'resume-123',
                    file_name: 'original.pdf',
                    name: 'John Doe',
                    has_file: true
                }]
            });

            const result = await getOriginalFileInfo('resume-123');

            expect(result).toEqual({
                resumeId: 'resume-123',
                filename: 'original.pdf',
                name: 'John Doe',
                hasFile: true
            });
        });

        it('should use name as filename fallback', async () => {
            query.mockResolvedValue({
                rows: [{
                    id: 'resume-123',
                    file_name: null,
                    name: 'John Doe',
                    has_file: true
                }]
            });

            const result = await getOriginalFileInfo('resume-123');

            expect(result.filename).toBe('John Doe');
        });

        it('should use cv as filename when both are null', async () => {
            query.mockResolvedValue({
                rows: [{
                    id: 'resume-123',
                    file_name: null,
                    name: null,
                    has_file: true
                }]
            });

            const result = await getOriginalFileInfo('resume-123');

            expect(result.filename).toBe('cv');
        });

        it('should return null when resume not found', async () => {
            query.mockResolvedValue({ rows: [] });

            const result = await getOriginalFileInfo('nonexistent');

            expect(result).toBeNull();
        });

        it('should return null when resume has no file', async () => {
            query.mockResolvedValue({
                rows: [{
                    id: 'resume-123',
                    has_file: false
                }]
            });

            const result = await getOriginalFileInfo('resume-123');

            expect(result).toBeNull();
            expect(safeLog).toHaveBeenCalledWith('warn', 'Original file not found in database', expect.any(Object));
        });

        it('should return null on database error', async () => {
            query.mockRejectedValue(new Error('Database error'));

            const result = await getOriginalFileInfo('resume-123');

            expect(result).toBeNull();
        });
    });

    describe('getShareStatus', () => {
        it('should return hasSharedPdf true when token exists', async () => {
            query.mockResolvedValue({
                rows: [{ shared_pdf_token: 'some-token' }]
            });

            const result = await getShareStatus('resume-123');

            expect(result).toEqual({
                hasSharedPdf: true,
                token: 'some-token'
            });
        });

        it('should return hasSharedPdf false when token is null', async () => {
            query.mockResolvedValue({
                rows: [{ shared_pdf_token: null }]
            });

            const result = await getShareStatus('resume-123');

            expect(result).toEqual({
                hasSharedPdf: false,
                token: null
            });
        });

        it('should return hasSharedPdf false when resume not found', async () => {
            query.mockResolvedValue({ rows: [] });

            const result = await getShareStatus('nonexistent');

            expect(result).toEqual({
                hasSharedPdf: false,
                token: null
            });
        });

        it('should return hasSharedPdf false on database error', async () => {
            query.mockRejectedValue(new Error('Database error'));

            const result = await getShareStatus('resume-123');

            expect(result).toEqual({
                hasSharedPdf: false,
                token: null
            });
            expect(safeLog).toHaveBeenCalledWith('error', expect.any(String), expect.any(Object));
        });
    });
});
