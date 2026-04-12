/**
 * Consent Operations
 * Core CRUD operations for GDPR consent management
 */

import crypto from 'crypto';
import { query } from '../../config/database.js';
import { safeLog } from '../../utils/logger.backend.js';
import { gdprMailService } from '../mail/gdprMailService.js';
import { logGdprAction, GDPR_ACTIONS } from '../gdprAudit.service.js';
import { getFrontendUrl, buildConsentRequestEmailHtml } from './emailTemplates.js';
import {
    initializeResumeConsent,
    markResumeConsentError,
    markResumeConsentRequested,
    recordResumeConsentResponse,
    resetResumeConsentForResend
} from '../resumes.service.js';

// Constants
export const CONSENT_TOKEN_EXPIRY_DAYS = 14; // 2 weeks
export const RETENTION_PERIOD_DAYS = 730; // 2 years

/**
 * Generate a secure random token
 * @returns {string} 64-character hex token
 */
export function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}

/**
 * Get DPO settings from llm_settings table
 * @returns {Promise<Object>} DPO settings
 */
export async function getDpoSettings() {
    try {
        const result = await query(`
            SELECT dpo_name, dpo_email, dpo_phone
            FROM llm_settings
            ORDER BY created_at DESC
            LIMIT 1
        `);
        return result.rows[0] || {};
    } catch (error) {
        safeLog('warn', 'Could not fetch DPO settings', { error: error.message });
        return {};
    }
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
    const result = await initializeResumeConsent({
        resumeId,
        profileType,
        candidateName,
        candidateEmail,
        consentStatus,
        consentToken,
        tokenExpiresAt
    });

    safeLog('info', 'Consent initialized', { 
        resumeId, 
        profileType, 
        consentStatus,
        hasToken: !!consentToken 
    });

    return result;
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

    // Build email HTML with DPO settings
    const firmName = resume.firm_name || 'Notre cabinet';
    const dpoSettings = await getDpoSettings();
    const emailHtml = buildConsentRequestEmailHtml({
        candidateName: resume.candidate_name,
        firmName: dpoSettings.firm_name || firmName,
        consentUrl,
        expiryDays: CONSENT_TOKEN_EXPIRY_DAYS,
        dpoSettings
    });

    // Send email via Gmail (using GLOBAL token)
    try {
        await gdprMailService.sendEmail({
            to: resume.candidate_email,
            subject: `Demande de consentement - conservation et traitement de votre CV`,
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
    await markResumeConsentRequested(resumeId);

    safeLog('info', 'Consent request email sent', { 
        resumeId, 
        to: resume.candidate_email,
        tokenPrefix: resume.consent_token.substring(0, 8)
    });

    // Log GDPR action
    await logGdprAction({
        action: GDPR_ACTIONS.CONSENT_REQUEST_SENT,
        firmId: resume.firm_id,
        firmName: resume.firm_name,
        targetType: 'candidate',
        targetId: resumeId,
        targetName: resume.candidate_name,
        targetEmail: resume.candidate_email,
        details: { expiryDays: CONSENT_TOKEN_EXPIRY_DAYS },
        isAutomated: false
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
               r.firm_id, r.firm_name, f.logo_url as firm_logo
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

    const result = await recordResumeConsentResponse(
        resume.id,
        newStatus,
        retentionUntil
    );

    safeLog('info', 'Consent response recorded', { 
        resumeId: resume.id, 
        accepted, 
        newStatus,
        retentionUntil 
    });

    // Log GDPR action
    await logGdprAction({
        action: accepted ? GDPR_ACTIONS.CONSENT_GRANTED : GDPR_ACTIONS.CONSENT_REFUSED,
        firmId: resume.firm_id,
        firmName: resume.firm_name,
        targetType: 'candidate',
        targetId: resume.id,
        targetName: resume.candidate_name,
        targetEmail: resume.candidate_email,
        details: { 
            retentionUntil: retentionUntil?.toISOString(),
            retentionDays: accepted ? RETENTION_PERIOD_DAYS : 0
        },
        isAutomated: false
    });

    // If refused, schedule immediate purge
    if (!accepted) {
        // The scheduler will handle the actual purge
        safeLog('info', 'Resume marked for purge after consent refusal', { resumeId: resume.id });
    }

    return result;
}

/**
 * Get consent status for a resume
 * @param {string} resumeId - Resume UUID
 * @returns {Promise<Object>} Consent information
 */
export async function getConsentStatus(resumeId) {
    const result = await query(`
        SELECT id, profile_type, candidate_name, candidate_email,
               firm_id, consent_status, consent_requested_at, consent_responded_at,
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

    await resetResumeConsentForResend(resumeId, newToken, tokenExpiresAt);

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
        
        await markResumeConsentError(resumeId);
        
        throw emailError;
    }
}
