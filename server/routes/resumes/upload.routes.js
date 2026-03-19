/**
 * Resume Routes - Upload & File Extraction
 * POST /upload, POST /extract-doc, POST /extract-pdf
 */

import express from 'express';
import multer from 'multer';
import fs from 'fs/promises';
import crypto from 'crypto';
import { UPLOAD_DIR } from '../../config/constants.js';
import { authenticateToken } from '../../middleware/auth.middleware.js';
import { safeLog } from '../../utils/logger.backend.js';
import { query } from '../../config/database.js';
import { getUserFirmId, isValidUUID, getFirmById } from '../../utils/firmHelpers.js';

const router = express.Router();

// Configure multer for file uploads
const upload = multer({ dest: UPLOAD_DIR });

// POST /api/resumes/extract-doc - Extract text from DOC file (Word 97-2003)
// This endpoint is needed because word-extractor is a Node.js library that doesn't work in browsers
router.post('/extract-doc', authenticateToken, upload.single('file'), async (req, res) => {
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
                throw new Error(`Failed to extract text from DOC file. The file may be corrupted or in an unsupported format.`);
            }
        }

        // Clean up temp file
        await fs.unlink(req.file.path).catch(() => {});

        if (!text || text.length < 10) {
            return res.status(400).json({ 
                error: 'Could not extract meaningful text from the DOC file. The file may be empty or corrupted.' 
            });
        }

        res.json({ text });
    } catch (error) {
        // Clean up temp file on error
        if (req.file?.path) {
            await fs.unlink(req.file.path).catch(() => {});
        }
        safeLog('error', 'Error extracting text from DOC', { error: error.message });
        res.status(500).json({ error: error.message || 'Failed to extract text from DOC file' });
    }
});

// POST /api/resumes/extract-pdf - Extract text from PDF file (server-side)
// This endpoint enables CSP-compliant PDF extraction without 'unsafe-eval'
// Includes OCR support for scanned PDFs using Tesseract.js
router.post('/extract-pdf', authenticateToken, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const fileBuffer = await fs.readFile(req.file.path);
        const startTime = Date.now();
        
        safeLog('info', 'Starting server-side PDF extraction', { 
            fileName: req.file.originalname,
            fileSize: fileBuffer.length 
        });

        // Use pdfjs-dist/legacy for Node.js compatibility
        const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
        const uint8Array = new Uint8Array(fileBuffer);
        
        const loadingTask = pdfjsLib.getDocument({ data: uint8Array });
        const pdf = await loadingTask.promise;
        
        let fullText = '';
        const numPages = pdf.numPages;
        let ocrUsed = false;
        let ocrPageCount = 0;
        let totalOcrConfidence = 0;
        
        // Lazy load Tesseract only if needed
        let tesseractWorker = null;
        
        // Extract text from each page with structure preservation
        for (let pageNum = 1; pageNum <= numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const textContent = await page.getTextContent();
            
            // Check if page appears to be scanned (very little text)
            const totalTextLength = textContent.items.reduce((sum, item) => sum + (item.str || '').length, 0);
            const isScannedPage = totalTextLength < 50 || textContent.items.length < 5;
            
            if (isScannedPage) {
                // Use OCR for scanned pages
                safeLog('info', `Page ${pageNum} appears to be scanned (${totalTextLength} chars), using OCR...`, {
                    fileName: req.file.originalname
                });
                
                try {
                    // Initialize Tesseract worker on first scanned page
                    if (!tesseractWorker) {
                        const Tesseract = await import('tesseract.js');
                        tesseractWorker = await Tesseract.createWorker('fra+eng', 1, {
                            logger: (m) => {
                                if (m.status === 'recognizing text') {
                                    safeLog('debug', `OCR progress page ${pageNum}: ${(m.progress * 100).toFixed(0)}%`);
                                }
                            }
                        });
                    }
                    
                    // Render page to canvas/image for OCR
                    const scale = 2.0; // Higher scale = better OCR quality
                    const viewport = page.getViewport({ scale });
                    
                    // Create a canvas using node-canvas or similar
                    const { createCanvas } = await import('canvas');
                    const canvas = createCanvas(viewport.width, viewport.height);
                    const context = canvas.getContext('2d');
                    
                    await page.render({
                        canvasContext: context,
                        viewport: viewport
                    }).promise;
                    
                    // Convert canvas to PNG buffer for Tesseract
                    const imageBuffer = canvas.toBuffer('image/png');
                    
                    // Perform OCR
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
                        safeLog('warn', `OCR returned insufficient text for page ${pageNum}`, {
                            confidence: confidence?.toFixed(2) || 'N/A',
                            textLength: ocrText?.trim().length || 0
                        });
                        fullText += `[Page ${pageNum}: OCR failed - insufficient text extracted]\n\n`;
                    }
                } catch (ocrError) {
                    safeLog('error', `OCR failed for page ${pageNum}`, { error: ocrError.message });
                    fullText += `[Page ${pageNum}: OCR error - ${ocrError.message}]\n\n`;
                }
                continue;
            }
            
            // Group text items by vertical position to preserve lines
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
                .map(line => line.join(' '))
                .join('\n');
            
            fullText += pageText + '\n\n';
        }
        
        // Cleanup Tesseract worker if used
        if (tesseractWorker) {
            await tesseractWorker.terminate();
        }
        
        // Clean up excessive whitespace
        fullText = fullText
            .replace(/[ \t]+/g, ' ')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
        
        // Clean up temp file
        await fs.unlink(req.file.path).catch(() => {});
        
        const extractionTime = Date.now() - startTime;
        const avgOcrConfidence = ocrPageCount > 0 ? (totalOcrConfidence / ocrPageCount).toFixed(2) : null;
        
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
        // Clean up temp file on error
        if (req.file?.path) {
            await fs.unlink(req.file.path).catch(() => {});
        }
        safeLog('error', 'Error extracting text from PDF', { error: error.message });
        res.status(500).json({ error: error.message || 'Failed to extract text from PDF file' });
    }
});

