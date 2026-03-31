import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { loadPdfDocument } from '../utils/pdfjs.server.js';

const execFileAsync = promisify(execFile);

const DEFAULT_MAX_PDF_EXTRACTION_PAGES = 50;
const DEFAULT_MAX_SCANNED_OCR_PAGES = 10;
const DEFAULT_MAX_OCR_RENDER_PIXELS = 20_000_000;
const DEFAULT_MIN_SCANNED_TEXT_LENGTH = 5;
const DEFAULT_MIN_SCANNED_ITEMS = 5;
const DEFAULT_MIN_OCR_TEXT_LENGTH = 20;
const DEFAULT_FORCE_DOCUMENT_OCR_TEXT_LENGTH = 0;
const DEFAULT_Y_THRESHOLD = 5;
const DEFAULT_OCR_RENDER_SCALE = 4.0;
const DEFAULT_OCR_DARK_PIXEL_THRESHOLD = 245;
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
const PYTHON_CANDIDATES = process.platform === 'win32' ? ['python', 'py'] : ['python3', 'python'];

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

function getScannedPageInfo(textContent, minTextLength = DEFAULT_MIN_SCANNED_TEXT_LENGTH, minItems = DEFAULT_MIN_SCANNED_ITEMS) {
    const totalTextLength = textContent.items.reduce((sum, item) => sum + (item.str || '').length, 0);
    return {
        totalTextLength,
        scanned: totalTextLength < minTextLength && textContent.items.length < minItems
    };
}

function findInkBoundingBox(imageData, width, height, darkPixelThreshold = DEFAULT_OCR_DARK_PIXEL_THRESHOLD) {
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const offset = (y * width + x) * 4;
            const r = imageData[offset];
            const g = imageData[offset + 1];
            const b = imageData[offset + 2];
            const alpha = imageData[offset + 3];

            if (alpha > 0 && (r < darkPixelThreshold || g < darkPixelThreshold || b < darkPixelThreshold)) {
                if (x < minX) minX = x;
                if (y < minY) minY = y;
                if (x > maxX) maxX = x;
                if (y > maxY) maxY = y;
            }
        }
    }

    if (maxX < minX || maxY < minY) {
        return null;
    }

    return { minX, minY, maxX, maxY };
}

