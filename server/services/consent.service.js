/**
 * Consent Service
 * Re-exports all consent functionality from modular sub-modules.
 * 
 * Structure:
 * - ./consent/emailTemplates.js : HTML email builders for consent emails
 * - ./consent/operations.js     : Core CRUD operations for consent management
 * - ./consent/scheduler.js      : Automated tasks (expiry, reminders, purge)
 */

// Operations
export {
    initializeConsent,
    sendConsentRequest,
    validateConsentToken,
    recordConsentResponse,
    getConsentStatus,
    resendConsentRequest
} from './consent/operations.js';

// Scheduler tasks
export {
    checkExpiredConsents,
    sendConsentReminders,
    purgeResume,
    purgeExpiredResumes
} from './consent/scheduler.js';

// Default export for backward compatibility
import { initializeConsent, sendConsentRequest, validateConsentToken, recordConsentResponse, getConsentStatus, resendConsentRequest } from './consent/operations.js';
import { checkExpiredConsents, sendConsentReminders, purgeResume, purgeExpiredResumes } from './consent/scheduler.js';

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
