import fs from 'fs/promises';
import crypto from 'crypto';
import { safeLog } from '../../../utils/logger.backend.js';
import { metrics } from '../../../services/metrics.service.js';
import { extractPdfTextWithOcr } from '../../../services/pdfTextExtraction.service.js';
import { cleanExtractedResumeText } from '../../../services/ocrTextCleanup.service.js';
import { getUserFirmId, isValidUUID, getFirmById } from '../../../utils/firmHelpers.js';
import * as resumesService from '../../../services/resumes.service.js';
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

            return res.json({ text });
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
            return res.status(500).json({ error: error.message || 'Failed to extract text from DOC file' });
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
            return res.status(500).json({ error: error.message || 'Failed to extract text from PDF file' });
        } finally {
            if (pdfExtractionSlotAcquired) {
                releasePdfExtractionSlot(pdfExtractionUserKey);
            }
        }
    };
}

function createUploadResumeHandler() {
    return async (req, res) => {
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
            await cleanupTempFile(req.file.path);

            if (profileType === 'external' && candidate_email && firmId) {
                safeLog('info', 'Attempting to send GDPR consent email', {
                    resumeId: newResume.id,
                    email: candidate_email,
                    firmId
                });
                try {
                    const { sendConsentRequest } = await import('../../../services/consent.service.js');
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

            return res.status(201).json({
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
            return res.status(500).json({ error: 'Failed to upload resume' });
        }
    };
}

export {
    createExtractDocHandler,
    createExtractPdfHandler,
    createUploadResumeHandler
};
