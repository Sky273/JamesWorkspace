/**
 * Share Resume Service
 * Manages PDF generation and sharing for resumes
 */

import { query } from '../config/database.js';
import { safeLog } from '../utils/logger.backend.js';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { UPLOAD_DIR } from '../config/constants.js';
import { assertSchemaRequirements } from './schemaVerification.service.js';

// Shared PDFs directory
const SHARED_PDF_DIR = path.join(UPLOAD_DIR, 'shared');
export const SHARE_LINK_TTL_DAYS = 7;
export const SHARE_LINK_TTL_MS = SHARE_LINK_TTL_DAYS * 24 * 60 * 60 * 1000;

function buildShareExpiryDate(now = new Date()) {
    return new Date(now.getTime() + SHARE_LINK_TTL_MS);
}

function isExpired(expiresAt, now = new Date()) {
    if (!expiresAt) {
        return true;
    }

    const expiryDate = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
    return Number.isNaN(expiryDate.getTime()) || expiryDate <= now;
}

function generateShareToken() {
    return crypto.randomBytes(32).toString('hex');
}

async function deleteSharedPdfFile(filePath) {
    if (!filePath) {
        return;
    }

    try {
        await fs.unlink(filePath);
    } catch (error) {
        if (error?.code !== 'ENOENT') {
            safeLog('warn', 'Failed to delete shared PDF file', { filePath, error: error.message });
        }
    }
}

async function getShareRowByResumeId(resumeId) {
    const result = await query(
        `SELECT id, shared_pdf_path, shared_pdf_token, shared_pdf_expires_at, shared_file_token, shared_file_expires_at
         FROM resumes
         WHERE id = $1`,
        [resumeId]
    );

    return result.rows[0] || null;
}

/**
 * Verify the shared resume schema is present
 */
export async function initShareResumeTable() {
    try {
        await assertSchemaRequirements({
            context: 'shared resume',
            tables: ['resumes'],
            columns: {
                resumes: [
                    'shared_pdf_path',
                    'shared_pdf_token',
                    'shared_pdf_expires_at',
                    'shared_file_token',
                    'shared_file_expires_at'
                ]
            },
            indexes: ['idx_resumes_shared_pdf_token', 'idx_resumes_shared_file_token']
        });

        await fs.mkdir(SHARED_PDF_DIR, { recursive: true });

        safeLog('info', 'Share resume schema verified');
        return true;
    } catch (error) {
        safeLog('error', 'Failed to verify share resume schema', {
            error: error.message
        });
        throw error;
    }
}

/**
 * Store a shared PDF for a resume
 * @param {string} resumeId - Resume UUID
 * @param {Buffer} pdfBuffer - PDF content as buffer
 * @param {string} filename - Original filename
 * @returns {Promise<{token: string, path: string, expiresAt: Date}>} Share info
 */
export async function storeSharedPdf(resumeId, pdfBuffer, filename) {
    try {
        const existingShare = await getShareRowByResumeId(resumeId);
        const token = generateShareToken();
        const expiresAt = buildShareExpiryDate();

        const safeFilename = filename.replace(/[^a-zA-Z0-9_-]/g, '_') + '.pdf';
        const pdfPath = path.join(SHARED_PDF_DIR, `${token}_${safeFilename}`);

        await fs.writeFile(pdfPath, pdfBuffer);

        await query(
            `UPDATE resumes
             SET shared_pdf_path = $1, shared_pdf_token = $2, shared_pdf_expires_at = $3
             WHERE id = $4`,
            [pdfPath, token, expiresAt, resumeId]
        );

        if (existingShare?.shared_pdf_path && existingShare.shared_pdf_path !== pdfPath) {
            await deleteSharedPdfFile(existingShare.shared_pdf_path);
        }

        safeLog('info', 'Shared PDF stored', {
            resumeId,
            token: token.substring(0, 8) + '...',
            expiresAt: expiresAt.toISOString()
        });

        return { token, path: pdfPath, expiresAt };
    } catch (error) {
        safeLog('error', 'Failed to store shared PDF', {
            resumeId,
            error: error.message
        });
        throw error;
    }
}

/**
 * Get shared PDF by token
 */
export async function getSharedPdfByToken(token) {
    try {
        const result = await query(
            `SELECT id, shared_pdf_path, name, shared_pdf_expires_at
             FROM resumes
             WHERE shared_pdf_token = $1`,
            [token]
        );

        if (result.rows.length === 0) {
            return null;
        }

        const resume = result.rows[0];
        if (isExpired(resume.shared_pdf_expires_at)) {
            safeLog('info', 'Shared PDF token expired', {
                token: token.substring(0, 8) + '...',
                resumeId: resume.id,
                expiresAt: resume.shared_pdf_expires_at
            });
            return null;
        }

        try {
            await fs.access(resume.shared_pdf_path);
        } catch {
            safeLog('warn', 'Shared PDF file not found', { token });
            return null;
        }

        return {
            path: resume.shared_pdf_path,
            resumeId: resume.id,
            name: resume.name,
            expiresAt: resume.shared_pdf_expires_at
        };
    } catch (error) {
        safeLog('error', 'Failed to get shared PDF', {
            error: error.message
        });
        return null;
    }
}

