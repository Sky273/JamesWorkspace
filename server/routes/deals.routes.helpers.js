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

export function validateDealTitle(normalizedDeal, { required = false } = {}) {
    if (!required) {
        return { ok: true };
    }

    if (!normalizedDeal.title || normalizedDeal.title.trim().length === 0) {
        return { ok: false, status: 400, error: 'Title is required' };
    }

    return { ok: true };
}

export function resolveDealRelationIds({ body = {}, normalizedDeal = {}, existingDeal = null }) {
    const hasClientUpdate =
        Object.prototype.hasOwnProperty.call(body, 'client_id') ||
        Object.prototype.hasOwnProperty.call(body, 'clientId');
    const hasContactUpdate =
        Object.prototype.hasOwnProperty.call(body, 'contact_id') ||
        Object.prototype.hasOwnProperty.call(body, 'contactId');

    const currentClientId = existingDeal?.client_id || null;
    const currentContactId = existingDeal?.contact_id || null;
    const nextClientId = normalizedDeal.client_id && normalizedDeal.client_id.trim() !== ''
        ? normalizedDeal.client_id
        : null;
    const nextContactId = normalizedDeal.contact_id && normalizedDeal.contact_id.trim() !== ''
        ? normalizedDeal.contact_id
        : null;

    return {
        clientId: existingDeal
            ? (hasClientUpdate ? nextClientId : currentClientId)
            : nextClientId,
        contactId: existingDeal
            ? (hasContactUpdate ? nextContactId : currentContactId)
            : nextContactId
    };
}

export async function validateDealRelations({ firmId, clientId, contactId }, { getClientFirmId, getContactOwnership }) {
    if (clientId) {
        const clientFirmId = await getClientFirmId(clientId);
        if (!clientFirmId) {
            return { ok: false, status: 400, error: 'Client not found' };
        }
        if (clientFirmId !== firmId) {
            return { ok: false, status: 403, error: 'Client belongs to different firm' };
        }
    }

    if (contactId) {
        const contact = await getContactOwnership(contactId);
        if (!contact) {
            return { ok: false, status: 400, error: 'Contact not found' };
        }
        if (contact.firm_id !== firmId) {
            return { ok: false, status: 403, error: 'Contact belongs to different firm' };
        }
        if (clientId && contact.client_id !== clientId) {
            return { ok: false, status: 400, error: 'Contact does not belong to the provided client' };
        }
    }

    return { ok: true };
}

export async function prepareDealMutationPayload(
    { body = {}, firmId, existingDeal = null, requireTitle = false },
    relationDeps
) {
    const normalizedDeal = normalizeDealPayload(body);
    const titleValidation = validateDealTitle(normalizedDeal, { required: requireTitle });
    if (!titleValidation.ok) {
        return titleValidation;
    }

    const relationIds = resolveDealRelationIds({
        body,
        normalizedDeal,
        existingDeal
    });

    const relationValidation = await validateDealRelations(
        { firmId, clientId: relationIds.clientId, contactId: relationIds.contactId },
        relationDeps
    );
    if (!relationValidation.ok) {
        return relationValidation;
    }

    return { ok: true, normalizedDeal };
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

export async function requireFirmScopedAccess(req, res, { getUserFirmId, isUserAdmin, missingFirmMessage }) {
    const userFirmId = await getUserFirmId(req);
    const admin = isUserAdmin(req);
    const access = ensureFirmScopedAccess({ isAdmin: admin, userFirmId, missingFirmMessage });
    if (!access.ok) {
        res.status(access.status).json({ error: access.error });
        return null;
    }

    return {
        isAdmin: admin,
        userFirmId
    };
}

export async function withFirmScopedAccess(req, res, deps, handler) {
    const access = await requireFirmScopedAccess(req, res, deps);
    if (!access) {
        return null;
    }

    return handler(access);
}

export function resolveScopedFirmId({ scopedAccess, requestedFirmId }) {
    return scopedAccess.isAdmin && requestedFirmId ? requestedFirmId : scopedAccess.userFirmId;
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

export function buildDealsListFilters(query = {}) {
    return {
        clientId: query.clientId,
        status: query.status,
        priority: query.priority,
        search: query.search
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

export async function requireDealAccess(req, res, dealId, deps) {
    const access = await checkDealAccess(req, dealId, deps);
    if (!access.hasAccess) {
        res.status(access.status || (access.error === 'Deal not found' ? 404 : 403)).json({ error: access.error });
        return null;
    }

    return access;
}

export async function withDealAccess(req, res, dealId, deps, handler) {
    const access = await requireDealAccess(req, res, dealId, deps);
    if (!access) {
        return null;
    }

    return handler(access);
}

export async function checkResumeFirmAccess({ resumeId, firmId }, { getResumeFirmId }) {
    const resumeFirmId = await getResumeFirmId(resumeId);
    if (!resumeFirmId) {
        return { ok: false, status: 404, error: 'Resume not found' };
    }
    if (resumeFirmId !== firmId) {
        return { ok: false, status: 403, error: 'Access denied' };
    }

    return { ok: true, resumeFirmId };
}

export async function requireResumeFirmAccess(res, { resumeId, firmId, forbiddenError = 'Access denied' }, deps) {
    const access = await checkResumeFirmAccess({ resumeId, firmId }, deps);
    if (!access.ok) {
        const error = access.status === 403 ? forbiddenError : access.error;
        res.status(access.status).json({ error });
        return null;
    }

    return access;
}

export async function withResumeFirmAccess(res, options, deps, handler) {
    const access = await requireResumeFirmAccess(res, options, deps);
    if (!access) {
        return null;
    }

    return handler(access);
}

export function validateBulkResumeAssociationRequest({ resumeId, dealIds }) {
    if (!resumeId || !dealIds || !Array.isArray(dealIds) || dealIds.length === 0) {
        return { ok: false, status: 400, error: 'resumeId and dealIds array are required' };
    }

    return { ok: true };
}

export function buildBulkResumeAssociationResponse(results, errors) {
    return {
        success: results.length > 0,
        added: results.length,
        errors: errors.length > 0 ? errors : undefined
    };
}

export async function processBulkResumeAssociation(
    { req, dealIds, resumeId, userId },
    { checkDealAccess, addResumeToDeal, dealAccessDeps }
) {
    const results = [];
    const errors = [];

    for (const dealId of dealIds) {
        try {
            const dealAccess = await checkDealAccess(req, dealId, dealAccessDeps);
            if (!dealAccess.hasAccess) {
                errors.push({ dealId, error: dealAccess.error });
                continue;
            }

            const result = await addResumeToDeal(dealId, resumeId, userId);
            results.push(result);
        } catch (error) {
            errors.push({ dealId, error: error.message });
        }
    }

    return { results, errors };
}
