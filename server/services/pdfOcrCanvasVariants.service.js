import {
    createAutocontrastImageData,
    createThresholdImageData,
    scaleImageData
} from './pdfTextExtraction.helpers.js';

const DEFAULT_OCR_BOUNDING_PADDING = 24;
const DEFAULT_OCR_MIN_CROP_WIDTH = 1800;

function getContextImageData(context, width, height) {
    return context.getImageData(0, 0, width, height);
}

function buildCanvasFromImageData(canvasModule, imageData, width, height) {
    const { createCanvas } = canvasModule;
    const canvas = createCanvas(width, height);
    const context = canvas.getContext('2d');
    context.putImageData(imageData, 0, 0);
    return canvas.toBuffer('image/png');
}

function cropImageData(canvasModule, context, x, y, width, height) {
    const { ImageData } = canvasModule;
    const source = context.getImageData(x, y, width, height);
    const cropped = new ImageData(width, height);
    cropped.data.set(source.data);
    return cropped;
}

function createGrayscaleImageData(canvasModule, context, width, height) {
    const { ImageData } = canvasModule;
    const source = getContextImageData(context, width, height);
    const target = new ImageData(width, height);

    for (let i = 0; i < source.data.length; i += 4) {
        const r = source.data[i];
        const g = source.data[i + 1];
        const b = source.data[i + 2];
        const alpha = source.data[i + 3];
        const luminance = Math.round((0.299 * r) + (0.587 * g) + (0.114 * b));
        target.data[i] = luminance;
        target.data[i + 1] = luminance;
        target.data[i + 2] = luminance;
        target.data[i + 3] = alpha;
    }

    return target;
}

function createOcrReadyCanvas(canvasModule, canvas, context, locateInkBoundingBox) {
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const inkBox = locateInkBoundingBox(imageData, canvas.width, canvas.height);

    if (!inkBox) {
        return canvas;
    }

    const cropX = Math.max(0, inkBox.minX - DEFAULT_OCR_BOUNDING_PADDING);
    const cropY = Math.max(0, inkBox.minY - DEFAULT_OCR_BOUNDING_PADDING);
    const cropWidth = Math.min(
        canvas.width - cropX,
        (inkBox.maxX - inkBox.minX + 1) + (DEFAULT_OCR_BOUNDING_PADDING * 2)
    );
    const cropHeight = Math.min(
        canvas.height - cropY,
        (inkBox.maxY - inkBox.minY + 1) + (DEFAULT_OCR_BOUNDING_PADDING * 2)
    );

    const scaleFactor = cropWidth < DEFAULT_OCR_MIN_CROP_WIDTH
        ? DEFAULT_OCR_MIN_CROP_WIDTH / cropWidth
        : 1;

    const croppedImageData = cropImageData(canvasModule, context, cropX, cropY, cropWidth, cropHeight);
    const scaledImageData = scaleImageData(croppedImageData, scaleFactor);
    const { createCanvas } = canvasModule;
    const processedCanvas = createCanvas(scaledImageData.width, scaledImageData.height);
    const processedContext = processedCanvas.getContext('2d');
    processedContext.putImageData(scaledImageData, 0, 0);

    return processedCanvas;
}

export function createOcrVariantBuffers(canvasModule, canvas, context, locateInkBoundingBox) {
    const preparedCanvas = createOcrReadyCanvas(canvasModule, canvas, context, locateInkBoundingBox);
    const preparedContext = preparedCanvas.getContext('2d');
    const grayscale = createGrayscaleImageData(canvasModule, preparedContext, preparedCanvas.width, preparedCanvas.height);
    const autocontrast = createAutocontrastImageData(grayscale);
    const thresholded = createThresholdImageData(autocontrast);
    const thresholdedSoft = createThresholdImageData(autocontrast, 205);

    return [
        { name: 'cropped-color', buffer: preparedCanvas.toBuffer('image/png') },
        { name: 'cropped-grayscale-autocontrast', buffer: buildCanvasFromImageData(canvasModule, autocontrast, preparedCanvas.width, preparedCanvas.height) },
        { name: 'cropped-threshold-185', buffer: buildCanvasFromImageData(canvasModule, thresholded, preparedCanvas.width, preparedCanvas.height) },
        { name: 'cropped-threshold-205', buffer: buildCanvasFromImageData(canvasModule, thresholdedSoft, preparedCanvas.width, preparedCanvas.height) },
        { name: 'full-page-color', buffer: canvas.toBuffer('image/png') }
    ];
}
