/**
 * Tests for Batch Jobs Worker - Export Generator
 * generateJobExport: ZIP creation, template processing, format handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Readable } from 'stream';

process.env.PDF_SERVER_INTERNAL_TOKEN = 'test-pdf-server-internal-token-minimum-32-chars';

vi.mock('../../utils/logger.backend.js', () => ({ safeLog: vi.fn() }));

const mockQuery = vi.fn();
vi.mock('../../config/database.js', () => ({
    query: (...args) => mockQuery(...args)
}));

const mockGetJob = vi.fn();
const mockGetJobItems = vi.fn();
const mockUpdateJobItemStatus = vi.fn();
const mockUpdateJobExportFile = vi.fn();

vi.mock('../../services/batchJobs.service.js', () => ({
    ITEM_STATUS: { PENDING: 'pending', PROCESSING: 'processing', SUCCESS: 'success', ERROR: 'error' },
    getJob: (...args) => mockGetJob(...args),
    getJobItems: (...args) => mockGetJobItems(...args),
    updateJobItemStatus: (...args) => mockUpdateJobItemStatus(...args),
    updateJobExportFile: (...args) => mockUpdateJobExportFile(...args)
}));

vi.mock('../../services/batchJobsWorker/helpers.js', () => ({
    removeSuggestionMarkers: vi.fn(text => text)
}));

const mockTrackBatchExportActivity = vi.fn();
vi.mock('../../services/metrics.service.js', () => ({
    metrics: {
        trackBatchExportActivity: (...args) => mockTrackBatchExportActivity(...args)
    }
}));

// Mock jszip - must be a constructor that tracks added files
const mockZipGenerateAsync = vi.fn(() => Buffer.from('zipdata'));
const mockZipGenerateNodeStream = vi.fn(() => Readable.from(['zipdata']));
let _zipInstance = null;

class MockJSZip {
    constructor() {
        this.files = {};
        _zipInstance = this;
    }
    folder() {
        // Return self so folder().file() works
        return this;
    }
    file(name, data) {
        if (name && data !== undefined) {
            this.files[name] = { dir: false, name };
        }
        return this;
    }
    generateNodeStream(...args) { return mockZipGenerateNodeStream(...args); }
    generateAsync(...args) { return mockZipGenerateAsync(...args); }
}

vi.mock('jszip', () => ({
    default: MockJSZip
}));

// Mock fs
vi.mock('fs', async () => {
    const actual = await vi.importActual('fs');
    return {
        ...actual,
        default: {
            ...actual,
            promises: {
                mkdtemp: vi.fn(() => Promise.resolve('/tmp/batch-export-j1-123')),
                mkdir: vi.fn(() => Promise.resolve()),
                rm: vi.fn(() => Promise.resolve()),
                writeFile: vi.fn(() => Promise.resolve()),
                stat: vi.fn(() => Promise.resolve({ size: 7 }))
            },
            existsSync: vi.fn(() => true),
            mkdirSync: vi.fn(),
            writeFileSync: vi.fn(),
            createReadStream: vi.fn(() => Readable.from(['artifact'])),
            createWriteStream: vi.fn(() => ({ on: vi.fn(), once: vi.fn(), destroy: vi.fn() }))
        },
        promises: {
            mkdtemp: vi.fn(() => Promise.resolve('/tmp/batch-export-j1-123')),
            mkdir: vi.fn(() => Promise.resolve()),
            rm: vi.fn(() => Promise.resolve()),
            writeFile: vi.fn(() => Promise.resolve()),
            stat: vi.fn(() => Promise.resolve({ size: 7 }))
        },
        existsSync: vi.fn(() => true),
        mkdirSync: vi.fn(),
        writeFileSync: vi.fn(),
        createReadStream: vi.fn(() => Readable.from(['artifact'])),
        createWriteStream: vi.fn(() => ({ on: vi.fn(), once: vi.fn(), destroy: vi.fn() }))
    };
});

vi.mock('stream/promises', () => ({
    pipeline: vi.fn(() => Promise.resolve())
}));

// Mock fetch for PDF server
const mockFetch = vi.fn();
global.fetch = mockFetch;

import { generateJobExport } from '../../services/batchJobsWorker/exportGenerator.js';

describe('Batch Jobs Worker - Export Generator', () => {
    const originalPdfToken = process.env.PDF_SERVER_INTERNAL_TOKEN;

    beforeEach(() => {
        vi.resetAllMocks();
        process.env.PDF_SERVER_INTERNAL_TOKEN = 't'.repeat(32);
        mockZipGenerateAsync.mockResolvedValue(Buffer.from('zipdata'));
        mockZipGenerateNodeStream.mockReturnValue(Readable.from(['zipdata']));
    });

    afterEach(() => {
        process.env.PDF_SERVER_INTERNAL_TOKEN = originalPdfToken;
        delete process.env.PDF_SERVER_URL;
    });

    const template = {
        id: 'tpl-1',
        name: 'Modern CV',
        template_content: '<div>-name- -title- -content-</div>',
        header_content: '<h1>-name-</h1>',
        footer_content: '<p>Page</p>',
        stylesheet: 'body { font: sans-serif; }',
        footer_height: 30
    };

    it('should return early when no successful items', async () => {
        mockGetJob.mockResolvedValueOnce({ id: 'j1' });
        mockGetJobItems.mockResolvedValueOnce([
            { id: 'i1', status: 'error', resume_id: null }
        ]);
        mockQuery.mockResolvedValueOnce({ rows: [template] }); // template query

        // Should not throw, just return
        await generateJobExport('j1', { templateId: 'tpl-1', exportFormats: ['pdf'] });

        // No export file update since no items to export
        expect(mockUpdateJobExportFile).not.toHaveBeenCalled();
    });

    it('should throw when template not found', async () => {
        mockGetJob.mockResolvedValueOnce({ id: 'j1' });
        mockGetJobItems.mockResolvedValueOnce([
            { id: 'i1', status: 'success', resume_id: 'r1' }
        ]);
        mockQuery.mockResolvedValueOnce({ rows: [] }); // no template

        await expect(
            generateJobExport('j1', { templateId: 'tpl-bad', exportFormats: ['pdf'] })
        ).rejects.toThrow('Template not found');

        expect(mockUpdateJobItemStatus).toHaveBeenCalledWith('i1', 'error', expect.objectContaining({
            error_message: 'Template not found'
        }));
    });

    it('should return early when only failed items exist', async () => {
        mockGetJob.mockResolvedValueOnce({ id: 'j1' });
        mockGetJobItems.mockResolvedValueOnce([
            { id: 'i1', status: 'error', resume_id: null }
        ]);

        // No template query needed since it returns early
        await generateJobExport('j1', { templateId: 'tpl-1', exportFormats: ['pdf'] });
        expect(mockUpdateJobExportFile).not.toHaveBeenCalled();
    });

    it('should generate PDF export for successful items', async () => {
        mockGetJob.mockResolvedValueOnce({ id: 'j1' });
        mockGetJobItems.mockResolvedValueOnce([
            { id: 'i1', status: 'success', resume_id: 'r1', file_name: 'cv.pdf' }
        ]);
        mockQuery
            .mockResolvedValueOnce({ rows: [template] }) // template
            .mockResolvedValueOnce({ rows: [{ id: 'r1', improved_text: '<p>Good CV</p>', name: 'Alice', title: 'Dev', trigram: 'ALI' }] }); // resume

        // Mock fetch for PDF server
        mockFetch.mockResolvedValueOnce({
            ok: true,
            arrayBuffer: () => Promise.resolve(new ArrayBuffer(100))
        });

        await generateJobExport('j1', { templateId: 'tpl-1', exportFormats: ['pdf'] });

        expect(mockFetch).toHaveBeenCalledWith(
            expect.stringContaining('/generate-pdf'),
            expect.objectContaining({ method: 'POST' })
        );
        expect(mockUpdateJobExportFile).toHaveBeenCalledWith('j1', expect.any(String), expect.stringContaining('export_j1'));
        expect(mockTrackBatchExportActivity).toHaveBeenCalledWith(expect.objectContaining({
            source: 'job',
            format: 'pdf',
            successfulRuns: 1,
            generatedFiles: 1
        }));
    });

    it('should persist generated artifacts to temp files before ZIP generation', async () => {
        mockGetJob.mockResolvedValueOnce({ id: 'j1' });
        mockGetJobItems.mockResolvedValueOnce([
            { id: 'i1', status: 'success', resume_id: 'r1', file_name: 'cv.pdf' }
        ]);
        mockQuery
            .mockResolvedValueOnce({ rows: [template] })
            .mockResolvedValueOnce({ rows: [{ id: 'r1', improved_text: '<p>CV</p>', name: 'Alice', title: 'Dev', trigram: 'ALI' }] });

        const arrayBuffer = vi.fn(() => Promise.resolve(new ArrayBuffer(32)));
        mockFetch.mockResolvedValueOnce({
            ok: true,
            body: Readable.from([Buffer.from('pdf-content')]),
            arrayBuffer
        });

        await generateJobExport('j1', { templateId: 'tpl-1', exportFormats: ['pdf'] });

        const fsModule = await import('fs');
        expect(arrayBuffer).toHaveBeenCalled();
        expect(fsModule.default.promises.writeFile).toHaveBeenCalled();
        expect(fsModule.default.createReadStream).toHaveBeenCalled();
        expect(mockUpdateJobExportFile).toHaveBeenCalledWith('j1', expect.any(String), expect.stringContaining('export_j1'));
    });

    it('should stream the final zip to disk without sync writes', async () => {
        mockGetJob.mockResolvedValueOnce({ id: 'j1' });
        mockGetJobItems.mockResolvedValueOnce([
            { id: 'i1', status: 'success', resume_id: 'r1', file_name: 'cv.pdf' }
        ]);
        mockQuery
            .mockResolvedValueOnce({ rows: [template] })
            .mockResolvedValueOnce({ rows: [{ id: 'r1', improved_text: '<p>CV</p>', name: 'Alice', title: 'Dev', trigram: 'ALI' }] });

        mockFetch.mockResolvedValueOnce({
            ok: true,
            arrayBuffer: () => Promise.resolve(new ArrayBuffer(32))
        });

        const fsModule = await import('fs');
        const { pipeline } = await import('stream/promises');

        await generateJobExport('j1', { templateId: 'tpl-1', exportFormats: ['pdf'] });

        expect(mockZipGenerateNodeStream).toHaveBeenCalled();
        expect(pipeline).toHaveBeenCalled();
        expect(fsModule.default.writeFileSync).not.toHaveBeenCalled();
        expect(fsModule.default.promises.rm).toHaveBeenCalled();
    });

    it('should mark generated items as error if final zip streaming fails', async () => {
        mockGetJob.mockResolvedValueOnce({ id: 'j1' });
        mockGetJobItems.mockResolvedValueOnce([
            { id: 'i1', status: 'success', resume_id: 'r1', file_name: 'cv.pdf' }
        ]);
        mockQuery
            .mockResolvedValueOnce({ rows: [template] })
            .mockResolvedValueOnce({ rows: [{ id: 'r1', improved_text: '<p>CV</p>', name: 'Alice', title: 'Dev', trigram: 'ALI' }] });

        mockFetch.mockResolvedValueOnce({
            ok: true,
            arrayBuffer: () => Promise.resolve(new ArrayBuffer(32))
        });

        const { pipeline } = await import('stream/promises');
        pipeline.mockRejectedValueOnce(new Error('zip stream failed'));

        await expect(
            generateJobExport('j1', { templateId: 'tpl-1', exportFormats: ['pdf'] })
        ).rejects.toThrow('zip stream failed');

        expect(mockUpdateJobExportFile).not.toHaveBeenCalled();
        expect(mockUpdateJobItemStatus).toHaveBeenCalledWith('i1', 'error', expect.objectContaining({
            error_message: 'Export archive generation failed'
        }));

        const fsModule = await import('fs');
        expect(fsModule.default.promises.rm).toHaveBeenCalledWith('/tmp/batch-export-j1-123', expect.objectContaining({
            recursive: true,
            force: true
        }));
    });

    it('should handle single exportFormat string', async () => {
        mockGetJob.mockResolvedValueOnce({ id: 'j1' });
        mockGetJobItems.mockResolvedValueOnce([
            { id: 'i1', status: 'success', resume_id: 'r1' }
        ]);
        mockQuery
            .mockResolvedValueOnce({ rows: [template] })
            .mockResolvedValueOnce({ rows: [{ id: 'r1', improved_text: '<p>CV</p>', name: 'Bob', title: 'PM', trigram: 'BOB' }] });

        mockFetch.mockResolvedValueOnce({
            ok: true,
            arrayBuffer: () => Promise.resolve(new ArrayBuffer(50))
        });

        // exportFormat (singular) should also work
        await generateJobExport('j1', { templateId: 'tpl-1', exportFormat: 'docx' });

        expect(mockFetch).toHaveBeenCalledWith(
            expect.stringContaining('/generate-docx'),
            expect.any(Object)
        );
    });

    it('should mark items as error when PDF generation fails', async () => {
        mockGetJob.mockResolvedValueOnce({ id: 'j1' });
        mockGetJobItems.mockResolvedValueOnce([
            { id: 'i1', status: 'success', resume_id: 'r1' }
        ]);
        mockQuery
            .mockResolvedValueOnce({ rows: [template] })
            .mockResolvedValueOnce({ rows: [{ id: 'r1', improved_text: '<p>CV</p>', name: 'Eve', title: 'QA', trigram: 'EVE' }] });

        // All 3 retry attempts fail
        mockFetch
            .mockResolvedValueOnce({ ok: false, status: 500, text: () => Promise.resolve('Server error') })
            .mockResolvedValueOnce({ ok: false, status: 500, text: () => Promise.resolve('Server error') })
            .mockResolvedValueOnce({ ok: false, status: 500, text: () => Promise.resolve('Server error') });

        // Should throw "No files generated" since the only item failed
        await expect(
            generateJobExport('j1', { templateId: 'tpl-1', exportFormats: ['pdf'] })
        ).rejects.toThrow('No files generated');

        expect(mockUpdateJobItemStatus).toHaveBeenCalledWith('i1', 'error', expect.objectContaining({
            error_message: expect.any(String)
        }));
        expect(mockTrackBatchExportActivity).toHaveBeenCalledWith(expect.objectContaining({
            source: 'job',
            format: 'pdf',
            failedRuns: 1,
            failedFiles: 1
        }));
    });

    it('should handle adaptation items', async () => {
        mockGetJob.mockResolvedValueOnce({ id: 'j1' });
        mockGetJobItems.mockResolvedValueOnce([
            { id: 'i1', status: 'success', resume_id: 'r1', adaptation_id: 'a1', source_type: 'adaptation', file_name: 'mission' }
        ]);
        mockQuery
            .mockResolvedValueOnce({ rows: [template] }) // template
            .mockResolvedValueOnce({ rows: [{ adapted_text: '<p>Adapted CV</p>', candidate_name: 'Carol', adapted_title: 'Adapted Dev', mission_title: 'Mission X' }] }); // adaptation

        mockFetch.mockResolvedValueOnce({
            ok: true,
            arrayBuffer: () => Promise.resolve(new ArrayBuffer(80))
        });

        await generateJobExport('j1', { templateId: 'tpl-1', exportFormats: ['pdf'] });

        expect(mockUpdateJobExportFile).toHaveBeenCalled();
    });

    it('should preserve only safe archive subdirectories in zip entries', async () => {
        mockGetJob.mockResolvedValueOnce({ id: 'j1' });
        mockGetJobItems.mockResolvedValueOnce([
            { id: 'i1', status: 'success', resume_id: 'r1', file_name: 'cv.pdf', relative_path: 'team/backend/original.pdf' }
        ]);
        mockQuery
            .mockResolvedValueOnce({ rows: [template] })
            .mockResolvedValueOnce({ rows: [{ id: 'r1', improved_text: '<p>CV</p>', name: 'Alice', title: 'Dev', trigram: 'ALI' }] });

        mockFetch.mockResolvedValueOnce({
            ok: true,
            arrayBuffer: () => Promise.resolve(new ArrayBuffer(32))
        });

        await generateJobExport('j1', { templateId: 'tpl-1', exportFormats: ['pdf'] });

        expect(Object.keys(_zipInstance.files)).toContain('team/backend/ALI_Modern_CV.pdf');
    });

    it('should reject traversal paths before adding files to the zip', async () => {
        mockGetJob.mockResolvedValueOnce({ id: 'j1' });
        mockGetJobItems.mockResolvedValueOnce([
            { id: 'i1', status: 'success', resume_id: 'r1', file_name: 'cv.pdf', relative_path: '../escape/original.pdf' }
        ]);
        mockQuery
            .mockResolvedValueOnce({ rows: [template] })
            .mockResolvedValueOnce({ rows: [{ id: 'r1', improved_text: '<p>CV</p>', name: 'Alice', title: 'Dev', trigram: 'ALI' }] });

        mockFetch.mockResolvedValueOnce({
            ok: true,
            arrayBuffer: () => Promise.resolve(new ArrayBuffer(32))
        });

        await expect(
            generateJobExport('j1', { templateId: 'tpl-1', exportFormats: ['pdf'] })
        ).rejects.toThrow('No files generated');

        expect(mockUpdateJobItemStatus).toHaveBeenCalledWith('i1', 'error', expect.objectContaining({
            error_message: expect.stringContaining('Archive path')
        }));
    });

    it('should reject public PDF server URLs before generating exports', async () => {
        process.env.PDF_SERVER_URL = 'https://example.com';
        mockGetJob.mockResolvedValueOnce({ id: 'j1' });
        mockGetJobItems.mockResolvedValueOnce([
            { id: 'i1', status: 'success', resume_id: 'r1', file_name: 'cv.pdf' }
        ]);
        mockQuery.mockResolvedValueOnce({ rows: [template] });

        await expect(
            generateJobExport('j1', { templateId: 'tpl-1', exportFormats: ['pdf'] })
        ).rejects.toThrow('private or loopback address');

        expect(mockFetch).not.toHaveBeenCalled();
        expect(mockUpdateJobItemStatus).toHaveBeenCalledWith('i1', 'error', expect.objectContaining({
            error_message: expect.stringContaining('private or loopback address')
        }));
    });
});
