export function resolvePdfParseFunction(pdfParseModule) {
    if (typeof pdfParseModule?.default === 'function') {
        return pdfParseModule.default;
    }

    if (typeof pdfParseModule === 'function') {
        return pdfParseModule;
    }

    if (typeof pdfParseModule?.pdfParse === 'function') {
        return pdfParseModule.pdfParse;
    }

    return null;
}

export function detectPdfImageFormat(stream) {
    if (!stream || stream.length <= 3) {
        return null;
    }

    const isJpeg = stream[0] === 0xff && stream[1] === 0xd8 && stream[2] === 0xff;
    if (isJpeg) {
        return 'image/jpeg';
    }

    const isPng = stream[0] === 0x89 && stream[1] === 0x50 && stream[2] === 0x4e && stream[3] === 0x47;
    if (isPng) {
        return 'image/png';
    }

    return null;
}

export function buildPdfImageDescriptor({ index, stream, width, height }) {
    const contentType = detectPdfImageFormat(stream);
    if (!contentType) {
        return null;
    }

    return {
        name: `pdf_image_${index}`,
        base64: Buffer.from(stream).toString('base64'),
        contentType,
        width: width.numberValue || 0,
        height: height.numberValue || 0
    };
}
