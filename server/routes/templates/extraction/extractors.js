import multer from 'multer';
import fs from 'fs/promises';
import path from 'path';
import { createRequire } from 'module';
import puppeteer from 'puppeteer';
import { safeLog } from '../../../utils/logger.backend.js';
import {
    extractTemplateFromHTML,
    extractTemplateFromImage,
    extractTemplateFromCV
} from '../../../services/templateExtraction.service.js';
import { extractTextFromPDFBuffer } from '../../../services/batchJobsWorker/textExtraction.js';
import { convertWordBufferToPdfBuffer } from '../../../services/wordTextExtraction.service.js';
import { injectDocxExtractedImages, injectPdfExtractedLogo } from './imagePlaceholders.js';
import {
    parseDocxStyles,
    buildDocxExtractedImage
} from './extractorHelpers.js';
import {
    resolvePdfParseFunction,
    buildPdfImageDescriptor
} from './pdfExtractionHelpers.js';
import { extractStructuredPdfTemplateInput } from './pdfLayoutTemplateBuilder.js';

const require = createRequire(import.meta.url);
const MIN_LAYOUT_TEXT_CHARACTERS = 80;
let cachedPdfJsDataUrls = null;

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function buildExtractionConfidence({
    extractionMethod,
    layoutAnalysis = null,
    hasExtractedImages = false,
    textLength = 0
}) {
    const metrics = layoutAnalysis?.metrics || {};
    const totalTextCharacters = Number(metrics.totalTextCharacters) || 0;
    const totalLines = Number(metrics.totalLines) || 0;
    const headerLines = Number(metrics.headerLines) || 0;
    const contentLines = Number(metrics.contentLines) || 0;
    const footerLines = Number(metrics.footerLines) || 0;

    if (extractionMethod === 'pdf-text-fallback') {
        return {
            score: 0.42,
            level: 'low',
            reasons: ['legacy_text_fallback']
        };
    }

    if (extractionMethod === 'pdf-vision-fallback') {
        return {
            score: 0.58,
            level: 'medium',
            reasons: ['vision_fallback', hasExtractedImages ? 'images_detected' : 'no_images_detected']
        };
    }

    const score = clamp(
        0.35
        + Math.min(totalTextCharacters / 600, 0.3)
        + Math.min(totalLines / 18, 0.15)
        + (headerLines > 0 ? 0.08 : 0)
        + (contentLines > 0 ? 0.08 : 0)
        + (footerLines > 0 ? 0.04 : 0)
        + (hasExtractedImages ? 0.03 : 0)
        + Math.min(textLength / 1200, 0.07),
        0,
        0.97
    );

    const reasons = [];
    if (headerLines > 0) reasons.push('header_detected');
    if (contentLines > 0) reasons.push('content_detected');
    if (footerLines > 0) reasons.push('footer_detected');
    if (hasExtractedImages) reasons.push('images_detected');
    if (totalTextCharacters >= MIN_LAYOUT_TEXT_CHARACTERS) reasons.push('sufficient_text_density');

    return {
        score: Number(score.toFixed(2)),
        level: score >= 0.78 ? 'high' : score >= 0.58 ? 'medium' : 'low',
        reasons
    };
}

function attachExtractionReview(result, {
    extractionMethod,
    layoutAnalysis = null,
    extractedImages = [],
    textContent = ''
}) {
    if (!result?.template) {
        return result;
    }

    const confidence = buildExtractionConfidence({
        extractionMethod,
        layoutAnalysis,
        hasExtractedImages: extractedImages.length > 0,
        textLength: textContent.length
    });

    result.template.extractionConfidence = confidence;
    result.template.extractionReview = {
        extractionMethod,
        textLength: textContent.length,
        imageCount: extractedImages.length,
        layoutMetrics: layoutAnalysis?.metrics || null,
        headerHtml: layoutAnalysis?.headerHtml || '',
        contentHtml: layoutAnalysis?.contentHtml || '',
        footerHtml: layoutAnalysis?.footerHtml || '',
        stylesheet: layoutAnalysis?.stylesheet || '',
        visualBlocks: layoutAnalysis?.visualBlocks || [],
        imageRegions: layoutAnalysis?.imageBlocks || []
    };

    return result;
}