export async function getOriginalFileInfo(resumeId) {
    try {
        const result = await query(
            `SELECT id, file_name, name, resume_file_data IS NOT NULL as has_file
             FROM resumes
             WHERE id = $1`,
            [resumeId]
        );

        if (result.rows.length === 0) {
            return null;
        }

        const resume = result.rows[0];
        if (!resume.has_file) {
            safeLog('warn', 'Original file not found in database', { resumeId });
            return null;
        }

        return {
            resumeId: resume.id,
            filename: resume.file_name || resume.name || 'cv',
            name: resume.name,
            hasFile: true
        };
    } catch (error) {
        safeLog('error', 'Failed to get original file path', {
            resumeId,
            error: error.message
        });
        return null;
    }
}

/**
 * Check if resume has non-expired shared links
 */
export async function getShareStatus(resumeId) {
    try {
        const result = await query(
            `SELECT shared_pdf_token, shared_pdf_expires_at, shared_file_token, shared_file_expires_at
             FROM resumes
             WHERE id = $1`,
            [resumeId]
        );

        if (result.rows.length === 0) {
            return {
                hasSharedPdf: false,
                token: null,
                expiresAt: null,
                pdfToken: null,
                pdfExpiresAt: null,
                hasSharedFile: false,
                fileToken: null,
                fileExpiresAt: null
            };
        }

        const row = result.rows[0];
        const hasSharedPdf = !!row.shared_pdf_token && !isExpired(row.shared_pdf_expires_at);
        const hasSharedFile = !!row.shared_file_token && !isExpired(row.shared_file_expires_at);

        return {
            hasSharedPdf,
            token: hasSharedPdf ? row.shared_pdf_token : null,
            expiresAt: hasSharedPdf ? row.shared_pdf_expires_at : null,
            pdfToken: hasSharedPdf ? row.shared_pdf_token : null,
            pdfExpiresAt: hasSharedPdf ? row.shared_pdf_expires_at : null,
            hasSharedFile,
            fileToken: hasSharedFile ? row.shared_file_token : null,
            fileExpiresAt: hasSharedFile ? row.shared_file_expires_at : null
        };
    } catch (error) {
        safeLog('error', 'Failed to get share status', {
            resumeId,
            error: error.message
        });
        return {
            hasSharedPdf: false,
            token: null,
            expiresAt: null,
            pdfToken: null,
            pdfExpiresAt: null,
            hasSharedFile: false,
            fileToken: null,
            fileExpiresAt: null
        };
    }
}

export async function getOrCreateSharedPdfToken(resumeId) {
    const share = await getShareRowByResumeId(resumeId);
    let token = share?.shared_pdf_token;
    let expiresAt = share?.shared_pdf_expires_at;

    if (!token || isExpired(expiresAt)) {
        token = generateShareToken();
        expiresAt = buildShareExpiryDate();
        await query(
            `UPDATE resumes SET shared_pdf_token = $1, shared_pdf_expires_at = $2 WHERE id = $3`,
            [token, expiresAt, resumeId]
        );
    }

    return token;
}

export async function getOrCreateOriginalFileToken(resumeId) {
    const share = await getShareRowByResumeId(resumeId);
    let token = share?.shared_file_token;
    let expiresAt = share?.shared_file_expires_at;

    if (!token || isExpired(expiresAt)) {
        token = generateShareToken();
        expiresAt = buildShareExpiryDate();
        await query(
            `UPDATE resumes SET shared_file_token = $1, shared_file_expires_at = $2 WHERE id = $3`,
            [token, expiresAt, resumeId]
        );
    }

    return token;
}

export async function revokeShareLinks(resumeId) {
    const share = await getShareRowByResumeId(resumeId);
    if (!share) {
        return false;
    }

    await query(
        `UPDATE resumes
         SET shared_pdf_path = NULL,
             shared_pdf_token = NULL,
             shared_pdf_expires_at = NULL,
             shared_file_token = NULL,
             shared_file_expires_at = NULL
         WHERE id = $1`,
        [resumeId]
    );

    await deleteSharedPdfFile(share.shared_pdf_path);
    return true;
}

export async function getResumeFileByToken(token) {
    const result = await query(
        `SELECT id, file_name, name, resume_file_data, resume_file_type, resume_file_size, shared_file_expires_at
         FROM resumes
         WHERE shared_file_token = $1`,
        [token]
    );

    if (result.rows.length === 0) {
        return null;
    }

    const resume = result.rows[0];
    if (isExpired(resume.shared_file_expires_at)) {
        safeLog('info', 'Shared original file token expired', {
            token: token.substring(0, 8) + '...',
            resumeId: resume.id,
            expiresAt: resume.shared_file_expires_at
        });
        return null;
    }

    return resume;
}

export default {
    initShareResumeTable,
    storeSharedPdf,
    getSharedPdfByToken,
    getOriginalFileInfo,
    getShareStatus,
    getOrCreateSharedPdfToken,
    getOrCreateOriginalFileToken,
    revokeShareLinks,
    getResumeFileByToken
};
