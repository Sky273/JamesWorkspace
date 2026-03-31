import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
    mockExecFile,
    mockMkdtemp,
    mockWriteFile,
    mockReadFile,
    mockRm,
    mockExtractPdfTextWithOcr
} = vi.hoisted(() => ({
    mockExecFile: vi.fn(),
    mockMkdtemp: vi.fn(),
    mockWriteFile: vi.fn(),
    mockReadFile: vi.fn(),
    mockRm: vi.fn(),
    mockExtractPdfTextWithOcr: vi.fn()
}));

vi.mock('child_process', () => ({
    execFile: (...args) => mockExecFile(...args)
}));

vi.mock('fs/promises', () => ({
    default: {
        mkdtemp: (...args) => mockMkdtemp(...args),
        writeFile: (...args) => mockWriteFile(...args),
        readFile: (...args) => mockReadFile(...args),
        rm: (...args) => mockRm(...args)
    },
    mkdtemp: (...args) => mockMkdtemp(...args),
    writeFile: (...args) => mockWriteFile(...args),
    readFile: (...args) => mockReadFile(...args),
    rm: (...args) => mockRm(...args)
}));

vi.mock('mammoth', () => ({
    default: {
        extractRawText: vi.fn()
    },
    extractRawText: vi.fn()
}));

vi.mock('../../services/pdfTextExtraction.service.js', () => ({
    extractPdfTextWithOcr: (...args) => mockExtractPdfTextWithOcr(...args)
}));

import * as mammoth from 'mammoth';
import {
    DOCX_MIME_TYPE,
    extractTextFromWordBuffer,
    resetWordTextExtractionCaches
} from '../../services/wordTextExtraction.service.js';

describe('wordTextExtraction.service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        resetWordTextExtractionCaches();
        mockMkdtemp.mockResolvedValue('/tmp/resume-word-ocr-123');
        mockWriteFile.mockResolvedValue(undefined);
        mockReadFile.mockResolvedValue(Buffer.from('fake-pdf-buffer'));
        mockRm.mockResolvedValue(undefined);
    });

    it('returns native DOCX text when mammoth extraction is sufficient', async () => {
        mammoth.extractRawText.mockResolvedValueOnce({
            value: 'Texte DOCX natif suffisamment long pour éviter le fallback OCR.'
        });

        const result = await extractTextFromWordBuffer(Buffer.from('docx'), {
            fileName: 'resume.docx',
            mimeType: DOCX_MIME_TYPE
        });

        expect(result.ocrUsed).toBe(false);
        expect(result.text).toContain('suffisamment long');
        expect(mockExecFile).not.toHaveBeenCalled();
        expect(mockExtractPdfTextWithOcr).not.toHaveBeenCalled();
    });

    it('falls back to PDF OCR when DOCX native extraction is too short', async () => {
        mammoth.extractRawText.mockResolvedValueOnce({ value: 'trop court' });
        mockExecFile
            .mockImplementationOnce((_file, _args, _options, callback) => callback(null, 'LibreOffice 25', ''))
            .mockImplementationOnce((_file, _args, _options, callback) => callback(null, 'converted', ''));
        mockExtractPdfTextWithOcr.mockResolvedValueOnce({
            text: 'Texte OCR Word extrait après conversion PDF.',
            ocrUsed: true,
            ocrPageCount: 1,
            failedOcrPages: 0,
            avgOcrConfidence: 88,
            pages: 1
        });

        const result = await extractTextFromWordBuffer(Buffer.from('docx'), {
            fileName: 'resume.docx',
            mimeType: DOCX_MIME_TYPE
        });

        expect(result.ocrUsed).toBe(true);
        expect(result.text).toContain('Texte OCR Word');
        expect(mockExecFile).toHaveBeenNthCalledWith(
            2,
            'soffice',
            expect.arrayContaining(['--convert-to', 'pdf:writer_pdf_Export']),
            expect.any(Object),
            expect.any(Function)
        );
        expect(mockExtractPdfTextWithOcr).toHaveBeenCalledWith(
            Buffer.from('fake-pdf-buffer'),
            expect.objectContaining({ forceDocumentOcrTextLength: 50 })
        );
    });

    it('returns the short native text when OCR fallback is unavailable', async () => {
        mammoth.extractRawText.mockResolvedValueOnce({ value: 'court' });
        mockExecFile.mockImplementationOnce((_file, _args, _options, callback) => callback(new Error('soffice not found')));

        const result = await extractTextFromWordBuffer(Buffer.from('docx'), {
            fileName: 'resume.docx',
            mimeType: DOCX_MIME_TYPE
        });

        expect(result.ocrUsed).toBe(false);
        expect(result.text).toBe('court');
        expect(mockExtractPdfTextWithOcr).not.toHaveBeenCalled();
    });
});
