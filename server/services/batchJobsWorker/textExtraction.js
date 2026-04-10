/**
 * Batch Jobs Worker - Text Extraction
 * Extract text from PDF, DOCX, and DOC file buffers
 */

import { safeLog } from '../../utils/logger.backend.js';
import { extractPdfTextWithOcr } from '../pdfTextExtraction.service.js';
import { extractTextFromWordBuffer } from '../wordTextExtraction.service.js';

let lastBatchTextExtractionSummary = null;

function updateLastBatchTextExtractionSummary(summary) {
    lastBatchTextExtractionSummary = {
        timestamp: new Date().toISOString(),
        ...summary
    };
}

/**
 * Extract text from PDF using pdfjs-dist (more reliable than pdf-parse)
 * Improved to better preserve structure, trigrams, and candidate names
 */
export async function extractTextFromPDFBuffer(buffer) {
    const startedAt = Date.now();
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
        avgOcrConfidence: result.avgOcrConfidence,
        durationMs: Date.now() - startedAt
    });
    updateLastBatchTextExtractionSummary({
        operation: 'extractTextFromPDFBuffer',
        kind: 'pdf',
        status: 'completed',
        textLength: result.text?.length || 0,
        ocrUsed: Boolean(result.ocrUsed),
        pages: result.pages,
        ocrPageCount: result.ocrPageCount,
        failedOcrPages: result.failedOcrPages,
        durationMs: Date.now() - startedAt
    });
    return result;
}

/**
 * Extract text from file buffer
 */
export async function extractTextFromBuffer(buffer, mimeType, fileName) {
    const startedAt = Date.now();
    // Use pdfjs-dist for PDF, mammoth for DOCX, word-extractor for DOC
    if (mimeType === 'application/pdf') {
        try {
            const result = await extractTextFromPDFBuffer(buffer);
            safeLog('info', 'Batch file extraction completed', {
                fileName,
                mimeType,
                textLength: result.text?.length || 0,
                ocrUsed: Boolean(result.ocrUsed),
                durationMs: Date.now() - startedAt
            });
            return result;
        } catch (pdfError) {
            safeLog('error', 'PDF extraction with pdfjs-dist failed', { error: pdfError.message, fileName });
            updateLastBatchTextExtractionSummary({
                operation: 'extractTextFromBuffer',
                kind: 'pdf',
                status: 'failed',
                fileName,
                mimeType,
                error: pdfError.message,
                durationMs: Date.now() - startedAt
            });
            throw new Error(`Failed to extract text from PDF: ${pdfError.message}`);
        }
    } else if (
        mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        || mimeType === 'application/msword'
    ) {
        const result = await extractTextFromWordBuffer(buffer, {
            mimeType,
            fileName
        });
        safeLog('info', 'Batch file extraction completed', {
            fileName,
            mimeType,
            textLength: result.text?.length || 0,
            ocrUsed: Boolean(result.ocrUsed),
            durationMs: Date.now() - startedAt
        });
        updateLastBatchTextExtractionSummary({
            operation: 'extractTextFromBuffer',
            kind: mimeType === 'application/msword' ? 'doc' : 'docx',
            status: 'completed',
            fileName,
            mimeType,
            textLength: result.text?.length || 0,
            ocrUsed: Boolean(result.ocrUsed),
            durationMs: Date.now() - startedAt
        });
        return result;
    }
    throw new Error(`Unsupported file type: ${mimeType}`);
}

export function getLastBatchTextExtractionSummary() {
    return lastBatchTextExtractionSummary;
}
