/**
 * Resume Routes - Upload & File Extraction
 * POST /upload, POST /extract-doc, POST /extract-pdf
 */

import express from 'express';
import multer from 'multer';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { MAX_FILE_SIZE, UPLOAD_DIR } from '../../config/constants.js';
import { authenticateToken } from '../../middleware/auth.middleware.js';
import { uploadLimiter } from '../../middleware/rateLimit.middleware.js';
import { safeLog } from '../../utils/logger.backend.js';
import { metrics } from '../../services/metrics.service.js';
import { loadPdfDocument } from '../../utils/pdfjs.server.js';
import { getUserFirmId, isValidUUID, getFirmById } from '../../utils/firmHelpers.js';
import * as resumesService from '../../services/resumes.service.js';

const router = express.Router();

const GENERIC_FILE_MIME_TYPES = new Set(['', 'application/octet-stream']);
const RESUME_ALLOWED_EXTENSIONS = new Set(['.pdf', '.doc', '.docx']);
const RESUME_ALLOWED_MIME_TYPES = new Set([
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
]);
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

const resumeUpload = createDiskUpload(RESUME_ALLOWED_EXTENSIONS, RESUME_ALLOWED_MIME_TYPES);
const pdfExtractionUpload = createDiskUpload(PDF_ALLOWED_EXTENSIONS, PDF_ALLOWED_MIME_TYPES);
const docExtractionUpload = createDiskUpload(DOC_ALLOWED_EXTENSIONS, DOC_ALLOWED_MIME_TYPES);

const uploadResumeFile = handleSingleFileUpload(resumeUpload.single('file'));
const uploadPdfFile = handleSingleFileUpload(pdfExtractionUpload.single('file'));
const uploadDocFile = handleSingleFileUpload(docExtractionUpload.single('file'));

// POST /api/resumes/extract-doc - Extract text from DOC file (Word 97-2003)
// This endpoint is needed because word-extractor is a Node.js library that doesn't work in browsers
router.post('/extract-doc', authenticateToken, uploadLimiter, uploadDocFile, async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const fileBuffer = await fs.readFile(req.file.path);

        // Dynamic import of word-extractor
        let text = '';
        try {
            const WordExtractor = (await import('word-extractor')).default;
            const extractor = new WordExtractor();
            const extracted = await extractor.extract(fileBuffer);
            text = extracted.getBody().trim();
            safeLog('info', 'Successfully extracted text from DOC file', {
                fileName: req.file.originalname,
                textLength: text.length
            });
        } catch (extractError) {
            safeLog('error', 'word-extractor failed', { error: extractError.message });

            // Fallback: try mammoth (limited support for .doc)
            try {
                const mammoth = (await import('mammoth')).default;
                const result = await mammoth.extractRawText({ buffer: fileBuffer });
                text = result.value.trim();
                safeLog('info', 'Extracted text from DOC using mammoth fallback', {
                    fileName: req.file.originalname,
                    textLength: text.length
                });
            } catch (mammothError) {
                safeLog('error', 'mammoth fallback also failed', { error: mammothError.message });
                throw new Error('Failed to extract text from DOC file. The file may be corrupted or in an unsupported format.');
            }
        }

        await cleanupTempFile(req.file.path);

        metrics.trackUploadActivity({
            endpoint: 'extract-doc',
            fileSize: req.file.size,
            mimeType: req.file.mimetype || 'application/msword',
            success: true,
            metadata: { textLength: text.length }
        });

        if (!text || text.length < 10) {
            return res.status(400).json({
                error: 'Could not extract meaningful text from the DOC file. The file may be empty or corrupted.'
            });
        }

        res.json({ text });
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
        res.status(500).json({ error: error.message || 'Failed to extract text from DOC file' });
    }
});

