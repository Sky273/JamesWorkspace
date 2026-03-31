/**
 * Batch Jobs Worker - Text Extraction
 * Extract text from PDF, DOCX, and DOC file buffers
 */

import { safeLog } from '../../utils/logger.backend.js';
import { extractPdfTextWithOcr } from '../pdfTextExtraction.service.js';

/**
 * Extract text from PDF using pdfjs-dist (more reliable than pdf-parse)
 * Improved to better preserve structure, trigrams, and candidate names
 */
export async function extractTextFromPDFBuffer(buffer) {
    const result = await extractPdfTextWithOcr(buffer, {
        forceDocumentOcrTextLength: 50,
        onOcrVariantAttempt: ({ pageNum, variant, confidence, textLength, engine, psm }) => {
            safeLog(textLength > 0 ? 'info' : 'debug', 'Batch OCR variant evaluated', {
                pageNum,
                variant,
                engine,
                psm,
                confidence,
                textLength
            });
        },
        onOcrPageDetected: ({ pageNum, totalTextLength, itemCount }) => {
            safeLog('info', 'Batch OCR page detected', {
                pageNum,
                totalTextLength,
                itemCount
            });
        },
        onOcrPageFailed: ({ pageNum, error, confidence, textLength, variant, engine, psm }) => {
            safeLog('error', 'Batch OCR page failed', {
                pageNum,
                error,
                confidence,
                textLength,
                variant,
                engine,
                psm
            });
        },
        onOcrPageCompleted: ({ pageNum, confidence, textLength, variant, engine, psm }) => {
            safeLog('info', 'Batch OCR page completed', {
                pageNum,
                confidence,
                textLength,
                variant,
                engine,
                psm
            });
        }
    });
    safeLog('info', 'Batch PDF extraction completed', {
        textLength: result.text?.length || 0,
        pages: result.pages,
        ocrUsed: result.ocrUsed,
        ocrPageCount: result.ocrPageCount,
        failedOcrPages: result.failedOcrPages,
        avgOcrConfidence: result.avgOcrConfidence
    });
    return result;
}

/**
 * Extract text from file buffer
 */
export async function extractTextFromBuffer(buffer, mimeType, fileName) {
    // Use pdfjs-dist for PDF, mammoth for DOCX, word-extractor for DOC
    if (mimeType === 'application/pdf') {
        try {
            return await extractTextFromPDFBuffer(buffer);
        } catch (pdfError) {
            safeLog('error', 'PDF extraction with pdfjs-dist failed', { error: pdfError.message, fileName });
            throw new Error(`Failed to extract text from PDF: ${pdfError.message}`);
        }
    } else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        const mammoth = await import('mammoth');
        const result = await mammoth.extractRawText({ buffer });
        return {
            text: result.value,
            ocrUsed: false,
            ocrPageCount: 0,
            failedOcrPages: 0,
            avgOcrConfidence: null
        };
    } else if (mimeType === 'application/msword') {
        // word-extractor is CommonJS
        const { createRequire } = await import('module');
        const require = createRequire(import.meta.url);
        const WordExtractor = require('word-extractor');
        const extractor = new WordExtractor();
        const doc = await extractor.extract(buffer);
        return {
            text: doc.getBody(),
            ocrUsed: false,
            ocrPageCount: 0,
            failedOcrPages: 0,
            avgOcrConfidence: null
        };
    }
    throw new Error(`Unsupported file type: ${mimeType}`);
}
