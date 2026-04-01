import fs from 'fs/promises';
import { safeLog } from '../../../utils/logger.backend.js';
import { metrics } from '../../../services/metrics.service.js';
import { extractPdfTextWithOcr } from '../../../services/pdfTextExtraction.service.js';
import { cleanExtractedResumeText } from '../../../services/ocrTextCleanup.service.js';
import { extractTextFromWordBuffer } from '../../../services/wordTextExtraction.service.js';
import { isValidFileSignature } from '../../../utils/fileSignature.js';
import {
    MAX_OCR_RENDER_PIXELS,
    MAX_PDF_EXTRACTION_PAGES,
    MAX_SCANNED_OCR_PAGES,
    PDF_EXTRACTION_MAX_CONCURRENCY,
    cleanupTempFile,
    getActivePdfExtractionCountForUser,
    getPdfExtractionUserKey,
    releasePdfExtractionSlot,
    tryAcquirePdfExtractionSlot
} from './helpers.js';

function createExtractDocHandler() {
    return async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ error: 'No file uploaded' });
            }

            const fileBuffer = await fs.readFile(req.file.path);
            if (!isValidFileSignature(fileBuffer, req.file.mimetype || 'application/msword')) {
                await cleanupTempFile(req.file.path);
                return res.status(400).json({ error: 'Invalid DOC file contents.' });
            }
            const extractionResult = await extractTextFromWordBuffer(fileBuffer, {
                fileName: req.file.originalname,
                mimeType: req.file.mimetype || 'application/msword',
                minTextLength: 10,
                pdfOcrOptions: {
                    maxPdfPages: MAX_PDF_EXTRACTION_PAGES,
                    maxScannedOcrPages: MAX_SCANNED_OCR_PAGES,
                    maxOcrRenderPixels: MAX_OCR_RENDER_PIXELS,
                    forceDocumentOcrTextLength: 10
                }
            });
            const { text, metadata: textCleanupMetadata } = cleanExtractedResumeText(extractionResult.text, {
                ocrUsed: !!extractionResult.ocrUsed
            });

            safeLog('info', 'Completed Word text extraction', {
                fileName: req.file.originalname,
                mimeType: req.file.mimetype,
                textLength: text.length,
                ocrUsed: extractionResult.ocrUsed,
                ocrPageCount: extractionResult.ocrPageCount,
                textCleanupChanged: textCleanupMetadata.changed
            });

            await cleanupTempFile(req.file.path);
            metrics.trackUploadActivity({
                endpoint: 'extract-doc',
                fileSize: req.file.size,
                mimeType: req.file.mimetype || 'application/msword',
                success: true,
                metadata: {
                    textLength: text.length,
                    ocrUsed: extractionResult.ocrUsed,
                    ocrPageCount: extractionResult.ocrPageCount || 0
                }
            });

            if (extractionResult.ocrUsed) {
                metrics.trackOcrActivity({
                    pages: extractionResult.pages || 0,
                    ocrPageCount: extractionResult.ocrPageCount || 0,
                    failedPages: extractionResult.failedOcrPages || 0,
                    avgConfidence: extractionResult.avgOcrConfidence ?? null,
                    success: !extractionResult.failedOcrPages,
                    metadata: {
                        source: 'extract-doc',
                        fileName: req.file.originalname,
                        engine: extractionResult.primaryResult?.engine || null,
                        variant: extractionResult.primaryResult?.variant || null,
                        psm: extractionResult.primaryResult?.psm || null
                    }
                });
            }

            if (!text || text.length < 10) {
                return res.status(400).json({
                    error: 'Could not extract meaningful text from the DOC file. The file may be empty or corrupted.'
                });
            }

            return res.json({
                text,
                ocrUsed: extractionResult.ocrUsed,
                ocrPageCount: extractionResult.ocrPageCount || 0,
                avgOcrConfidence: extractionResult.avgOcrConfidence ?? null
            });
        } catch (error) {
            await cleanupTempFile(req.file?.path);
            if (req.file) {
                metrics.trackUploadActivity({
                    endpoint: 'extract-doc',
                    fileSize: req.file.size,
                    mimeType: req.file.mimetype || 'application/msword',
                    success: false,
                    metadata: { error: error.message }
                });
            }
            safeLog('error', 'Error extracting text from DOC', { error: error.message });
            return res.status(500).json({ error: 'Failed to extract text from DOC file' });
        }
    };
}

