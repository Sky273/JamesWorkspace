import { describe, expect, it } from 'vitest';
import {
    resolvePdfParseFunction,
    detectPdfImageFormat,
    buildPdfImageDescriptor
} from '../../routes/templates/extraction/pdfExtractionHelpers.js';

describe('template extraction pdf helpers', () => {
    it('resolves the callable pdf-parse export variant', () => {
        const fn = () => 'ok';
        expect(resolvePdfParseFunction({ default: fn })).toBe(fn);
        expect(resolvePdfParseFunction(fn)).toBe(fn);
        expect(resolvePdfParseFunction({ pdfParse: fn })).toBe(fn);
        expect(resolvePdfParseFunction({})).toBeNull();
    });

    it('detects supported PDF image formats from the stream signature', () => {
        expect(detectPdfImageFormat(Buffer.from([0xff, 0xd8, 0xff, 0x00]))).toBe('image/jpeg');
        expect(detectPdfImageFormat(Buffer.from([0x89, 0x50, 0x4e, 0x47]))).toBe('image/png');
        expect(detectPdfImageFormat(Buffer.from([0x00, 0x11, 0x22, 0x33]))).toBeNull();
    });

    it('builds the PDF image descriptor only for supported streams', () => {
        expect(buildPdfImageDescriptor({
            index: 1,
            stream: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x01]),
            width: { numberValue: 120 },
            height: { numberValue: 80 }
        })).toEqual({
            name: 'pdf_image_1',
            base64: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x01]).toString('base64'),
            contentType: 'image/png',
            width: 120,
            height: 80
        });

        expect(buildPdfImageDescriptor({
            index: 2,
            stream: Buffer.from([0x00, 0x11, 0x22, 0x33, 0x44]),
            width: { numberValue: 1 },
            height: { numberValue: 1 }
        })).toBeNull();
    });
});
