import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { loadPdfDocument } from '../utils/pdfjs.server.js';
import {
    getScannedPageInfo as deriveScannedPageInfo,
    findInkBoundingBox as locateInkBoundingBox,
    scoreOcrResult as calculateOcrResultScore,
    getTextLength as getRecognizedTextLength,
    scoreOcrCandidateQuality as calculateOcrCandidateQuality,
    buildOcrCandidate as createOcrCandidate,
    scoreBlockSequence as calculateBlockSequenceScore,
    buildBlockSequenceText as createBlockSequenceText
} from './pdfOcrHeuristics.service.js';
import { createPdfOcrRuntimeService } from './pdfOcrRuntime.service.js';
import { createPdfOcrIoService } from './pdfOcrIo.service.js';
import { createOcrPageEvaluator, recognizeBlockSequence } from './pdfOcrPageOrchestrator.service.js';

const execFileAsync = promisify(execFile);

const DEFAULT_MAX_PDF_EXTRACTION_PAGES = 50;
const DEFAULT_MAX_SCANNED_OCR_PAGES = 10;
const DEFAULT_MAX_OCR_RENDER_PIXELS = 20_000_000;
const DEFAULT_MIN_OCR_TEXT_LENGTH = 20;
const DEFAULT_FORCE_DOCUMENT_OCR_TEXT_LENGTH = 0;
const DEFAULT_Y_THRESHOLD = 5;
const DEFAULT_OCR_RENDER_SCALE = 4.0;
const DEFAULT_OCR_BOUNDING_PADDING = 24;
const DEFAULT_OCR_MIN_CROP_WIDTH = 1800;
const DEFAULT_OCR_VARIANT_THRESHOLD = 185;
const DEFAULT_ADVANCED_OCR_TRIGGER_TEXT_LENGTH = 500;
const DEFAULT_EMBEDDED_IMAGE_TRIGGER_TEXT_LENGTH = 220;
const DEFAULT_EMBEDDED_IMAGE_STRONG_TEXT_LENGTH = 160;
const DEFAULT_MAX_EMBEDDED_IMAGES_PER_PAGE = 4;
const DEFAULT_MAX_VARIANTS_PER_PAGE = 18;
const DEFAULT_MAX_OCR_TIME_PER_PAGE_MS = 20_000;
const DEFAULT_EARLY_ACCEPT_SCORE = 260;
const DEFAULT_ADVANCED_OCR_BACKEND = process.env.OCR_ADVANCED_BACKEND || 'none';

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

