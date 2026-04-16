import multer from 'multer';
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

const MIN_LAYOUT_TEXT_CHARACTERS = 80;
let cachedPdfJsModules = null;

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

async function getPdfJsModules() {
    if (cachedPdfJsModules) {
        return cachedPdfJsModules;
    }

    const candidates = [
        'pdfjs-dist/legacy/build/pdf.mjs',
        'pdfjs-dist/build/pdf.mjs',
        'pdfjs-dist/legacy/build/pdf.min.mjs',
        'pdfjs-dist/build/pdf.min.mjs'
    ];

    let pdfJsModule = null;
    let lastError = null;
    for (const candidate of candidates) {
        try {
            pdfJsModule = await import(candidate);
            break;
        } catch (error) {
            lastError = error;
        }
    }

    if (!pdfJsModule) {
        throw lastError || new Error('Unable to load pdfjs-dist module for PDF rendering');
    }

    cachedPdfJsModules = {
        pdfJsModule
    };

    return cachedPdfJsModules;
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
        const fallbackResult = await extractTextFromPDFBuffer(buffer);
        return typeof fallbackResult === 'string'
            ? fallbackResult
            : (fallbackResult?.text || '');
    }
}

async function renderPdfToFirstPageImage(buffer) {
    const [{ createCanvas }, { pdfJsModule }] = await Promise.all([
        import('canvas'),
        getPdfJsModules()
    ]);

    const loadingTask = pdfJsModule.getDocument({
        data: new Uint8Array(buffer),
        disableWorker: true,
        useWorkerFetch: false,
        isEvalSupported: false,
        standardFontDataUrl: undefined
    });
    const pdfDocument = await loadingTask.promise;
    const pdfPage = await pdfDocument.getPage(1);
    const viewport = pdfPage.getViewport({ scale: 2 });
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    const context = canvas.getContext('2d');

    await pdfPage.render({
        canvasContext: context,
        viewport
    }).promise;

    const imageBuffer = canvas.toBuffer('image/png');

    await pdfDocument.destroy().catch(() => {});
    return imageBuffer.toString('base64');
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
