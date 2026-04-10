/**
 * Tests for Batch Jobs Worker - Text Extraction
 * Tests extractTextFromBuffer dispatch logic and extractTextFromPDFBuffer
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { safeLog } from '../../utils/logger.backend.js';

vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn()
}));

// Mock pdfjs-dist
vi.mock('pdfjs-dist/legacy/build/pdf.mjs', () => ({
    getDocument: vi.fn()
}));

vi.mock('canvas', () => ({
    ImageData: class MockImageData {
        constructor(width, height) {
            this.width = width;
            this.height = height;
            this.data = new Uint8ClampedArray(width * height * 4).fill(255);
        }
    },
    createCanvas: vi.fn((width = 1000, height = 1400) => ({
        width,
        height,
        getContext: vi.fn(() => ({
            getImageData: vi.fn(() => ({
                data: new Uint8ClampedArray(width * height * 4).fill(255)
            })),
            putImageData: vi.fn(),
            fillRect: vi.fn(),
            drawImage: vi.fn()
        })),
        toBuffer: vi.fn(() => Buffer.from('fake-image'))
    }))
}));

vi.mock('tesseract.js', () => ({
    createWorker: vi.fn(async () => ({
        recognize: vi.fn(async () => ({
            data: {
                text: 'Texte OCR extrait depuis une image de CV avec suffisamment de contenu pour passer la validation.',
                confidence: 92
            }
        })),
        terminate: vi.fn(async () => {})
    }))
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
                            items: [{ str: 'Hello PDF with enough native text content to avoid OCR fallback in batch extraction.', transform: [1, 0, 0, 1, 0, 700] }]
                        })
                    })
                })
            });

            const buf = Buffer.from('fake-pdf');
            const result = await extractTextFromBuffer(buf, 'application/pdf', 'test.pdf');

            expect(result.text).toContain('Hello PDF with enough native text content');
            expect(result.ocrUsed).toBe(false);
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

            expect(result.text).toBe('Hello DOCX');
            expect(result.ocrUsed).toBe(false);
            expect(mammoth.extractRawText).toHaveBeenCalledWith({ buffer: buf });
            expect(safeLog).toHaveBeenCalledWith('info', 'Batch file extraction completed', expect.objectContaining({
                fileName: 'test.docx',
                mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                textLength: 'Hello DOCX'.length,
                ocrUsed: false,
                durationMs: expect.any(Number)
            }));
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
                            { str: 'Page 1 Line 1 with enough extracted text to keep the native layer active', transform: [1, 0, 0, 1, 0, 700] },
                            { str: 'Page 1 Line 2 still contributes significant native PDF text length', transform: [1, 0, 0, 1, 0, 680] }
                        ]))
                        .mockResolvedValueOnce(makePage([
                            { str: 'Page 2 Content remains in native extraction mode as well', transform: [1, 0, 0, 1, 0, 700] }
                        ]))
                })
            });

            const buf = Buffer.from('fake-pdf');
            const result = await extractTextFromPDFBuffer(buf);

            expect(result.text).toContain('Page 1 Line 1 with enough extracted text');
            expect(result.text).toContain('Page 1 Line 2 still contributes significant native PDF text length');
            expect(result.text).toContain('Page 2 Content remains in native extraction mode as well');
            expect(result.ocrUsed).toBe(false);
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
                                { str: 'Same Line with enough text to remain in native extraction mode', transform: [1, 0, 0, 1, 150, 702] },
                                { str: 'New Line carries additional text beyond the OCR fallback threshold', transform: [1, 0, 0, 1, 50, 680] }
                            ]
                        })
                    })
                })
            });

            const buf = Buffer.from('fake-pdf');
            const result = await extractTextFromPDFBuffer(buf);

            expect(result.text).toContain('First Same Line with enough text to remain in native extraction mode');
            expect(result.text).toContain('New Line carries additional text beyond the OCR fallback threshold');
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
                                { str: 'Visible native content with enough text to exceed the OCR fallback threshold safely', transform: [1, 0, 0, 1, 50, 700] },
                                { str: '', transform: [1, 0, 0, 1, 100, 700] }
                            ]
                        })
                    })
                })
            });

            const buf = Buffer.from('fake-pdf');
            const result = await extractTextFromPDFBuffer(buf);

            expect(result.text).toBe('Visible native content with enough text to exceed the OCR fallback threshold safely');
        });

        it('should collapse multiple whitespace', async () => {
            const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');

            pdfjsLib.getDocument.mockReturnValue({
                promise: Promise.resolve({
                    numPages: 1,
                    getPage: vi.fn().mockResolvedValue({
                        getTextContent: vi.fn().mockResolvedValue({
                            items: [
                                { str: 'Hello    World    with    enough    native    content    to    bypass    OCR', transform: [1, 0, 0, 1, 0, 700] }
                            ]
                        })
                    })
                })
            });

            const buf = Buffer.from('fake-pdf');
            const result = await extractTextFromPDFBuffer(buf);

            expect(result.text).toBe('Hello World with enough native content to bypass OCR');
        });

        it('should fallback to OCR for scanned PDFs with no usable text layer', async () => {
            const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');

            pdfjsLib.getDocument.mockReturnValue({
                promise: Promise.resolve({
                    numPages: 1,
                    getPage: vi.fn().mockResolvedValue({
                        getTextContent: vi.fn().mockResolvedValue({
                            items: [{ str: '', transform: [1, 0, 0, 1, 0, 700] }]
                        }),
                        getViewport: vi.fn(() => ({ width: 1000, height: 1400 })),
                        render: vi.fn(() => ({ promise: Promise.resolve() }))
                    })
                })
            });

            const buf = Buffer.from('scanned-pdf');
            const result = await extractTextFromPDFBuffer(buf);

            expect(result.text).toContain('Texte OCR extrait depuis une image de CV');
            expect(result.ocrUsed).toBe(true);
        });

        it('should fallback to full-document OCR when native extraction stays too short', async () => {
            const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');

            pdfjsLib.getDocument.mockReturnValue({
                promise: Promise.resolve({
                    numPages: 1,
                    getPage: vi.fn().mockResolvedValue({
                        getTextContent: vi.fn().mockResolvedValue({
                            items: [
                                { str: 'a', transform: [1, 0, 0, 1, 0, 700] },
                                { str: 'b', transform: [1, 0, 0, 1, 10, 700] },
                                { str: 'c', transform: [1, 0, 0, 1, 20, 700] },
                                { str: 'd', transform: [1, 0, 0, 1, 30, 700] },
                                { str: 'e', transform: [1, 0, 0, 1, 40, 700] },
                                { str: 'f', transform: [1, 0, 0, 1, 50, 700] }
                            ]
                        }),
                        getViewport: vi.fn(() => ({ width: 1000, height: 1400 })),
                        render: vi.fn(() => ({ promise: Promise.resolve() }))
                    })
                })
            });

            const buf = Buffer.from('pseudo-text-pdf');
            const result = await extractTextFromPDFBuffer(buf);

            expect(result.text).toContain('Texte OCR extrait depuis une image de CV');
            expect(result.ocrUsed).toBe(true);
        });

        it('should log a summary with extraction duration', async () => {
            const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');

            pdfjsLib.getDocument.mockReturnValue({
                promise: Promise.resolve({
                    numPages: 1,
                    getPage: vi.fn().mockResolvedValue({
                        getTextContent: vi.fn().mockResolvedValue({
                            items: [
                                { str: 'Visible native content with enough text to exceed the OCR fallback threshold safely', transform: [1, 0, 0, 1, 50, 700] }
                            ]
                        })
                    })
                })
            });

            const buf = Buffer.from('fake-pdf');
            await extractTextFromPDFBuffer(buf);

            expect(safeLog).toHaveBeenCalledWith('info', 'Batch PDF extraction completed', expect.objectContaining({
                textLength: expect.any(Number),
                durationMs: expect.any(Number)
            }));
        });
    });
});
