/**
 * Tests for Batch Jobs Worker - Text Extraction
 * Tests extractTextFromBuffer dispatch logic and extractTextFromPDFBuffer
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn()
}));

// Mock pdfjs-dist
vi.mock('pdfjs-dist/legacy/build/pdf.mjs', () => ({
    getDocument: vi.fn()
}));

// Mock mammoth
vi.mock('mammoth', () => ({
    extractRawText: vi.fn()
}));

import { extractTextFromBuffer, extractTextFromPDFBuffer } from '../../services/batchJobsWorker/textExtraction.js';

describe('Batch Jobs Worker - Text Extraction', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('extractTextFromBuffer', () => {
        it('should call PDF extractor for PDF mime type', async () => {
            const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
            pdfjsLib.getDocument.mockReturnValue({
                promise: Promise.resolve({
                    numPages: 1,
                    getPage: vi.fn().mockResolvedValue({
                        getTextContent: vi.fn().mockResolvedValue({
                            items: [{ str: 'Hello PDF', transform: [1, 0, 0, 1, 0, 700] }]
                        })
                    })
                })
            });

            const buf = Buffer.from('fake-pdf');
            const result = await extractTextFromBuffer(buf, 'application/pdf', 'test.pdf');

            expect(result).toContain('Hello PDF');
        });

        it('should call mammoth for DOCX mime type', async () => {
            const mammoth = await import('mammoth');
            mammoth.extractRawText.mockResolvedValueOnce({ value: 'Hello DOCX' });

            const buf = Buffer.from('fake-docx');
            const result = await extractTextFromBuffer(
                buf,
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'test.docx'
            );

            expect(result).toBe('Hello DOCX');
            expect(mammoth.extractRawText).toHaveBeenCalledWith({ buffer: buf });
        });

        it('should throw for unsupported mime type', async () => {
            const buf = Buffer.from('data');
            await expect(extractTextFromBuffer(buf, 'text/plain', 'test.txt'))
                .rejects.toThrow('Unsupported file type');
        });

        it('should throw with details when PDF extraction fails', async () => {
            const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
            pdfjsLib.getDocument.mockReturnValue({
                promise: Promise.reject(new Error('Corrupt PDF'))
            });

            const buf = Buffer.from('bad-pdf');
            await expect(extractTextFromBuffer(buf, 'application/pdf', 'bad.pdf'))
                .rejects.toThrow('Failed to extract text from PDF');
        });
    });

    describe('extractTextFromPDFBuffer', () => {
        it('should extract and join text from multiple pages', async () => {
            const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');

            const makePage = (items) => ({
                getTextContent: vi.fn().mockResolvedValue({ items })
            });

            pdfjsLib.getDocument.mockReturnValue({
                promise: Promise.resolve({
                    numPages: 2,
                    getPage: vi.fn()
                        .mockResolvedValueOnce(makePage([
                            { str: 'Page 1 Line 1', transform: [1, 0, 0, 1, 0, 700] },
                            { str: 'Page 1 Line 2', transform: [1, 0, 0, 1, 0, 680] }
                        ]))
                        .mockResolvedValueOnce(makePage([
                            { str: 'Page 2 Content', transform: [1, 0, 0, 1, 0, 700] }
                        ]))
                })
            });

            const buf = Buffer.from('fake-pdf');
            const result = await extractTextFromPDFBuffer(buf);

            expect(result).toContain('Page 1 Line 1');
            expect(result).toContain('Page 1 Line 2');
            expect(result).toContain('Page 2 Content');
        });

        it('should group items on same Y coordinate into one line', async () => {
            const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');

            pdfjsLib.getDocument.mockReturnValue({
                promise: Promise.resolve({
                    numPages: 1,
                    getPage: vi.fn().mockResolvedValue({
                        getTextContent: vi.fn().mockResolvedValue({
                            items: [
                                { str: 'First', transform: [1, 0, 0, 1, 50, 700] },
                                { str: 'Same Line', transform: [1, 0, 0, 1, 150, 702] }, // within Y_THRESHOLD=5
                                { str: 'New Line', transform: [1, 0, 0, 1, 50, 680] }   // different Y
                            ]
                        })
                    })
                })
            });

            const buf = Buffer.from('fake-pdf');
            const result = await extractTextFromPDFBuffer(buf);

            expect(result).toContain('First Same Line');
            expect(result).toContain('New Line');
        });

        it('should skip empty text items', async () => {
            const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');

            pdfjsLib.getDocument.mockReturnValue({
                promise: Promise.resolve({
                    numPages: 1,
                    getPage: vi.fn().mockResolvedValue({
                        getTextContent: vi.fn().mockResolvedValue({
                            items: [
                                { str: '  ', transform: [1, 0, 0, 1, 0, 700] },
                                { str: 'Visible', transform: [1, 0, 0, 1, 50, 700] },
                                { str: '', transform: [1, 0, 0, 1, 100, 700] }
                            ]
                        })
                    })
                })
            });

            const buf = Buffer.from('fake-pdf');
            const result = await extractTextFromPDFBuffer(buf);

            expect(result).toBe('Visible');
        });

        it('should collapse multiple whitespace', async () => {
            const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');

            pdfjsLib.getDocument.mockReturnValue({
                promise: Promise.resolve({
                    numPages: 1,
                    getPage: vi.fn().mockResolvedValue({
                        getTextContent: vi.fn().mockResolvedValue({
                            items: [
                                { str: 'Hello    World', transform: [1, 0, 0, 1, 0, 700] }
                            ]
                        })
                    })
                })
            });

            const buf = Buffer.from('fake-pdf');
            const result = await extractTextFromPDFBuffer(buf);

            expect(result).toBe('Hello World');
        });
    });
});
