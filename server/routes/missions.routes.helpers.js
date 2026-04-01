export function getFirstDefinedValue(source, keys) {
    for (const key of keys) {
        if (source[key] !== undefined) {
            return source[key];
        }
    }
    return undefined;
}

export function normalizeMissionPayload(payload = {}) {
    return {
        title: getFirstDefinedValue(payload, ['title', 'Title']),
        content: getFirstDefinedValue(payload, ['content', 'Content']),
        status: getFirstDefinedValue(payload, ['status', 'Status']),
        firm: getFirstDefinedValue(payload, ['firm', 'Firm']),
        firmId: getFirstDefinedValue(payload, ['firmId', 'firm_id', 'Firm ID']),
        clientId: getFirstDefinedValue(payload, ['clientId', 'client_id', 'Client ID']),
        contactId: getFirstDefinedValue(payload, ['contactId', 'contact_id', 'Contact ID']),
        dealId: getFirstDefinedValue(payload, ['dealId', 'deal_id', 'Deal ID']),
        keywords: getFirstDefinedValue(payload, ['keywords', 'Keywords']),
        requiredSkills: getFirstDefinedValue(payload, ['requiredSkills', 'required_skills', 'Required Skills']),
        preferredSkills: getFirstDefinedValue(payload, ['preferredSkills', 'preferred_skills', 'Preferred Skills'])
    };
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

export function hasMissionFirmAccess({ isAdmin, userFirmId, mission }) {
    if (isAdmin) {
        return true;
    }

    if (!mission) {
        return false;
    }

    if (userFirmId && mission.firm_id) {
        return mission.firm_id === userFirmId;
    }

    if (!userFirmId) {
        return false;
    }

    return false;
}

export function ensureMissionFirmAccess({ isAdmin, userFirmId, mission, missingFirmMessage = 'No firm association' }) {
    if (isAdmin) {
        return { ok: true };
    }

    if (!userFirmId) {
        return { ok: false, status: 403, error: missingFirmMessage };
    }

    if (!hasMissionFirmAccess({ isAdmin, userFirmId, mission })) {
        return { ok: false, status: 403, error: 'Access denied' };
    }

    return { ok: true };
}
