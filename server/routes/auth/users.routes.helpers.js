export function getFirstDefinedValue(source, keys) {
    for (const key of keys) {
        if (Object.prototype.hasOwnProperty.call(source, key) && source[key] !== undefined) {
            return source[key];
        }
    }
    return undefined;
}

export function normalizeAdminUserPayload(payload = {}) {
    return {
        ...payload,
        email: getFirstDefinedValue(payload, ['email', 'Email']),
        password: getFirstDefinedValue(payload, ['password', 'Password']),
        name: getFirstDefinedValue(payload, ['name', 'Name']),
        jobTitle: getFirstDefinedValue(payload, ['jobTitle', 'job_title', 'JobTitle']),
        phone: getFirstDefinedValue(payload, ['phone', 'Phone']),
        status: getFirstDefinedValue(payload, ['status', 'Status']),
        firm: getFirstDefinedValue(payload, ['firm', 'Firm']),
        firmId: getFirstDefinedValue(payload, ['firmId', 'firm_id', 'FirmId', 'Firm ID']),
        customer: getFirstDefinedValue(payload, ['customer', 'Customer']),
        role: getFirstDefinedValue(payload, ['role', 'Role'])
    };
}

export function resolveRequiredFirmId(normalizedPayload = {}) {
    const firmId = normalizedPayload.firmId;
    return typeof firmId === 'string' ? firmId.trim() : '';
}

export function normalizeRole(role) {
    const normalizedRole = String(role || 'user').toLowerCase();
    return ['admin', 'user'].includes(normalizedRole) ? normalizedRole : 'user';
}

export function buildAdminUserUpdateData(normalizedPayload, currentUser, hashedPassword) {
    const updateData = {};
    const name = normalizedPayload.name;
    const email = normalizedPayload.email;
    const status = normalizedPayload.status;
    const role = normalizedPayload.role;
    const jobTitle = normalizedPayload.jobTitle;
    const phone = normalizedPayload.phone;

    if (name && name !== currentUser.name) updateData.name = name;
    if (email && email.toLowerCase() !== currentUser.email.toLowerCase()) {
        updateData.email = email.toLowerCase();
    }
    if (status) updateData.status = status.toLowerCase();
    if (role) updateData.role = role.toLowerCase();
    if (jobTitle !== undefined) updateData.job_title = jobTitle || null;
    if (phone !== undefined) updateData.phone = phone || null;
    if (hashedPassword) {
        updateData.password = hashedPassword;
    }

    return updateData;
}
