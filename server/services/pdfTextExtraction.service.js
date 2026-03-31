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
import {
    DEFAULT_Y_THRESHOLD,
    extractStructuredPageText,
    normalizeExtractedText
} from './pdfTextExtraction.helpers.js';
import { createPdfOcrRuntimeService } from './pdfOcrRuntime.service.js';
import { createPdfOcrIoService } from './pdfOcrIo.service.js';
import { createOcrPageEvaluator, recognizeBlockSequence } from './pdfOcrPageOrchestrator.service.js';
import { createOcrVariantBuffers } from './pdfOcrCanvasVariants.service.js';

const execFileAsync = promisify(execFile);

const DEFAULT_MAX_PDF_EXTRACTION_PAGES = 50;
const DEFAULT_MAX_SCANNED_OCR_PAGES = 10;
const DEFAULT_MAX_OCR_RENDER_PIXELS = 20_000_000;
const DEFAULT_MIN_OCR_TEXT_LENGTH = 20;
const DEFAULT_FORCE_DOCUMENT_OCR_TEXT_LENGTH = 0;
const DEFAULT_OCR_RENDER_SCALE = 4.0;
const DEFAULT_ADVANCED_OCR_TRIGGER_TEXT_LENGTH = 500;
const DEFAULT_EMBEDDED_IMAGE_TRIGGER_TEXT_LENGTH = 220;
const DEFAULT_EMBEDDED_IMAGE_STRONG_TEXT_LENGTH = 160;
const DEFAULT_MAX_EMBEDDED_IMAGES_PER_PAGE = 4;
const DEFAULT_MAX_VARIANTS_PER_PAGE = 18;
const DEFAULT_MAX_OCR_TIME_PER_PAGE_MS = 20_000;
const DEFAULT_EARLY_ACCEPT_SCORE = 260;
const DEFAULT_ADVANCED_OCR_BACKEND = process.env.OCR_ADVANCED_BACKEND || 'none';

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
                const variantBuffers = createOcrVariantBuffers(
                    canvasModule,
                    canvas,
                    context,
                    locateInkBoundingBox
                );

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