function resolvePdfJsAssetPath(candidates) {
    for (const candidate of candidates) {
        try {
            return require.resolve(candidate);
        } catch {
            // Try next candidate.
        }
    }

    const pdfJsPackagePath = require.resolve('pdfjs-dist/package.json');
    const pdfJsRoot = path.dirname(pdfJsPackagePath);

    for (const candidate of candidates) {
        const relativeCandidate = candidate.replace(/^pdfjs-dist[\\/]/, '');
        const absolutePath = path.join(pdfJsRoot, relativeCandidate);
        try {
            require.resolve(absolutePath);
            return absolutePath;
        } catch {
            // Try next candidate.
        }
    }

    const fallbackCandidate = candidates[0].replace(/^pdfjs-dist[\\/]/, '');
    return path.join(pdfJsRoot, fallbackCandidate);
}

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        const allowedTypes = [
            'application/pdf',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/msword',
            'application/octet-stream'
        ];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
            return;
        }
        cb(new Error('Invalid file type. Only PDF and Word documents are allowed.'), false);
    }
});

async function getPdfJsDataUrls() {
    if (cachedPdfJsDataUrls) {
        return cachedPdfJsDataUrls;
    }

    const pdfJsBundlePath = resolvePdfJsAssetPath([
        'pdfjs-dist/build/pdf.min.mjs',
        'pdfjs-dist/legacy/build/pdf.min.mjs'
    ]);
    const pdfJsWorkerBundlePath = resolvePdfJsAssetPath([
        'pdfjs-dist/build/pdf.worker.min.mjs',
        'pdfjs-dist/legacy/build/pdf.worker.min.mjs'
    ]);

    const [pdfJsSource, pdfWorkerSource] = await Promise.all([
        fs.readFile(pdfJsBundlePath, 'utf8'),
        fs.readFile(pdfJsWorkerBundlePath, 'utf8')
    ]);

    cachedPdfJsDataUrls = {
        pdfJsModuleUrl: `data:text/javascript;base64,${Buffer.from(pdfJsSource, 'utf8').toString('base64')}`,
        pdfJsWorkerUrl: `data:text/javascript;base64,${Buffer.from(pdfWorkerSource, 'utf8').toString('base64')}`
    };

    return cachedPdfJsDataUrls;
}

async function extractDocxAssets(buffer) {
    const JSZip = (await import('jszip')).default;
    const extractedImages = [];
    let extractedStyles = { colors: [], fonts: [] };

    try {
        const zip = await JSZip.loadAsync(buffer);
        const stylesFile = zip.file('word/styles.xml');
        if (stylesFile) {
            const stylesXml = await stylesFile.async('string');
            extractedStyles = parseDocxStyles(stylesXml);
        }

        const mediaFiles = Object.keys(zip.files).filter((name) => name.startsWith('word/media/'));
        for (const mediaPath of mediaFiles) {
            const file = zip.file(mediaPath);
            if (!file) {
                continue;
            }
            const imageData = await file.async('base64');
            extractedImages.push(buildDocxExtractedImage(mediaPath, imageData));
        }
    } catch (error) {
        safeLog('warn', 'Could not extract DOCX assets for template extraction', { error: error.message });
    }

    return { extractedImages, extractedStyles };
}

async function extractImagesFromPDF(buffer) {
    const extractedImages = [];
    try {
        const { PDFDocument } = await import('pdf-lib');
        const pdfDoc = await PDFDocument.load(buffer);
        const pdfObjects = pdfDoc.context.indirectObjects;

        for (const [_ref, obj] of pdfObjects) {
            if (!obj || !obj.dict) {
                continue;
            }
            try {
                const subtype = obj.dict.get(pdfDoc.context.obj('/Subtype'));
                if (!subtype || subtype.toString() !== '/Image') {
                    continue;
                }

                const width = obj.dict.get(pdfDoc.context.obj('/Width'));
                const height = obj.dict.get(pdfDoc.context.obj('/Height'));
                const stream = obj.getContents ? obj.getContents() : null;

                if (!width || !height || !stream || stream.length <= 100) {
                    continue;
                }

                const descriptor = buildPdfImageDescriptor({
                    index: extractedImages.length + 1,
                    stream,
                    width,
                    height
                });
                if (descriptor) {
                    extractedImages.push(descriptor);
                }
            } catch (objectError) {
                safeLog('debug', 'Could not process PDF object for template image extraction', { error: objectError.message });
            }
        }
    } catch (error) {
        safeLog('warn', 'PDF image extraction failed', { error: error.message });
    }

    return extractedImages;
}

