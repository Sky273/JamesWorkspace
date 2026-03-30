import crypto from 'crypto';
import { safeLog } from '../../../utils/logger.backend.js';
import { markConsentError, sendConsentRequest } from '../../consent.service.js';

export function normalizeProfileType(profileType) {
    return profileType === 'employee' ? 'employee' : 'external';
}

export function stringifyJsonField(value, fallback = null) {
    if (value === undefined) return undefined;
    if (value === null) return fallback;
    return JSON.stringify(value);
}

export function extractSummaryText(analysis) {
    const summary = analysis?.summary ?? analysis?.Summary;
    if (typeof summary === 'string') {
        return summary.trim() || null;
    }
    if (summary && typeof summary === 'object') {
        const highlights = Array.isArray(summary.profileHighlights) ? summary.profileHighlights.filter(Boolean).map(String) : [];
        if (highlights.length > 0) {
            return highlights.join(' ');
        }
    }
    return null;
}

export function buildConsentMetadata(options = {}) {
    const profileType = normalizeProfileType(options.profileType);
    const candidateName = typeof options.candidateName === 'string' && options.candidateName.trim().length > 0
        ? options.candidateName.trim()
        : null;
    const candidateEmail = profileType === 'external' && typeof options.candidateEmail === 'string' && options.candidateEmail.trim().length > 0
        ? options.candidateEmail.trim()
        : null;
    const consentStatus = profileType === 'employee' ? 'not_required' : 'pending_consent';
    const consentToken = profileType === 'external' ? crypto.randomBytes(32).toString('hex') : null;
    const consentTokenExpiresAt = profileType === 'external'
        ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
        : null;
    const consentRequestedAt = profileType === 'external' ? new Date() : null;
    const retentionUntil = profileType === 'employee'
        ? null
        : new Date(Date.now() + 2 * 365 * 24 * 60 * 60 * 1000);

    return {
        profileType,
        candidateName,
        candidateEmail,
        consentStatus,
        consentToken,
        consentTokenExpiresAt,
        consentRequestedAt,
        retentionUntil
    };
}

export async function sendConsentRequestIfNeeded(resumeId, consentMetadata, firmId) {
    if (consentMetadata.profileType !== 'external' || !consentMetadata.candidateEmail || !firmId) {
        return;
    }

    try {
        await sendConsentRequest(resumeId);
    } catch (error) {
        safeLog('error', 'Failed to send GDPR consent email for batch import', {
            resumeId,
            firmId,
            error: error.message
        });
        await markConsentError(resumeId).catch(markError => {
            safeLog('error', 'Failed to mark consent email error for batch import', {
                resumeId,
                firmId,
                error: markError.message
            });
        });
    }
}
