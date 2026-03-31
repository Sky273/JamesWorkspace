/**
 * Text Extraction Utilities
 * Functions for extracting text from PDF, DOCX, and DOC files
 * 
 * PDF extraction is now handled server-side to enable strict CSP without 'unsafe-eval'
 */

import logger from './logger.frontend';
import { fetchWithAuth, createAuthOptionsWithCsrf } from './apiInterceptor';

async function extractTextFromWordViaServer(file: File): Promise<string> {
    const formData = new FormData();
    formData.append('file', file);

    const options = await createAuthOptionsWithCsrf({
        method: 'POST',
        body: formData
    });

    if (options.headers) {
        delete options.headers['Content-Type'];
    }

    const response = await fetchWithAuth('/api/resumes/extract-doc', options);

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to extract text from Word file' }));
        throw new Error(errorData.error || 'Failed to extract text from Word file');
    }

    const { text } = await response.json();
    return text;
}

/**
 * Extract text from PDF using server-side extraction
 * This approach enables strict CSP without 'unsafe-eval'
 */
export async function extractTextFromPDF(file: File): Promise<string> {
    try {
        logger.log('Extracting text from PDF via server...', { fileName: file.name, fileSize: file.size });
        
        const formData = new FormData();
        formData.append('file', file);
        
        const options = await createAuthOptionsWithCsrf({
            method: 'POST',
            body: formData
        });
        
        // Remove Content-Type to let browser set it with boundary
        if (options.headers) {
            delete options.headers['Content-Type'];
        }
        
        const response = await fetchWithAuth('/api/resumes/extract-pdf', options);
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Failed to extract text from PDF' }));
            throw new Error(errorData.error || 'Failed to extract text from PDF file');
        }
        
        const { text, pages, ocrUsed, ocrPageCount, extractionTimeMs } = await response.json();
        
        if (ocrUsed) {
            logger.log(`PDF extraction completed via server with ${ocrPageCount} scanned pages`, {
                pages,
                textLength: text.length,
                extractionTimeMs
            });
        } else {
            logger.log(`Successfully extracted text from PDF via server`, {
                pages,
                textLength: text.length,
                extractionTimeMs
            });
        }
        
        return text;
    } catch (error) {
        logger.error('Error extracting text from PDF:', error);
        throw new Error(`Failed to extract text from PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Extract text from DOCX
 */
export async function extractTextFromDOCX(file: File): Promise<string> {
    try {
        logger.log('Extracting text from DOCX file via server...');
        const text = await extractTextFromWordViaServer(file);
        logger.log(`Successfully extracted ${text.length} characters from DOCX via server`);
        return text;
    } catch (error) {
        logger.error('Error extracting text from DOCX:', error);
        throw new Error(`Failed to extract text from DOCX: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Extract text from DOC (Word 97-2003)
 * Uses server-side extraction because word-extractor is a Node.js library
 * that doesn't work in browsers
 */
export async function extractTextFromDOC(file: File): Promise<string> {
    try {
        logger.log('Extracting text from DOC file (Word 97-2003) via server...');
        const text = await extractTextFromWordViaServer(file);
        logger.log(`Successfully extracted ${text.length} characters from DOC via server`);
        return text;
    } catch (error) {
        logger.error('Error extracting text from DOC:', error);
        throw new Error(`Failed to extract text from DOC: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
