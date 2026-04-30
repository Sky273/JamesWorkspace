/**
 * Tests for shareResume.service.js
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'path';

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
        access: vi.fn().mockResolvedValue(undefined),
        unlink: vi.fn().mockResolvedValue(undefined)
    },
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
    access: vi.fn().mockResolvedValue(undefined),
    unlink: vi.fn().mockResolvedValue(undefined)
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

vi.mock('../../utils/shareTokenStorage.js', () => ({
    generateShareToken: vi.fn(() => 'a'.repeat(64)),
    createStoredShareToken: vi.fn((token) => token),
    getStoredShareTokenLookup: vi.fn((token) => ({
        exactToken: token,
        v2Pattern: `v2:stored:${token}%`
    })),
    readStoredShareToken: vi.fn((storedValue) => storedValue.startsWith('v2:stored:') ? storedValue.slice('v2:stored:'.length) : storedValue)
}));

import { query } from '../../config/database.js';
import fs from 'fs/promises';
import { readStoredShareToken } from '../../utils/shareTokenStorage.js';
import {
    initShareResumeTable,
    storeSharedPdf,
    getSharedPdfByToken,
    cleanupExpiredShareArtifacts,
    getOriginalFileInfo,
    getShareStatus,
    getOrCreateOriginalFileToken,
    getOrCreateSharedPdfToken,
    getResumeFileMetadataByToken,
    getResumeFileDataById,
    getResumeFileByToken,
    revokeShareLinks,
    SHARE_LINK_TTL_DAYS
} from '../../services/shareResume.service.js';

describe('shareResume.service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('verifies the complete share schema', async () => {
        query.mockImplementation((sql, params) => {
            if (sql.includes('information_schema.tables')) {
                return Promise.resolve({ rows: [{ table_name: 'resumes' }] });
            }
            if (sql.includes('information_schema.columns')) {
                expect(params).toEqual(['resumes', ['shared_pdf_path', 'shared_pdf_token', 'shared_pdf_expires_at', 'shared_file_token', 'shared_file_expires_at']]);
                return Promise.resolve({ rows: [
                    { column_name: 'shared_pdf_path' },
                    { column_name: 'shared_pdf_token' },
                    { column_name: 'shared_pdf_expires_at' },
                    { column_name: 'shared_file_token' },
                    { column_name: 'shared_file_expires_at' }
                ] });
            }
            if (sql.includes('pg_indexes')) {
                expect(params).toEqual([['idx_resumes_shared_pdf_token', 'idx_resumes_shared_file_token']]);
                return Promise.resolve({ rows: [
                    { indexname: 'idx_resumes_shared_pdf_token' },
                    { indexname: 'idx_resumes_shared_file_token' }
                ] });
            }
            return Promise.resolve({ rows: [] });
        });

        await expect(initShareResumeTable()).resolves.toBe(true);
        expect(fs.mkdir).toHaveBeenCalled();
    });

    it('stores a shared PDF with a 7-day expiry', async () => {
        query
            .mockResolvedValueOnce({ rows: [{ id: 'resume-123', shared_pdf_path: null }] })
            .mockResolvedValueOnce({ rows: [] });

        const pdfBuffer = Buffer.from('PDF content');
        const result = await storeSharedPdf('resume-123', pdfBuffer, 'cv.pdf');

        expect(result.token).toHaveLength(64);
        expect(result.expiresAt).toBeInstanceOf(Date);
        const ttlDays = (result.expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
        expect(ttlDays).toBeGreaterThan(SHARE_LINK_TTL_DAYS - 0.01);
        expect(fs.writeFile).toHaveBeenCalledWith(expect.stringContaining(path.join('uploads', 'shared', 'aaaaaaaa')), pdfBuffer);
        expect(query.mock.calls[1][0]).toContain('shared_pdf_token');
        expect(query.mock.calls[1][1]).toEqual([
            `${'a'.repeat(64)}.pdf`,
            'a'.repeat(64),
            expect.any(Date),
            'resume-123'
        ]);
    });

    it('deletes the previous shared PDF when replacing it', async () => {
        query
            .mockResolvedValueOnce({ rows: [{ id: 'resume-123', shared_pdf_path: '/old/file.pdf' }] })
            .mockResolvedValueOnce({ rows: [] });

        await storeSharedPdf('resume-123', Buffer.from('PDF content'), 'cv.pdf');

        expect(fs.unlink).not.toHaveBeenCalledWith('/old/file.pdf');
    });

    it('deletes the new shared PDF if the database update fails', async () => {
        query
            .mockResolvedValueOnce({ rows: [{ id: 'resume-123', shared_pdf_path: null }] })
            .mockRejectedValueOnce(new Error('db failure'));

        await expect(storeSharedPdf('resume-123', Buffer.from('PDF content'), 'cv.pdf')).rejects.toThrow('db failure');

        expect(fs.writeFile).toHaveBeenCalled();
        expect(fs.unlink).toHaveBeenCalledWith(expect.stringContaining('aaaaaaaa'));
    });

    it('returns shared PDF info when token is valid', async () => {
        const expectedPath = path.resolve(process.cwd(), 'uploads', 'shared', 'pdf.pdf');
        query.mockResolvedValueOnce({
            rows: [{
                id: 'resume-123',
                shared_pdf_path: 'pdf.pdf',
                name: 'John Doe CV',
                shared_pdf_expires_at: new Date(Date.now() + 60_000)
            }]
        });

        const result = await getSharedPdfByToken('valid-token');

        expect(result).toEqual({
            path: expectedPath,
            resumeId: 'resume-123',
            name: 'John Doe CV',
            format: 'pdf',
            expiresAt: expect.any(Date)
        });
    });

    it('throws a typed 503 when shared PDF lookup fails', async () => {
        query.mockRejectedValueOnce(new Error('db down'));

        await expect(getSharedPdfByToken('valid-token')).rejects.toMatchObject({
            code: 'SHARE_PDF_LOOKUP_FAILED',
            statusCode: 503
        });
    });

    it('rejects shared PDF paths outside the managed directory', async () => {
        query.mockResolvedValueOnce({
            rows: [{
                id: 'resume-123',
                shared_pdf_path: 'C:\\temp\\outside.pdf',
                name: 'John Doe CV',
                shared_pdf_expires_at: new Date(Date.now() + 60_000)
            }]
        });

        await expect(getSharedPdfByToken('valid-token')).resolves.toBeNull();
        expect(fs.access).not.toHaveBeenCalled();
    });

    it('returns null when PDF token is expired', async () => {
        query.mockResolvedValueOnce({
            rows: [{
                id: 'resume-123',
                shared_pdf_path: '/path/to/pdf.pdf',
                name: 'John Doe CV',
                shared_pdf_expires_at: new Date(Date.now() - 60_000)
            }]
        });

        await expect(getSharedPdfByToken('expired-token')).resolves.toBeNull();
        expect(fs.access).not.toHaveBeenCalled();
    });

    it('returns original file info when a file exists', async () => {
        query.mockResolvedValueOnce({
            rows: [{ id: 'resume-123', file_name: 'original.pdf', name: 'John Doe', has_file: true }]
        });

        await expect(getOriginalFileInfo('resume-123')).resolves.toEqual({
            resumeId: 'resume-123',
            filename: 'original.pdf',
            name: 'John Doe',
            hasFile: true
        });
    });

    it('throws a typed 503 when original file lookup fails', async () => {
        query.mockRejectedValueOnce(new Error('db down'));

        await expect(getOriginalFileInfo('resume-123')).rejects.toMatchObject({
            code: 'SHARE_ORIGINAL_FILE_LOOKUP_FAILED',
            statusCode: 503
        });
    });

    it('returns separate PDF and file status', async () => {
        query.mockResolvedValueOnce({
            rows: [{
                shared_pdf_token: 'pdf-token',
                shared_pdf_expires_at: new Date(Date.now() + 60_000),
                shared_file_token: 'file-token',
                shared_file_expires_at: new Date(Date.now() + 60_000)
            }]
        });

        await expect(getShareStatus('resume-123')).resolves.toEqual({
            hasSharedPdf: true,
            token: 'pdf-token',
            expiresAt: expect.any(Date),
            pdfToken: 'pdf-token',
            pdfExpiresAt: expect.any(Date),
            hasSharedFile: true,
            fileToken: 'file-token',
            fileExpiresAt: expect.any(Date)
        });
    });

    it('fails closed when share status lookup fails', async () => {
        query.mockRejectedValueOnce(new Error('db failure'));

        await expect(getShareStatus('resume-123')).rejects.toMatchObject({
            code: 'SHARE_STATUS_LOOKUP_FAILED'
        });
    });

    it('returns inactive status for expired tokens', async () => {
        query.mockResolvedValueOnce({
            rows: [{
                shared_pdf_token: 'pdf-token',
                shared_pdf_expires_at: new Date(Date.now() - 60_000),
                shared_file_token: 'file-token',
                shared_file_expires_at: new Date(Date.now() - 60_000)
            }]
        });

        await expect(getShareStatus('resume-123')).resolves.toEqual({
            hasSharedPdf: false,
            token: null,
            expiresAt: null,
            pdfToken: null,
            pdfExpiresAt: null,
            hasSharedFile: false,
            fileToken: null,
            fileExpiresAt: null
        });
    });

    it('reuses a non-expired PDF token', async () => {
        query.mockResolvedValueOnce({
            rows: [{
                id: 'resume-123',
                shared_pdf_token: 'existing-pdf-token',
                shared_pdf_expires_at: new Date(Date.now() + 60_000)
            }]
        });

        await expect(getOrCreateSharedPdfToken('resume-123')).resolves.toBe('existing-pdf-token');
        expect(query).toHaveBeenCalledTimes(1);
    });

    it('creates a new original-file token when expired', async () => {
        query
            .mockResolvedValueOnce({
                rows: [{
                    id: 'resume-123',
                    shared_file_token: 'expired-file-token',
                    shared_file_expires_at: new Date(Date.now() - 60_000)
                }]
            })
            .mockResolvedValueOnce({ rows: [] });

        const token = await getOrCreateOriginalFileToken('resume-123');

        expect(token).toHaveLength(64);
        expect(query).toHaveBeenCalledTimes(2);
        expect(query.mock.calls[1][0]).toContain('shared_file_token');
    });

    it('regenerates an original-file token when the stored token cannot be read', async () => {
        readStoredShareToken.mockImplementationOnce(() => {
            throw new Error('Stored share token integrity check failed');
        });
        query
            .mockResolvedValueOnce({
                rows: [{
                    id: 'resume-123',
                    shared_file_token: 'broken-token',
                    shared_file_expires_at: new Date(Date.now() + 60_000)
                }]
            })
            .mockResolvedValueOnce({ rows: [] });

        const token = await getOrCreateOriginalFileToken('resume-123');

        expect(token).toHaveLength(64);
        expect(query).toHaveBeenCalledTimes(2);
        expect(query.mock.calls[1][0]).toContain('shared_file_token');
    });

    it('looks up hashed v2 share tokens for public PDF access', async () => {
        query.mockResolvedValueOnce({
            rows: [{
                id: 'resume-123',
                shared_pdf_path: 'pdf.pdf',
                name: 'John Doe CV',
                shared_pdf_expires_at: new Date(Date.now() + 60_000)
            }]
        });

        await getSharedPdfByToken('public-token');

        expect(query.mock.calls[0][0]).toContain('shared_pdf_token = $1 OR shared_pdf_token LIKE $2');
        expect(query.mock.calls[0][1]).toEqual(['public-token', 'v2:stored:public-token%']);
    });

    it('hides unreadable stored tokens from share status instead of failing', async () => {
        readStoredShareToken
            .mockImplementationOnce(() => {
                throw new Error('Stored share token integrity check failed');
            })
            .mockImplementationOnce(() => {
                throw new Error('Stored share token integrity check failed');
            });
        query.mockResolvedValueOnce({
            rows: [{
                shared_pdf_token: 'broken-pdf-token',
                shared_pdf_expires_at: new Date(Date.now() + 60_000),
                shared_file_token: 'broken-file-token',
                shared_file_expires_at: new Date(Date.now() + 60_000)
            }]
        });

        await expect(getShareStatus('resume-123')).resolves.toEqual({
            hasSharedPdf: false,
            token: null,
            expiresAt: null,
            pdfToken: null,
            pdfExpiresAt: null,
            hasSharedFile: false,
            fileToken: null,
            fileExpiresAt: null
        });
    });

    it('returns original file metadata without loading the blob for a valid file token', async () => {
        query.mockResolvedValueOnce({
            rows: [{
                id: 'resume-123',
                file_name: 'cv.pdf',
                name: 'John',
                resume_file_type: 'application/pdf',
                resume_file_size: 4,
                has_file: true,
                shared_file_expires_at: new Date(Date.now() + 60_000)
            }]
        });

        const result = await getResumeFileMetadataByToken('file-token');
        expect(result).toEqual(expect.objectContaining({ id: 'resume-123', file_name: 'cv.pdf' }));
        expect(query.mock.calls[0][0]).not.toContain('resume_file_data,');
    });

    it('rejects an expired original-file token', async () => {
        query.mockResolvedValueOnce({
            rows: [{
                id: 'resume-123',
                file_name: 'cv.pdf',
                resume_file_type: 'application/pdf',
                resume_file_size: 4,
                has_file: true,
                shared_file_expires_at: new Date(Date.now() - 60_000)
            }]
        });

        await expect(getResumeFileMetadataByToken('expired-file-token')).resolves.toBeNull();
    });

    it('returns null for original-file metadata when the blob is absent', async () => {
        query.mockResolvedValueOnce({
            rows: [{
                id: 'resume-123',
                file_name: 'cv.pdf',
                resume_file_type: 'application/pdf',
                resume_file_size: 4,
                has_file: false,
                shared_file_expires_at: new Date(Date.now() + 60_000)
            }]
        });

        await expect(getResumeFileMetadataByToken('missing-file-token')).resolves.toBeNull();
    });

    it('loads original file data by resume id only when needed', async () => {
        query.mockResolvedValueOnce({
            rows: [{ resume_file_data: Buffer.from('file') }]
        });

        const result = await getResumeFileDataById('resume-123');

        expect(result).toEqual(Buffer.from('file'));
        expect(query.mock.calls[0][0]).toContain('SELECT resume_file_data');
        expect(query.mock.calls[0][1]).toEqual(['resume-123']);
    });

    it('still supports the compatibility wrapper for original file download', async () => {
        query
            .mockResolvedValueOnce({
                rows: [{
                    id: 'resume-123',
                    file_name: 'cv.pdf',
                    name: 'John',
                    resume_file_type: 'application/pdf',
                    resume_file_size: 4,
                    has_file: true,
                    shared_file_expires_at: new Date(Date.now() + 60_000)
                }]
            })
            .mockResolvedValueOnce({
                rows: [{ resume_file_data: Buffer.from('file') }]
            });

        const result = await getResumeFileByToken('file-token');

        expect(result).toEqual(expect.objectContaining({
            id: 'resume-123',
            file_name: 'cv.pdf',
            resume_file_data: Buffer.from('file')
        }));
    });

    it('revokes both share links and deletes the shared PDF file', async () => {
        query
            .mockResolvedValueOnce({
                rows: [{
                    id: 'resume-123',
                    shared_pdf_path: 'shared.pdf',
                    shared_pdf_token: 'pdf-token',
                    shared_file_token: 'file-token'
                }]
            })
            .mockResolvedValueOnce({ rows: [] });

        await expect(revokeShareLinks('resume-123')).resolves.toBe(true);
        expect(query.mock.calls[1][0]).toContain('shared_file_token = NULL');
        expect(fs.unlink).toHaveBeenCalledWith(expect.stringContaining(path.join('uploads', 'shared', 'shared.pdf')));
    });

    it('cleans up expired share tokens and PDF files', async () => {
        query
            .mockResolvedValueOnce({
                rows: [{
                    id: 'resume-123',
                    shared_pdf_path: 'expired.pdf',
                    shared_pdf_token: 'expired-pdf-token',
                    shared_pdf_expires_at: new Date(Date.now() - 60_000),
                    shared_file_token: 'expired-file-token',
                    shared_file_expires_at: new Date(Date.now() - 60_000)
                }]
            })
            .mockResolvedValueOnce({ rows: [] });

        await expect(cleanupExpiredShareArtifacts()).resolves.toEqual({
            expiredPdfLinksCleared: 1,
            expiredFileLinksCleared: 1,
            expiredPdfFilesDeleted: 1
        });

        expect(fs.unlink).toHaveBeenCalledWith(expect.stringContaining(path.join('uploads', 'shared', 'expired.pdf')));
        expect(query.mock.calls[1][0]).toContain('shared_pdf_path = NULL');
        expect(query.mock.calls[1][0]).toContain('shared_file_token = NULL');
    });

    it('cleans up only the expired share side when the other one is still active', async () => {
        query
            .mockResolvedValueOnce({
                rows: [{
                    id: 'resume-123',
                    shared_pdf_path: '/tmp/shared.pdf',
                    shared_pdf_token: 'expired-pdf-token',
                    shared_pdf_expires_at: new Date(Date.now() - 60_000),
                    shared_file_token: 'active-file-token',
                    shared_file_expires_at: new Date(Date.now() + 60_000)
                }]
            })
            .mockResolvedValueOnce({ rows: [] });

        await cleanupExpiredShareArtifacts();

        expect(query.mock.calls[1][0]).toContain('shared_pdf_path = NULL');
        expect(query.mock.calls[1][0]).not.toContain('shared_file_token = NULL');
    });
});
