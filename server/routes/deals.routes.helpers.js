export function getFirstDefinedValue(source, keys) {
    for (const key of keys) {
        if (Object.prototype.hasOwnProperty.call(source, key) && source[key] !== undefined) {
            return source[key];
        }
    }
    return undefined;
}

export function normalizeDealPayload(payload = {}) {
    return {
        ...payload,
        title: getFirstDefinedValue(payload, ['title', 'Title']),
        description: getFirstDefinedValue(payload, ['description', 'Description']),
        client_id: getFirstDefinedValue(payload, ['client_id', 'clientId']),
        contact_id: getFirstDefinedValue(payload, ['contact_id', 'contactId']),
        status: getFirstDefinedValue(payload, ['status', 'Status']),
        expected_start_date: getFirstDefinedValue(payload, ['expected_start_date', 'expectedStartDate']),
        expected_end_date: getFirstDefinedValue(payload, ['expected_end_date', 'expectedEndDate']),
        budget_min: getFirstDefinedValue(payload, ['budget_min', 'budgetMin']),
        budget_max: getFirstDefinedValue(payload, ['budget_max', 'budgetMax']),
        priority: getFirstDefinedValue(payload, ['priority', 'Priority']),
        tags: getFirstDefinedValue(payload, ['tags', 'Tags']),
        notes: getFirstDefinedValue(payload, ['notes', 'Notes'])
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

export async function checkDealAccess(req, dealId, { getDealFirmId, getUserFirmId, isUserAdmin }) {
    try {
        const dealFirmId = await getDealFirmId(dealId);
        if (!dealFirmId) {
            return { hasAccess: false, error: 'Deal not found', status: 404 };
        }

        const admin = isUserAdmin(req);
        if (admin) {
            return { hasAccess: true, firmId: dealFirmId };
        }

        const userFirmId = await getUserFirmId(req);
        if (!userFirmId) {
            return { hasAccess: false, error: 'No firm association', status: 403 };
        }
        if (dealFirmId !== userFirmId) {
            return { hasAccess: false, error: 'Access denied', status: 403 };
        }

        return { hasAccess: true, firmId: userFirmId };
    } catch {
        return { hasAccess: false, error: 'Failed to validate deal access', status: 500 };
    }
}
