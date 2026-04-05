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
