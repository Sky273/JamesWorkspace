/**
 * Text Extraction Utilities
 * Functions for extracting text from PDF, DOCX, and DOC files
 */

import { loadPdfjs } from './lazyPdfjs.js';
import { createLazyWorker } from './lazyTesseract.js';
import mammoth from 'mammoth';
import logger from './logger.frontend';

// Lazy load word-extractor only when needed (it's a Node.js library with browser compatibility issues)
let WordExtractor = null;
const loadWordExtractor = async () => {
  if (!WordExtractor) {
    try {
      const module = await import('word-extractor');
      WordExtractor = module.default;
    } catch (error) {
      logger.warn('word-extractor not available, falling back to mammoth for .doc files');
      return null;
    }
  }
  return WordExtractor;
};

// PDF.js module reference (loaded lazily)
let pdfjsModule = null;
let workerInitialized = false;
let workerInstance = null;

/**
 * Initialize PDF.js worker
 */
export const initializePdfWorker = async () => {
  if (!workerInitialized) {
    try {
      pdfjsModule = await loadPdfjs();
      workerInitialized = true;
      logger.log('PDF.js worker initialized successfully (lazy loaded)');
    } catch (error) {
      logger.error('Error initializing PDF.js worker:', error);
      throw new Error('Failed to initialize PDF.js worker');
    }
  }
  return pdfjsModule;
};

/**
 * Cleanup PDF.js worker
 */
export const cleanupPdfWorker = () => {
  if (workerInstance) {
    workerInstance.terminate();
    workerInstance = null;
  }
  workerInitialized = false;
};

/**
 * Timeout helper to prevent infinite hangs
 */
export const withTimeout = (promise, ms, label) => {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
};

/**
 * Calculate adaptive timeout based on file size
 */
export const getAdaptiveTimeout = (fileSize, baseTimeout = 30000) => {
  const sizeBasedTimeout = baseTimeout + (fileSize / 1024) * 10;
  return Math.min(120000, sizeBasedTimeout);
};

/**
 * Check if PDF page contains actual text or is likely scanned
 */
export async function isPageScanned(page) {
  try {
    const content = await page.getTextContent();
    const textLength = content.items.reduce((sum, item) => sum + item.str.length, 0);
    const isScanned = textLength < 50 || content.items.length < 5;
    
    if (isScanned) {
      logger.log(`Page appears to be scanned (${textLength} chars, ${content.items.length} items)`);
    }
    
    return isScanned;
  } catch (error) {
    logger.error('Error checking if page is scanned:', error);
    return false;
  }
}

/**
 * Extract text from scanned PDF page using OCR
 */
export async function extractTextFromScannedPage(page, pageNumber, totalPages) {
  try {
    logger.log(`Starting OCR for page ${pageNumber}/${totalPages}...`);
    
    const viewport = page.getViewport({ scale: 2.0 });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    
    await page.render({
      canvasContext: context,
      viewport: viewport
    }).promise;
    
    const worker = await createLazyWorker('fra+eng');
    const { data: { text, confidence } } = await worker.recognize(canvas);
    await worker.terminate();
    
    logger.log(`OCR completed for page ${pageNumber} (confidence: ${confidence.toFixed(2)}%)`);
    
    return {
      text: text.trim(),
      confidence: confidence,
      method: 'ocr'
    };
  } catch (error) {
    logger.error(`Error performing OCR on page ${pageNumber}:`, error);
    return {
      text: '',
      confidence: 0,
      method: 'ocr',
      error: error.message
    };
  }
}

/**
 * Extract text from PDF with improved text ordering and OCR support
 */
