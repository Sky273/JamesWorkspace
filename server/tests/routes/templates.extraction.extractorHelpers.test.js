import { describe, expect, it } from 'vitest';
import {
    parseDocxStyles,
    resolveDocxImageContentType,
    buildDocxExtractedImage
} from '../../routes/templates/extraction/extractorHelpers.js';

describe('template extraction extractor helpers', () => {
    it('parses DOCX styles with the same filtering rules', () => {
        const result = parseDocxStyles(`
            <w:styles>
                <w:color w:val="FF0000" />
                <w:color w:val="000000" />
                <w:rFonts w:ascii="Custom Font" />
                <w:rFonts w:ascii="Arial" />
            </w:styles>
        `);

        expect(result.colors).toEqual(['#FF0000']);
        expect(result.fonts).toEqual(['Custom Font']);
    });

    it('resolves DOCX theme colors and font declarations from full package context', () => {
        const result = parseDocxStyles({
            stylesXml: `
                <w:styles>
                    <w:style>
                        <w:rPr>
                            <w:color w:themeColor="accent1" />
                            <w:rFonts w:asciiTheme="majorHAnsi" w:hAnsi="Aptos Display" />
                        </w:rPr>
                    </w:style>
                </w:styles>
            `,
            themeXml: `
                <a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
                    <a:themeElements>
                        <a:clrScheme name="Office">
                            <a:accent1><a:srgbClr val="5B9BD5" /></a:accent1>
                            <a:accent2><a:srgbClr val="ED7D31" /></a:accent2>
                        </a:clrScheme>
                        <a:fontScheme name="Office">
                            <a:majorFont>
                                <a:latin typeface="Aptos Display" />
                            </a:majorFont>
                            <a:minorFont>
                                <a:latin typeface="Aptos" />
                            </a:minorFont>
                        </a:fontScheme>
                    </a:themeElements>
                </a:theme>
            `,
            fontTableXml: `
                <w:fonts>
                    <w:font w:name="Montserrat" />
                    <w:font w:name="Calibri" />
                </w:fonts>
            `,
            documentXml: `
                <w:document>
                    <w:body>
                        <w:p>
                            <w:r>
                                <w:rPr>
                                    <w:color w:themeColor="accent2" />
                                    <w:rFonts w:ascii="Merriweather Sans" />
                                </w:rPr>
                            </w:r>
                        </w:p>
                    </w:body>
                </w:document>
            `
        });

        expect(result.colors).toEqual(expect.arrayContaining(['#5B9BD5', '#ED7D31']));
        expect(result.fonts).toEqual(expect.arrayContaining(['Aptos Display', 'Aptos', 'Merriweather Sans']));
    });

    it('resolves DOCX image content types from file extensions', () => {
        expect(resolveDocxImageContentType('word/media/image1.png')).toBe('image/png');
        expect(resolveDocxImageContentType('word/media/image2.jpg')).toBe('image/jpeg');
        expect(resolveDocxImageContentType('word/media/image3.gif')).toBe('image/gif');
        expect(resolveDocxImageContentType('word/media/image4.bin')).toBe('image/png');
    });

    it('builds the extracted image descriptor from a DOCX media path', () => {
        expect(buildDocxExtractedImage('word/media/image1.png', 'ZmFrZQ==')).toEqual({
            name: 'image1.png',
            base64: 'ZmFrZQ==',
            contentType: 'image/png'
        });
    });
});
