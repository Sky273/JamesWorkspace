/**
 * Consent Scheduler Tasks
 * Automated tasks for consent expiry, reminders, and purging
 */

import { query } from '../../config/database.js';
import { transaction } from '../../utils/postgresHelpers.js';
import { safeLog } from '../../utils/logger.backend.js';
import { gdprMailService } from '../mail/gdprMailService.js';
import { logGdprAction, GDPR_ACTIONS } from '../gdprAudit.service.js';
import { getFrontendUrl, buildConsentReminderEmailHtml } from './emailTemplates.js';
import {
    deleteResume,
    expirePendingConsents,
    expireRetentionConsents,
    getResumeAuditInfo,
    recordConsentReminderSent
} from '../resumes.service.js';
import { deleteSubmissionsByResumeId } from '../resumeSubmissions.service.js';
import { deleteVersionsByResumeId } from '../resumeVersions.service.js';
import { deleteAdaptationsByResumeId } from '../adaptations.service.js';
import { invalidateDashboardAndGroupedViews } from '../viewCacheInvalidation.service.js';

// Constants
const REMINDER_AFTER_DAYS = 7; // Send reminder after 1 week
let lastConsentSchedulerSummary = null;

function updateLastConsentSchedulerSummary(summary) {
    lastConsentSchedulerSummary = {
        timestamp: new Date().toISOString(),
        ...summary
    };
}

/**
 * Check for expired consents and mark them
 * Called by scheduler
 * @returns {Promise<number>} Number of resumes marked as expired
 */
export async function checkExpiredConsents() {
    // Mark pending consents that have expired (token expired)
    const expiredPending = await expirePendingConsents();

    // Mark active consents that have exceeded retention period
    const expiredRetention = await expireRetentionConsents();

    const totalExpired = expiredPending.rows.length + expiredRetention.rows.length;

    if (totalExpired > 0) {
        safeLog('info', 'Expired consents marked', { 
            pendingExpired: expiredPending.rows.length,
            retentionExpired: expiredRetention.rows.length 
        });
    }

    updateLastConsentSchedulerSummary({
        operation: 'checkExpiredConsents',
        status: 'completed',
        totalExpired,
        pendingExpired: expiredPending.rows.length,
        retentionExpired: expiredRetention.rows.length
    });

    return totalExpired;
}

/**
 * Send reminders for pending consents
 * Called by scheduler
 * @returns {Promise<number>} Number of reminders sent
 */
export async function sendConsentReminders() {
    const reminderThreshold = new Date(Date.now() - REMINDER_AFTER_DAYS * 24 * 60 * 60 * 1000);

    // Find resumes needing reminder
    const result = await query(`
        SELECT r.id, r.firm_id, r.candidate_name, r.candidate_email, r.consent_token,
               r.consent_token_expires_at, r.firm_name, f.logo_url as firm_logo
        FROM resumes r
        LEFT JOIN firms f ON r.firm_id = f.id
        WHERE r.consent_status = 'pending_consent'
          AND r.consent_requested_at IS NOT NULL
          AND r.consent_requested_at < $1
          AND (r.consent_reminder_sent_at IS NULL OR r.consent_reminder_sent_at < r.consent_requested_at)
          AND r.consent_reminder_count < 2
          AND r.consent_token IS NOT NULL
          AND r.consent_token_expires_at > CURRENT_TIMESTAMP
    `, [reminderThreshold]);

    let sentCount = 0;

    for (const resume of result.rows) {
        try {
            const frontendUrl = getFrontendUrl();
            const consentUrl = `${frontendUrl}/consent/${resume.consent_token}`;
            
            const daysRemaining = Math.ceil(
                (new Date(resume.consent_token_expires_at) - new Date()) / (24 * 60 * 60 * 1000)
            );

            const firmName = resume.firm_name || 'Notre cabinet';
            const emailHtml = buildConsentReminderEmailHtml({
                candidateName: resume.candidate_name,
                firmName,
                consentUrl,
                daysRemaining
            });

            await gdprMailService.sendEmail({
                to: resume.candidate_email,
                subject: `Rappel : Demande de consentement RGPD - ${firmName}`,
                html: emailHtml
            });

            // Update reminder tracking
            await recordConsentReminderSent(resume.id);

            // Log GDPR action
            await logGdprAction({
                action: GDPR_ACTIONS.CONSENT_REMINDER_SENT,
                firmId: resume.firm_id,
                firmName: resume.firm_name,
                targetType: 'candidate',
                targetId: resume.id,
                targetName: resume.candidate_name,
                targetEmail: resume.candidate_email,
                details: { daysRemaining },
                isAutomated: true
            });

            sentCount++;
        } catch (error) {
            safeLog('error', 'Failed to send consent reminder', { 
                resumeId: resume.id, 
                error: error.message 
            });
        }
    }

    if (sentCount > 0) {
        safeLog('info', 'Consent reminders sent', { count: sentCount });
    }

    updateLastConsentSchedulerSummary({
        operation: 'sendConsentReminders',
        status: 'completed',
        candidateCount: result.rows.length,
        sentCount,
        failedCount: Math.max(0, result.rows.length - sentCount)
    });

    return sentCount;
}

