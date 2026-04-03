import { describe, expect, it, vi } from 'vitest';

const getDocumentMock = vi.fn(() => ({ promise: Promise.resolve({ numPages: 0 }) }));

vi.mock('pdfjs-dist/legacy/build/pdf.mjs', () => ({
    getDocument: getDocumentMock
}));

describe('pdfjs.server', () => {
    it('passes a file URL for standard fonts to pdfjs-dist', async () => {
        const { loadPdfDocument } = await import('../../utils/pdfjs.server.js');

        const data = new Uint8Array([1, 2, 3]);
        await loadPdfDocument(data);

        expect(getDocumentMock).toHaveBeenCalledTimes(1);

        const options = getDocumentMock.mock.calls[0][0];
        expect(options.data).toBe(data);
        expect(options.standardFontDataUrl).toMatch(/^file:\/\//);
        expect(options.standardFontDataUrl.endsWith('/')).toBe(true);
        expect(options.disableFontFace).toBe(true);
        expect(options.useSystemFonts).toBe(false);
        expect(options.useWorkerFetch).toBe(false);
    });
});