// POST /api/resumes/extract-pdf - Extract text from PDF file (server-side)
// This endpoint enables CSP-compliant PDF extraction without 'unsafe-eval'
// Includes OCR support for scanned PDFs using Tesseract.js
router.post('/extract-pdf', authenticateToken, uploadLimiter, uploadPdfFile, async (req, res) => {
    let tesseractWorker = null;
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
        const startTime = Date.now();

        safeLog('info', 'Starting server-side PDF extraction', {
            fileName: req.file.originalname,
            fileSize: fileBuffer.length
        });
        const uint8Array = new Uint8Array(fileBuffer);

        const loadingTask = await loadPdfDocument(uint8Array);
        const pdf = await loadingTask.promise;

        if (pdf.numPages > MAX_PDF_EXTRACTION_PAGES) {
            return res.status(400).json({
                error: `PDF too large to extract safely. Maximum supported page count is ${MAX_PDF_EXTRACTION_PAGES}.`
            });
        }

        let fullText = '';
        const numPages = pdf.numPages;
        let ocrUsed = false;
        let ocrPageCount = 0;
        let totalOcrConfidence = 0;
        let failedOcrPages = 0;

        for (let pageNum = 1; pageNum <= numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const textContent = await page.getTextContent();

            const totalTextLength = textContent.items.reduce((sum, item) => sum + (item.str || '').length, 0);
            const isScannedPage = totalTextLength < 50 || textContent.items.length < 5;

            if (isScannedPage) {
                if (ocrPageCount >= MAX_SCANNED_OCR_PAGES) {
                    return res.status(400).json({
                        error: `PDF contains too many scanned pages for OCR extraction. Maximum supported scanned pages is ${MAX_SCANNED_OCR_PAGES}.`
                    });
                }

                safeLog('info', `Page ${pageNum} appears to be scanned (${totalTextLength} chars), using OCR...`, {
                    fileName: req.file.originalname
                });

                try {
                    if (!tesseractWorker) {
                        const Tesseract = await import('tesseract.js');
                        tesseractWorker = await Tesseract.createWorker('fra+eng', 1, {
                            logger: (message) => {
                                if (message.status === 'recognizing text') {
                                    safeLog('debug', `OCR progress page ${pageNum}: ${(message.progress * 100).toFixed(0)}%`);
                                }
                            }
                        });
                    }

                    const scale = 2.0;
                    const viewport = page.getViewport({ scale });
                    if ((viewport.width * viewport.height) > MAX_OCR_RENDER_PIXELS) {
                        throw new Error('Page is too large for OCR rendering');
                    }

                    const { createCanvas } = await import('canvas');
                    const canvas = createCanvas(viewport.width, viewport.height);
                    const context = canvas.getContext('2d');

                    await page.render({
                        canvasContext: context,
                        viewport
                    }).promise;

                    const imageBuffer = canvas.toBuffer('image/png');
                    const { data: { text: ocrText, confidence } } = await tesseractWorker.recognize(imageBuffer);

                    if (ocrText && ocrText.trim().length > 20) {
                        fullText += ocrText.trim() + '\n\n';
                        ocrUsed = true;
                        ocrPageCount++;
                        totalOcrConfidence += confidence;
                        safeLog('info', `OCR completed for page ${pageNum}`, {
                            confidence: confidence.toFixed(2),
                            textLength: ocrText.trim().length
                        });
                    } else {
                        ocrPageCount++;
                        safeLog('warn', `OCR returned insufficient text for page ${pageNum}`, {
                            confidence: confidence?.toFixed(2) || 'N/A',
                            textLength: ocrText?.trim().length || 0
                        });
                        failedOcrPages++;
                    }
                } catch (ocrError) {
                    ocrPageCount++;
                    failedOcrPages++;
                    safeLog('error', `OCR failed for page ${pageNum}`, { error: ocrError.message });
                    fullText += `[Page ${pageNum}: OCR error - ${ocrError.message}]\n\n`;
                }
                continue;
            }

            const lines = [];
            let currentLine = [];
            let lastY = null;
            const Y_THRESHOLD = 5;

            for (const item of textContent.items) {
                const y = item.transform ? item.transform[5] : 0;

                if (lastY !== null && Math.abs(y - lastY) > Y_THRESHOLD) {
                    if (currentLine.length > 0) {
                        lines.push(currentLine);
                        currentLine = [];
                    }
                }

                if (item.str && item.str.trim()) {
                    currentLine.push(item.str);
                }
                lastY = y;
            }

            if (currentLine.length > 0) {
                lines.push(currentLine);
            }

            const pageText = lines
                .map((line) => line.join(' '))
                .join('\n');

            fullText += pageText + '\n\n';
        }

        if (tesseractWorker) {
            await tesseractWorker.terminate();
        }

        fullText = fullText
            .replace(/[ \t]+/g, ' ')
            .replace(/\n{3,}/g, '\n\n')
            .trim();

        await cleanupTempFile(req.file.path);

        const extractionTime = Date.now() - startTime;
        const avgOcrConfidence = ocrPageCount > 0 ? (totalOcrConfidence / ocrPageCount).toFixed(2) : null;

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
                avgConfidence: avgOcrConfidence ? Number(avgOcrConfidence) : null,
                extractionTimeMs: extractionTime,
                success: failedOcrPages === 0,
                metadata: { fileName: req.file.originalname }
            });
        }

        safeLog('info', 'PDF extraction completed', {
            fileName: req.file.originalname,
            textLength: fullText.length,
            pages: numPages,
            ocrUsed,
            ocrPageCount,
            avgOcrConfidence,
            extractionTimeMs: extractionTime
        });

        if (!fullText || fullText.length < 10) {
            return res.status(400).json({
                error: 'Could not extract meaningful text from the PDF file. The file may be empty, corrupted, or entirely scanned.',
                ocrRequired: ocrUsed
            });
        }

        res.json({
            text: fullText,
            pages: numPages,
            ocrUsed,
            ocrPageCount,
            avgOcrConfidence,
            extractionTimeMs: extractionTime
        });
    } catch (error) {
        if (tesseractWorker) {
            await tesseractWorker.terminate().catch(() => {});
        }
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
        res.status(500).json({ error: error.message || 'Failed to extract text from PDF file' });
    } finally {
        if (pdfExtractionSlotAcquired) {
            releasePdfExtractionSlot(pdfExtractionUserKey);
        }
    }
});

