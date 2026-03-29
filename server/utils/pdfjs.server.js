import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

let cachedStandardFontDataUrl = null;

function getStandardFontDataUrl() {
    if (cachedStandardFontDataUrl) {
        return cachedStandardFontDataUrl;
    }

    const pdfjsPackagePath = require.resolve('pdfjs-dist/package.json');
    const pdfjsRoot = path.dirname(pdfjsPackagePath);
    const standardFontsPath = path.join(pdfjsRoot, 'standard_fonts');

    cachedStandardFontDataUrl = `${standardFontsPath}${path.sep}`;
    return cachedStandardFontDataUrl;
}

export async function loadPdfDocument(data) {
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');

    return pdfjsLib.getDocument({
        data,
        standardFontDataUrl: getStandardFontDataUrl(),
        disableFontFace: true,
        useSystemFonts: false,
        useWorkerFetch: false
    });
}
