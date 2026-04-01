export function getFirstDefinedValue(source, keys) {
    for (const key of keys) {
        if (source[key] !== undefined) {
            return source[key];
        }
    }
    return undefined;
}

export function normalizeAdaptationPayload(payload = {}) {
    return {
        adaptedText: getFirstDefinedValue(payload, ['adaptedText', 'adapted_text', 'Adapted Text']),
        adaptedTitle: getFirstDefinedValue(payload, ['adaptedTitle', 'adapted_title', 'Adapted Title']),
        status: getFirstDefinedValue(payload, ['status', 'Status']),
        matchScore: getFirstDefinedValue(payload, ['matchScore', 'match_score', 'Match Score']),
        matchAnalysis: getFirstDefinedValue(payload, ['matchAnalysis', 'match_analysis', 'Match Analysis'])
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
