import { describe, expect, it } from 'vitest';
import { buildAllowedOrigins, normalizeOrigin } from '../../utils/originUtils.js';

describe('originUtils', () => {
    it('normalizes origins by trimming, parsing and lowercasing', () => {
        expect(normalizeOrigin(' https://ResumeConverter.net/ ')).toBe('https://resumeconverter.net');
        expect(normalizeOrigin('https://resumeconverter.net:3443/')).toBe('https://resumeconverter.net:3443');
    });

    it('builds allowed origins from env aliases and defaults', () => {
        const origins = buildAllowedOrigins({
            ALLOWED_ORIGINS: 'https://resumeconverter.net/, https://www.resumeconverter.net',
            FRONTEND_URL: 'https://luc-moreau.com/',
            APP_URL: 'https://ResumeConverter.net'
        });

        expect(origins).toContain('https://resumeconverter.net');
        expect(origins).toContain('https://www.resumeconverter.net');
        expect(origins).toContain('https://luc-moreau.com');
        expect(origins).toContain('http://localhost:5173');
    });

    it('derives allowed origins from redirect URIs and cookie domain', () => {
        const origins = buildAllowedOrigins({
            GOOGLE_AUTH_REDIRECT_URI: 'https://auth.example.com/api/auth/google/callback',
            GOOGLE_GDPR_REDIRECT_URI: 'https://gdpr.example.com/api/gdpr/mail/callback',
            VITE_APP_URL: 'https://app.example.com/',
            COOKIE_DOMAIN: '.resumeconverter.net'
        });

        expect(origins).toContain('https://auth.example.com');
        expect(origins).toContain('https://gdpr.example.com');
        expect(origins).toContain('https://app.example.com');
        expect(origins).toContain('https://resumeconverter.net');
    });
});
