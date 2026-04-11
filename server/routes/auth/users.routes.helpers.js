import { normalizeRequestBodyAliases } from '../../utils/validation.js';

export function normalizeAdminUserPayload(payload = {}) {
    const normalized = normalizeRequestBodyAliases(payload);

    return {
        ...normalized,
        email: normalized.email,
        name: normalized.name,
        jobTitle: normalized.jobTitle,
        phone: normalized.phone,
        status: normalized.status,
        firm: normalized.firm,
        firmId: normalized.firmId,
        customer: normalized.customer,
        role: normalized.role
    };
}

export function resolveRequiredFirmId(normalizedPayload = {}) {
    const firmId = normalizedPayload.firmId;
    return typeof firmId === 'string' ? firmId.trim() : '';
}

export function normalizeRole(role) {
    const normalizedRole = String(role || 'user').trim().toLowerCase();

    if (normalizedRole === 'admin') {
        return 'admin';
    }

    if (normalizedRole === 'localadmin' || normalizedRole === 'local_admin') {
        return 'localAdmin';
    }

    return normalizedRole === 'user' ? 'user' : 'user';
}

export function buildAdminUserUpdateData(normalizedPayload, currentUser) {
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
    if (role) updateData.role = normalizeRole(role);
    if (jobTitle !== undefined) updateData.job_title = jobTitle || null;
    if (phone !== undefined) updateData.phone = phone || null;
    return updateData;
}