export async function extractTextFromPDF(file) {
  let ocrUsed = false;
  let ocrPageCount = 0;
  let totalConfidence = 0;
  
  try {
    const pdfjs = await initializePdfWorker();
    
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjs.getDocument({
      data: arrayBuffer,
      useWorkerFetch: true,
      isEvalSupported: true,
      useSystemFonts: true
    });
    
    loadingTask.onProgress = (progress) => {
      if (progress.total > 0) {
        const percent = (progress.loaded / progress.total) * 100;
        logger.log(`PDF Loading progress: ${percent.toFixed(1)}%`);
      }
    };
    
    const loadTimeout = getAdaptiveTimeout(file.size, 30000);
    logger.log(`Using ${loadTimeout}ms timeout for PDF load`);
    const pdf = await withTimeout(loadingTask.promise, loadTimeout, 'PDF load');
    
    let text = '';
    const numPages = pdf.numPages;
    logger.log(`PDF has ${numPages} pages`);

    for (let i = 1; i <= numPages; i++) {
      try {
        logger.log(`Processing page ${i} of ${numPages}`);
        const page = await pdf.getPage(i);
        
        const isScanned = await isPageScanned(page);
        
        if (isScanned) {
          logger.log(`Page ${i} is scanned, using OCR...`);
          const ocrResult = await extractTextFromScannedPage(page, i, numPages);
          
          if (ocrResult.text && ocrResult.text.length > 20) {
            text += ocrResult.text + '\n\n';
            ocrUsed = true;
            ocrPageCount++;
            totalConfidence += ocrResult.confidence || 0;
          } else {
            logger.warn(`OCR returned insufficient text for page ${i}`);
            text += `[Page ${i}: OCR failed or insufficient text]\n\n`;
          }
        } else {
          const pageTimeout = getAdaptiveTimeout(file.size / numPages, 15000);
          const content = await withTimeout(page.getTextContent(), pageTimeout, `PDF page ${i} text extraction`);
          
          const sortedItems = content.items.sort((a, b) => {
            const yDiff = Math.abs(a.transform[5] - b.transform[5]);
            if (yDiff < 5) {
              return a.transform[4] - b.transform[4];
            }
            return b.transform[5] - a.transform[5];
          });
          
          let currentY = null;
          let lineText = '';
          
          for (const item of sortedItems) {
            const y = item.transform[5];
            const str = item.str;
            
            if (currentY !== null && Math.abs(y - currentY) > 5) {
              if (lineText.trim()) {
                text += lineText.trim() + '\n';
              }
              lineText = '';
            }
            
            if (lineText && !lineText.endsWith(' ') && !str.startsWith(' ')) {
              lineText += ' ';
            }
            lineText += str;
            currentY = y;
          }
          
          if (lineText.trim()) {
            text += lineText.trim() + '\n';
          }
          text += '\n';
        }
        
        page.cleanup();
      } catch (pageError) {
        logger.error(`Error processing page ${i}:`, pageError);
        text += `[Page ${i}: Extraction failed - ${pageError.message}]\n\n`;
        continue;
      }
    }

    pdf.destroy();
    
    if (ocrUsed) {
      const avgConfidence = ocrPageCount > 0 ? (totalConfidence / ocrPageCount).toFixed(2) : 0;
      logger.log(`PDF extraction completed with OCR on ${ocrPageCount}/${numPages} pages (avg confidence: ${avgConfidence}%)`);
    } else {
      logger.log('Successfully extracted text from PDF (no OCR needed)');
    }
    
    return text.trim();
  } catch (error) {
    logger.error('Error extracting text from PDF:', error);
    throw error;
  } finally {
    cleanupPdfWorker();
  }
}

/**
 * Extract text from DOCX
 */
export async function extractTextFromDOCX(file) {
  try {
    logger.log('Extracting text from DOCX file...');
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    const text = result.value.trim();
    logger.log(`Successfully extracted ${text.length} characters from DOCX`);
    return text;
  } catch (error) {
    logger.error('Error extracting text from DOCX:', error);
    throw new Error(`Failed to extract text from DOCX: ${error.message}`);
  }
}

/**
 * Extract text from DOC (Word 97-2003)
 * Falls back to mammoth if word-extractor is not available
 */
export async function extractTextFromDOC(file) {
  try {
    logger.log('Extracting text from DOC file (Word 97-2003)...');
    
    // Try to load word-extractor dynamically
    const WordExtractorClass = await loadWordExtractor();
    
    if (WordExtractorClass) {
      const extractor = new WordExtractorClass();
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      const extracted = await extractor.extract(buffer);
      const text = extracted.getBody().trim();
      logger.log(`Successfully extracted ${text.length} characters from DOC using word-extractor`);
      return text;
    } else {
      // Fallback to mammoth for .doc files (may have limited support)
      logger.log('Falling back to mammoth for DOC extraction...');
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      const text = result.value.trim();
      logger.log(`Successfully extracted ${text.length} characters from DOC using mammoth`);
      return text;
    }
  } catch (error) {
    logger.error('Error extracting text from DOC:', error);
    throw new Error(`Failed to extract text from DOC: ${error.message}`);
  }
}
