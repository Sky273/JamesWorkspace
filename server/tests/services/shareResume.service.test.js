/**
 * Tests for shareResume.service.js
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

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

import { query } from '../../config/database.js';
import fs from 'fs/promises';
import {
    initShareResumeTable,
    storeSharedPdf,
    getSharedPdfByToken,
    getOriginalFileInfo,
    getShareStatus,
    getOrCreateOriginalFileToken,
    getOrCreateSharedPdfToken,
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
        expect(fs.writeFile).toHaveBeenCalled();
        expect(query.mock.calls[1][0]).toContain('shared_pdf_token');
    });

    it('deletes the previous shared PDF when replacing it', async () => {
        query
            .mockResolvedValueOnce({ rows: [{ id: 'resume-123', shared_pdf_path: '/old/file.pdf' }] })
            .mockResolvedValueOnce({ rows: [] });

        await storeSharedPdf('resume-123', Buffer.from('PDF content'), 'cv.pdf');

        expect(fs.unlink).toHaveBeenCalledWith('/old/file.pdf');
    });

    it('returns shared PDF info when token is valid', async () => {
        query.mockResolvedValueOnce({
            rows: [{
                id: 'resume-123',
                shared_pdf_path: '/path/to/pdf.pdf',
                name: 'John Doe CV',
                shared_pdf_expires_at: new Date(Date.now() + 60_000)
            }]
        });

        const result = await getSharedPdfByToken('valid-token');

        expect(result).toEqual({
            path: '/path/to/pdf.pdf',
            resumeId: 'resume-123',
            name: 'John Doe CV',
            expiresAt: expect.any(Date)
        });
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

    it('returns the original file only for a valid file token', async () => {
        query.mockResolvedValueOnce({
            rows: [{
                id: 'resume-123',
                file_name: 'cv.pdf',
                name: 'John',
                resume_file_data: Buffer.from('file'),
                resume_file_type: 'application/pdf',
                resume_file_size: 4,
                shared_file_expires_at: new Date(Date.now() + 60_000)
            }]
        });

        const result = await getResumeFileByToken('file-token');
        expect(result).toEqual(expect.objectContaining({ id: 'resume-123', file_name: 'cv.pdf' }));
    });

    it('rejects an expired original-file token', async () => {
        query.mockResolvedValueOnce({
            rows: [{
                id: 'resume-123',
                file_name: 'cv.pdf',
                resume_file_data: Buffer.from('file'),
                resume_file_type: 'application/pdf',
                resume_file_size: 4,
                shared_file_expires_at: new Date(Date.now() - 60_000)
            }]
        });

        await expect(getResumeFileByToken('expired-file-token')).resolves.toBeNull();
    });

    it('revokes both share links and deletes the shared PDF file', async () => {
        query
            .mockResolvedValueOnce({
                rows: [{
                    id: 'resume-123',
                    shared_pdf_path: '/tmp/shared.pdf',
                    shared_pdf_token: 'pdf-token',
                    shared_file_token: 'file-token'
                }]
            })
            .mockResolvedValueOnce({ rows: [] });

        await expect(revokeShareLinks('resume-123')).resolves.toBe(true);
        expect(query.mock.calls[1][0]).toContain('shared_file_token = NULL');
        expect(fs.unlink).toHaveBeenCalledWith('/tmp/shared.pdf');
    });
});
