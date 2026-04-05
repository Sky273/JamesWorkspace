const DEFAULT_IMAGE_CONTENT_TYPE = 'image/png';
const EXCLUDED_DOCX_COLORS = new Set(['000000', 'FFFFFF', 'AUTO']);
const STANDARD_DOCX_FONTS = new Set(['Times New Roman', 'Arial', 'Calibri']);

export function parseDocxStyles(stylesXml) {
    const colors = new Set();
    const fonts = new Set();

    const colorRegex = /w:(?:val|color)="([0-9A-Fa-f]{6})"/g;
    let match;
    while ((match = colorRegex.exec(stylesXml)) !== null) {
        const color = match[1].toUpperCase();
        if (!EXCLUDED_DOCX_COLORS.has(color)) {
            colors.add(`#${color}`);
        }
    }

    const fontRegex = /w:(?:ascii|hAnsi|cs)="([^"]+)"/g;
    while ((match = fontRegex.exec(stylesXml)) !== null) {
        const font = match[1];
        if (!STANDARD_DOCX_FONTS.has(font)) {
            fonts.add(font);
        }
    }

    return {
        colors: Array.from(colors).slice(0, 10),
        fonts: Array.from(fonts).slice(0, 5)
    };
}

export function resolveDocxImageContentType(mediaPath) {
    const ext = mediaPath.split('.').pop().toLowerCase();
    return ext === 'png'
        ? 'image/png'
        : ext === 'jpg' || ext === 'jpeg'
            ? 'image/jpeg'
            : ext === 'gif'
                ? 'image/gif'
                : DEFAULT_IMAGE_CONTENT_TYPE;
}

export function buildDocxExtractedImage(mediaPath, imageData) {
    return {
        name: mediaPath.split('/').pop(),
        base64: imageData,
        contentType: resolveDocxImageContentType(mediaPath)
    };
}