// POST /api/resumes/upload - Upload resume file
router.post('/upload', authenticateToken, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const isAdmin = req.user?.role === 'admin';
        const { name, title, profile_type, candidate_name, candidate_email, firm_id: requestedFirmId } = req.body;

        // Read file content from temp location
        const fileBuffer = await fs.readFile(req.file.path);

        // Get firm_id - use only UUID, no name lookup
        let firmId = await getUserFirmId(req);
        let firmName = null;
        
        // If admin sends a firm_id, use it instead
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
            // Get firm name from firm_id
            const firm = await getFirmById(firmId);
            if (firm) {
                firmName = firm.name;
            }
        }

        // GDPR consent fields
        const profileType = profile_type || 'external';
        const consentStatus = profileType === 'employee' ? 'not_required' : 'pending_consent';
        const consentToken = profileType === 'external' ? crypto.randomBytes(32).toString('hex') : null;
        const tokenExpiresAt = profileType === 'external' 
            ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) // 14 days
            : null;
        const retentionUntil = profileType === 'employee'
            ? null // No retention limit for employees
            : new Date(Date.now() + 2 * 365 * 24 * 60 * 60 * 1000); // 2 years for external

        // Insert resume with file data and GDPR fields
        const result = await query(
            `INSERT INTO resumes (
                name, title, file_name, resume_file_data, resume_file_size, resume_file_type, 
                resume_file_url, status, firm_id, firm_name,
                profile_type, candidate_name, candidate_email, consent_status,
                consent_token, consent_token_expires_at, consent_requested_at, retention_until
            )
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
             RETURNING *`,
            [
                name || req.file.originalname,
                title || '',
                req.file.originalname,
                fileBuffer,
                req.file.size,
                req.file.mimetype,
                `/api/resumes/${null}/download`, // Will be updated after insert
                'active',
                firmId,
                firmName,
                profileType,
                candidate_name || null,
                candidate_email || null,
                consentStatus,
                consentToken,
                tokenExpiresAt,
                profileType === 'external' ? new Date() : null,
                retentionUntil
            ]
        );

        const newResume = result.rows[0];

        // Update the resume_file_url with the correct ID
        await query(
            `UPDATE resumes SET resume_file_url = $1 WHERE id = $2`,
            [`/api/resumes/${newResume.id}/download`, newResume.id]
        );
        newResume.resume_file_url = `/api/resumes/${newResume.id}/download`;

        // Delete temp file from uploads directory
        try {
            await fs.unlink(req.file.path);
        } catch (unlinkError) {
            safeLog('warn', 'Failed to delete temp file', { path: req.file.path, error: unlinkError.message });
        }

        // Send GDPR consent email automatically for external candidates
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
                // Update consent_status to 'error' to indicate email sending failed
                try {
                    await query(`
                        UPDATE resumes 
                        SET consent_status = 'error', updated_at = CURRENT_TIMESTAMP
                        WHERE id = $1
                    `, [newResume.id]);
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
        safeLog('error', 'Error uploading resume', { error: error.message });
        // Clean up temp file on error
        if (req.file?.path) {
            try {
                await fs.unlink(req.file.path);
            } catch (unlinkError) {
                safeLog('debug', 'Failed to delete temp file during error cleanup', { 
                    path: req.file.path, 
                    error: unlinkError.message 
                });
            }
        }
        res.status(500).json({ error: 'Failed to upload resume' });
    }
});

export default router;
