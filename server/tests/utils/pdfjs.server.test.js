import { describe, expect, it, vi } from 'vitest';

const getDocumentMock = vi.fn(() => ({ promise: Promise.resolve({ numPages: 0 }) }));
const globalWorkerOptions = {};

vi.mock('pdfjs-dist/legacy/build/pdf.mjs', () => ({
    getDocument: getDocumentMock,
    GlobalWorkerOptions: globalWorkerOptions
}));

describe('pdfjs.server', () => {
    it('passes matching asset URLs for pdfjs-dist document loading', async () => {
        const { loadPdfDocument } = await import('../../utils/pdfjs.server.js');

        const data = new Uint8Array([1, 2, 3]);
        await loadPdfDocument(data);

        expect(getDocumentMock).toHaveBeenCalledTimes(1);
        expect(globalWorkerOptions.workerSrc).toMatch(/^file:\/\//);
        expect(globalWorkerOptions.workerSrc).toContain('/pdf.worker.mjs');

        const options = getDocumentMock.mock.calls[0][0];
        expect(options.data).toBe(data);
        expect(options.standardFontDataUrl).toMatch(/^file:\/\//);
        expect(options.standardFontDataUrl.endsWith('/')).toBe(true);
        expect(options.disableFontFace).toBe(true);
        expect(options.useSystemFonts).toBe(false);
        expect(options.useWorkerFetch).toBe(false);
    });
});