function createOcrReadyCanvas(canvasModule, canvas, context) {
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const inkBox = findInkBoundingBox(imageData, canvas.width, canvas.height);

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

function scoreOcrResult(text, confidence) {
    return (text?.trim().length || 0) + ((confidence || 0) * 2);
}

function getTextLength(value) {
    return value?.text?.trim().length || 0;
}

function scoreOcrCandidateQuality(text, confidence = 0) {
    const normalized = normalizeExtractedText(text || '');
    const length = normalized.length;
    if (!length) {
        return 0;
    }

    const words = normalized.match(/[A-Za-zÀ-ÿ]{2,}/g) || [];
    const emailMatches = normalized.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) || [];
    const phoneMatches = normalized.match(/(?:\+\d{1,3}\s*)?(?:\d[\s.-]*){8,}/g) || [];
    const yearMatches = normalized.match(/\b(?:19|20)\d{2}\b/g) || [];
    const sectionMatches = normalized.match(/\b(PROFIL|EXPERIENCE|EXPÉRIENCE|COMPETENCES|COMPÉTENCES|FORMATION|LANGUES|SKILLS|SUMMARY|EDUCATION)\b/gi) || [];
    const alphaChars = (normalized.match(/[A-Za-zÀ-ÿ]/g) || []).length;
    const weirdChars = (normalized.match(/[^A-Za-zÀ-ÿ0-9\s@.+,;:()/'"!?&%#\-|]/g) || []).length;
    const lineCount = normalized.split('\n').filter((line) => line.trim().length > 0).length;
    const avgWordLength = words.length
        ? words.reduce((sum, word) => sum + word.length, 0) / words.length
        : 0;

    let score = 0;
    score += Math.min(180, length * 0.45);
    score += Math.min(70, words.length * 3);
    score += Math.min(35, lineCount * 4);
    score += emailMatches.length * 40;
    score += phoneMatches.length * 25;
    score += Math.min(20, yearMatches.length * 5);
    score += Math.min(24, sectionMatches.length * 6);
    score += Math.min(25, confidence * 0.4);

    if (alphaChars > 0) {
        const weirdRatio = weirdChars / Math.max(alphaChars + weirdChars, 1);
        const alphaRatio = alphaChars / Math.max(length, 1);
        score -= weirdRatio * 120;
        score += alphaRatio * 20;
    }

    if (avgWordLength < 3.2 && words.length > 20) {
        score -= 25;
    }

    return Math.max(0, Math.round(score));
}

function buildOcrCandidate(variant, recognition) {
    return {
        variant,
        text: recognition.text,
        confidence: recognition.confidence,
        score: scoreOcrCandidateQuality(recognition.text, recognition.confidence),
        engine: recognition.engine,
        psm: recognition.psm
    };
}

let cachedTesseractCliAvailability = null;
let cachedPdftoppmAvailability = null;
let cachedPdfimagesAvailability = null;
let cachedPythonCommand = undefined;

async function hasTesseractCli() {
    if (cachedTesseractCliAvailability !== null) {
        return cachedTesseractCliAvailability;
    }

    try {
        await execFileAsync('tesseract', ['--version']);
        cachedTesseractCliAvailability = true;
    } catch {
        cachedTesseractCliAvailability = false;
    }

    return cachedTesseractCliAvailability;
}

async function hasPdftoppmCli() {
    if (cachedPdftoppmAvailability !== null) {
        return cachedPdftoppmAvailability;
    }

    try {
        await execFileAsync('pdftoppm', ['-v']);
        cachedPdftoppmAvailability = true;
    } catch {
        cachedPdftoppmAvailability = false;
    }

    return cachedPdftoppmAvailability;
}

async function hasPdfimagesCli() {
    if (cachedPdfimagesAvailability !== null) {
        return cachedPdfimagesAvailability;
    }

    try {
        await execFileAsync('pdfimages', ['-v']);
        cachedPdfimagesAvailability = true;
    } catch {
        cachedPdfimagesAvailability = false;
    }

    return cachedPdfimagesAvailability;
}

async function hasAdvancedOcrBackend(backend = DEFAULT_ADVANCED_OCR_BACKEND) {
    if (!backend || backend === 'none') {
        return false;
    }

    try {
        const scriptPath = path.join(process.cwd(), 'server', 'scripts', 'advanced_ocr.py');
        const result = await runPythonJson(scriptPath, ['--backend', backend, '--image', '__healthcheck__', '--healthcheck']);
        return !!result?.ok;
    } catch {
        return false;
    }
}

export async function getOcrRuntimeDiagnostics() {
    const [tesseractAvailable, pdftoppmAvailable, pdfimagesAvailable, pythonCommand] = await Promise.all([
        hasTesseractCli(),
        hasPdftoppmCli(),
        hasPdfimagesCli(),
        getPythonCommand()
    ]);

    const advancedBackend = DEFAULT_ADVANCED_OCR_BACKEND;
    let advancedBackendAvailable = false;
    let preferredEngine = 'tesseract.js';
    let advancedBackendStatus = 'not_applicable';

    if (tesseractAvailable && pdftoppmAvailable) {
        preferredEngine = 'tesseract-cli';
    }

    if (advancedBackend && advancedBackend !== 'none' && pythonCommand) {
        advancedBackendAvailable = await hasAdvancedOcrBackend(advancedBackend);
        advancedBackendStatus = advancedBackendAvailable
            ? 'ok'
            : (preferredEngine === 'tesseract-cli' ? 'not_applicable' : 'warning');
    } else if (advancedBackend && advancedBackend !== 'none') {
        advancedBackendStatus = preferredEngine === 'tesseract-cli' ? 'not_applicable' : 'warning';
    }

    return {
        status: preferredEngine === 'tesseract-cli' ? 'ok' : 'warning',
        preferredEngine,
        tesseractCliAvailable: tesseractAvailable,
        pdftoppmAvailable,
        pdfimagesAvailable,
        pythonCommand,
        advancedBackend,
        advancedBackendAvailable,
        advancedBackendStatus,
        notes: preferredEngine === 'tesseract-cli'
            ? (
                advancedBackend && advancedBackend !== 'none' && !advancedBackendAvailable
                    ? 'CLI OCR pipeline available; advanced OCR fallback unavailable'
                    : 'CLI OCR pipeline available'
            )
            : 'Falling back to tesseract.js OCR pipeline'
    };
}

async function extractEmbeddedImagesFromPdf(buffer, pageNum) {
    if (!(await hasPdfimagesCli())) {
        return [];
    }

    const basePath = path.join(
        os.tmpdir(),
        `resume-ocr-images-${process.pid}-${Date.now()}-${pageNum}`
    );
    const pdfPath = `${basePath}.pdf`;
    const outputPrefix = `${basePath}-img`;

    try {
        await fs.writeFile(pdfPath, buffer);
        await execFileAsync('pdfimages', [
            '-f', String(pageNum),
            '-l', String(pageNum),
            '-png',
            pdfPath,
            outputPrefix
        ], {
            maxBuffer: 10 * 1024 * 1024
        });

        const dir = path.dirname(outputPrefix);
        const prefixName = path.basename(outputPrefix);
        const files = await fs.readdir(dir);
        const candidates = files
            .filter((file) => file.startsWith(prefixName) && file.endsWith('.png'))
            .sort((a, b) => a.localeCompare(b))
            .map((file, index) => ({
                name: `pdfimages-${String(index).padStart(2, '0')}`,
                path: path.join(dir, file),
                order: index
            }));

        return candidates;
    } catch {
        return [];
    } finally {
        await fs.unlink(pdfPath).catch(() => {});
    }
}

async function getPythonCommand() {
    if (cachedPythonCommand !== undefined) {
        return cachedPythonCommand;
    }

    for (const candidate of PYTHON_CANDIDATES) {
        try {
            if (candidate === 'py') {
                await execFileAsync(candidate, ['-3', '--version']);
            } else {
                await execFileAsync(candidate, ['--version']);
            }
            cachedPythonCommand = candidate;
            return cachedPythonCommand;
        } catch {
            // continue
        }
    }

    cachedPythonCommand = null;
    return cachedPythonCommand;
}

async function runPythonJson(scriptPath, args) {
    const python = await getPythonCommand();
    if (!python) {
        throw new Error('Python runtime unavailable');
    }

    const pythonArgs = python === 'py'
        ? ['-3', scriptPath, ...args]
        : [scriptPath, ...args];

    const { stdout } = await execFileAsync(python, pythonArgs, {
        maxBuffer: 20 * 1024 * 1024
    });

    return JSON.parse(stdout.trim());
}

async function recognizeWithTesseractCli(tempPath) {
    const psmModes = ['6', '11', '4'];
    let best = { text: '', confidence: 0, score: 0, engine: 'tesseract-cli', psm: null };

    for (const psm of psmModes) {
        const { stdout } = await execFileAsync('tesseract', [
            tempPath,
            'stdout',
            '-l',
            'fra+eng',
            '--psm',
            psm,
            'quiet'
        ], {
            maxBuffer: 10 * 1024 * 1024
        });

        const text = stdout || '';
        const score = scoreOcrResult(text, 0);
        if (score > best.score) {
            best = { text, confidence: 0, score, engine: 'tesseract-cli', psm };
        }
    }

    return best;
}

async function preparePythonOcrVariants(imagePath, pageNum) {
    const outputDir = path.join(
        os.tmpdir(),
        `resume-ocr-variants-${process.pid}-${Date.now()}-${pageNum}`
    );
    const scriptPath = path.join(process.cwd(), 'server', 'scripts', 'prepare_ocr_variants.py');

    try {
        const result = await runPythonJson(scriptPath, [
            '--input', imagePath,
            '--output-dir', outputDir
        ]);
        return {
            variants: result?.variants || [],
            blocks: result?.blocks || []
        };
    } catch {
        return { variants: [], blocks: [] };
    }
}

function scoreBlockSequence(results = []) {
    return results.reduce((sum, result) => sum + scoreOcrResult(result.text, result.confidence), 0);
}

function buildBlockSequenceText(results = []) {
    return results
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map((result) => (result.text || '').trim())
        .filter(Boolean)
        .join('\n\n')
        .trim();
}

async function recognizeBlockSequence(blocks, recognizer, onOcrVariantAttempt, pageNum, variantPrefix = 'python-blocks') {
    if (!Array.isArray(blocks) || blocks.length === 0) {
        return null;
    }

    const results = [];
    for (const block of blocks) {
        const recognition = await recognizer(block.path);
        const trimmedTextLength = recognition.text?.trim().length || 0;
        onOcrVariantAttempt?.({
            pageNum,
            variant: `${variantPrefix}-${String(block.order ?? 0).padStart(2, '0')}`,
            confidence: recognition.confidence,
            textLength: trimmedTextLength,
            engine: recognition.engine,
            psm: recognition.psm,
            blockOrder: block.order ?? null
        });
        results.push({
            ...recognition,
            order: block.order ?? results.length
        });
    }

    const text = buildBlockSequenceText(results);
    if (!text) {
        return null;
    }

    const confidences = results
        .map((result) => Number(result.confidence) || 0)
        .filter((value) => value > 0);

    return {
        variant: variantPrefix,
        text,
        confidence: confidences.length
            ? confidences.reduce((sum, value) => sum + value, 0) / confidences.length
            : 0,
        score: scoreBlockSequence(results),
        engine: results[0]?.engine || 'unknown',
        psm: 'blocks'
    };
}

async function recognizeWithAdvancedOcr(tempPath, backend = DEFAULT_ADVANCED_OCR_BACKEND) {
    if (!backend || backend === 'none') {
        return null;
    }

    const scriptPath = path.join(process.cwd(), 'server', 'scripts', 'advanced_ocr.py');

    try {
        const result = await runPythonJson(scriptPath, [
            '--image', tempPath,
            '--backend', backend
        ]);

        if (!result?.text) {
            return null;
        }

        return {
            text: result.text,
            confidence: Number(result.confidence) || 0,
            score: scoreOcrResult(result.text, Number(result.confidence) || 0),
            engine: result.engine || backend,
            psm: null
        };
    } catch {
        return null;
    }
}

async function renderPdfPageWithPdftoppm(pdfBuffer, pageNum, dpi = 300) {
    const basePath = path.join(
        os.tmpdir(),
        `resume-ocr-render-${process.pid}-${Date.now()}-${pageNum}`
    );
    const pdfPath = `${basePath}.pdf`;
    const outputPrefix = `${basePath}-page`;
    const outputPath = `${outputPrefix}-${pageNum}.png`;

    try {
        await fs.writeFile(pdfPath, pdfBuffer);
        await execFileAsync('pdftoppm', [
            '-f', String(pageNum),
            '-l', String(pageNum),
            '-r', String(dpi),
            '-png',
            pdfPath,
            outputPrefix
        ], {
            maxBuffer: 10 * 1024 * 1024
        });
        return outputPath;
    } finally {
        await fs.unlink(pdfPath).catch(() => {});
    }
}

async function recognizeWithTesseractJs(tesseractWorker, tempPath) {
    const { data: { text, confidence } } = await tesseractWorker.recognize(tempPath);
    return {
        text,
        confidence,
        score: scoreOcrResult(text, confidence),
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
            return await recognizeWithTesseractCli(tempPath);
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

            let bestVariant = null;
            const pageStartedAt = Date.now();
            let evaluatedVariants = 0;
            const shouldStopExploration = () => (
                evaluatedVariants >= DEFAULT_MAX_VARIANTS_PER_PAGE
                || (Date.now() - pageStartedAt) >= DEFAULT_MAX_OCR_TIME_PER_PAGE_MS
                || ((bestVariant?.score || 0) >= DEFAULT_EARLY_ACCEPT_SCORE)
            );
            const recordCandidate = (variant, recognition, extra = {}) => {
                evaluatedVariants++;
                const trimmedTextLength = recognition.text?.trim().length || 0;
                onOcrVariantAttempt?.({
                    pageNum,
                    variant,
                    confidence: recognition.confidence,
                    textLength: trimmedTextLength,
                    engine: recognition.engine,
                    psm: recognition.psm,
                    ...extra
                });
                const candidate = buildOcrCandidate(variant, recognition);
                if (!bestVariant || candidate.score > bestVariant.score) {
                    bestVariant = candidate;
                }
                return candidate;
            };

            if (useCliOcrPipeline) {
                const renderedImagePath = await renderPdfPageWithPdftoppm(buffer, pageNum);
                try {
                    const candidateImages = [{ name: 'pdftoppm-page', path: renderedImagePath }];
                    const baseRecognition = await recognizeWithTesseractCli(renderedImagePath);
                    recordCandidate('pdftoppm-page', baseRecognition);

                    let preparedAssets = { variants: [], blocks: [] };
                    if (!shouldStopExploration()) {
                        preparedAssets = await preparePythonOcrVariants(renderedImagePath, pageNum);
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
                        const recognition = await recognizeWithTesseractCli(imageVariant.path);
                        recordCandidate(imageVariant.name, recognition);
                    }

                    if (!shouldStopExploration() && preparedAssets.blocks.length > 0) {
                        const blockSequenceCandidate = await recognizeBlockSequence(
                            preparedAssets.blocks,
                            async (imagePath) => recognizeWithTesseractCli(imagePath),
                            onOcrVariantAttempt,
                            pageNum
                        );
                        if (blockSequenceCandidate) {
                            blockSequenceCandidate.score = scoreOcrCandidateQuality(blockSequenceCandidate.text, blockSequenceCandidate.confidence);
                            if (!bestVariant || blockSequenceCandidate.score > bestVariant.score) {
                                bestVariant = blockSequenceCandidate;
                            }
                        }
                    }

                    if (
                        useEmbeddedImagePipeline
                        && getTextLength(bestVariant) < DEFAULT_EMBEDDED_IMAGE_TRIGGER_TEXT_LENGTH
                        && !shouldStopExploration()
                    ) {
                        const embeddedImages = (await extractEmbeddedImagesFromPdf(buffer, pageNum))
                            .slice(0, DEFAULT_MAX_EMBEDDED_IMAGES_PER_PAGE);
                        try {
                            const embeddedImageCandidates = [];
                            for (const embeddedImage of embeddedImages) {
                                if (shouldStopExploration()) {
                                    break;
                                }
                                embeddedImageCandidates.push(embeddedImage);
                                const baseRecognition = await recognizeWithTesseractCli(embeddedImage.path);
                                const baseCandidate = recordCandidate(embeddedImage.name, baseRecognition);

                                if (getTextLength(baseCandidate) < DEFAULT_EMBEDDED_IMAGE_STRONG_TEXT_LENGTH && !shouldStopExploration()) {
                                    const preparedEmbeddedAssets = await preparePythonOcrVariants(embeddedImage.path, pageNum);
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
                                        const embeddedBlocksCandidate = await recognizeBlockSequence(
                                            preparedEmbeddedAssets.blocks,
                                            async (imagePath) => recognizeWithTesseractCli(imagePath),
                                            onOcrVariantAttempt,
                                            pageNum,
                                            `${embeddedImage.name}-blocks`
                                        );
                                        if (embeddedBlocksCandidate) {
                                            embeddedBlocksCandidate.score = scoreOcrCandidateQuality(embeddedBlocksCandidate.text, embeddedBlocksCandidate.confidence);
                                            if (!bestVariant || embeddedBlocksCandidate.score > bestVariant.score) {
                                                bestVariant = embeddedBlocksCandidate;
                                            }
                                        }
                                    }

                                    for (const blockVariant of preparedEmbeddedAssets.blocks) {
                                        await fs.unlink(blockVariant.path).catch(() => {});
                                    }
                                }
                            }

                            if (!shouldStopExploration()) {
                                const embeddedSequenceCandidate = await recognizeBlockSequence(
                                    embeddedImages,
                                    async (imagePath) => recognizeWithTesseractCli(imagePath),
                                    onOcrVariantAttempt,
                                    pageNum,
                                    'pdfimages-sequence'
                                );
                                if (embeddedSequenceCandidate) {
                                    embeddedSequenceCandidate.score = scoreOcrCandidateQuality(embeddedSequenceCandidate.text, embeddedSequenceCandidate.confidence);
                                    if (!bestVariant || embeddedSequenceCandidate.score > bestVariant.score) {
                                        bestVariant = embeddedSequenceCandidate;
                                    }
                                }
                            }

                            for (const imageVariant of embeddedImageCandidates) {
                                if (shouldStopExploration()) {
                                    break;
                                }
                                if (embeddedImages.some((embedded) => embedded.path === imageVariant.path)) {
                                    continue;
                                }
                                const recognition = await recognizeWithTesseractCli(imageVariant.path);
                                recordCandidate(imageVariant.name, recognition);
                            }

                            if (
                                bestVariant
                                && (bestVariant.text?.trim().length || 0) < advancedOcrTriggerTextLength
                                && DEFAULT_ADVANCED_OCR_BACKEND !== 'none'
                                && !shouldStopExploration()
                            ) {
                                const advancedEmbeddedSequenceCandidate = await recognizeBlockSequence(
                                    embeddedImages,
                                    async (imagePath) => {
                                        const advancedRecognition = await recognizeWithAdvancedOcr(
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
                                    'pdfimages-sequence-advanced'
                                );
                                if (advancedEmbeddedSequenceCandidate) {
                                    advancedEmbeddedSequenceCandidate.score = scoreOcrCandidateQuality(advancedEmbeddedSequenceCandidate.text, advancedEmbeddedSequenceCandidate.confidence);
                                    if (!bestVariant || advancedEmbeddedSequenceCandidate.score > bestVariant.score) {
                                        bestVariant = advancedEmbeddedSequenceCandidate;
                                    }
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
                        bestVariant
                        && (bestVariant.text?.trim().length || 0) < advancedOcrTriggerTextLength
                        && DEFAULT_ADVANCED_OCR_BACKEND !== 'none'
                        && !shouldStopExploration()
                    ) {
                        for (const imageVariant of candidateImages) {
                            if (shouldStopExploration()) {
                                break;
                            }
                            const advancedRecognition = await recognizeWithAdvancedOcr(
                                imageVariant.path,
                                DEFAULT_ADVANCED_OCR_BACKEND
                            );
                            if (!advancedRecognition) {
                                continue;
                            }
                            recordCandidate(`${imageVariant.name}-advanced`, advancedRecognition);
                        }

                        if (!shouldStopExploration()) {
                            const advancedBlockCandidate = await recognizeBlockSequence(
                                preparedAssets.blocks,
                                async (imagePath) => {
                                    const advancedRecognition = await recognizeWithAdvancedOcr(
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
                                'python-blocks-advanced'
                            );
                            if (advancedBlockCandidate) {
                                advancedBlockCandidate.score = scoreOcrCandidateQuality(advancedBlockCandidate.text, advancedBlockCandidate.confidence);
                                if (!bestVariant || advancedBlockCandidate.score > bestVariant.score) {
                                    bestVariant = advancedBlockCandidate;
                                }
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
            const { totalTextLength, scanned } = getScannedPageInfo(textContent);

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
