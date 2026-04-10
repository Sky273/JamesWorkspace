import { normalizeRequestBodyAliases } from '../utils/validation.js';

export function normalizeAdaptationPayload(payload = {}) {
    const normalized = normalizeRequestBodyAliases(payload);

    return {
        adaptedText: normalized.adaptedText,
        adaptedTitle: normalized.adaptedTitle,
        status: normalized.status,
        matchScore: normalized.matchScore,
        matchAnalysis: normalized.matchAnalysis
    };
}

export function ensureAdaptationFirmAccess({ isAdmin, userFirmId, record, missingFirmMessage = 'No firm association' }) {
    if (isAdmin) {
        return { ok: true };
    }

    if (!userFirmId) {
        return { ok: false, status: 403, error: missingFirmMessage };
    }

    if (record && record.firm_id !== userFirmId) {
        return { ok: false, status: 403, error: 'Access denied' };
    }

    return { ok: true };
}
