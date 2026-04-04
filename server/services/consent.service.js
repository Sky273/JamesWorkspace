/**
 * Consent Service
 * Re-exports all consent functionality from modular sub-modules.
 * 
 * Structure:
 * - ./consent/emailTemplates.js : HTML email builders for consent emails
 * - ./consent/operations.js     : Core CRUD operations for consent management
 * - ./consent/scheduler.js      : Automated tasks (expiry, reminders, purge)
 */

import { query } from '../config/database.js';

// Operations
export {
    initializeConsent,
    sendConsentRequest,
    validateConsentToken,
    recordConsentResponse,
    getConsentStatus,
    resendConsentRequest
} from './consent/operations.js';

/**
 * Mark consent status as error after send failure
 * @param {string} resumeId
 * @returns {Promise<void>}
 */
export async function markConsentError(resumeId) {
    await query(`
        UPDATE resumes 
        SET consent_status = 'error', updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND consent_status = 'pending_consent'
    `, [resumeId]);
}

// Scheduler tasks
export {
    checkExpiredConsents,
    sendConsentReminders,
    purgeResume,
    purgeExpiredResumes
} from './consent/scheduler.js';
