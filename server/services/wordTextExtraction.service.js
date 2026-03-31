import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { extractPdfTextWithOcr } from './pdfTextExtraction.service.js';

const execFileAsync = promisify(execFile);
const DOCX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const DOC_MIME_TYPE = 'application/msword';
const DEFAULT_MIN_WORD_TEXT_LENGTH = 50;

let cachedSofficeAvailability = null;

function resetWordTextExtractionCaches() {
    cachedSofficeAvailability = null;
}

function normalizeWordText(text) {
    return (text || '').replace(/\r\n/g, '\n').trim();
}

async function hasSofficeCli() {
    if (cachedSofficeAvailability !== null) {
        return cachedSofficeAvailability;
    }

    try {
        await execFileAsync('soffice', ['--version'], { windowsHide: true });
        cachedSofficeAvailability = true;
    } catch {
        cachedSofficeAvailability = false;
    }

    return cachedSofficeAvailability;
}

async function getWordExtractionRuntimeDiagnostics() {
    const sofficeAvailable = await hasSofficeCli();

    return {
        sofficeAvailable,
        wordOcrFallbackAvailable: sofficeAvailable,
        notes: sofficeAvailable
            ? 'LibreOffice CLI available for Word to PDF OCR fallback'
            : 'LibreOffice CLI unavailable; Word OCR fallback disabled'
    };
}

async function extractNativeWordText(buffer, mimeType) {
    if (mimeType === DOCX_MIME_TYPE) {
        const mammoth = await import('mammoth');
        const result = await mammoth.extractRawText({ buffer });
        return normalizeWordText(result.value);
    }

    if (mimeType === DOC_MIME_TYPE) {
        try {
            const { createRequire } = await import('module');
            const require = createRequire(import.meta.url);
            const WordExtractor = require('word-extractor');
            const extractor = new WordExtractor();
            const extracted = await extractor.extract(buffer);
            return normalizeWordText(extracted.getBody());
        } catch {
            const mammoth = await import('mammoth');
            const result = await mammoth.extractRawText({ buffer });
            return normalizeWordText(result.value);
        }
    }

    throw new Error(`Unsupported Word MIME type: ${mimeType}`);
}

function resolveWordExtension(fileName, mimeType) {
    const fileExtension = path.extname(fileName || '').toLowerCase();
    if (fileExtension === '.doc' || fileExtension === '.docx') {
        return fileExtension;
    }

    if (mimeType === DOCX_MIME_TYPE) {
        return '.docx';
    }

    return '.doc';
}

async function convertWordBufferToPdfBuffer(buffer, { fileName, mimeType }) {
    const extension = resolveWordExtension(fileName, mimeType);
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'resume-word-ocr-'));
    const inputPath = path.join(tempDir, `source${extension}`);
    const outputPath = path.join(tempDir, 'source.pdf');

    try {
        await fs.writeFile(inputPath, buffer);
        await execFileAsync(
            'soffice',
            [
                '--headless',
                '--convert-to',
                'pdf:writer_pdf_Export',
                '--outdir',
                tempDir,
                inputPath
            ],
            { windowsHide: true }
        );
        return await fs.readFile(outputPath);
    } finally {
        await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
}

export async function extractTextFromWordBuffer(buffer, {
    fileName = 'resume.docx',
    mimeType = DOCX_MIME_TYPE,
    minTextLength = DEFAULT_MIN_WORD_TEXT_LENGTH,
    pdfOcrOptions = {}
} = {}) {
    let nativeText = '';
    let nativeError = null;

    try {
        nativeText = await extractNativeWordText(buffer, mimeType);
    } catch (error) {
        nativeError = error;
    }

    if (nativeText.length >= minTextLength) {
        return {
            text: nativeText,
            ocrUsed: false,
            ocrPageCount: 0,
            failedOcrPages: 0,
            avgOcrConfidence: null,
            nativeExtractionSucceeded: true,
            nativeTextLength: nativeText.length
        };
    }

    if (!(await hasSofficeCli())) {
        if (nativeError) {
            throw nativeError;
        }

        return {
            text: nativeText,
            ocrUsed: false,
            ocrPageCount: 0,
            failedOcrPages: 0,
            avgOcrConfidence: null,
            nativeExtractionSucceeded: true,
            nativeTextLength: nativeText.length
        };
    }

    const pdfBuffer = await convertWordBufferToPdfBuffer(buffer, { fileName, mimeType });
    const ocrResult = await extractPdfTextWithOcr(pdfBuffer, {
        forceDocumentOcrTextLength: minTextLength,
        ...pdfOcrOptions
    });

    return {
        ...ocrResult,
        text: normalizeWordText(ocrResult.text),
        nativeExtractionSucceeded: !nativeError,
        nativeTextLength: nativeText.length,
        fallbackSource: 'word-to-pdf-ocr'
    };
}

export {
    DEFAULT_MIN_WORD_TEXT_LENGTH,
    DOCX_MIME_TYPE,
    DOC_MIME_TYPE,
    hasSofficeCli,
    getWordExtractionRuntimeDiagnostics,
    resetWordTextExtractionCaches
};
