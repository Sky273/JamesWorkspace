/**
 * Consent Service
 * Manages GDPR consent for resume storage
 * Handles consent initialization, token generation, response recording, and purging
 */

import crypto from 'crypto';
import { query } from '../config/database.js';
import { safeLog } from '../utils/logger.backend.js';
import { gdprMailService } from './mail/gdprMailService.js';

// Constants
const CONSENT_TOKEN_EXPIRY_DAYS = 14; // 2 weeks
const RETENTION_PERIOD_DAYS = 730; // 2 years
const REMINDER_AFTER_DAYS = 7; // Send reminder after 1 week

/**
 * Generate a secure random token
 * @returns {string} 64-character hex token
 */
function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}

/**
 * Get the frontend URL for consent pages
 * @returns {string}
 */
function getFrontendUrl() {
    return process.env.FRONTEND_URL || process.env.VITE_APP_URL || 'http://localhost:5173';
}

/**
 * Build HTML email for consent request
 * @param {Object} params
 * @returns {string} HTML content
 */
function buildConsentRequestEmailHtml({ candidateName, firmName, consentUrl, expiryDays }) {
    return `
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f5;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <tr>
            <td style="background-color: #ffffff; border-radius: 8px; padding: 40px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <!-- Header -->
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                    <tr>
                        <td style="text-align: center; padding-bottom: 30px; border-bottom: 1px solid #e5e7eb;">
                            <h1 style="color: #1f2937; font-size: 24px; margin: 0;">Demande de consentement</h1>
                            <p style="color: #6b7280; font-size: 14px; margin: 10px 0 0 0;">Conservation de votre CV</p>
                        </td>
                    </tr>
                </table>

                <!-- Content -->
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding-top: 30px;">
                    <tr>
                        <td>
                            <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                                Bonjour <strong>${candidateName}</strong>,
                            </p>
                            <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                                Le cabinet <strong>${firmName}</strong> souhaite conserver votre CV dans son vivier de talents afin de vous proposer des opportunités professionnelles correspondant à votre profil.
                            </p>
                            
                            <div style="background-color: #f9fafb; border-radius: 6px; padding: 20px; margin: 20px 0;">
                                <p style="color: #374151; font-size: 14px; margin: 0 0 10px 0; font-weight: bold;">Ce que nous conservons :</p>
                                <ul style="color: #6b7280; font-size: 14px; margin: 0; padding-left: 20px;">
                                    <li style="margin-bottom: 5px;">Votre CV et les informations qu'il contient</li>
                                    <li style="margin-bottom: 5px;">Vos coordonnées pour vous contacter</li>
                                    <li>L'historique des opportunités proposées</li>
                                </ul>
                            </div>

                            <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 0 0 30px 0;">
                                <strong>Durée de conservation :</strong> 2 ans maximum. Vous pouvez retirer votre consentement à tout moment.
                            </p>

                            <!-- CTA Button -->
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                                <tr>
                                    <td style="text-align: center;">
                                        <a href="${consentUrl}" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: bold; padding: 14px 32px; border-radius: 6px;">
                                            Répondre à la demande
                                        </a>
                                    </td>
                                </tr>
                            </table>

                            <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 30px 0 0 0;">
                                Ce lien expire dans ${expiryDays} jours.
                            </p>
                        </td>
                    </tr>
                </table>

                <!-- Footer -->
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding-top: 30px; border-top: 1px solid #e5e7eb; margin-top: 30px;">
                    <tr>
                        <td style="text-align: center;">
                            <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                                Ce message est conforme au Règlement Général sur la Protection des Données (RGPD).
                            </p>
                            <p style="color: #9ca3af; font-size: 12px; margin: 10px 0 0 0;">
                                Vous disposez d'un droit d'accès, de rectification et de suppression de vos données.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
    `.trim();
}

/**
 * Build HTML email for consent reminder
 * @param {Object} params
 * @returns {string} HTML content
 */