/**
 * Purge a single resume and its versions
 * @param {string} resumeId - Resume UUID
 * @param {Object} [auditInfo] - Optional audit info for logging
 * @returns {Promise<boolean>} Success
 */
export async function purgeResume(resumeId, auditInfo = null) {
    safeLog('info', 'Purging resume', { resumeId });

    // Get resume info for audit logging if not provided
    let resumeInfo = auditInfo;
    if (!resumeInfo) {
        resumeInfo = await getResumeAuditInfo(resumeId);
    }

    // Wrap all deletes in a transaction to prevent partial purge
    const result = await transaction(async (client) => {
        // Delete versions first (foreign key constraint)
        await deleteVersionsByResumeId(resumeId, { executor: client });

        // Delete adaptations
        await deleteAdaptationsByResumeId(resumeId, { executor: client });

        // Delete submissions
        await deleteSubmissionsByResumeId(resumeId, { executor: client });

        // Delete the resume
        try {
            await deleteResume(resumeId, { executor: client, invalidateCaches: false });
        } catch (error) {
            if (error?.statusCode === 404) {
                return { rows: [] };
            }
            throw error;
        }
        return { rows: [{ id: resumeId }] };
    });

    if (result.rows.length > 0) {
        await invalidateDashboardAndGroupedViews(resumeInfo?.firm_id || null);
        safeLog('info', 'Resume purged successfully', { resumeId });

        // Log GDPR action
        if (resumeInfo) {
            await logGdprAction({
                action: GDPR_ACTIONS.CV_PURGED,
                firmId: resumeInfo.firm_id,
                firmName: resumeInfo.firm_name,
                targetType: 'candidate',
                targetId: resumeId,
                targetName: resumeInfo.candidate_name,
                targetEmail: resumeInfo.candidate_email,
                details: { 
                    reason: resumeInfo.consent_status === 'refused' ? 'consent_refused' : 
                            resumeInfo.consent_status === 'expired' ? 'consent_expired' : 'manual_purge'
                },
                isAutomated: auditInfo?.isAutomated ?? false
            });
        }

        return true;
    }

    return false;
}

/**
 * Purge all resumes with expired or refused consent
 * Called by scheduler
 * @returns {Promise<number>} Number of resumes purged
 */
export async function purgeExpiredResumes() {
    // Find resumes to purge with full info for audit
    const result = await query(`
        SELECT id, firm_id, firm_name, candidate_name, candidate_email, consent_status
        FROM resumes 
        WHERE consent_status IN ('refused', 'expired')
    `);

    let purgedCount = 0;
    let skippedCount = 0;

    for (const resume of result.rows) {
        try {
            const purged = await purgeResume(resume.id, { ...resume, isAutomated: true });

            if (purged) {
                purgedCount++;
            } else {
                skippedCount++;
                safeLog('warn', 'Resume selected for purge was not deleted', {
                    resumeId: resume.id,
                    consentStatus: resume.consent_status
                });
            }
        } catch (error) {
            safeLog('error', 'Failed to purge resume', { 
                resumeId: resume.id, 
                error: error.message 
            });
            skippedCount++;
        }
    }

    if (result.rows.length > 0) {
        safeLog('info', 'Purge batch completed', {
            attemptedCount: result.rows.length,
            purgedCount,
            skippedCount
        });
    }

    updateLastConsentSchedulerSummary({
        operation: 'purgeExpiredResumes',
        status: 'completed',
        attemptedCount: result.rows.length,
        purgedCount,
        skippedCount
    });

    if (purgedCount > 0) {
        // Log batch purge action
        await logGdprAction({
            action: GDPR_ACTIONS.AUTO_PURGE_EXECUTED,
            details: {
                attemptedCount: result.rows.length,
                purgedCount,
                skippedCount,
                reason: 'scheduled_cleanup'
            },
            isAutomated: true
        });
    }

    return purgedCount;
}

export function getLastConsentSchedulerSummary() {
    return lastConsentSchedulerSummary;
}
