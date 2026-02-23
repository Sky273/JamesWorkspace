/**
 * Consent Service
 * Frontend service for GDPR consent management API calls
 */

import { fetchWithAuth, createAuthOptionsWithCsrf } from './apiInterceptor';
import logger from './logger.frontend';

export interface ConsentInitData {
    resumeId: string;
    profileType: 'employee' | 'external';
    candidateName: string;
    candidateEmail?: string;
}

export interface ConsentStatus {
    id: string;
    profile_type: 'employee' | 'external';
    candidate_name: string;
    candidate_email?: string;
    consent_status: 'not_required' | 'pending_consent' | 'active' | 'refused' | 'expired' | 'purged';
    consent_requested_at?: string | null;
    consent_responded_at?: string | null;
    retention_until?: string | null;
    consent_reminder_count?: number;
}

/**
 * Initialize consent for a resume
 */
export async function initializeConsent(data: ConsentInitData): Promise<{ success: boolean; consent: ConsentStatus }> {
    logger.info('[ConsentService] Initializing consent', { resumeId: data.resumeId, profileType: data.profileType });

    const options = await createAuthOptionsWithCsrf({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });

    const response = await fetchWithAuth('/api/consent/initialize', options);
    
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to initialize consent' }));
        throw new Error(errorData.error || 'Failed to initialize consent');
    }

    return response.json();
}

/**
 * Send consent request email
 */
export async function sendConsentRequest(resumeId: string): Promise<{ success: boolean; sentTo: string }> {
    logger.info('[ConsentService] Sending consent request', { resumeId });

    const options = await createAuthOptionsWithCsrf({ method: 'POST' });
    const response = await fetchWithAuth(`/api/consent/${resumeId}/send`, options);
    
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to send consent request' }));
        throw new Error(errorData.error || 'Failed to send consent request');
    }

    return response.json();
}

/**
 * Resend consent request email
 */
export async function resendConsentRequest(resumeId: string): Promise<{ success: boolean; sentTo: string }> {
    logger.info('[ConsentService] Resending consent request', { resumeId });

    const options = await createAuthOptionsWithCsrf({ method: 'POST' });
    const response = await fetchWithAuth(`/api/consent/${resumeId}/resend`, options);
    
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to resend consent request' }));
        throw new Error(errorData.error || 'Failed to resend consent request');
    }

    return response.json();
}

/**
 * Get consent status for a resume
 */
export async function getConsentStatus(resumeId: string): Promise<{ success: boolean; consent: ConsentStatus }> {
    logger.info('[ConsentService] Getting consent status', { resumeId });

    const options = await createAuthOptionsWithCsrf({ method: 'GET' });
    const response = await fetchWithAuth(`/api/consent/${resumeId}/status`, options);
    
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to get consent status' }));
        throw new Error(errorData.error || 'Failed to get consent status');
    }

    return response.json();
}

/**
 * Initialize consent and send request in one step (for external profiles)
 */
export async function initializeAndSendConsent(data: ConsentInitData): Promise<{ success: boolean; consent: ConsentStatus; sentTo?: string }> {
    // First initialize
    const initResult = await initializeConsent(data);
    
    // If external, also send the request
    if (data.profileType === 'external' && data.candidateEmail) {
        try {
            const sendResult = await sendConsentRequest(data.resumeId);
            return { ...initResult, sentTo: sendResult.sentTo };
        } catch (error) {
            logger.error('[ConsentService] Failed to send consent request after init', error);
            // Return init result even if send failed - consent is initialized
            return initResult;
        }
    }
    
    return initResult;
}

export default {
    initializeConsent,
    sendConsentRequest,
    resendConsentRequest,
    getConsentStatus,
    initializeAndSendConsent
};
