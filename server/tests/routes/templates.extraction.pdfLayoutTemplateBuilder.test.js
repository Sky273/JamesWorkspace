import { describe, expect, it, vi } from 'vitest';
import * as pdfLayoutBuilder from '../../routes/templates/extraction/pdfLayoutTemplateBuilder.js';

const { buildStructuredPdfTemplateInput, extractStructuredPdfTemplateInput } = pdfLayoutBuilder;

describe('template extraction pdf layout builder', () => {
    it('splits positioned PDF text lines into header, content, footer fragments', () => {
        const result = buildStructuredPdfTemplateInput({
            pageWidth: 600,
            pageHeight: 800,
            items: [
                { str: 'Cabinet Example', transform: [14, 0, 0, 14, 40, 760], width: 120, height: 14, fontName: 'HeaderBold' },
                { str: 'Senior Engineer', transform: [12, 0, 0, 12, 50, 620], width: 120, height: 12, fontName: 'BodyRegular' },
                { str: 'Experience line', transform: [11, 0, 0, 11, 50, 590], width: 130, height: 11, fontName: 'BodyRegular' },
                { str: 'www.example.com', transform: [10, 0, 0, 10, 50, 40], width: 120, height: 10, fontName: 'FooterRegular' }
            ],
            styles: {
                HeaderBold: { fontFamily: 'Cabinet Sans' },
                BodyRegular: { fontFamily: 'Source Sans Pro' },
                FooterRegular: { fontFamily: 'Source Sans Pro' }
            }
        });

        expect(result.headerHtml).toContain('Cabinet Example');
        expect(result.contentHtml).toContain('Senior Engineer');
        expect(result.footerHtml).toContain('www.example.com');
        expect(result.stylesheet).toContain('.template-region-header');
        expect(result.extractedFonts).toContain('Cabinet Sans');
        expect(result.metrics.totalLines).toBe(4);
    });

    it('sanitizes dangerous HTML and stylesheet output', () => {
        const result = buildStructuredPdfTemplateInput({
            pageWidth: 600,
            pageHeight: 800,
            items: [
                { str: '<script>alert(1)</script>', transform: [12, 0, 0, 12, 50, 620], width: 160, height: 12, fontName: 'BodyRegular' }
            ],
            styles: {
                BodyRegular: { fontFamily: 'Source Sans Pro' }
            }
        });

        expect(result.pageHtml).not.toContain('<script>');
        expect(result.stylesheet).not.toContain('@import');
    });

    it('extracts visual blocks and image regions from PDF operator lists when available', () => {
        const result = buildStructuredPdfTemplateInput({
            pageWidth: 600,
            pageHeight: 800,
            items: [
                { str: 'Header', transform: [12, 0, 0, 12, 40, 760], width: 80, height: 12, fontName: 'HeaderBold' },
                { str: 'Body line', transform: [12, 0, 0, 12, 40, 620], width: 90, height: 12, fontName: 'BodyRegular' }
            ],
            styles: {
                HeaderBold: { fontFamily: 'Cabinet Sans' },
                BodyRegular: { fontFamily: 'Source Sans Pro' }
            },
            operatorList: {
                fnArray: [10, 20, 30, 40, 50],
                argsArray: [
                    [0.2, 0.4, 0.6],
                    [[99], [20, 700, 560, 60]],
                    [],
                    [200, 0, 0, 80, 360, 680],
                    ['img_1']
                ]
            },
            pdfOps: {
                setFillRGBColor: 10,
                constructPath: 20,
                fill: 30,
                transform: 40,
                paintImageXObject: 50,
                rectangle: 99
            }
        });

        expect(result.pageHtml).toContain('template-visual-block');
        expect(result.pageHtml).toContain('template-image-slot');
        expect(result.extractedColors).toContain('#336699');
        expect(result.metrics.visualBlockCount).toBe(1);
        expect(result.metrics.imageBlockCount).toBe(1);
        expect(result.visualBlocks[0]).toEqual(expect.objectContaining({
            region: 'content',
            fill: '#336699'
        }));
        expect(result.imageBlocks[0]).toEqual(expect.objectContaining({
            region: 'content'
        }));
    });

    it('derives page background, primary font and text color from extracted layout styles when available', () => {
        const result = buildStructuredPdfTemplateInput({
            pageWidth: 600,
            pageHeight: 800,
            items: [
                {
                    str: 'Cabinet Example',
                    transform: [18, 0, 0, 18, 40, 760],
                    width: 180,
                    height: 18,
                    fontName: 'HeaderBold',
                    color: '#224466'
                },
                {
                    str: 'Senior Engineer',
                    transform: [12, 0, 0, 12, 50, 620],
                    width: 140,
                    height: 12,
                    fontName: 'BodyRegular',
                    color: 'rgb(34, 68, 102)'
                }
            ],
            styles: {
                HeaderBold: { fontFamily: 'Cabinet Sans' },
                BodyRegular: { fontFamily: 'Source Sans Pro' }
            },
            operatorList: {
                fnArray: [10, 20, 30],
                argsArray: [
                    [0.95, 0.96, 0.98],
                    [[99], [0, 0, 600, 800]],
                    []
                ]
            },
            pdfOps: {
                setFillRGBColor: 10,
                constructPath: 20,
                fill: 30,
                rectangle: 99
            }
        });

        expect(result.stylesheet).toContain('background:#f2f5fa;');
        expect(result.stylesheet).toContain('color:#224466;');
        expect(result.stylesheet).toContain('font-family:"Cabinet Sans";');
        expect(result.stylesheet).toContain('color:#224466;white-space:pre-wrap;');
        expect(result.extractedColors).toEqual(expect.arrayContaining(['#f2f5fa', '#224466']));
    });

    it('extends the header region when the top block continues below the default ratio', () => {
        const result = buildStructuredPdfTemplateInput({
            pageWidth: 600,
            pageHeight: 800,
            items: [
                { str: 'Cabinet Example', transform: [14, 0, 0, 14, 40, 690], width: 120, height: 14, fontName: 'HeaderBold' },
                { str: 'Conseil en transformation', transform: [11, 0, 0, 11, 40, 648], width: 180, height: 11, fontName: 'HeaderRegular' },
                { str: 'Senior Engineer', transform: [12, 0, 0, 12, 50, 520], width: 120, height: 12, fontName: 'BodyRegular' },
                { str: 'www.example.com', transform: [10, 0, 0, 10, 50, 40], width: 120, height: 10, fontName: 'FooterRegular' }
            ],
            styles: {
                HeaderBold: { fontFamily: 'Cabinet Sans' },
                HeaderRegular: { fontFamily: 'Cabinet Sans' },
                BodyRegular: { fontFamily: 'Source Sans Pro' },
                FooterRegular: { fontFamily: 'Source Sans Pro' }
            }
        });

        expect(result.headerHtml).toContain('Cabinet Example');
        expect(result.headerHtml).toContain('Conseil en transformation');
        expect(result.contentHtml).toContain('Senior Engineer');
        expect(result.metrics.headerLines).toBe(2);
    });

    it('promotes repeated top and bottom lines into header and footer regions', () => {
        const result = buildStructuredPdfTemplateInput({
            pageWidth: 600,
            pageHeight: 800,
            items: [
                { str: 'CABINET NOVA', transform: [12, 0, 0, 12, 40, 628], width: 120, height: 12, fontName: 'HeaderBold' },
                { str: 'Profil', transform: [12, 0, 0, 12, 40, 540], width: 60, height: 12, fontName: 'BodyRegular' },
                { str: 'Page 1 / 2', transform: [10, 0, 0, 10, 440, 120], width: 70, height: 10, fontName: 'FooterRegular' }
            ],
            styles: {
                HeaderBold: { fontFamily: 'Cabinet Sans' },
                BodyRegular: { fontFamily: 'Source Sans Pro' },
                FooterRegular: { fontFamily: 'Source Sans Pro' }
            },
            repeatedRegionHints: {
                headerTexts: new Set(['cabinet nova']),
                footerTexts: new Set(['page # #'])
            }
        });

        expect(result.headerHtml).toContain('CABINET NOVA');
        expect(result.footerHtml).toContain('Page 1 / 2');
        expect(result.contentHtml).toContain('Profil');
        expect(result.metrics.repeatedHeaderTextCount).toBe(1);
        expect(result.metrics.repeatedFooterTextCount).toBe(1);
    });

    it('selects the densest candidate page among the first pages for layout extraction', async () => {
        const page1 = {
            getViewport: vi.fn().mockReturnValue({ width: 600, height: 800 }),
            getTextContent: vi.fn().mockResolvedValue({
                items: [
                    { str: 'Cover', transform: [12, 0, 0, 12, 40, 760], width: 40, height: 12, fontName: 'CoverFont' }
                ],
                styles: {
                    CoverFont: { fontFamily: 'Cover Sans' }
                }
            }),
            getOperatorList: vi.fn().mockResolvedValue(null)
        };
        const page2 = {
            getViewport: vi.fn().mockReturnValue({ width: 600, height: 800 }),
            getTextContent: vi.fn().mockResolvedValue({
                items: [
                    { str: 'Cabinet Example', transform: [14, 0, 0, 14, 40, 760], width: 120, height: 14, fontName: 'HeaderBold' },
                    { str: 'Senior Engineer', transform: [12, 0, 0, 12, 50, 620], width: 120, height: 12, fontName: 'BodyRegular' },
                    { str: 'Experience line', transform: [11, 0, 0, 11, 50, 590], width: 130, height: 11, fontName: 'BodyRegular' }
                ],
                styles: {
                    HeaderBold: { fontFamily: 'Cabinet Sans' },
                    BodyRegular: { fontFamily: 'Source Sans Pro' }
                }
            }),
            getOperatorList: vi.fn().mockResolvedValue(null)
        };

        const loadPdfDocumentSpy = vi.spyOn(await import('../../utils/pdfjs.server.js'), 'loadPdfDocument').mockResolvedValue({
            promise: Promise.resolve({
                numPages: 2,
                getPage: vi.fn()
                    .mockResolvedValueOnce(page1)
                    .mockResolvedValueOnce(page2)
                    .mockResolvedValueOnce(page1)
                    .mockResolvedValueOnce(page2)
            })
        });

        const result = await extractStructuredPdfTemplateInput(Buffer.from('%PDF-1.7 sample'));

        expect(result.contentHtml).toContain('Senior Engineer');
        expect(result.metrics.sourcePageNumber).toBe(2);
        expect(result.metrics.candidatePages).toEqual(expect.arrayContaining([
            expect.objectContaining({ pageNumber: 1 }),
            expect.objectContaining({ pageNumber: 2, layoutTextCharacters: expect.any(Number) })
        ]));

        loadPdfDocumentSpy.mockRestore();
    });
});
