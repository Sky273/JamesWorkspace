import fs from 'fs/promises';
import path from 'path';
import { query } from '../config/database.js';
import { safeLog } from '../utils/logger.backend.js';
import {
    createStoredShareToken,
    generateShareToken,
    readStoredShareToken
} from '../utils/shareTokenStorage.js';
import {
    RESOLVED_SHARED_PDF_DIR,
    SHARE_LINK_TTL_MS
} from './shareResume.constants.js';

export function createEmptyShareStatus() {
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

export function buildShareExpiryDate(now = new Date()) {
    return new Date(now.getTime() + SHARE_LINK_TTL_MS);
}

export function isExpired(expiresAt, now = new Date()) {
    if (!expiresAt) {
        return true;
    }

    const expiryDate = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
    return Number.isNaN(expiryDate.getTime()) || expiryDate <= now;
}

export function isManagedSharedPdfPath(filePath) {
    if (!filePath) {
        return false;
    }

    const resolvedPath = path.resolve(filePath);
    return resolvedPath === RESOLVED_SHARED_PDF_DIR || resolvedPath.startsWith(`${RESOLVED_SHARED_PDF_DIR}${path.sep}`);
}

export async function deleteSharedPdfFile(filePath) {
    if (!isManagedSharedPdfPath(filePath)) {
        return false;
    }

    try {
        await fs.unlink(filePath);
        return true;
    } catch (error) {
        if (error?.code !== 'ENOENT') {
            safeLog('warn', 'Failed to delete shared PDF file', { filePath, error: error.message });
        }
        return false;
    }
}

export async function getShareRowByResumeId(resumeId) {
    const result = await query(
        `SELECT id, shared_pdf_path, shared_pdf_token, shared_pdf_expires_at, shared_file_token, shared_file_expires_at
         FROM resumes
         WHERE id = $1`,
        [resumeId]
    );

    return result.rows[0] || null;
}

export async function getOrCreateShareToken(resumeId, { tokenColumn, expiresColumn }) {
    const share = await getShareRowByResumeId(resumeId);
    let token = share?.[tokenColumn] ? readStoredShareToken(share[tokenColumn]) : null;
    let expiresAt = share?.[expiresColumn];

    if (!token || isExpired(expiresAt)) {
        token = generateShareToken();
        const storedToken = createStoredShareToken(token);
        expiresAt = buildShareExpiryDate();
        await query(
            `UPDATE resumes SET ${tokenColumn} = $1, ${expiresColumn} = $2 WHERE id = $3`,
            [storedToken, expiresAt, resumeId]
        );
    }

    return token;
}