function buildConsentReminderEmailHtml({ candidateName, firmName, consentUrl, daysRemaining }) {
    return `
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f5;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <tr>
            <td style="background-color: #ffffff; border-radius: 8px; padding: 40px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <!-- Header -->
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                    <tr>
                        <td style="text-align: center; padding-bottom: 30px; border-bottom: 1px solid #e5e7eb;">
                            <h1 style="color: #1f2937; font-size: 24px; margin: 0;">Rappel : Demande de consentement</h1>
                            <p style="color: #f59e0b; font-size: 14px; margin: 10px 0 0 0; font-weight: bold;">
                                ⏰ Plus que ${daysRemaining} jours pour répondre
                            </p>
                        </td>
                    </tr>
                </table>

                <!-- Content -->
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding-top: 30px;">
                    <tr>
                        <td>
                            <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                                Bonjour <strong>${candidateName}</strong>,
                            </p>
                            <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                                Nous vous avons récemment envoyé une demande de consentement pour la conservation de votre CV par <strong>${firmName}</strong>.
                            </p>
                            <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                                Sans réponse de votre part dans les ${daysRemaining} prochains jours, votre CV sera automatiquement supprimé de notre base de données.
                            </p>

                            <!-- CTA Button -->
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                                <tr>
                                    <td style="text-align: center;">
                                        <a href="${consentUrl}" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: bold; padding: 14px 32px; border-radius: 6px;">
                                            Répondre maintenant
                                        </a>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>

                <!-- Footer -->
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding-top: 30px; border-top: 1px solid #e5e7eb; margin-top: 30px;">
                    <tr>
                        <td style="text-align: center;">
                            <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                                Ce message est conforme au RGPD.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
    `.trim();
}

/**
 * Initialize consent for a resume
 * @param {Object} params - Consent parameters
 * @param {string} params.resumeId - Resume UUID
 * @param {string} params.profileType - 'employee' or 'external'
 * @param {string} params.candidateName - Real name of the candidate
 * @param {string} params.candidateEmail - Email for consent request (required for external)
 * @returns {Promise<Object>} Updated resume with consent fields
 */
