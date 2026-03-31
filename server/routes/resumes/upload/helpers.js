import multer from 'multer';
import fs from 'fs/promises';
import path from 'path';
import { MAX_FILE_SIZE, UPLOAD_DIR } from '../../../config/constants.js';

const GENERIC_FILE_MIME_TYPES = new Set(['', 'application/octet-stream']);
const PDF_ALLOWED_EXTENSIONS = new Set(['.pdf']);
const PDF_ALLOWED_MIME_TYPES = new Set(['application/pdf']);
const DOC_ALLOWED_EXTENSIONS = new Set(['.doc']);
const DOC_ALLOWED_MIME_TYPES = new Set(['application/msword']);
const MAX_PDF_EXTRACTION_PAGES = 50;
const MAX_SCANNED_OCR_PAGES = 10;
const MAX_OCR_RENDER_PIXELS = 20_000_000;
const DEFAULT_PDF_EXTRACTION_MAX_CONCURRENCY = 2;
const parsedPdfExtractionMaxConcurrency = Number.parseInt(process.env.PDF_EXTRACTION_MAX_CONCURRENCY || '', 10);
const PDF_EXTRACTION_MAX_CONCURRENCY = Number.isInteger(parsedPdfExtractionMaxConcurrency) && parsedPdfExtractionMaxConcurrency > 0
    ? parsedPdfExtractionMaxConcurrency
    : DEFAULT_PDF_EXTRACTION_MAX_CONCURRENCY;

const activePdfExtractionCountsByUser = new Map();

function getPdfExtractionUserKey(req) {
    return req.user?.id || 'anonymous';
}

function getActivePdfExtractionCountForUser(userKey) {
    return activePdfExtractionCountsByUser.get(userKey) || 0;
}

function tryAcquirePdfExtractionSlot(userKey) {
    const activeCount = getActivePdfExtractionCountForUser(userKey);
    if (activeCount >= PDF_EXTRACTION_MAX_CONCURRENCY) {
        return false;
    }
    activePdfExtractionCountsByUser.set(userKey, activeCount + 1);
    return true;
}

function releasePdfExtractionSlot(userKey) {
    const activeCount = getActivePdfExtractionCountForUser(userKey);
    if (activeCount <= 1) {
        activePdfExtractionCountsByUser.delete(userKey);
        return;
    }
    activePdfExtractionCountsByUser.set(userKey, activeCount - 1);
}

function createDiskUpload(allowedExtensions, allowedMimeTypes) {
    return multer({
        dest: UPLOAD_DIR,
        limits: {
            fileSize: MAX_FILE_SIZE,
            files: 1
        },
        fileFilter: (_req, file, cb) => {
            const extension = path.extname(file.originalname || '').toLowerCase();
            const mimeType = (file.mimetype || '').toLowerCase();
            const extensionAllowed = allowedExtensions.has(extension);
            const mimeAllowed = allowedMimeTypes.has(mimeType) || GENERIC_FILE_MIME_TYPES.has(mimeType);

            if (extensionAllowed && mimeAllowed) {
                cb(null, true);
                return;
            }

            cb(new Error(`Invalid file type. Allowed extensions: ${Array.from(allowedExtensions).join(', ')}`));
        }
    });
}

function handleSingleFileUpload(singleUpload) {
    return (req, res, next) => {
        singleUpload(req, res, (error) => {
            if (!error) {
                next();
                return;
            }

            if (error instanceof multer.MulterError) {
                if (error.code === 'LIMIT_FILE_SIZE') {
                    res.status(413).json({ error: `File too large. Maximum allowed size is ${Math.round(MAX_FILE_SIZE / (1024 * 1024))}MB.` });
                    return;
                }

                res.status(400).json({ error: error.message || 'Invalid upload request' });
                return;
            }

            res.status(400).json({ error: error.message || 'Invalid file upload' });
        });
    };
}

async function cleanupTempFile(filePath) {
    if (!filePath) {
        return;
    }
    await fs.unlink(filePath).catch(() => {});
}

const pdfExtractionUpload = createDiskUpload(PDF_ALLOWED_EXTENSIONS, PDF_ALLOWED_MIME_TYPES);
const docExtractionUpload = createDiskUpload(DOC_ALLOWED_EXTENSIONS, DOC_ALLOWED_MIME_TYPES);

const uploadPdfFile = handleSingleFileUpload(pdfExtractionUpload.single('file'));
const uploadDocFile = handleSingleFileUpload(docExtractionUpload.single('file'));

export {
    MAX_OCR_RENDER_PIXELS,
    MAX_PDF_EXTRACTION_PAGES,
    MAX_SCANNED_OCR_PAGES,
    PDF_EXTRACTION_MAX_CONCURRENCY,
    cleanupTempFile,
    getActivePdfExtractionCountForUser,
    getPdfExtractionUserKey,
    releasePdfExtractionSlot,
    tryAcquirePdfExtractionSlot,
    uploadDocFile,
    uploadPdfFile
};
