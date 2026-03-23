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

/**
 * Verify the shared resume schema is present
 */
export async function initShareResumeTable() {
    try {
        await assertSchemaRequirements({
            context: 'shared resume',
            tables: ['resumes'],
            columns: {
                resumes: ['shared_pdf_path', 'shared_pdf_token']
            },
            indexes: ['idx_resumes_shared_pdf_token']
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
 * Generate a unique share token
 * @returns {string} Unique token
 */
function generateShareToken() {
    return crypto.randomBytes(32).toString('hex');
}

/**
 * Store a shared PDF for a resume
 * @param {string} resumeId - Resume UUID
 * @param {Buffer} pdfBuffer - PDF content as buffer
 * @param {string} filename - Original filename
 * @returns {Promise<{token: string, url: string}>} Share info
 */
export async function storeSharedPdf(resumeId, pdfBuffer, filename) {
    try {
        // Generate unique token
        const token = generateShareToken();
        
        // Create safe filename
        const safeFilename = filename.replace(/[^a-zA-Z0-9_-]/g, '_') + '.pdf';
        const pdfPath = path.join(SHARED_PDF_DIR, `${token}_${safeFilename}`);
        
        // Write PDF to disk
        await fs.writeFile(pdfPath, pdfBuffer);
        
        // Store path and token in database
        await query(`
            UPDATE resumes 
            SET shared_pdf_path = $1, shared_pdf_token = $2
            WHERE id = $3
        `, [pdfPath, token, resumeId]);

        safeLog('info', 'Shared PDF stored', {
            resumeId,
            token: token.substring(0, 8) + '...'
        });

        return { token, path: pdfPath };
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
 * @param {string} token - Share token
 * @returns {Promise<{path: string, resumeId: string} | null>} PDF info or null
 */
export async function getSharedPdfByToken(token) {
    try {
        const result = await query(`
            SELECT id, shared_pdf_path, name
            FROM resumes 
            WHERE shared_pdf_token = $1
        `, [token]);

        if (result.rows.length === 0) {
            return null;
        }

        const resume = result.rows[0];
        
        // Verify file exists
        try {
            await fs.access(resume.shared_pdf_path);
        } catch {
            safeLog('warn', 'Shared PDF file not found', { token });
            return null;
        }

        return {
            path: resume.shared_pdf_path,
            resumeId: resume.id,
            name: resume.name
        };
    } catch (error) {
        safeLog('error', 'Failed to get shared PDF', {
            error: error.message
        });
        return null;
    }
}

/**
 * Get the original file info for a resume
 * @param {string} resumeId - Resume UUID
 * @returns {Promise<{resumeId: string, filename: string, hasFile: boolean} | null>} File info or null
 */
export async function getOriginalFileInfo(resumeId) {
    try {
        const result = await query(`
            SELECT id, file_name, name, resume_file_data IS NOT NULL as has_file
            FROM resumes 
            WHERE id = $1
        `, [resumeId]);

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
 * Check if resume has a shared PDF
 * @param {string} resumeId - Resume UUID
 * @returns {Promise<{hasSharedPdf: boolean, token: string | null}>}
 */
export async function getShareStatus(resumeId) {
    try {
        const result = await query(`
            SELECT shared_pdf_token
            FROM resumes 
            WHERE id = $1
        `, [resumeId]);

        if (result.rows.length === 0) {
            return { hasSharedPdf: false, token: null };
        }

        const token = result.rows[0].shared_pdf_token;
        return {
            hasSharedPdf: !!token,
            token
        };
    } catch (error) {
        safeLog('error', 'Failed to get share status', {
            resumeId,
            error: error.message
        });
        return { hasSharedPdf: false, token: null };
    }
}

/**
 * Get or create a share token for a resume
 * @param {string} resumeId
 * @returns {Promise<string>} token
 */
export async function getOrCreateShareToken(resumeId) {
    const result = await query(`
        SELECT shared_pdf_token FROM resumes WHERE id = $1
    `, [resumeId]);

    let token = result.rows[0]?.shared_pdf_token;

    if (!token) {
        token = crypto.randomBytes(32).toString('hex');
        await query(`
            UPDATE resumes SET shared_pdf_token = $1 WHERE id = $2
        `, [token, resumeId]);
    }

    return token;
}

/**
 * Get resume file data by share token
 * @param {string} token
 * @returns {Promise<Object|null>}
 */
export async function getResumeFileByToken(token) {
    const result = await query(`
        SELECT id, file_name, name, resume_file_data, resume_file_type, resume_file_size
        FROM resumes 
        WHERE shared_pdf_token = $1
    `, [token]);

    if (result.rows.length === 0) {
        return null;
    }
    return result.rows[0];
}

export default {
    initShareResumeTable,
    storeSharedPdf,
    getSharedPdfByToken,
    getOriginalFileInfo,
    getShareStatus,
    getOrCreateShareToken,
    getResumeFileByToken
};
