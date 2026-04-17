import { query } from '../config/database.js';
import { resolveResumeExecutor } from './resumesPersistence.service.js';
import {
    invalidateResumeMutationViews,
    invalidateResumeMutationViewsForRows
} from './resumesInvalidation.service.js';

export async function updateConsentStatus(id, consentStatus, { executor } = {}) {
    const run = resolveResumeExecutor(executor) || query;
    await run(
        'UPDATE resumes SET consent_status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [consentStatus, id]
    );
}

export async function initializeResumeConsent({
    resumeId,
    profileType,
    candidateName,
    candidateEmail,
    consentStatus,
    consentToken,
    tokenExpiresAt
}, { executor } = {}) {
    const run = resolveResumeExecutor(executor) || query;
    const result = await run(`
        UPDATE resumes
        SET profile_type = $1,
            candidate_name = $2,
            candidate_email = $3,
            consent_status = $4,
            consent_token = $5,
            consent_token_expires_at = $6,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $7
        RETURNING id, firm_id, profile_type, candidate_name, candidate_email, consent_status,
                  consent_token, consent_token_expires_at, consent_requested_at
    `, [
        profileType,
        candidateName,
        candidateEmail || null,
        consentStatus,
        consentToken,
        tokenExpiresAt,
        resumeId
    ]);

    if (result.rows.length === 0) {
        throw new Error('Resume not found');
    }

    await invalidateResumeMutationViews(result.rows[0].id, result.rows[0].firm_id || null);
    return result.rows[0];
}

export async function markResumeConsentRequested(resumeId, { executor } = {}) {
    const run = resolveResumeExecutor(executor) || query;
    const result = await run(`
        UPDATE resumes
        SET consent_requested_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING id, firm_id
    `, [resumeId]);

    if (result.rows.length === 0) {
        throw new Error('Resume not found');
    }

    await invalidateResumeMutationViews(result.rows[0].id, result.rows[0].firm_id || null);
    return result.rows[0];
}

export async function recordResumeConsentResponse(
    resumeId,
    consentStatus,
    retentionUntil,
    { executor } = {}
) {
    const run = resolveResumeExecutor(executor) || query;
    const result = await run(`
        UPDATE resumes
        SET consent_status = $1,
            consent_responded_at = CURRENT_TIMESTAMP,
            retention_until = $2,
            consent_token = NULL,
            consent_token_expires_at = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
        RETURNING id, firm_id, consent_status, consent_responded_at, retention_until
    `, [consentStatus, retentionUntil, resumeId]);

    if (result.rows.length === 0) {
        throw new Error('Resume not found');
    }

    await invalidateResumeMutationViews(result.rows[0].id, result.rows[0].firm_id || null);
    return result.rows[0];
}

export async function resetResumeConsentForResend(
    resumeId,
    consentToken,
    tokenExpiresAt,
    { executor } = {}
) {
    const run = resolveResumeExecutor(executor) || query;
    const result = await run(`
        UPDATE resumes
        SET consent_token = $1,
            consent_token_expires_at = $2,
            consent_status = 'pending_consent',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
        RETURNING id, firm_id
    `, [consentToken, tokenExpiresAt, resumeId]);

    if (result.rows.length === 0) {
        throw new Error('Resume not found');
    }

    await invalidateResumeMutationViews(result.rows[0].id, result.rows[0].firm_id || null);
    return result.rows[0];
}

export async function markResumeConsentError(resumeId, { executor, pendingOnly = false } = {}) {
    const run = resolveResumeExecutor(executor) || query;
    const params = [resumeId];
    const pendingClause = pendingOnly ? ' AND consent_status = $2' : '';
    if (pendingOnly) {
        params.push('pending_consent');
    }

    const result = await run(`
        UPDATE resumes
        SET consent_status = 'error',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1${pendingClause}
        RETURNING id, firm_id
    `, params);

    if (result.rows[0]) {
        await invalidateResumeMutationViews(result.rows[0].id, result.rows[0].firm_id || null);
    }

    return result.rows[0] || null;
}

export async function expirePendingConsents() {
    const result = await query(`
        UPDATE resumes
        SET consent_status = 'expired',
            updated_at = CURRENT_TIMESTAMP
        WHERE consent_status = 'pending_consent'
          AND consent_token_expires_at IS NOT NULL
          AND consent_token_expires_at < CURRENT_TIMESTAMP
        RETURNING id, firm_id
    `);
    await invalidateResumeMutationViewsForRows(result.rows);
    return result;
}

export async function expireRetentionConsents() {
    const result = await query(`
        UPDATE resumes
        SET consent_status = 'expired',
            updated_at = CURRENT_TIMESTAMP
        WHERE consent_status = 'active'
          AND retention_until IS NOT NULL
          AND retention_until < CURRENT_TIMESTAMP
        RETURNING id, firm_id
    `);
    await invalidateResumeMutationViewsForRows(result.rows);
    return result;
}

export async function recordConsentReminderSent(resumeId) {
    const result = await query(`
        UPDATE resumes
        SET consent_reminder_sent_at = CURRENT_TIMESTAMP,
            consent_reminder_count = consent_reminder_count + 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING id, firm_id
    `, [resumeId]);
    if (result.rows[0]?.firm_id) {
        await invalidateResumeMutationViews(resumeId, result.rows[0].firm_id);
    }
    return result;
}
