/**
 * Tests for template extraction helpers
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockExtractTemplateFromHTML = vi.fn();
const mockExtractTemplateFromImage = vi.fn();
const mockExtractTemplateFromCV = vi.fn();
const mockExtractTextFromPDFBuffer = vi.fn();
const mockConvertWordBufferToPdfBuffer = vi.fn();
const mockExtractStructuredPdfTemplateInput = vi.fn();
const mockReadFile = vi.fn(async (filePath) => {
    const normalized = String(filePath);
    if (normalized.includes('pdf.min.mjs')) {
        return 'pdfjs-module-source';
    }
    if (normalized.includes('pdf.worker.min.mjs')) {
        return 'pdfjs-worker-source';
    }
    return '';
});
const mockPdfParse = vi.fn();
const mockPdfDocumentLoad = vi.fn();
const mockPuppeteerLaunch = vi.fn();

vi.mock('fs/promises', () => ({
    default: {
        readFile: (...args) => mockReadFile(...args)
    },
    readFile: (...args) => mockReadFile(...args)
}));

vi.mock('../../services/templateExtraction.service.js', () => ({
    extractTemplateFromHTML: (...args) => mockExtractTemplateFromHTML(...args),
    extractTemplateFromImage: (...args) => mockExtractTemplateFromImage(...args),
    extractTemplateFromCV: (...args) => mockExtractTemplateFromCV(...args)
}));

vi.mock('../../services/batchJobsWorker/textExtraction.js', () => ({
    extractTextFromPDFBuffer: (...args) => mockExtractTextFromPDFBuffer(...args)
}));

vi.mock('../../services/wordTextExtraction.service.js', () => ({
    convertWordBufferToPdfBuffer: (...args) => mockConvertWordBufferToPdfBuffer(...args)
}));

vi.mock('../../routes/templates/extraction/pdfLayoutTemplateBuilder.js', () => ({
    extractStructuredPdfTemplateInput: (...args) => mockExtractStructuredPdfTemplateInput(...args)
}));

vi.mock('puppeteer', () => ({
    default: {
        launch: (...args) => mockPuppeteerLaunch(...args)
    }
}));

vi.mock('pdf-parse', () => ({
    default: (...args) => mockPdfParse(...args)
}));

vi.mock('pdf-lib', () => ({
    PDFDocument: {
        load: (...args) => mockPdfDocumentLoad(...args)
    }
}));

vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn()
}));

import { extractFromDOCX, extractFromPDF } from '../../routes/templates/extraction/extractors.js';

describe('template extraction extractors', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        mockPdfParse.mockResolvedValue({
            text: 'PDF text content for extraction'
        });

        mockPdfDocumentLoad.mockResolvedValue({
            context: {
                indirectObjects: [],
                obj: (value) => value
            }
        });

        mockExtractStructuredPdfTemplateInput.mockResolvedValue({
            pageHtml: '<div class="template-page"><main>Layout</main></div>',
            headerHtml: '<div>Header</div>',
            contentHtml: '<div>Content</div>',
            footerHtml: '<div>Footer</div>',
            stylesheet: '.template-page{width:600px;}',
            extractedFonts: ['Source Sans Pro'],
            extractedColors: ['#336699'],
            visualBlocks: [{ type: 'fill-rect', left: 20, top: 20, width: 100, height: 40, region: 'header', fill: '#336699' }],
            imageBlocks: [{ left: 320, top: 24, width: 80, height: 80, region: 'header' }],
            metrics: {
                totalTextCharacters: 180,
                totalLines: 10,
                visualBlockCount: 1,
                imageBlockCount: 1
            }
        });

        mockExtractTemplateFromHTML.mockResolvedValue({
            template: { name: 'Extracted template' },
            model: 'mock-model',
            usage: { total_tokens: 1 }
        });

        mockExtractTemplateFromImage.mockResolvedValue({
            template: { name: 'Vision template' },
            model: 'vision-model',
            usage: { total_tokens: 1 }
        });

        mockExtractTemplateFromCV.mockResolvedValue({
            template: { name: 'Fallback template' },
            model: 'legacy-model',
            usage: { total_tokens: 1 }
        });

        mockConvertWordBufferToPdfBuffer.mockResolvedValue(Buffer.from('%PDF-1.7 converted'));

        const page = {
            setViewport: vi.fn().mockResolvedValue(undefined),
            setContent: vi.fn().mockResolvedValue(undefined),
            waitForFunction: vi.fn().mockResolvedValue(undefined),
            $: vi.fn().mockResolvedValue({
                screenshot: vi.fn().mockResolvedValue(Buffer.from('png'))
            })
        };

        mockPuppeteerLaunch.mockResolvedValue({
            newPage: vi.fn().mockResolvedValue(page),
            close: vi.fn().mockResolvedValue(undefined)
        });
    });

    it('builds templates from structured PDF layout before using any vision fallback', async () => {
        const result = await extractFromPDF(Buffer.from('%PDF-1.7 sample'), 'sample.pdf');

        expect(result.extractionMethod).toBe('pdf-layout-html');
        expect(result.template.extractionConfidence).toEqual(expect.objectContaining({
            level: expect.any(String),
            score: expect.any(Number)
        }));
        expect(result.template.extractionReview).toEqual(expect.objectContaining({
            extractionMethod: 'pdf-layout-html',
            headerHtml: '<div>Header</div>',
            visualBlocks: expect.arrayContaining([
                expect.objectContaining({ fill: '#336699' })
            ]),
            imageRegions: expect.arrayContaining([
                expect.objectContaining({ region: 'header' })
            ])
        }));
        expect(result.template.extractedColors).toEqual(['#336699']);
        expect(mockExtractStructuredPdfTemplateInput).toHaveBeenCalledWith(expect.any(Buffer));
        expect(mockExtractTemplateFromHTML).toHaveBeenCalledWith(
            '<div class="template-page"><main>Layout</main></div>',
            [],
            'sample.pdf',
            expect.objectContaining({
                colors: ['#336699'],
                fonts: ['Source Sans Pro']
            }),
            expect.objectContaining({
                layoutAnalysis: expect.objectContaining({
                    headerHtml: '<div>Header</div>',
                    footerHtml: '<div>Footer</div>'
                })
            })
        );
        expect(mockExtractTemplateFromImage).not.toHaveBeenCalled();
    });

    it('converts office documents to PDF before layout extraction', async () => {
        const result = await extractFromDOCX(Buffer.from('docx'), 'template.docx');

        expect(result.extractionMethod).toBe('office-pdf-layout-html');
        expect(result.template.extractionReview).toEqual(expect.objectContaining({
            extractionMethod: 'office-pdf-layout-html'
        }));
        expect(mockConvertWordBufferToPdfBuffer).toHaveBeenCalledWith(
            expect.any(Buffer),
            expect.objectContaining({
                fileName: 'template.docx',
                mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            })
        );
        expect(mockExtractStructuredPdfTemplateInput).toHaveBeenCalledWith(Buffer.from('%PDF-1.7 converted'));
    });

    it('falls back to vision when structured PDF layout is too sparse', async () => {
        mockExtractStructuredPdfTemplateInput.mockResolvedValueOnce({
            pageHtml: '<div class="template-page"></div>',
            headerHtml: '',
            contentHtml: '',
            footerHtml: '',
            stylesheet: '',
            extractedFonts: [],
            metrics: {
                totalTextCharacters: 12,
                totalLines: 1
            }
        });

        const result = await extractFromPDF(Buffer.from('%PDF-1.7 sample'), 'sample.pdf');

        expect(result.extractionMethod).toBe('pdf-vision-fallback');
        expect(result.template.extractionConfidence).toEqual(expect.objectContaining({
            level: 'medium'
        }));
        expect(mockExtractTemplateFromImage).toHaveBeenCalledTimes(1);
    });
});
