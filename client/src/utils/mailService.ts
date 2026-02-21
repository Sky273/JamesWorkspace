/**
 * Mail Service
 * Frontend service for email operations (Gmail OAuth, draft creation)
 * Updated: 2026-02-21 17:20 - Added templateId and templateContext support
 */

import { fetchWithAuth, createAuthOptions, createAuthOptionsWithCsrf } from './apiInterceptor';
import logger from './logger.frontend';

export interface MailStatus {
    connected: boolean;
    provider?: string;
    email?: string;
    needsReauth?: boolean;
}

export interface CreateDraftParams {
    to: string;
    subject: string;
    body?: string;
    pdfBase64?: string;
    pdfFilename?: string;
    resumeId?: string;
    clientId?: string;
    contactId?: string;
    missionId?: string;
    versionNumber?: number;
    templateId?: string;
    templateContext?: Record<string, unknown>;
}

export interface CreateDraftResponse {
    success: boolean;
    draftId?: string;
    webLink?: string;
    submissionId?: string;
}

const mailService = {
    /**
     * Get mail connection status
     */
    async getStatus(): Promise<MailStatus> {
        try {
            const response = await fetchWithAuth('/api/mail/status', createAuthOptions());
            if (!response.ok) {
                throw new Error('Failed to get mail status');
            }
            return await response.json();
        } catch (error) {
            logger.error('Error getting mail status:', error);
            throw error;
        }
    },

    /**
     * Initiate Gmail OAuth flow
     * Opens a new window for OAuth authorization
     */
    async connectGmail(): Promise<void> {
        try {
            const response = await fetchWithAuth('/api/mail/auth/gmail', createAuthOptions());
            if (!response.ok) {
                throw new Error('Failed to initiate Gmail auth');
            }
            const { authUrl } = await response.json();
            
            // Open OAuth in same window (will redirect back)
            window.location.href = authUrl;
        } catch (error) {
            logger.error('Error connecting Gmail:', error);
            throw error;
        }
    },

    /**
     * Create email draft with PDF attachment
     */
    async createDraft({
        to,
        subject,
        body,
        pdfBase64,
        pdfFilename,
        resumeId,
        clientId,
        contactId,
        missionId,
        versionNumber,
        templateId,
        templateContext
    }: CreateDraftParams): Promise<CreateDraftResponse> {
        try {
            // Debug: log all params including template (v2)
            logger.info('[mailService v2] createDraft called with ALL params', { 
                resumeId: resumeId || 'MISSING', 
                clientId: clientId || 'MISSING', 
                contactId: contactId || 'MISSING',
                templateId: templateId || 'NONE',
                hasTemplateContext: !!templateContext,
                versionNumber: versionNumber || 'MISSING'
            });
            
            const options = await createAuthOptionsWithCsrf({
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to,
                    subject,
                    body: body || '',
                    pdfBase64,
                    pdfFilename,
                    // Submission tracking
                    resumeId,
                    clientId,
                    contactId,
                    missionId,
                    versionNumber,
                    // Template rendering
                    templateId,
                    templateContext
                })
            });

            const response = await fetchWithAuth('/api/mail/draft', options);
            
            if (!response.ok) {
                const errorData = await response.json();
                if (errorData.needsReauth) {
                    throw new Error('NEEDS_REAUTH');
                }
                throw new Error(errorData.error || 'Failed to create draft');
            }
            
            return await response.json();
        } catch (error) {
            logger.error('Error creating draft:', error);
            throw error;
        }
    },

    /**
     * Disconnect mail provider
     */
    async disconnect(provider: string = 'gmail'): Promise<void> {
        try {
            const options = await createAuthOptionsWithCsrf({
                method: 'DELETE'
            });

            const response = await fetchWithAuth(`/api/mail/disconnect?provider=${provider}`, options);
            if (!response.ok) {
                throw new Error('Failed to disconnect mail');
            }
        } catch (error) {
            logger.error('Error disconnecting mail:', error);
            throw error;
        }
    }
};

export default mailService;
