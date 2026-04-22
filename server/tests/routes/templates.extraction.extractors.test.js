/**
 * Tests for template extraction helpers
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockExtractTemplateFromHTML = vi.fn();
const mockExtractTextFromPDFBuffer = vi.fn();
const mockConvertWordBufferToPdfBuffer = vi.fn();
const mockExtractStructuredPdfTemplateInput = vi.fn();
const mockPdfParse = vi.fn();
const mockPdfDocumentLoad = vi.fn();
const mockCreateCanvas = vi.fn();
const mockCanvasToBuffer = vi.fn();
const mockPdfJsGetDocument = vi.fn();
const mockPdfJsRender = vi.fn();
const mockPdfJsGetPage = vi.fn();
const mockPdfJsDocumentDestroy = vi.fn();

vi.mock('canvas', () => ({
    createCanvas: (...args) => mockCreateCanvas(...args)
}));

vi.mock('../../services/templateExtraction.service.js', () => ({
    extractTemplateFromHTML: (...args) => mockExtractTemplateFromHTML(...args),
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

vi.mock('pdfjs-dist/legacy/build/pdf.mjs', () => ({
    getDocument: (...args) => mockPdfJsGetDocument(...args),
    GlobalWorkerOptions: {}
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
            text: 'PDF text content for extraction with enough global characters to exceed the threshold easily'
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
                imageBlockCount: 1,
                sourcePageNumber: 1,
                candidatePages: [
                    { pageNumber: 1, rawItemCount: 10, rawTextCharacters: 180, totalLines: 10, layoutTextCharacters: 180 }
                ]
            }
        });

        mockExtractTemplateFromHTML.mockResolvedValue({
            template: { name: 'Extracted template' },
            model: 'mock-model',
            usage: { total_tokens: 1 }
        });

        mockConvertWordBufferToPdfBuffer.mockResolvedValue(Buffer.from('%PDF-1.7 converted'));

        mockCanvasToBuffer.mockReturnValue(Buffer.from('png'));
        mockCreateCanvas.mockReturnValue({
            getContext: vi.fn().mockReturnValue({}),
            toBuffer: mockCanvasToBuffer
        });
        mockPdfJsRender.mockResolvedValue(undefined);
        mockPdfJsGetPage.mockResolvedValue({
            getViewport: vi.fn().mockReturnValue({ width: 400, height: 600 }),
            render: vi.fn().mockReturnValue({ promise: mockPdfJsRender })
        });
        mockPdfJsDocumentDestroy.mockResolvedValue(undefined);
        mockPdfJsGetDocument.mockReturnValue({
            promise: Promise.resolve({
                getPage: mockPdfJsGetPage,
                destroy: mockPdfJsDocumentDestroy
            })
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

    it('fails with a clear extraction error when structured PDF layout is too sparse', async () => {
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

        await expect(extractFromPDF(Buffer.from('%PDF-1.7 sample'), 'sample.pdf'))
            .rejects.toMatchObject({
                code: 'TEMPLATE_LAYOUT_TOO_SPARSE',
                statusCode: 422,
                details: expect.objectContaining({
                    detectedTextCharacters: 12,
                    extractedPdfTextLength: expect.any(Number),
                    minimumTextCharacters: 80,
                    sourcePageNumber: 1,
                    layoutMetrics: expect.objectContaining({
                        totalTextCharacters: 12
                    })
                })
            });
    });
});
