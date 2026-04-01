/**
 * Tests for Consent Email Templates
 * Tests getFrontendUrl, buildConsentRequestEmailHtml, buildConsentReminderEmailHtml
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import {
    getFrontendUrl,
    buildConsentRequestEmailHtml,
    buildConsentReminderEmailHtml
} from '../../services/consent/emailTemplates.js';

describe('Consent Email Templates', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        process.env = { ...originalEnv };
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    describe('getFrontendUrl', () => {
        it('should return FRONTEND_URL if set', () => {
            process.env.FRONTEND_URL = 'https://app.example.com';
            expect(getFrontendUrl()).toBe('https://app.example.com');
        });

        it('should fallback to VITE_APP_URL', () => {
            delete process.env.FRONTEND_URL;
            process.env.VITE_APP_URL = 'https://vite.example.com';
            expect(getFrontendUrl()).toBe('https://vite.example.com');
        });

        it('should fallback to localhost default', () => {
            delete process.env.FRONTEND_URL;
            delete process.env.VITE_APP_URL;
            expect(getFrontendUrl()).toBe('http://localhost:5173');
        });
    });

    describe('buildConsentRequestEmailHtml', () => {
        it('should include candidate name', () => {
            const html = buildConsentRequestEmailHtml({
                candidateName: 'Jean Dupont',
                firmName: 'Acme',
                consentUrl: 'https://app.example.com/consent/abc',
                expiryDays: 14
            });
            expect(html).toContain('Jean Dupont');
        });

        it('should include firm name', () => {
            const html = buildConsentRequestEmailHtml({
                candidateName: 'Jane',
                firmName: 'Cabinet XYZ',
                consentUrl: 'https://app.example.com/consent/abc',
                expiryDays: 14
            });
            expect(html).toContain('Cabinet XYZ');
        });

        it('should include consent URL', () => {
            const url = 'https://app.example.com/consent/token123';
            const html = buildConsentRequestEmailHtml({
                candidateName: 'Jane',
                firmName: 'Acme',
                consentUrl: url,
                expiryDays: 14
            });
            expect(html).toContain(url);
        });

        it('should include expiry days', () => {
            const html = buildConsentRequestEmailHtml({
                candidateName: 'Jane',
                firmName: 'Acme',
                consentUrl: 'https://example.com/consent/x',
                expiryDays: 7
            });
            expect(html).toContain('7 jours');
        });

        it('should include DPO email from settings', () => {
            const html = buildConsentRequestEmailHtml({
                candidateName: 'Jane',
                firmName: 'Acme',
                consentUrl: 'https://example.com/consent/x',
                expiryDays: 14,
                dpoSettings: { dpo_email: 'dpo@custom.com' }
            });
            expect(html).toContain('dpo@custom.com');
        });

        it('should use default DPO email when not provided', () => {
            const html = buildConsentRequestEmailHtml({
                candidateName: 'Jane',
                firmName: 'Acme',
                consentUrl: 'https://example.com/consent/x',
                expiryDays: 14
            });
            expect(html).toContain('dpo@aptea.net');
        });

        it('should return valid HTML document', () => {
            const html = buildConsentRequestEmailHtml({
                candidateName: 'Jane',
                firmName: 'Acme',
                consentUrl: 'https://example.com/consent/x',
                expiryDays: 14
            });
            expect(html).toContain('<!DOCTYPE html>');
            expect(html).toContain('</html>');
        });
    });

    describe('buildConsentReminderEmailHtml', () => {
        it('should include candidate name', () => {
            const html = buildConsentReminderEmailHtml({
                candidateName: 'Jean Dupont',
                firmName: 'Acme',
                consentUrl: 'https://example.com/consent/x',
                daysRemaining: 5
            });
            expect(html).toContain('Jean Dupont');
        });

        it('should include firm name', () => {
            const html = buildConsentReminderEmailHtml({
                candidateName: 'Jane',
                firmName: 'Cabinet ABC',
                consentUrl: 'https://example.com/consent/x',
                daysRemaining: 5
            });
            expect(html).toContain('Cabinet ABC');
        });

        it('should include days remaining', () => {
            const html = buildConsentReminderEmailHtml({
                candidateName: 'Jane',
                firmName: 'Acme',
                consentUrl: 'https://example.com/consent/x',
                daysRemaining: 3
            });
            expect(html).toContain('3');
        });

        it('should include consent URL', () => {
            const url = 'https://example.com/consent/reminder123';
            const html = buildConsentReminderEmailHtml({
                candidateName: 'Jane',
                firmName: 'Acme',
                consentUrl: url,
                daysRemaining: 5
            });
            expect(html).toContain(url);
        });

        it('should return valid HTML document', () => {
            const html = buildConsentReminderEmailHtml({
                candidateName: 'Jane',
                firmName: 'Acme',
                consentUrl: 'https://example.com/consent/x',
                daysRemaining: 5
            });
            expect(html).toContain('<!DOCTYPE html>');
            expect(html).toContain('Rappel');
        });
    });
});
