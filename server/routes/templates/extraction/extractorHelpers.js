const DEFAULT_IMAGE_CONTENT_TYPE = 'image/png';
const EXCLUDED_DOCX_COLORS = new Set(['000000', 'FFFFFF', 'AUTO']);
const STANDARD_DOCX_FONTS = new Set(['Times New Roman', 'Arial', 'Calibri']);

function normalizeDocxHexColor(value) {
    const normalized = String(value || '').replace(/^#/, '').trim().toUpperCase();
    return /^[0-9A-F]{6}$/.test(normalized) ? normalized : null;
}

function resolveDocxThemeColors(themeXml = '') {
    const themeColors = new Map();
    const colorDefinitionRegex = /<a:([a-z0-9]+)[^>]*>\s*<a:(?:srgbClr|sysClr)[^>]*(?:lastClr|val)="([0-9A-Fa-f]{6})"[^>]*\/>\s*<\/a:\1>/gi;
    let match;

    while ((match = colorDefinitionRegex.exec(String(themeXml || ''))) !== null) {
        const [, token = '', colorValue = ''] = match;
        const normalizedColor = normalizeDocxHexColor(colorValue);
        if (!normalizedColor) {
            continue;
        }
        themeColors.set(token.toLowerCase(), `#${normalizedColor}`);
    }

    return themeColors;
}

function collectDocxColors(xml = '', colorSet, themeColors = new Map()) {
    const explicitColorRegex = /w:(?:val|color|fill)="([0-9A-Fa-f]{6})"/g;
    let match;

    while ((match = explicitColorRegex.exec(String(xml || ''))) !== null) {
        const normalizedColor = normalizeDocxHexColor(match[1]);
        if (normalizedColor && !EXCLUDED_DOCX_COLORS.has(normalizedColor)) {
            colorSet.add(`#${normalizedColor}`);
        }
    }

    const themeRefRegex = /w:(?:themeColor|themeFill)="([a-zA-Z0-9]+)"/g;
    while ((match = themeRefRegex.exec(String(xml || ''))) !== null) {
        const resolvedColor = themeColors.get(String(match[1] || '').toLowerCase());
        if (resolvedColor) {
            colorSet.add(resolvedColor);
        }
    }
}

function collectDocxFonts(xml = '', fontSet) {
    const fontRegex = /w:(?:ascii|hAnsi|cs|eastAsia|name)="([^"]+)"/g;
    let match;

    while ((match = fontRegex.exec(String(xml || ''))) !== null) {
        const font = String(match[1] || '').trim();
        if (font && !STANDARD_DOCX_FONTS.has(font)) {
            fontSet.add(font);
        }
    }
}

function collectThemeFonts(themeXml = '', fontSet) {
    const themeFontRegex = /<a:(?:latin|ea|cs|font)[^>]*(?:typeface|script)="([^"]+)"/gi;
    let match;

    while ((match = themeFontRegex.exec(String(themeXml || ''))) !== null) {
        const font = String(match[1] || '').trim();
        if (font && !STANDARD_DOCX_FONTS.has(font) && font !== '+mj-lt' && font !== '+mn-lt') {
            fontSet.add(font);
        }
    }
}

export function parseDocxStyles(input) {
    const context = typeof input === 'string'
        ? { stylesXml: input }
        : (input || {});
    const {
        stylesXml = '',
        themeXml = '',
        fontTableXml = '',
        documentXml = ''
    } = context;
    const colors = new Set();
    const fonts = new Set();
    const themeColors = resolveDocxThemeColors(themeXml);

    collectDocxColors(stylesXml, colors, themeColors);
    collectDocxColors(documentXml, colors, themeColors);
    collectDocxFonts(stylesXml, fonts);
    collectDocxFonts(fontTableXml, fonts);
    collectDocxFonts(documentXml, fonts);
    collectThemeFonts(themeXml, fonts);

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
