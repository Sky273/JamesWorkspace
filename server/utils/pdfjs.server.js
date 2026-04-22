import path from 'path';
import { pathToFileURL } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

let cachedStandardFontDataUrl = null;
let cachedWorkerSrc = null;

function getStandardFontDataUrl() {
    if (cachedStandardFontDataUrl) {
        return cachedStandardFontDataUrl;
    }

    const pdfjsPackagePath = require.resolve('pdfjs-dist/package.json');
    const pdfjsRoot = path.dirname(pdfjsPackagePath);
    const standardFontsPath = path.join(pdfjsRoot, 'standard_fonts');

    cachedStandardFontDataUrl = pathToFileURL(`${standardFontsPath}${path.sep}`).href;
    return cachedStandardFontDataUrl;
}

function getWorkerSrc() {
    if (cachedWorkerSrc) {
        return cachedWorkerSrc;
    }

    const workerPath = require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs');
    cachedWorkerSrc = pathToFileURL(workerPath).href;
    return cachedWorkerSrc;
}

export async function loadPdfDocument(data) {
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    if (pdfjsLib.GlobalWorkerOptions) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = getWorkerSrc();
    }

    return pdfjsLib.getDocument({
        data,
        standardFontDataUrl: getStandardFontDataUrl(),
        disableFontFace: true,
        useSystemFonts: false,
        useWorkerFetch: false
    });
}