async function extractPdfText(buffer, fileName) {
    try {
        const pdfParseModule = await import('pdf-parse');
        const pdfParse = resolvePdfParseFunction(pdfParseModule);
        if (!pdfParse) {
            throw new Error('pdf-parse module does not expose a callable parser');
        }
        const pdfData = await pdfParse(buffer);
        return pdfData?.text || '';
    } catch (error) {
        safeLog('warn', 'pdf-parse extraction failed, falling back to pdfjs-dist', {
            fileName,
            error: error.message
        });
        return extractTextFromPDFBuffer(buffer);
    }
}

async function renderPdfToFirstPageImage(buffer) {
    let browser = null;
    try {
        const { pdfJsModuleUrl, pdfJsWorkerUrl } = await getPdfJsDataUrls();
        browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage'
            ]
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1200, height: 1600, deviceScaleFactor: 2 });

        const pdfBase64 = buffer.toString('base64');
        await page.setContent(`
            <!DOCTYPE html>
            <html>
            <body style="margin:0;padding:0;background:white">
                <div id="status" style="position:absolute;top:10px;left:10px;font-family:monospace">Loading PDF...</div>
                <canvas id="canvas"></canvas>
                <script type="module">
                    import * as pdfjsLib from '${pdfJsModuleUrl}';
                    pdfjsLib.GlobalWorkerOptions.workerSrc = '${pdfJsWorkerUrl}';
                    const pdfData = atob('${pdfBase64}');
                    const pdfArray = new Uint8Array(pdfData.length);
                    for (let i = 0; i < pdfData.length; i++) {
                        pdfArray[i] = pdfData.charCodeAt(i);
                    }
                    const loadingTask = pdfjsLib.getDocument({ data: pdfArray });
                    const pdf = await loadingTask.promise;
                    const pdfPage = await pdf.getPage(1);
                    const viewport = pdfPage.getViewport({ scale: 2 });
                    const canvas = document.getElementById('canvas');
                    const context = canvas.getContext('2d');
                    canvas.width = viewport.width;
                    canvas.height = viewport.height;
                    await pdfPage.render({ canvasContext: context, viewport }).promise;
                    window.pdfRendered = true;
                </script>
            </body>
            </html>
        `, { waitUntil: 'networkidle0', timeout: 60000 });

        await page.waitForFunction(() => window.pdfRendered === true, { timeout: 120000 });
        const canvas = await page.$('#canvas');
        const imageBuffer = await canvas.screenshot({ type: 'png' });
        return imageBuffer.toString('base64');
    } finally {
        if (browser) {
            await browser.close().catch(() => {});
        }
    }
}

async function extractFromPdfWithLayout(buffer, fileName, extractedImages = [], extractedStyles = {}, options = {}) {
    const textContent = await extractPdfText(buffer, fileName);
    const layoutAnalysis = await extractStructuredPdfTemplateInput(buffer);

    safeLog('info', 'PDF layout extracted for template generation', {
        fileName,
        textLength: textContent.length,
        layoutMetrics: layoutAnalysis.metrics
    });

    const result = await extractTemplateFromHTML(
        layoutAnalysis.pageHtml,
        extractedImages,
        fileName,
        {
            colors: Array.from(new Set([
                ...(extractedStyles.colors || []),
                ...(layoutAnalysis.extractedColors || [])
            ])).slice(0, 12),
            fonts: Array.from(new Set([
                ...(extractedStyles.fonts || []),
                ...(layoutAnalysis.extractedFonts || [])
            ])).slice(0, 12)
        },
        {
            maxTokens: options.maxTokens,
            layoutAnalysis
        }
    );

    if (layoutAnalysis.extractedColors?.length > 0 && !result.template.extractedColors?.length) {
        result.template.extractedColors = layoutAnalysis.extractedColors;
    }
    if (layoutAnalysis.extractedFonts?.length > 0 && !result.template.extractedFonts?.length) {
        result.template.extractedFonts = layoutAnalysis.extractedFonts;
    }

    return {
        ...result,
        textContent,
        layoutAnalysis
    };
}

