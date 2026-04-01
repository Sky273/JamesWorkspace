export function getFirstDefinedValue(source, keys) {
    for (const key of keys) {
        if (Object.prototype.hasOwnProperty.call(source, key) && source[key] !== undefined) {
            return source[key];
        }
    }
    return undefined;
}

export function normalizeClientPayload(payload = {}) {
    return {
        ...payload,
        name: getFirstDefinedValue(payload, ['name', 'Name']),
        type: getFirstDefinedValue(payload, ['type', 'Type']),
        status: getFirstDefinedValue(payload, ['status', 'Status']),
        address: getFirstDefinedValue(payload, ['address', 'Address']),
        website: getFirstDefinedValue(payload, ['website', 'Website']),
        industry: getFirstDefinedValue(payload, ['industry', 'Industry']),
        notes: getFirstDefinedValue(payload, ['notes', 'Notes']),
        firm_id: getFirstDefinedValue(payload, ['firm_id', 'firmId', 'FirmId'])
    };
}

export function normalizeContactPayload(payload = {}) {
    return {
        ...payload,
        name: getFirstDefinedValue(payload, ['name', 'Name']),
        role: getFirstDefinedValue(payload, ['role', 'Role']),
        email: getFirstDefinedValue(payload, ['email', 'Email']),
        phone: getFirstDefinedValue(payload, ['phone', 'Phone']),
        is_primary: getFirstDefinedValue(payload, ['is_primary', 'isPrimary', 'IsPrimary'])
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
