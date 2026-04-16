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
    extractStructuredPageText,
    normalizeExtractedText
} from './pdfTextExtraction.helpers.js';
import { createPdfOcrRuntimeService } from './pdfOcrRuntime.service.js';
import { createPdfOcrIoService } from './pdfOcrIo.service.js';
import { createOcrPageEvaluator, recognizeBlockSequence } from './pdfOcrPageOrchestrator.service.js';
import { createOcrVariantBuffers } from './pdfOcrCanvasVariants.service.js';
import { createPdfOcrPageProcessor } from './pdfTextOcrPageProcessor.service.js';

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
const DEFAULT_ADVANCED_OCR_BACKEND = process.env.OCR_ADVANCED_BACKEND || 'paddleocr';

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
    hasAdvancedOcrBackend: _hasAdvancedOcrBackend,
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

async function createTesseractWorker({ logger }) {
    const Tesseract = await import('tesseract.js');
    return Tesseract.createWorker('fra+eng', 1, { logger });
}

async function createCanvasModule() {
    return import('canvas');
}

async function writeTempVariantBuffer(variantName, variantBuffer, pageNum) {
    const tempPath = path.join(
        os.tmpdir(),
        `resume-ocr-${process.pid}-${Date.now()}-${pageNum}-${variantName}.png`
    );

    await fs.writeFile(tempPath, variantBuffer);
    return tempPath;
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

    const workerRef = { current: null };

    try {
        const uint8Array = new Uint8Array(buffer);
        const loadingTask = await loadPdfDocument(uint8Array);
        const pdf = await loadingTask.promise;

        if (pdf.numPages > maxPdfPages) {
            throw new Error(`PDF too large to extract safely. Maximum supported page count is ${maxPdfPages}.`);
        }

        let fullText = '';
        const ocrState = {
            ocrUsed: false,
            ocrPageCount: 0,
            failedOcrPages: 0,
            totalOcrConfidence: 0,
            recentResults: []
        };
        const ocrPage = createPdfOcrPageProcessor({
            settings: {
                maxScannedOcrPages,
                maxOcrRenderPixels,
                minOcrTextLength,
                advancedOcrTriggerTextLength,
                ocrRenderScale,
                advancedOcrBackend: DEFAULT_ADVANCED_OCR_BACKEND,
                embeddedImageTriggerTextLength: DEFAULT_EMBEDDED_IMAGE_TRIGGER_TEXT_LENGTH,
                embeddedImageStrongTextLength: DEFAULT_EMBEDDED_IMAGE_STRONG_TEXT_LENGTH,
                maxEmbeddedImagesPerPage: DEFAULT_MAX_EMBEDDED_IMAGES_PER_PAGE,
                maxVariantsPerPage: DEFAULT_MAX_VARIANTS_PER_PAGE,
                maxOcrTimePerPageMs: DEFAULT_MAX_OCR_TIME_PER_PAGE_MS,
                earlyAcceptScore: DEFAULT_EARLY_ACCEPT_SCORE
            },
            workerRef,
            callbacks: {
                onOcrProgress,
                onOcrPageDetected,
                onOcrPageCompleted,
                onOcrPageFailed,
                onOcrVariantAttempt
            },
            services: {
                fs,
                hasTesseractCli,
                hasPdftoppmCli,
                hasPdfimagesCli,
                renderPdfPageWithPdftoppm: renderPdfPageWithPdftoppmIo,
                recognizeWithTesseractCli: recognizeWithTesseractCliIo,
                preparePythonOcrVariants: preparePythonOcrVariantsIo,
                recognizeWithAdvancedOcr: recognizeWithAdvancedOcrIo,
                extractEmbeddedImagesFromPdf: extractEmbeddedImagesFromPdfIo,
                createCanvasModule,
                createTesseractWorker,
                createOcrPageEvaluator,
                recognizeBlockSequence,
                createOcrVariantBuffers,
                writeTempVariantBuffer
            },
            heuristics: {
                locateInkBoundingBox,
                calculateOcrResultScore,
                getRecognizedTextLength,
                calculateOcrCandidateQuality,
                createOcrCandidate,
                calculateBlockSequenceScore,
                createBlockSequenceText
            }
        });

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const textContent = await page.getTextContent();
            const { totalTextLength, scanned } = deriveScannedPageInfo(textContent);

            if (!scanned) {
                fullText += extractStructuredPageText(textContent.items) + '\n\n';
                continue;
            }

            try {
                fullText += await ocrPage({
                    page,
                    pageNum,
                    buffer,
                    state: ocrState,
                    totalTextLength,
                    itemCount: textContent.items.length
                });
            } catch (error) {
                ocrState.ocrPageCount++;
                ocrState.failedOcrPages++;
                const failedResult = { pageNum, error: error.message };
                ocrState.recentResults.push({ success: false, ...failedResult });
                if (ocrState.recentResults.length > 10) {
                    ocrState.recentResults.shift();
                }
                onOcrPageFailed?.(failedResult);
            }
        }

        let normalizedText = normalizeExtractedText(fullText);

        if (normalizedText.length < forceDocumentOcrTextLength) {
            fullText = '';
            ocrState.ocrUsed = false;
            ocrState.ocrPageCount = 0;
            ocrState.failedOcrPages = 0;
            ocrState.totalOcrConfidence = 0;

            for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
                const page = await pdf.getPage(pageNum);
                try {
                    fullText += await ocrPage({
                        page,
                        pageNum,
                        buffer,
                        state: ocrState,
                        totalTextLength: 0,
                        itemCount: 0
                    });
                } catch (error) {
                    ocrState.ocrPageCount++;
                    ocrState.failedOcrPages++;
                    const failedResult = { pageNum, error: error.message };
                    ocrState.recentResults.push({ success: false, ...failedResult });
                    if (ocrState.recentResults.length > 10) {
                        ocrState.recentResults.shift();
                    }
                    onOcrPageFailed?.(failedResult);
                }
            }

            normalizedText = normalizeExtractedText(fullText);
        }

        const successfulResults = ocrState.recentResults
            .filter((result) => result.success && Number(result.textLength) > 0)
            .sort((a, b) => (Number(b.textLength) || 0) - (Number(a.textLength) || 0));

        return {
            text: normalizedText,
            pages: pdf.numPages,
            ocrUsed: ocrState.ocrUsed,
            ocrPageCount: ocrState.ocrPageCount,
            failedOcrPages: ocrState.failedOcrPages,
            avgOcrConfidence: ocrState.ocrPageCount > 0 ? ocrState.totalOcrConfidence / ocrState.ocrPageCount : null,
            primaryResult: successfulResults[0] || null,
            recentResults: ocrState.recentResults.slice(-5)
        };
    } finally {
        if (workerRef.current) {
            await workerRef.current.terminate().catch(() => {});
        }
    }
}