function createOcrReadyCanvas(canvasModule, canvas, context) {
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

function scaleImageData(imageData, scaleFactor) {
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

function createAutocontrastImageData(imageData) {
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

function createThresholdImageData(imageData, threshold = DEFAULT_OCR_VARIANT_THRESHOLD) {
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

function createOcrVariantBuffers(canvasModule, canvas, context) {
    const preparedCanvas = createOcrReadyCanvas(canvasModule, canvas, context);
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

let ocrIoService;

async function getPythonCommand() {
    return ocrIoService.getPythonCommand();
}

async function runPythonJson(scriptPath, args) {
    return ocrIoService.runPythonJson(scriptPath, args);
}

const ocrRuntimeService = createPdfOcrRuntimeService({
    execFileAsync,
    getPythonCommand,
    runPythonJson,
    advancedBackend: DEFAULT_ADVANCED_OCR_BACKEND,
    scriptPathResolver: (scriptName) => path.join(process.cwd(), 'server', 'scripts', scriptName)
});

const {
    hasTesseractCli,
    hasPdftoppmCli,
    hasPdfimagesCli,
    hasAdvancedOcrBackend,
    getOcrRuntimeDiagnostics
} = ocrRuntimeService;

export { getOcrRuntimeDiagnostics };

ocrIoService = createPdfOcrIoService({
    fs,
    os,
    path,
    execFileAsync,
    hasPdfimagesCli: () => hasPdfimagesCli(),
    scoreOcrResult: calculateOcrResultScore,
    advancedBackend: DEFAULT_ADVANCED_OCR_BACKEND,
    cwdProvider: () => process.cwd()
});

const {
    extractEmbeddedImagesFromPdf: extractEmbeddedImagesFromPdfIo,
    recognizeWithTesseractCli: recognizeWithTesseractCliIo,
    preparePythonOcrVariants: preparePythonOcrVariantsIo,
    recognizeWithAdvancedOcr: recognizeWithAdvancedOcrIo,
    renderPdfPageWithPdftoppm: renderPdfPageWithPdftoppmIo
} = ocrIoService;

async function recognizeWithTesseractJs(tesseractWorker, tempPath) {
    const { data: { text, confidence } } = await tesseractWorker.recognize(tempPath);
    return {
        text,
        confidence,
        score: calculateOcrResultScore(text, confidence),
        engine: 'tesseract.js',
        psm: null
    };
}

async function recognizeVariantBuffer(tesseractWorker, variantName, variantBuffer, pageNum) {
    const tempPath = path.join(
        os.tmpdir(),
        `resume-ocr-${process.pid}-${Date.now()}-${pageNum}-${variantName}.png`
    );

    try {
        await fs.writeFile(tempPath, variantBuffer);
        if (await hasTesseractCli()) {
            return await recognizeWithTesseractCliIo(tempPath);
        }
        return await recognizeWithTesseractJs(tesseractWorker, tempPath);
    } finally {
        await fs.unlink(tempPath).catch(() => {});
    }
}

export async function extractPdfTextWithOcr(buffer, options = {}) {
    const {
        maxPdfPages = DEFAULT_MAX_PDF_EXTRACTION_PAGES,
        maxScannedOcrPages = DEFAULT_MAX_SCANNED_OCR_PAGES,
        maxOcrRenderPixels = DEFAULT_MAX_OCR_RENDER_PIXELS,
        minOcrTextLength = DEFAULT_MIN_OCR_TEXT_LENGTH,
        forceDocumentOcrTextLength = DEFAULT_FORCE_DOCUMENT_OCR_TEXT_LENGTH,
        advancedOcrTriggerTextLength = DEFAULT_ADVANCED_OCR_TRIGGER_TEXT_LENGTH,
        ocrRenderScale = DEFAULT_OCR_RENDER_SCALE,
        onOcrProgress,
        onOcrPageDetected,
        onOcrPageCompleted,
        onOcrPageFailed,
        onOcrVariantAttempt
    } = options;

    let tesseractWorker = null;

    try {
        const uint8Array = new Uint8Array(buffer);
        const loadingTask = await loadPdfDocument(uint8Array);
        const pdf = await loadingTask.promise;

        if (pdf.numPages > maxPdfPages) {
            throw new Error(`PDF too large to extract safely. Maximum supported page count is ${maxPdfPages}.`);
        }

        let fullText = '';
        let ocrUsed = false;
        let ocrPageCount = 0;
        let failedOcrPages = 0;
        let totalOcrConfidence = 0;
        const recentResults = [];

        const useCliOcrPipeline = (await hasTesseractCli()) && (await hasPdftoppmCli());
        const useEmbeddedImagePipeline = (await hasTesseractCli()) && (await hasPdfimagesCli());

        const ocrPage = async (page, pageNum, totalTextLength = 0, itemCount = 0) => {
            if (ocrPageCount >= maxScannedOcrPages) {
                throw new Error(`PDF contains too many scanned pages for OCR extraction. Maximum supported scanned pages is ${maxScannedOcrPages}.`);
            }

            onOcrPageDetected?.({ pageNum, totalTextLength, itemCount });

            if (!useCliOcrPipeline && !tesseractWorker) {
                const Tesseract = await import('tesseract.js');
                tesseractWorker = await Tesseract.createWorker('fra+eng', 1, {
                    logger: (message) => {
                        if (message.status === 'recognizing text') {
                            onOcrProgress?.({ pageNum, progress: message.progress });
                        }
                    }
                });
            }

            const evaluator = createOcrPageEvaluator({
                pageNum,
                maxVariantsPerPage: DEFAULT_MAX_VARIANTS_PER_PAGE,
                maxOcrTimePerPageMs: DEFAULT_MAX_OCR_TIME_PER_PAGE_MS,
                earlyAcceptScore: DEFAULT_EARLY_ACCEPT_SCORE,
                onOcrVariantAttempt,
                buildCandidate: createOcrCandidate
            });
            const shouldStopExploration = evaluator.shouldStopExploration;
            const recordCandidate = evaluator.recordCandidate;
            const considerCandidate = evaluator.considerCandidate;
            const getBestVariant = evaluator.getBestVariant;

            if (useCliOcrPipeline) {
                const renderedImagePath = await renderPdfPageWithPdftoppmIo(buffer, pageNum);
                try {
                    const candidateImages = [{ name: 'pdftoppm-page', path: renderedImagePath }];
                    const baseRecognition = await recognizeWithTesseractCliIo(renderedImagePath);
                    recordCandidate('pdftoppm-page', baseRecognition);

                    let preparedAssets = { variants: [], blocks: [] };
                    if (!shouldStopExploration()) {
                        preparedAssets = await preparePythonOcrVariantsIo(renderedImagePath, pageNum);
                        for (const variant of preparedAssets.variants) {
                            if (variant?.path) {
                                candidateImages.push({ name: variant.name, path: variant.path });
                            }
                        }
                    }

                    for (const imageVariant of candidateImages.slice(1)) {
                        if (shouldStopExploration()) {
                            break;
                        }
                        const recognition = await recognizeWithTesseractCliIo(imageVariant.path);
                        recordCandidate(imageVariant.name, recognition);
                    }

                    if (!shouldStopExploration() && preparedAssets.blocks.length > 0) {
                        const blockSequenceCandidate = await recognizeBlockSequence({
                            blocks: preparedAssets.blocks,
                            recognizer: async (imagePath) => recognizeWithTesseractCliIo(imagePath),
                            onOcrVariantAttempt,
                            pageNum,
                            buildSequenceText: createBlockSequenceText,
                            scoreSequence: calculateBlockSequenceScore
                        });
                        if (blockSequenceCandidate) {
                            blockSequenceCandidate.score = calculateOcrCandidateQuality(blockSequenceCandidate.text, blockSequenceCandidate.confidence);
                            considerCandidate(blockSequenceCandidate);
                        }
                    }

                    if (
                        useEmbeddedImagePipeline
                        && getRecognizedTextLength(getBestVariant()) < DEFAULT_EMBEDDED_IMAGE_TRIGGER_TEXT_LENGTH
                        && !shouldStopExploration()
                    ) {
                        const embeddedImages = (await extractEmbeddedImagesFromPdfIo(buffer, pageNum))
                            .slice(0, DEFAULT_MAX_EMBEDDED_IMAGES_PER_PAGE);
                        try {
                            const embeddedImageCandidates = [];
                            for (const embeddedImage of embeddedImages) {
                                if (shouldStopExploration()) {
                                    break;
                                }
                                embeddedImageCandidates.push(embeddedImage);
                                const baseRecognition = await recognizeWithTesseractCliIo(embeddedImage.path);
                                const baseCandidate = recordCandidate(embeddedImage.name, baseRecognition);

                                if (getRecognizedTextLength(baseCandidate) < DEFAULT_EMBEDDED_IMAGE_STRONG_TEXT_LENGTH && !shouldStopExploration()) {
                                    const preparedEmbeddedAssets = await preparePythonOcrVariantsIo(embeddedImage.path, pageNum);
                                    for (const variant of preparedEmbeddedAssets.variants.slice(0, 4)) {
                                        if (variant?.path) {
                                            embeddedImageCandidates.push({
                                                name: `${embeddedImage.name}-${variant.name}`,
                                                path: variant.path,
                                                order: embeddedImage.order
                                            });
                                        }
                                    }

                                    if (!shouldStopExploration()) {
                                        const embeddedBlocksCandidate = await recognizeBlockSequence({
                                            blocks: preparedEmbeddedAssets.blocks,
                                            recognizer: async (imagePath) => recognizeWithTesseractCliIo(imagePath),
                                            onOcrVariantAttempt,
                                            pageNum,
                                            variantPrefix: `${embeddedImage.name}-blocks`,
                                            buildSequenceText: createBlockSequenceText,
                                            scoreSequence: calculateBlockSequenceScore
                                        });
                                        if (embeddedBlocksCandidate) {
                                            embeddedBlocksCandidate.score = calculateOcrCandidateQuality(embeddedBlocksCandidate.text, embeddedBlocksCandidate.confidence);
                                            considerCandidate(embeddedBlocksCandidate);
                                        }
                                    }

                                    for (const blockVariant of preparedEmbeddedAssets.blocks) {
                                        await fs.unlink(blockVariant.path).catch(() => {});
                                    }
                                }
                            }

                            if (!shouldStopExploration()) {
                                const embeddedSequenceCandidate = await recognizeBlockSequence({
                                    blocks: embeddedImages,
                                    recognizer: async (imagePath) => recognizeWithTesseractCliIo(imagePath),
                                    onOcrVariantAttempt,
                                    pageNum,
                                    variantPrefix: 'pdfimages-sequence',
                                    buildSequenceText: createBlockSequenceText,
                                    scoreSequence: calculateBlockSequenceScore
                                });
                                if (embeddedSequenceCandidate) {
                                    embeddedSequenceCandidate.score = calculateOcrCandidateQuality(embeddedSequenceCandidate.text, embeddedSequenceCandidate.confidence);
                                    considerCandidate(embeddedSequenceCandidate);
                                }
                            }

                            for (const imageVariant of embeddedImageCandidates) {
                                if (shouldStopExploration()) {
                                    break;
                                }
                                if (embeddedImages.some((embedded) => embedded.path === imageVariant.path)) {
                                    continue;
                                }
                                const recognition = await recognizeWithTesseractCliIo(imageVariant.path);
                                recordCandidate(imageVariant.name, recognition);
                            }

                            if (
                                getBestVariant()
                                && (getBestVariant()?.text?.trim().length || 0) < advancedOcrTriggerTextLength
                                && DEFAULT_ADVANCED_OCR_BACKEND !== 'none'
                                && !shouldStopExploration()
                            ) {
                                const advancedEmbeddedSequenceCandidate = await recognizeBlockSequence({
                                    blocks: embeddedImages,
                                    recognizer: async (imagePath) => {
                                        const advancedRecognition = await recognizeWithAdvancedOcrIo(
                                            imagePath,
                                            DEFAULT_ADVANCED_OCR_BACKEND
                                        );
                                        return advancedRecognition || {
                                            text: '',
                                            confidence: 0,
                                            score: 0,
                                            engine: DEFAULT_ADVANCED_OCR_BACKEND,
                                            psm: null
                                        };
                                    },
                                    onOcrVariantAttempt,
                                    pageNum,
                                    variantPrefix: 'pdfimages-sequence-advanced',
                                    buildSequenceText: createBlockSequenceText,
                                    scoreSequence: calculateBlockSequenceScore
                                });
                                if (advancedEmbeddedSequenceCandidate) {
                                    advancedEmbeddedSequenceCandidate.score = calculateOcrCandidateQuality(advancedEmbeddedSequenceCandidate.text, advancedEmbeddedSequenceCandidate.confidence);
                                    considerCandidate(advancedEmbeddedSequenceCandidate);
                                }
                            }

                            for (const embeddedImage of embeddedImages) {
                                await fs.unlink(embeddedImage.path).catch(() => {});
                            }
                            for (const imageVariant of embeddedImageCandidates.filter((item) => !embeddedImages.some((embedded) => embedded.path === item.path))) {
                                await fs.unlink(imageVariant.path).catch(() => {});
                            }
                        } catch {
                            for (const embeddedImage of embeddedImages) {
                                await fs.unlink(embeddedImage.path).catch(() => {});
                            }
                        }
                    }

                    if (
                        getBestVariant()
                        && (getBestVariant()?.text?.trim().length || 0) < advancedOcrTriggerTextLength
                        && DEFAULT_ADVANCED_OCR_BACKEND !== 'none'
                        && !shouldStopExploration()
                    ) {
                        for (const imageVariant of candidateImages) {
                            if (shouldStopExploration()) {
                                break;
                            }
                            const advancedRecognition = await recognizeWithAdvancedOcrIo(
                                imageVariant.path,
                                DEFAULT_ADVANCED_OCR_BACKEND
                            );
                            if (!advancedRecognition) {
                                continue;
                            }
                            recordCandidate(`${imageVariant.name}-advanced`, advancedRecognition);
                        }

                        if (!shouldStopExploration()) {
                            const advancedBlockCandidate = await recognizeBlockSequence({
                                blocks: preparedAssets.blocks,
                                recognizer: async (imagePath) => {
                                    const advancedRecognition = await recognizeWithAdvancedOcrIo(
                                        imagePath,
                                        DEFAULT_ADVANCED_OCR_BACKEND
                                    );
                                    return advancedRecognition || {
                                        text: '',
                                        confidence: 0,
                                        score: 0,
                                        engine: DEFAULT_ADVANCED_OCR_BACKEND,
                                        psm: null
                                    };
                                },
                                onOcrVariantAttempt,
                                pageNum,
                                variantPrefix: 'python-blocks-advanced',
                                buildSequenceText: createBlockSequenceText,
                                scoreSequence: calculateBlockSequenceScore
                            });
                            if (advancedBlockCandidate) {
                                advancedBlockCandidate.score = calculateOcrCandidateQuality(advancedBlockCandidate.text, advancedBlockCandidate.confidence);
                                considerCandidate(advancedBlockCandidate);
                            }
                        }
                    }

                    for (const imageVariant of candidateImages.slice(1)) {
                        await fs.unlink(imageVariant.path).catch(() => {});
                    }
                    for (const blockVariant of preparedAssets.blocks) {
                        await fs.unlink(blockVariant.path).catch(() => {});
                    }
                } finally {
                    await fs.unlink(renderedImagePath).catch(() => {});
                }
            } else {
                const viewport = page.getViewport({ scale: ocrRenderScale });
                if ((viewport.width * viewport.height) > maxOcrRenderPixels) {
                    throw new Error('Page is too large for OCR rendering');
                }

                const canvasModule = await import('canvas');
                const { createCanvas } = canvasModule;
                const canvas = createCanvas(viewport.width, viewport.height);
                const context = canvas.getContext('2d');
                await page.render({ canvasContext: context, viewport }).promise;
                const variantBuffers = createOcrVariantBuffers(canvasModule, canvas, context);

                for (const variant of variantBuffers) {
                    if (shouldStopExploration()) {
                        break;
                    }
                    const recognition = await recognizeVariantBuffer(
                        tesseractWorker,
                        variant.name,
                        variant.buffer,
                        pageNum
                    );
                    recordCandidate(variant.name, recognition);
                }
            }

            const bestVariant = getBestVariant();
            const ocrText = bestVariant?.text || '';
            const confidence = bestVariant?.confidence || 0;

            ocrPageCount++;

            if (ocrText && ocrText.trim().length > minOcrTextLength) {
                const trimmedText = ocrText.trim();
                ocrUsed = true;
                totalOcrConfidence += confidence || 0;
                const pageResult = {
                    pageNum,
                    confidence,
                    textLength: trimmedText.length,
                    variant: bestVariant?.variant || 'unknown',
                    engine: bestVariant?.engine || 'unknown',
                    psm: bestVariant?.psm || null
                };
                recentResults.push({ success: true, ...pageResult });
                if (recentResults.length > 10) {
                    recentResults.shift();
                }
                onOcrPageCompleted?.(pageResult);
                return trimmedText + '\n\n';
            }

            failedOcrPages++;
            const failedResult = {
                pageNum,
                error: 'OCR returned insufficient text',
                confidence,
                textLength: ocrText?.trim().length || 0,
                variant: bestVariant?.variant || 'unknown',
                engine: bestVariant?.engine || 'unknown',
                psm: bestVariant?.psm || null
            };
            recentResults.push({ success: false, ...failedResult });
            if (recentResults.length > 10) {
                recentResults.shift();
            }
            onOcrPageFailed?.(failedResult);
            return '';
        };

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const textContent = await page.getTextContent();
            const { totalTextLength, scanned } = deriveScannedPageInfo(textContent);

            if (!scanned) {
                fullText += extractStructuredPageText(textContent.items) + '\n\n';
                continue;
            }

            try {
                fullText += await ocrPage(page, pageNum, totalTextLength, textContent.items.length);
            } catch (error) {
                ocrPageCount++;
                failedOcrPages++;
                const failedResult = { pageNum, error: error.message };
                recentResults.push({ success: false, ...failedResult });
                if (recentResults.length > 10) {
                    recentResults.shift();
                }
                onOcrPageFailed?.(failedResult);
            }
        }

        let normalizedText = normalizeExtractedText(fullText);

        if (normalizedText.length < forceDocumentOcrTextLength) {
            fullText = '';
            ocrUsed = false;
            ocrPageCount = 0;
            failedOcrPages = 0;
            totalOcrConfidence = 0;

            for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
                const page = await pdf.getPage(pageNum);
                try {
                    fullText += await ocrPage(page, pageNum, 0, 0);
                } catch (error) {
                    ocrPageCount++;
                    failedOcrPages++;
                    const failedResult = { pageNum, error: error.message };
                    recentResults.push({ success: false, ...failedResult });
                    if (recentResults.length > 10) {
                        recentResults.shift();
                    }
                    onOcrPageFailed?.(failedResult);
                }
            }

            normalizedText = normalizeExtractedText(fullText);
        }

        const successfulResults = recentResults
            .filter((result) => result.success && Number(result.textLength) > 0)
            .sort((a, b) => (Number(b.textLength) || 0) - (Number(a.textLength) || 0));

        return {
            text: normalizedText,
            pages: pdf.numPages,
            ocrUsed,
            ocrPageCount,
            failedOcrPages,
            avgOcrConfidence: ocrPageCount > 0 ? totalOcrConfidence / ocrPageCount : null,
            primaryResult: successfulResults[0] || null,
            recentResults: recentResults.slice(-5)
        };
    } finally {
        if (tesseractWorker) {
            await tesseractWorker.terminate().catch(() => {});
        }
    }
}
