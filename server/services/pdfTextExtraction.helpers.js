export const DEFAULT_Y_THRESHOLD = 5;
export const DEFAULT_OCR_VARIANT_THRESHOLD = 185;

export function extractStructuredPageText(textItems, yThreshold = DEFAULT_Y_THRESHOLD) {
    const lines = [];
    let currentLine = [];
    let lastY = null;

    for (const item of textItems) {
        const y = item.transform ? item.transform[5] : 0;

        if (lastY !== null && Math.abs(y - lastY) > yThreshold) {
            if (currentLine.length > 0) {
                lines.push(currentLine);
                currentLine = [];
            }
        }

        if (item.str && item.str.trim()) {
            currentLine.push(item.str);
        }

        lastY = y;
    }

    if (currentLine.length > 0) {
        lines.push(currentLine);
    }

    return lines.map((line) => line.join(' ')).join('\n');
}

export function normalizeExtractedText(text) {
    return text
        .replace(/[ \t]+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

export function scaleImageData(imageData, scaleFactor) {
    if (scaleFactor <= 1) {
        return imageData;
    }

    const scaledWidth = Math.max(1, Math.round(imageData.width * scaleFactor));
    const scaledHeight = Math.max(1, Math.round(imageData.height * scaleFactor));
    const scaled = new imageData.constructor(scaledWidth, scaledHeight);

    for (let y = 0; y < scaledHeight; y++) {
        const sourceY = Math.min(imageData.height - 1, Math.floor(y / scaleFactor));
        for (let x = 0; x < scaledWidth; x++) {
            const sourceX = Math.min(imageData.width - 1, Math.floor(x / scaleFactor));
            const sourceOffset = (sourceY * imageData.width + sourceX) * 4;
            const targetOffset = (y * scaledWidth + x) * 4;
            scaled.data[targetOffset] = imageData.data[sourceOffset];
            scaled.data[targetOffset + 1] = imageData.data[sourceOffset + 1];
            scaled.data[targetOffset + 2] = imageData.data[sourceOffset + 2];
            scaled.data[targetOffset + 3] = imageData.data[sourceOffset + 3];
        }
    }

    return scaled;
}

export function createAutocontrastImageData(imageData) {
    const stretched = new imageData.constructor(imageData.width, imageData.height);
    let min = 255;
    let max = 0;

    for (let i = 0; i < imageData.data.length; i += 4) {
        const value = imageData.data[i];
        if (imageData.data[i + 3] === 0) {
            continue;
        }
        if (value < min) min = value;
        if (value > max) max = value;
    }

    if (max <= min) {
        return imageData;
    }

    const scale = 255 / (max - min);

    for (let i = 0; i < imageData.data.length; i += 4) {
        const alpha = imageData.data[i + 3];
        const value = imageData.data[i];
        const normalized = alpha === 0 ? 255 : Math.max(0, Math.min(255, Math.round((value - min) * scale)));
        stretched.data[i] = normalized;
        stretched.data[i + 1] = normalized;
        stretched.data[i + 2] = normalized;
        stretched.data[i + 3] = alpha;
    }

    return stretched;
}

export function createThresholdImageData(imageData, threshold = DEFAULT_OCR_VARIANT_THRESHOLD) {
    const thresholded = new imageData.constructor(imageData.width, imageData.height);

    for (let i = 0; i < imageData.data.length; i += 4) {
        const alpha = imageData.data[i + 3];
        const value = imageData.data[i];
        const bw = alpha === 0 ? 255 : (value < threshold ? 0 : 255);
        thresholded.data[i] = bw;
        thresholded.data[i + 1] = bw;
        thresholded.data[i + 2] = bw;
        thresholded.data[i + 3] = alpha;
    }

    return thresholded;
}