// POST /api/resumes/upload - Upload resume file
router.post('/upload', authenticateToken, uploadLimiter, uploadResumeFile, async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const isAdmin = req.user?.role === 'admin';
        const { name, title, profile_type, candidate_name, candidate_email, firm_id: requestedFirmId } = req.body;

        const fileBuffer = await fs.readFile(req.file.path);

        let firmId = await getUserFirmId(req);
        let firmName = null;

        if (isAdmin && requestedFirmId && isValidUUID(requestedFirmId)) {
            const firm = await getFirmById(requestedFirmId);
            if (firm) {
                firmId = firm.id;
                firmName = firm.name;
                safeLog('info', 'Admin uploading resume for another firm', {
                    adminId: req.user?.id,
                    targetFirmId: firmId,
                    targetFirmName: firmName
                });
            }
        } else if (firmId) {
            const firm = await getFirmById(firmId);
            if (firm) {
                firmName = firm.name;
            }
        }

        const profileType = profile_type || 'external';
        const consentStatus = profileType === 'employee' ? 'not_required' : 'pending_consent';
        const consentToken = profileType === 'external' ? crypto.randomBytes(32).toString('hex') : null;
        const tokenExpiresAt = profileType === 'external'
            ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
            : null;
        const retentionUntil = profileType === 'employee'
            ? null
            : new Date(Date.now() + 2 * 365 * 24 * 60 * 60 * 1000);

        const newResume = await resumesService.insertResume({
            name: name || req.file.originalname,
            title: title || '',
            fileName: req.file.originalname,
            fileBuffer,
            fileSize: req.file.size,
            mimeType: req.file.mimetype,
            fileUrl: `/api/resumes/${null}/download`,
            status: 'active',
            firmId,
            firmName,
            profileType,
            candidateName: candidate_name || null,
            candidateEmail: candidate_email || null,
            consentStatus,
            consentToken,
            tokenExpiresAt,
            consentRequestedAt: profileType === 'external' ? new Date() : null,
            retentionUntil
        });

        await resumesService.updateResumeFileUrl(newResume.id, `/api/resumes/${newResume.id}/download`);
        newResume.resume_file_url = `/api/resumes/${newResume.id}/download`;

        try {
            await fs.unlink(req.file.path);
        } catch (unlinkError) {
            safeLog('warn', 'Failed to delete temp file', { path: req.file.path, error: unlinkError.message });
        }

        if (profileType === 'external' && candidate_email && firmId) {
            safeLog('info', 'Attempting to send GDPR consent email', {
                resumeId: newResume.id,
                email: candidate_email,
                firmId
            });
            try {
                const { sendConsentRequest } = await import('../../services/consent.service.js');
                await sendConsentRequest(newResume.id);
                safeLog('info', 'GDPR consent email sent automatically', { resumeId: newResume.id, email: candidate_email });
            } catch (emailError) {
                safeLog('error', 'Failed to send GDPR consent email', {
                    resumeId: newResume.id,
                    email: candidate_email,
                    firmId,
                    error: emailError.message,
                    stack: emailError.stack
                });
                try {
                    await resumesService.updateConsentStatus(newResume.id, 'error');
                    newResume.consent_status = 'error';
                    safeLog('info', 'Consent status set to error', { resumeId: newResume.id });
                } catch (updateError) {
                    safeLog('error', 'Failed to update consent status to error', { error: updateError.message });
                }
            }
        } else {
            safeLog('debug', 'GDPR email not sent', {
                profileType,
                hasEmail: !!candidate_email,
                hasFirmId: !!firmId
            });
        }

        metrics.trackUploadActivity({
            endpoint: 'upload',
            fileSize: req.file.size,
            mimeType: req.file.mimetype || 'application/octet-stream',
            success: true,
            storedInDb: true,
            metadata: { profileType, resumeId: newResume.id }
        });

        res.status(201).json({
            id: newResume.id,
            Name: newResume.name,
            Title: newResume.title,
            'File Name': newResume.file_name,
            'Resume File': [{
                id: newResume.id,
                filename: newResume.file_name,
                size: newResume.resume_file_size,
                type: newResume.resume_file_type,
                url: newResume.resume_file_url
            }],
            Status: 'Active',
            FirmName: newResume.firm_name,
            CustomerName: newResume.firm_name,
            profile_type: newResume.profile_type,
            candidate_name: newResume.candidate_name,
            candidate_email: newResume.candidate_email,
            consent_status: newResume.consent_status
        });
    } catch (error) {
        if (req.file) {
            metrics.trackUploadActivity({
                endpoint: 'upload',
                fileSize: req.file.size,
                mimeType: req.file.mimetype || 'application/octet-stream',
                success: false,
                storedInDb: false,
                metadata: { error: error.message }
            });
        }
        safeLog('error', 'Error uploading resume', { error: error.message });
        await cleanupTempFile(req.file?.path);
        res.status(500).json({ error: 'Failed to upload resume' });
    }
});

export default router;




