import { describe, expect, it } from 'vitest';
import { buildStructuredPdfTemplateInput } from '../../routes/templates/extraction/pdfLayoutTemplateBuilder.js';

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
});