function createExtractPdfHandler() {
    return async (req, res) => {
        let pdfExtractionSlotAcquired = false;
        const pdfExtractionUserKey = getPdfExtractionUserKey(req);

        try {
            if (!req.file) {
                return res.status(400).json({ error: 'No file uploaded' });
            }

            if (!tryAcquirePdfExtractionSlot(pdfExtractionUserKey)) {
                const activeExtractionsForUser = getActivePdfExtractionCountForUser(pdfExtractionUserKey);
                await cleanupTempFile(req.file.path);
                metrics.trackUploadActivity({
                    endpoint: 'extract-pdf',
                    fileSize: req.file.size,
                    mimeType: req.file.mimetype || 'application/pdf',
                    success: false,
                    metadata: {
                        error: 'PDF extraction concurrency limit reached',
                        userId: pdfExtractionUserKey,
                        activeExtractionsForUser,
                        maxConcurrentExtractionsPerUser: PDF_EXTRACTION_MAX_CONCURRENCY
                    }
                });
                safeLog('warn', 'Rejecting PDF extraction because the user reached the concurrency limit', {
                    fileName: req.file.originalname,
                    userId: pdfExtractionUserKey,
                    activeExtractionsForUser,
                    maxConcurrentExtractionsPerUser: PDF_EXTRACTION_MAX_CONCURRENCY
                });
                return res.status(503).json({
                    error: 'PDF extraction is temporarily saturated for this user. Please retry in a few moments.',
                    retryable: true
                });
            }

            pdfExtractionSlotAcquired = true;
            const fileBuffer = await fs.readFile(req.file.path);
            if (!isValidFileSignature(fileBuffer, req.file.mimetype || 'application/pdf')) {
                await cleanupTempFile(req.file.path);
                return res.status(400).json({ error: 'Invalid PDF file contents.' });
            }
            const startTime = Date.now();

            safeLog('info', 'Starting server-side PDF extraction', {
                fileName: req.file.originalname,
                fileSize: fileBuffer.length
            });

            const result = await extractPdfTextWithOcr(fileBuffer, {
                maxPdfPages: MAX_PDF_EXTRACTION_PAGES,
                maxScannedOcrPages: MAX_SCANNED_OCR_PAGES,
                maxOcrRenderPixels: MAX_OCR_RENDER_PIXELS,
                forceDocumentOcrTextLength: 50,
                onOcrProgress: ({ pageNum, progress }) => {
                    safeLog('debug', `OCR progress page ${pageNum}: ${(progress * 100).toFixed(0)}%`);
                },
                onOcrPageDetected: ({ pageNum, totalTextLength }) => {
                    safeLog('info', `Page ${pageNum} appears to be scanned (${totalTextLength} chars), using OCR...`, {
                        fileName: req.file.originalname
                    });
                },
                onOcrPageCompleted: ({ pageNum, confidence, textLength, engine, psm }) => {
                    safeLog('info', `OCR completed for page ${pageNum}`, {
                        engine,
                        psm,
                        confidence: confidence?.toFixed(2),
                        textLength
                    });
                },
                onOcrPageFailed: ({ pageNum, error, confidence, textLength, variant, engine, psm }) => {
                    safeLog(error === 'OCR returned insufficient text' ? 'warn' : 'error', `OCR issue on page ${pageNum}`, {
                        error,
                        variant,
                        engine,
                        psm,
                        confidence: confidence?.toFixed?.(2) || confidence || 'N/A',
                        textLength: textLength || 0
                    });
                },
                onOcrVariantAttempt: ({ pageNum, variant, confidence, textLength, engine, psm }) => {
                    safeLog(textLength > 0 ? 'info' : 'debug', `OCR variant evaluated on page ${pageNum}`, {
                        variant,
                        engine,
                        psm,
                        confidence: confidence?.toFixed?.(2) || confidence || 'N/A',
                        textLength: textLength || 0
                    });
                }
            });

            const {
                text: fullText,
                pages: numPages,
                ocrUsed,
                ocrPageCount,
                failedOcrPages,
                avgOcrConfidence
            } = result;

            await cleanupTempFile(req.file.path);

            const { text: cleanedText } = cleanExtractedResumeText(fullText, { ocrUsed });
            const extractionTime = Date.now() - startTime;
            const roundedAvgOcrConfidence = avgOcrConfidence !== null ? avgOcrConfidence.toFixed(2) : null;

            metrics.trackUploadActivity({
                endpoint: 'extract-pdf',
                fileSize: req.file.size,
                mimeType: req.file.mimetype || 'application/pdf',
                success: true,
                metadata: { pages: numPages, ocrUsed, ocrPageCount, extractionTimeMs: extractionTime }
            });
            if (ocrUsed) {
                metrics.trackOcrActivity({
                    pages: numPages,
                    ocrPageCount,
                    failedPages: failedOcrPages,
                    avgConfidence: roundedAvgOcrConfidence ? Number(roundedAvgOcrConfidence) : null,
                    extractionTimeMs: extractionTime,
                    success: failedOcrPages === 0,
                    metadata: {
                        source: 'extract-pdf',
                        fileName: req.file.originalname,
                        engine: result.primaryResult?.engine || null,
                        variant: result.primaryResult?.variant || null,
                        psm: result.primaryResult?.psm || null,
                        textLength: result.primaryResult?.textLength || 0,
                        recentResults: Array.isArray(result.recentResults)
                            ? result.recentResults.slice(-5)
                            : []
                    }
                });
            }

            safeLog('info', 'PDF extraction completed', {
                fileName: req.file.originalname,
                textLength: cleanedText.length,
                pages: numPages,
                ocrUsed,
                ocrPageCount,
                avgOcrConfidence: roundedAvgOcrConfidence,
                extractionTimeMs: extractionTime
            });

            if (!cleanedText || cleanedText.length < 10) {
                return res.status(400).json({
                    error: 'Could not extract meaningful text from the PDF file. The file may be empty, corrupted, or entirely scanned.',
                    ocrRequired: ocrUsed
                });
            }

            return res.json({
                text: cleanedText,
                pages: numPages,
                ocrUsed,
                ocrPageCount,
                avgOcrConfidence: roundedAvgOcrConfidence,
                extractionTimeMs: extractionTime
            });
        } catch (error) {
            await cleanupTempFile(req.file?.path);
            if (req.file) {
                metrics.trackUploadActivity({
                    endpoint: 'extract-pdf',
                    fileSize: req.file.size,
                    mimeType: req.file.mimetype || 'application/pdf',
                    success: false,
                    metadata: { error: error.message }
                });
                metrics.trackOcrActivity({
                    success: false,
                    metadata: { fileName: req.file.originalname, error: error.message }
                });
            }
            safeLog('error', 'Error extracting text from PDF', { error: error.message });
            return res.status(500).json({ error: 'Failed to extract text from PDF file' });
        } finally {
            if (pdfExtractionSlotAcquired) {
                releasePdfExtractionSlot(pdfExtractionUserKey);
            }
        }
    };
}

export {
    createExtractDocHandler,
    createExtractPdfHandler
};
