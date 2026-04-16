/**
 * Share Resume Service
 * Manages PDF generation and sharing for resumes
 */

import { query } from '../config/database.js';
import { safeLog } from '../utils/logger.backend.js';
import fs from 'fs/promises';
import path from 'path';
import { assertSchemaRequirements } from './schemaVerification.service.js';
import {
    createStoredShareToken,
    generateShareToken,
    getStoredShareTokenLookup,
    readStoredShareToken
} from '../utils/shareTokenStorage.js';
import { SHARED_PDF_DIR } from './shareResume.constants.js';
import {
    buildShareExpiryDate,
    createEmptyShareStatus,
    deleteSharedPdfFile,
    getOrCreateShareToken,
    getShareRowByResumeId,
    isExpired,
    isManagedSharedPdfPath,
    resolveManagedSharedPdfPath
} from './shareResume.helpers.js';
export { SHARE_LINK_TTL_DAYS, SHARE_LINK_TTL_MS } from './shareResume.constants.js';

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
export async function storeSharedPdf(resumeId, pdfBuffer, _filename) {
    let pdfPath = null;
    let storedPdfPath = null;

    try {
        const existingShare = await getShareRowByResumeId(resumeId);
        const token = generateShareToken();
        const storedToken = createStoredShareToken(token);
        const expiresAt = buildShareExpiryDate();
        storedPdfPath = token;
        pdfPath = path.join(SHARED_PDF_DIR, storedPdfPath);

        await fs.writeFile(pdfPath, pdfBuffer);

        await query(
            `UPDATE resumes
             SET shared_pdf_path = $1, shared_pdf_token = $2, shared_pdf_expires_at = $3
             WHERE id = $4`,
            [storedPdfPath, storedToken, expiresAt, resumeId]
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
        if (pdfPath) {
            await deleteSharedPdfFile(pdfPath);
        }
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
        const lookup = getStoredShareTokenLookup(token);
        const result = await query(
            `SELECT id, shared_pdf_path, name, shared_pdf_expires_at
             FROM resumes
             WHERE shared_pdf_token = $1 OR shared_pdf_token LIKE $2`,
            [lookup.exactToken, lookup.v2Pattern]
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

        if (!isManagedSharedPdfPath(resume.shared_pdf_path)) {
            safeLog('warn', 'Shared PDF path rejected because it is outside managed directory', {
                resumeId: resume.id,
                token: token.substring(0, 8) + '...'
            });
            return null;
        }

        const resolvedPath = resolveManagedSharedPdfPath(resume.shared_pdf_path || '');
        try {
            await fs.access(resolvedPath);
        } catch {
            safeLog('warn', 'Shared PDF file not found', { token });
            return null;
        }

        return {
            path: resolvedPath,
            resumeId: resume.id,
            name: resume.name,
            expiresAt: resume.shared_pdf_expires_at
        };
    } catch (error) {
        safeLog('error', 'Failed to get shared PDF', {
            error: error.message
        });
        const serviceError = new Error('Failed to get shared PDF');
        serviceError.code = 'SHARE_PDF_LOOKUP_FAILED';
        serviceError.statusCode = 503;
        serviceError.cause = error;
        throw serviceError;
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
        const serviceError = new Error('Failed to get original file info');
        serviceError.code = 'SHARE_ORIGINAL_FILE_LOOKUP_FAILED';
        serviceError.statusCode = 503;
        serviceError.cause = error;
        throw serviceError;
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
            return createEmptyShareStatus();
        }

        const row = result.rows[0];
        const hasSharedPdf = !!row.shared_pdf_token && !isExpired(row.shared_pdf_expires_at);
        const hasSharedFile = !!row.shared_file_token && !isExpired(row.shared_file_expires_at);
        const pdfToken = hasSharedPdf ? readStoredShareToken(row.shared_pdf_token) : null;
        const fileToken = hasSharedFile ? readStoredShareToken(row.shared_file_token) : null;

        return {
            hasSharedPdf,
            token: pdfToken,
            expiresAt: hasSharedPdf ? row.shared_pdf_expires_at : null,
            pdfToken,
            pdfExpiresAt: hasSharedPdf ? row.shared_pdf_expires_at : null,
            hasSharedFile,
            fileToken,
            fileExpiresAt: hasSharedFile ? row.shared_file_expires_at : null
        };
    } catch (error) {
        safeLog('error', 'Failed to get share status', {
            resumeId,
            error: error.message
        });
        const serviceError = new Error('Failed to get share status');
        serviceError.code = 'SHARE_STATUS_LOOKUP_FAILED';
        serviceError.cause = error;
        throw serviceError;
    }
}

export async function getOrCreateSharedPdfToken(resumeId) {
    return getOrCreateShareToken(resumeId, {
        tokenColumn: 'shared_pdf_token',
        expiresColumn: 'shared_pdf_expires_at'
    });
}

export async function getOrCreateOriginalFileToken(resumeId) {
    return getOrCreateShareToken(resumeId, {
        tokenColumn: 'shared_file_token',
        expiresColumn: 'shared_file_expires_at'
    });
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

export async function cleanupExpiredShareArtifacts(now = new Date()) {
    try {
        const result = await query(
            `SELECT id, shared_pdf_path, shared_pdf_token, shared_pdf_expires_at, shared_file_token, shared_file_expires_at
             FROM resumes
             WHERE (shared_pdf_token IS NOT NULL AND shared_pdf_expires_at IS NOT NULL AND shared_pdf_expires_at < $1)
                OR (shared_file_token IS NOT NULL AND shared_file_expires_at IS NOT NULL AND shared_file_expires_at < $1)`,
            [now]
        );

        let expiredPdfLinksCleared = 0;
        let expiredFileLinksCleared = 0;
        let expiredPdfFilesDeleted = 0;

        for (const share of result.rows) {
            const updates = [];
            const params = [];
            let paramIndex = 1;

            if (share.shared_pdf_token && isExpired(share.shared_pdf_expires_at, now)) {
                const deleted = await deleteSharedPdfFile(share.shared_pdf_path);
                if (deleted) {
                    expiredPdfFilesDeleted++;
                }
                updates.push('shared_pdf_path = NULL');
                updates.push('shared_pdf_token = NULL');
                updates.push('shared_pdf_expires_at = NULL');
                expiredPdfLinksCleared++;
            }

            if (share.shared_file_token && isExpired(share.shared_file_expires_at, now)) {
                updates.push('shared_file_token = NULL');
                updates.push('shared_file_expires_at = NULL');
                expiredFileLinksCleared++;
            }

            if (updates.length === 0) {
                continue;
            }

            params.push(share.id);
            await query(
                `UPDATE resumes
                 SET ${updates.join(', ')}
                 WHERE id = $${paramIndex}`,
                params
            );
        }

        if (expiredPdfLinksCleared > 0 || expiredFileLinksCleared > 0 || expiredPdfFilesDeleted > 0) {
            safeLog('info', 'Expired share artifacts cleaned up', {
                expiredPdfLinksCleared,
                expiredFileLinksCleared,
                expiredPdfFilesDeleted
            });
        }

        return {
            expiredPdfLinksCleared,
            expiredFileLinksCleared,
            expiredPdfFilesDeleted
        };
    } catch (error) {
        safeLog('error', 'Failed to cleanup expired share artifacts', { error: error.message });
        return {
            expiredPdfLinksCleared: 0,
            expiredFileLinksCleared: 0,
            expiredPdfFilesDeleted: 0
        };
    }
}

export async function getResumeFileByToken(token) {
    const metadata = await getResumeFileMetadataByToken(token);
    if (!metadata?.has_file) {
        return null;
    }

    const resumeFileData = await getResumeFileDataById(metadata.id);
    if (!resumeFileData) {
        return null;
    }

    return {
        ...metadata,
        resume_file_data: resumeFileData
    };
}

export async function getResumeFileMetadataByToken(token) {
    const lookup = getStoredShareTokenLookup(token);
    const result = await query(
        `SELECT id, file_name, name, resume_file_type, resume_file_size, shared_file_expires_at,
                resume_file_data IS NOT NULL AS has_file
         FROM resumes
         WHERE shared_file_token = $1 OR shared_file_token LIKE $2`,
        [lookup.exactToken, lookup.v2Pattern]
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

    return resume.has_file ? resume : null;
}

export async function getResumeFileDataById(resumeId) {
    const result = await query(
        `SELECT resume_file_data
         FROM resumes
         WHERE id = $1`,
        [resumeId]
    );

    return result.rows[0]?.resume_file_data || null;
}
