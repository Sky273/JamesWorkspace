import { describe, expect, it } from 'vitest';

import {
    createAutocontrastImageData,
    createThresholdImageData,
    extractStructuredPageText,
    normalizeExtractedText,
    scaleImageData
} from '../../services/pdfTextExtraction.helpers.js';

class FakeImageData {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.data = new Uint8ClampedArray(width * height * 4);
    }
}

function createImageData(width, height, pixels) {
    const imageData = new FakeImageData(width, height);
    imageData.data.set(pixels);
    return imageData;
}

describe('pdfTextExtraction.helpers', () => {
    it('extracts structured page text by line groups', () => {
        const text = extractStructuredPageText([
            { str: 'Hello', transform: [0, 0, 0, 0, 0, 100] },
            { str: 'world', transform: [0, 0, 0, 0, 0, 100] },
            { str: 'Next', transform: [0, 0, 0, 0, 0, 80] }
        ], 5);

        expect(text).toBe('Hello world\nNext');
    });

    it('normalizes extracted text spacing', () => {
        expect(normalizeExtractedText('Hello   world\n\n\nNext\t\tline  '))
            .toBe('Hello world\n\nNext line');
    });

    it('scales image data with nearest-neighbor duplication', () => {
        const imageData = createImageData(1, 1, [10, 20, 30, 255]);
        const scaled = scaleImageData(imageData, 2);

        expect(scaled.width).toBe(2);
        expect(scaled.height).toBe(2);
        expect(Array.from(scaled.data.slice(0, 8))).toEqual([10, 20, 30, 255, 10, 20, 30, 255]);
    });

    it('creates autocontrast grayscale image data', () => {
        const imageData = createImageData(2, 1, [
            50, 50, 50, 255,
            150, 150, 150, 255
        ]);

        const stretched = createAutocontrastImageData(imageData);

        expect(stretched.data[0]).toBe(0);
        expect(stretched.data[4]).toBe(255);
    });

    it('creates thresholded image data', () => {
        const imageData = createImageData(2, 1, [
            100, 100, 100, 255,
            220, 220, 220, 255
        ]);

        const thresholded = createThresholdImageData(imageData, 185);

        expect(thresholded.data[0]).toBe(0);
        expect(thresholded.data[4]).toBe(255);
    });
});
