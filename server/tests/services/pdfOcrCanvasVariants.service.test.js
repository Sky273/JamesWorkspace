import { describe, expect, it } from 'vitest';

import { createOcrVariantBuffers } from '../../services/pdfOcrCanvasVariants.service.js';

class FakeImageData {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.data = new Uint8ClampedArray(width * height * 4);
    }
}

function createCanvasModule() {
    return {
        ImageData: FakeImageData,
        createCanvas(width, height) {
            const context = {
                imageData: new FakeImageData(width, height),
                getImageData(x, y, w, h) {
                    if (x === 0 && y === 0 && w === width && h === height) {
                        return this.imageData;
                    }

                    const cropped = new FakeImageData(w, h);
                    for (let row = 0; row < h; row++) {
                        for (let col = 0; col < w; col++) {
                            const sourceOffset = (((y + row) * width) + x + col) * 4;
                            const targetOffset = ((row * w) + col) * 4;
                            cropped.data[targetOffset] = this.imageData.data[sourceOffset];
                            cropped.data[targetOffset + 1] = this.imageData.data[sourceOffset + 1];
                            cropped.data[targetOffset + 2] = this.imageData.data[sourceOffset + 2];
                            cropped.data[targetOffset + 3] = this.imageData.data[sourceOffset + 3];
                        }
                    }
                    return cropped;
                },
                putImageData(imageData) {
                    this.imageData = imageData;
                }
            };

            return {
                width,
                height,
                getContext() {
                    return context;
                },
                toBuffer() {
                    return Buffer.from(`${width}x${height}`);
                }
            };
        }
    };
}

describe('pdfOcrCanvasVariants.service', () => {
    it('builds the expected OCR variants for a page canvas', () => {
        const canvasModule = createCanvasModule();
        const canvas = canvasModule.createCanvas(2, 1);
        const context = canvas.getContext('2d');
        context.imageData.data.set([
            10, 10, 10, 255,
            240, 240, 240, 255
        ]);

        const variants = createOcrVariantBuffers(
            canvasModule,
            canvas,
            context,
            () => null
        );

        expect(variants.map((variant) => variant.name)).toEqual([
            'cropped-color',
            'cropped-grayscale-autocontrast',
            'cropped-threshold-185',
            'cropped-threshold-205',
            'full-page-color'
        ]);
        expect(variants.every((variant) => Buffer.isBuffer(variant.buffer))).toBe(true);
    });

    it('crops and scales when ink bounds are detected', () => {
        const canvasModule = createCanvasModule();
        const canvas = canvasModule.createCanvas(10, 4);
        const context = canvas.getContext('2d');
        context.imageData.data.fill(255);

        const variants = createOcrVariantBuffers(
            canvasModule,
            canvas,
            context,
            () => ({ minX: 2, minY: 1, maxX: 3, maxY: 2 })
        );

        expect(variants).toHaveLength(5);
        expect(variants[0].buffer.toString()).not.toBe('10x4');
    });
});
