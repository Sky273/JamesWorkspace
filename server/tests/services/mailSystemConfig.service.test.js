import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetCanonicalSettingsRecord = vi.fn();
const mockInvalidateSettingsCache = vi.fn();
const mockUpdateSettings = vi.fn();

vi.mock('../../services/settings.service.js', () => ({
    getCanonicalSettingsRecord: (...args) => mockGetCanonicalSettingsRecord(...args),
    invalidateSettingsCache: (...args) => mockInvalidateSettingsCache(...args),
    updateSettings: (...args) => mockUpdateSettings(...args)
}));

vi.mock('../../config/oauth.config.js', () => ({
    encryptToken: vi.fn((value) => `enc:${value}`),
    decryptToken: vi.fn((value) => `dec:${value}`)
}));

import {
    resolveMailSystemConfig,
    getMailSystemConfigForAdmin
} from '../../services/mail/mailSystemConfig.service.js';

describe('mailSystemConfig.service', () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
        vi.clearAllMocks();
        process.env = {
            ...originalEnv,
            GDPR_MAIL_PROVIDER: 'smtp',
            SMTP_HOST: 'smtp.gmail.com',
            SMTP_PORT: '587',
            SMTP_SECURE: 'false',
            SMTP_USER: 'luc.moreau.1@gmail.com',
            SMTP_PASSWORD: 'wscp wzfu nbvs tksx',
            SMTP_FROM_NAME: 'ResumeConverter@gmail.com',
            SMTP_FROM_EMAIL: 'luc.moreau.1@gmail.com',
            GOOGLE_GDPR_REDIRECT_URI: 'https://resumeconverter.net/api/gdpr/mail/callback',
            GOOGLE_CLIENT_ID: 'client-id',
            GOOGLE_CLIENT_SECRET: 'client-secret'
        };
    });

    it('falls back to environment defaults when persisted GDPR mail fields are blank', async () => {
        mockGetCanonicalSettingsRecord.mockResolvedValueOnce({
            id: 'settings-1',
            mail_delivery_provider: 'smtp',
            smtp_host: '',
            smtp_port: '',
            smtp_secure: false,
            smtp_user: '',
            smtp_password_encrypted: '',
            smtp_from_name: '',
            smtp_from_email: '',
            google_gdpr_redirect_uri: ''
        });

        const config = await resolveMailSystemConfig();

        expect(config.provider).toBe('smtp');
        expect(config.source).toBe('database');
        expect(config.smtpHost).toBe('smtp.gmail.com');
        expect(config.smtpPort).toBe(587);
        expect(config.smtpUser).toBe('luc.moreau.1@gmail.com');
        expect(config.smtpPassword).toBe('wscp wzfu nbvs tksx');
        expect(config.smtpFromName).toBe('ResumeConverter@gmail.com');
        expect(config.smtpFromEmail).toBe('luc.moreau.1@gmail.com');
        expect(config.googleGdprRedirectUri).toBe('https://resumeconverter.net/api/gdpr/mail/callback');
        expect(config.smtpConfigured).toBe(true);
    });

    it('uses only persisted values once a GDPR mail config exists in database', async () => {
        mockGetCanonicalSettingsRecord.mockResolvedValueOnce({
            id: 'settings-1',
            mail_delivery_provider: 'smtp',
            smtp_host: 'smtp.custom.local',
            smtp_port: 2525,
            smtp_secure: true,
            smtp_user: 'custom-user@example.com',
            smtp_password_encrypted: 'encrypted-password',
            smtp_from_name: 'Custom Sender',
            smtp_from_email: 'custom-from@example.com',
            google_gdpr_redirect_uri: 'https://custom.example.com/api/gdpr/mail/callback'
        });

        const config = await resolveMailSystemConfig();

        expect(config.source).toBe('database');
        expect(config.smtpHost).toBe('smtp.custom.local');
        expect(config.smtpPort).toBe(2525);
        expect(config.smtpSecure).toBe(true);
        expect(config.smtpUser).toBe('custom-user@example.com');
        expect(config.smtpPassword).toBe('dec:encrypted-password');
        expect(config.smtpFromName).toBe('Custom Sender');
        expect(config.smtpFromEmail).toBe('custom-from@example.com');
        expect(config.googleGdprRedirectUri).toBe('https://custom.example.com/api/gdpr/mail/callback');
    });

    it('returns effective admin config prefilled from .env when no persisted override exists', async () => {
        mockGetCanonicalSettingsRecord.mockResolvedValueOnce(null);

        const config = await getMailSystemConfigForAdmin();

        expect(config.provider).toBe('smtp');
        expect(config.source).toBe('environment');
        expect(config.smtpHost).toBe('smtp.gmail.com');
        expect(config.smtpPort).toBe(587);
        expect(config.smtpUser).toBe('luc.moreau.1@gmail.com');
        expect(config.smtpPassword).toBe('wscp wzfu nbvs tksx');
        expect(config.smtpFromName).toBe('ResumeConverter@gmail.com');
        expect(config.smtpFromEmail).toBe('luc.moreau.1@gmail.com');
        expect(config.hasSmtpPassword).toBe(true);
        expect(config.smtpConfigured).toBe(true);
    });
});