export async function initializeConsent({
    resumeId,
    profileType,
    candidateName,
    candidateEmail
}) {
    safeLog('info', 'Initializing consent for resume', { resumeId, profileType, candidateName });

    // Validate inputs
    if (!resumeId) {
        throw new Error('Resume ID is required');
    }
    if (!profileType || !['employee', 'external'].includes(profileType)) {
        throw new Error('Profile type must be "employee" or "external"');
    }
    if (!candidateName) {
        throw new Error('Candidate name is required');
    }
    if (profileType === 'external' && !candidateEmail) {
        throw new Error('Candidate email is required for external profiles');
    }

    // Determine consent status based on profile type
    const consentStatus = profileType === 'employee' ? 'not_required' : 'pending_consent';
    
    // Generate token for external profiles
    const consentToken = profileType === 'external' ? generateToken() : null;
    const tokenExpiresAt = profileType === 'external' 
        ? new Date(Date.now() + CONSENT_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000)
        : null;

    // Update resume with consent fields
    const result = await query(`
        UPDATE resumes 
        SET profile_type = $1,
            candidate_name = $2,
            candidate_email = $3,
            consent_status = $4,
            consent_token = $5,
            consent_token_expires_at = $6,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $7
        RETURNING id, profile_type, candidate_name, candidate_email, consent_status, 
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

    safeLog('info', 'Consent initialized', { 
        resumeId, 
        profileType, 
        consentStatus,
        hasToken: !!consentToken 
    });

    return result.rows[0];
}

/**
 * Send consent request email for a resume
 * @param {string} resumeId - Resume UUID
 * @returns {Promise<Object>} Send result
 */
export async function sendConsentRequest(resumeId) {
    // Get resume with firm info
    const result = await query(`
        SELECT r.id, r.candidate_name, r.candidate_email, r.consent_status, 
               r.consent_token, r.consent_token_expires_at, r.profile_type,
               r.firm_id, r.firm_name,
               f.logo_url as firm_logo
        FROM resumes r
        LEFT JOIN firms f ON r.firm_id = f.id
        WHERE r.id = $1
    `, [resumeId]);

    if (result.rows.length === 0) {
        throw new Error('Resume not found');
    }

    const resume = result.rows[0];

    // Validate state
    if (resume.profile_type === 'employee') {
        throw new Error('Consent not required for employee profiles');
    }
    if (!resume.candidate_email) {
        throw new Error('Candidate email is required to send consent request');
    }
    if (!resume.consent_token) {
        throw new Error('Consent token not generated. Initialize consent first.');
    }

    // Build consent URL
    const frontendUrl = getFrontendUrl();
    const consentUrl = `${frontendUrl}/consent/${resume.consent_token}`;

    // Log token being used (for debugging)
    safeLog('debug', 'Building consent email', {
        resumeId,
        tokenPrefix: resume.consent_token.substring(0, 8),
        tokenSuffix: resume.consent_token.substring(56),
        tokenLength: resume.consent_token.length,
        consentUrl: consentUrl.replace(resume.consent_token, '[TOKEN]')
    });

    // Build email HTML
    const firmName = resume.firm_name || 'Notre cabinet';
    const emailHtml = buildConsentRequestEmailHtml({
        candidateName: resume.candidate_name,
        firmName,
        consentUrl,
        expiryDays: CONSENT_TOKEN_EXPIRY_DAYS
    });

    // Send email via Gmail (using GLOBAL token)
    try {
        await gdprMailService.sendEmail({
            to: resume.candidate_email,
            subject: `Demande de consentement RGPD - ${firmName}`,
            html: emailHtml
        });
    } catch (emailError) {
        safeLog('error', 'Failed to send consent email via Gmail (GLOBAL)', {
            resumeId,
            error: emailError.message
        });
        throw emailError;
    }

    // Update consent_requested_at
    await query(`
        UPDATE resumes 
        SET consent_requested_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
    `, [resumeId]);

    safeLog('info', 'Consent request email sent', { 
        resumeId, 
        to: resume.candidate_email,
        tokenPrefix: resume.consent_token.substring(0, 8)
    });

    return { success: true, sentTo: resume.candidate_email };
}

/**
 * Validate a consent token and return the associated resume
 * @param {string} token - Consent token
 * @returns {Promise<Object|null>} Resume if valid, null if invalid/expired
 */
export async function validateConsentToken(token) {
    if (!token || token.length !== 64) {
        safeLog('warn', 'Invalid consent token format', { 
            tokenLength: token?.length || 0,
            expectedLength: 64
        });
        return null;
    }

    // Log token prefix for debugging (first 8 chars only for security)
    safeLog('debug', 'Validating consent token', { 
        tokenPrefix: token.substring(0, 8),
        tokenSuffix: token.substring(56)
    });

    const result = await query(`
        SELECT r.id, r.candidate_name, r.candidate_email, r.consent_status,
               r.consent_token, r.consent_token_expires_at, r.profile_type,
               r.firm_name, f.logo_url as firm_logo
        FROM resumes r
        LEFT JOIN firms f ON r.firm_id = f.id
        WHERE r.consent_token = $1
    `, [token]);

    if (result.rows.length === 0) {
        // Additional diagnostic: check if any resume has a similar token prefix
        const diagnosticResult = await query(`
            SELECT id, consent_token, consent_status, consent_token_expires_at
            FROM resumes
            WHERE consent_token IS NOT NULL
            AND LEFT(consent_token, 8) = $1
            LIMIT 5
        `, [token.substring(0, 8)]);
        
        safeLog('warn', 'Invalid consent token - not found in database', { 
            tokenPrefix: token.substring(0, 8),
            tokenSuffix: token.substring(56),
            similarTokensFound: diagnosticResult.rows.length,
            similarTokens: diagnosticResult.rows.map(r => ({
                id: r.id,
                status: r.consent_status,
                tokenPrefix: r.consent_token?.substring(0, 8),
                expired: r.consent_token_expires_at ? new Date(r.consent_token_expires_at) < new Date() : null
            }))
        });
        return null;
    }

    const resume = result.rows[0];

    // Check if token is expired
    if (resume.consent_token_expires_at && new Date(resume.consent_token_expires_at) < new Date()) {
        safeLog('warn', 'Consent token expired', { resumeId: resume.id });
        return { ...resume, expired: true };
    }

    // Check if already responded
    if (resume.consent_status !== 'pending_consent') {
        safeLog('warn', 'Consent already processed', { resumeId: resume.id, status: resume.consent_status });
        return { ...resume, alreadyProcessed: true };
    }

    return resume;
}

/**
 * Record consent response (accept or refuse)
 * @param {string} token - Consent token
 * @param {boolean} accepted - Whether consent was accepted
 * @returns {Promise<Object>} Updated resume
 */
export async function recordConsentResponse(token, accepted) {
    const resume = await validateConsentToken(token);
    
    if (!resume) {
        throw new Error('Invalid or expired consent token');
    }
    if (resume.expired) {
        throw new Error('Consent token has expired');
    }
    if (resume.alreadyProcessed) {
        throw new Error('Consent has already been processed');
    }

    const newStatus = accepted ? 'active' : 'refused';
    const retentionUntil = accepted 
        ? new Date(Date.now() + RETENTION_PERIOD_DAYS * 24 * 60 * 60 * 1000)
        : null;

    const result = await query(`
        UPDATE resumes 
        SET consent_status = $1,
            consent_responded_at = CURRENT_TIMESTAMP,
            retention_until = $2,
            consent_token = NULL,
            consent_token_expires_at = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
        RETURNING id, consent_status, consent_responded_at, retention_until
    `, [newStatus, retentionUntil, resume.id]);

    safeLog('info', 'Consent response recorded', { 
        resumeId: resume.id, 
        accepted, 
        newStatus,
        retentionUntil 
    });

    // If refused, schedule immediate purge
    if (!accepted) {
        // The scheduler will handle the actual purge
        safeLog('info', 'Resume marked for purge after consent refusal', { resumeId: resume.id });
    }

    return result.rows[0];
}

/**
 * Get consent status for a resume
 * @param {string} resumeId - Resume UUID
 * @returns {Promise<Object>} Consent information
 */
export async function getConsentStatus(resumeId) {
    const result = await query(`
        SELECT id, profile_type, candidate_name, candidate_email,
               consent_status, consent_requested_at, consent_responded_at,
               retention_until, consent_reminder_count
        FROM resumes
        WHERE id = $1
    `, [resumeId]);

    if (result.rows.length === 0) {
        throw new Error('Resume not found');
    }

    return result.rows[0];
}

/**
 * Resend consent request email
 * @param {string} resumeId - Resume UUID
 * @returns {Promise<Object>} Send result
 */
export async function resendConsentRequest(resumeId) {
    // Check current status
    const status = await getConsentStatus(resumeId);
    
    if (status.consent_status !== 'pending_consent' && status.consent_status !== 'error') {
        throw new Error(`Cannot resend consent request. Current status: ${status.consent_status}`);
    }

    // Generate new token
    const newToken = generateToken();
    const tokenExpiresAt = new Date(Date.now() + CONSENT_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    // Log token generation for debugging
    safeLog('debug', 'Generating new consent token for resend', {
        resumeId,
        tokenPrefix: newToken.substring(0, 8),
        tokenLength: newToken.length,
        expiresAt: tokenExpiresAt.toISOString()
    });

    await query(`
        UPDATE resumes 
        SET consent_token = $1,
            consent_token_expires_at = $2,
            consent_status = 'pending_consent',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
    `, [newToken, tokenExpiresAt, resumeId]);

    // Send the email with error handling
    try {
        const result = await sendConsentRequest(resumeId);
        return result;
    } catch (emailError) {
        // Mark consent as error if email sending fails
        safeLog('error', 'Failed to send consent email during resend, marking as error', {
            resumeId,
            error: emailError.message
        });
        
        await query(`
            UPDATE resumes 
            SET consent_status = 'error',
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
        `, [resumeId]);
        
        throw emailError;
    }
}

/**
 * Check for expired consents and mark them
 * Called by scheduler
 * @returns {Promise<number>} Number of resumes marked as expired
 */
export async function checkExpiredConsents() {
    // Mark pending consents that have expired (token expired)
    const expiredPending = await query(`
        UPDATE resumes 
        SET consent_status = 'expired',
            updated_at = CURRENT_TIMESTAMP
        WHERE consent_status = 'pending_consent'
          AND consent_token_expires_at IS NOT NULL
          AND consent_token_expires_at < CURRENT_TIMESTAMP
        RETURNING id
    `);

    // Mark active consents that have exceeded retention period
    const expiredRetention = await query(`
        UPDATE resumes 
        SET consent_status = 'expired',
            updated_at = CURRENT_TIMESTAMP
        WHERE consent_status = 'active'
          AND retention_until IS NOT NULL
          AND retention_until < CURRENT_TIMESTAMP
        RETURNING id
    `);

    const totalExpired = expiredPending.rows.length + expiredRetention.rows.length;

    if (totalExpired > 0) {
        safeLog('info', 'Expired consents marked', { 
            pendingExpired: expiredPending.rows.length,
            retentionExpired: expiredRetention.rows.length 
        });
    }

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
            await query(`
                UPDATE resumes 
                SET consent_reminder_sent_at = CURRENT_TIMESTAMP,
                    consent_reminder_count = consent_reminder_count + 1,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $1
            `, [resume.id]);

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

    return sentCount;
}

/**
 * Purge a single resume and its versions
 * @param {string} resumeId - Resume UUID
 * @returns {Promise<boolean>} Success
 */
export async function purgeResume(resumeId) {
    safeLog('info', 'Purging resume', { resumeId });

    // Delete versions first (foreign key constraint)
    await query(`DELETE FROM resume_versions WHERE resume_id = $1`, [resumeId]);

    // Delete adaptations
    await query(`DELETE FROM resume_adaptations WHERE resume_id = $1`, [resumeId]);

    // Delete submissions
    await query(`DELETE FROM resume_submissions WHERE resume_id = $1`, [resumeId]);

    // Delete the resume
    const result = await query(`DELETE FROM resumes WHERE id = $1 RETURNING id`, [resumeId]);

    if (result.rows.length > 0) {
        safeLog('info', 'Resume purged successfully', { resumeId });
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
    // Find resumes to purge
    const result = await query(`
        SELECT id FROM resumes 
        WHERE consent_status IN ('refused', 'expired')
    `);

    let purgedCount = 0;

    for (const resume of result.rows) {
        try {
            await purgeResume(resume.id);
            purgedCount++;
        } catch (error) {
            safeLog('error', 'Failed to purge resume', { 
                resumeId: resume.id, 
                error: error.message 
            });
        }
    }

    if (purgedCount > 0) {
        safeLog('info', 'Resumes purged', { count: purgedCount });
    }

    return purgedCount;
}

export default {
    initializeConsent,
    sendConsentRequest,
    validateConsentToken,
    recordConsentResponse,
    getConsentStatus,
    resendConsentRequest,
    checkExpiredConsents,
    sendConsentReminders,
    purgeResume,
    purgeExpiredResumes
};