async function extractFromPdfWithVision(buffer, fileName, extractedImages = [], options = {}) {
    const textContent = await extractPdfText(buffer, fileName);
    const imageBase64 = await renderPdfToFirstPageImage(buffer);
    const result = await extractTemplateFromImage(imageBase64, textContent, fileName, extractedImages, options);
    return {
        ...result,
        textContent
    };
}

async function extractFromOfficeDocument(buffer, fileName, mimeType, options = {}) {
    const docxAssets = mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ? await extractDocxAssets(buffer)
        : { extractedImages: [], extractedStyles: { colors: [], fonts: [] } };

    const pdfBuffer = await convertWordBufferToPdfBuffer(buffer, { fileName, mimeType });
    const result = await extractFromPdfWithLayout(
        pdfBuffer,
        fileName,
        docxAssets.extractedImages,
        docxAssets.extractedStyles,
        options
    );

    result.extractionMethod = 'office-pdf-layout-html';
    injectDocxExtractedImages(result.template, docxAssets.extractedImages);
    if (docxAssets.extractedStyles.colors.length > 0 && !result.template.extractedColors?.length) {
        result.template.extractedColors = docxAssets.extractedStyles.colors;
    }
    if (docxAssets.extractedStyles.fonts.length > 0 && !result.template.extractedFonts?.length) {
        result.template.extractedFonts = docxAssets.extractedStyles.fonts;
    }
    return attachExtractionReview(result, {
        extractionMethod: result.extractionMethod,
        layoutAnalysis: result.layoutAnalysis,
        extractedImages: docxAssets.extractedImages,
        textContent: result.textContent || ''
    });
}

async function extractFromPDF(buffer, fileName, options = {}) {
    const extractedImages = await extractImagesFromPDF(buffer);

    try {
        const layoutResult = await extractFromPdfWithLayout(buffer, fileName, extractedImages, {}, options);
        if ((layoutResult.layoutAnalysis?.metrics?.totalTextCharacters || 0) < MIN_LAYOUT_TEXT_CHARACTERS) {
            throw new Error('PDF layout extraction produced too little text for reliable template generation');
        }

        layoutResult.extractionMethod = 'pdf-layout-html';
        if (extractedImages.length > 0 && injectPdfExtractedLogo(layoutResult.template, extractedImages[0])) {
            safeLog('info', 'Injected extracted PDF logo into layout-based template');
        }
        return attachExtractionReview(layoutResult, {
            extractionMethod: layoutResult.extractionMethod,
            layoutAnalysis: layoutResult.layoutAnalysis,
            extractedImages,
            textContent: layoutResult.textContent || ''
        });
    } catch (error) {
        safeLog('warn', 'Structured PDF layout extraction failed, falling back to vision', {
            fileName,
            error: error.message
        });

        try {
            const visionResult = await extractFromPdfWithVision(buffer, fileName, extractedImages, options);
            visionResult.extractionMethod = 'pdf-vision-fallback';
            if (extractedImages.length > 0) {
                injectPdfExtractedLogo(visionResult.template, extractedImages[0]);
            }
            return attachExtractionReview(visionResult, {
                extractionMethod: visionResult.extractionMethod,
                layoutAnalysis: null,
                extractedImages,
                textContent: visionResult.textContent || ''
            });
        } catch (visionError) {
            safeLog('error', 'PDF vision extraction failed', { fileName, error: visionError.message });
            const fallbackText = await extractPdfText(buffer, fileName);
            if (fallbackText && fallbackText.trim().length > 50) {
                const legacyResult = await extractTemplateFromCV(fallbackText, fileName, options);
                legacyResult.extractionMethod = 'pdf-text-fallback';
                return attachExtractionReview(legacyResult, {
                    extractionMethod: legacyResult.extractionMethod,
                    layoutAnalysis: null,
                    extractedImages,
                    textContent: fallbackText
                });
            }
            throw visionError;
        }
    }
}

async function extractFromDOCX(buffer, fileName, options = {}) {
    const mimeType = fileName.toLowerCase().endsWith('.doc')
        ? 'application/msword'
        : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    return extractFromOfficeDocument(buffer, fileName, mimeType, options);
}

export {
    extractFromDOCX,
    extractFromPDF,
    upload
};
