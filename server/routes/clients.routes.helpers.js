import { normalizeRequestBodyAliases } from '../utils/validation.js';
import { normalizeRequestTextFields } from '../utils/requestTextNormalization.js';

export function normalizeClientPayload(payload = {}) {
    const normalized = normalizeRequestTextFields(
        normalizeRequestBodyAliases(payload),
        ['name', 'address', 'website', 'industry', 'notes']
    );

    return {
        ...normalized,
        name: normalized.name,
        type: normalized.type,
        status: normalized.status,
        address: normalized.address,
        website: normalized.website,
        industry: normalized.industry,
        notes: normalized.notes,
        firm_id: normalized.firmId
    };
}

export function normalizeContactPayload(payload = {}) {
    const normalized = normalizeRequestTextFields(
        normalizeRequestBodyAliases(payload),
        ['name', 'role', 'phone']
    );

    return {
        ...normalized,
        name: normalized.name,
        role: normalized.role,
        email: normalized.email,
        phone: normalized.phone,
        is_primary: normalized.isPrimary
    };
}

export function ensureFirmScopedAccess({ isAdmin, userFirmId, missingFirmMessage = 'No firm association' }) {
    if (isAdmin) {
        return { ok: true };
    }

    if (!userFirmId) {
        return { ok: false, status: 403, error: missingFirmMessage };
    }

    return { ok: true };
}

export function parsePaginationParams(pageValue, limitValue, { defaultPage = 1, defaultLimit = 20, maxLimit = 100 } = {}) {
    const hasPage = pageValue !== undefined;
    const hasLimit = limitValue !== undefined;
    const page = hasPage ? Number.parseInt(pageValue, 10) : defaultPage;
    const limit = hasLimit ? Number.parseInt(limitValue, 10) : defaultLimit;

    if ((hasPage && (!Number.isInteger(page) || page < 1)) || (hasLimit && (!Number.isInteger(limit) || limit < 1 || limit > maxLimit))) {
        return { ok: false, error: 'Invalid pagination parameters' };
    }

    return {
        ok: true,
        value: { page, limit }
    };
}
