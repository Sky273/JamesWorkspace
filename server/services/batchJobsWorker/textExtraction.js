/**
 * Batch Jobs Worker - Text Extraction
 * Extract text from PDF, DOCX, and DOC file buffers
 */

import { safeLog } from '../../utils/logger.backend.js';
import { loadPdfDocument } from '../../utils/pdfjs.server.js';

/**
 * Extract text from PDF using pdfjs-dist (more reliable than pdf-parse)
 * Improved to better preserve structure, trigrams, and candidate names
 */
export async function extractTextFromPDFBuffer(buffer) {
    // Convert Buffer to Uint8Array (required by pdfjs-dist)
    const uint8Array = new Uint8Array(buffer);
    
    // Load the PDF document
    const loadingTask = await loadPdfDocument(uint8Array);
    const pdf = await loadingTask.promise;
    
    let fullText = '';
    
    // Extract text from each page with improved structure preservation
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        
        // Group text items by their vertical position (Y coordinate) to preserve lines
        const lines = [];
        let currentLine = [];
        let lastY = null;
        const Y_THRESHOLD = 5; // Pixels threshold to consider same line
        
        for (const item of textContent.items) {
            const y = item.transform ? item.transform[5] : 0;
            
            // If Y position changed significantly, start a new line
            if (lastY !== null && Math.abs(y - lastY) > Y_THRESHOLD) {
                if (currentLine.length > 0) {
                    lines.push(currentLine);
                    currentLine = [];
                }
            }
            
            // Add item to current line (preserve the text as-is, including trigrams)
            if (item.str && item.str.trim()) {
                currentLine.push(item.str);
            }
            lastY = y;
        }
        
        // Don't forget the last line
        if (currentLine.length > 0) {
            lines.push(currentLine);
        }
        
        // Join items within each line with space, join lines with newline
        const pageText = lines
            .map(line => line.join(' '))
            .join('\n');
        
        fullText += pageText + '\n\n';
    }
    
    // Clean up excessive whitespace while preserving structure
    fullText = fullText
        .replace(/[ \t]+/g, ' ')           // Multiple spaces to single space
        .replace(/\n{3,}/g, '\n\n')        // Max 2 consecutive newlines
        .trim();
    
    return fullText;
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
        return result.value;
    } else if (mimeType === 'application/msword') {
        // word-extractor is CommonJS
        const { createRequire } = await import('module');
        const require = createRequire(import.meta.url);
        const WordExtractor = require('word-extractor');
        const extractor = new WordExtractor();
        const doc = await extractor.extract(buffer);
        return doc.getBody();
    }
    throw new Error(`Unsupported file type: ${mimeType}`);
}
