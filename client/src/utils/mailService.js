/**
 * Mail Service
 * Frontend service for email operations (Gmail OAuth, draft creation)
 */

import { fetchWithAuth, createAuthOptions, createAuthOptionsWithCsrf } from './apiInterceptor';
import logger from './logger.frontend';

const mailService = {
    /**
     * Get mail connection status
     * @returns {Promise<Object>} - { connected, provider, email, needsReauth }
     */
    async getStatus() {
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
     * @returns {Promise<void>}
     */
    async connectGmail() {
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
     * @param {Object} params
     * @param {string} params.to - Recipient email
     * @param {string} params.subject - Email subject
     * @param {string} [params.body] - Email body (optional)
     * @param {string} [params.pdfBase64] - PDF as base64 string
     * @param {string} [params.pdfFilename] - PDF filename
     * @returns {Promise<Object>} - { success, draftId, webLink }
     */
    async createDraft({ to, subject, body, pdfBase64, pdfFilename }) {
        try {
            const options = await createAuthOptionsWithCsrf({
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to,
                    subject,
                    body: body || '',
                    pdfBase64,
                    pdfFilename
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
     * @param {string} [provider='gmail']
     * @returns {Promise<void>}
     */
    async disconnect(provider = 'gmail') {
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
