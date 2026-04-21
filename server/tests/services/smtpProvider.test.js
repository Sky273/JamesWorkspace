import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSendMail = vi.fn();
const mockCreateTransport = vi.fn(() => ({
    sendMail: mockSendMail
}));
const mockSafeLog = vi.fn();

vi.mock('nodemailer', () => ({
    default: {
        createTransport: (...args) => mockCreateTransport(...args)
    }
}));

vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: (...args) => mockSafeLog(...args)
}));

import { getSmtpStatus, sendSmtpEmail } from '../../services/mail/smtpProvider.js';

describe('smtpProvider', () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
        vi.clearAllMocks();
        process.env = {
            ...originalEnv,
            SMTP_HOST: 'smtp.gmail.com',
            SMTP_PORT: '587',
            SMTP_SECURE: 'false',
            SMTP_USER: 'luc.moreau.1@gmail.com',
            SMTP_PASSWORD: 'wscp wzfu nbvs tksx',
            SMTP_FROM_NAME: 'ResumeConverter@gmail.com',
            SMTP_FROM_EMAIL: 'luc.moreau.1@gmail.com'
        };
        mockSendMail.mockResolvedValue({
            messageId: 'message-1',
            response: '250 OK'
        });
    });

    it('fills missing SMTP fields from environment defaults in status checks', () => {
        const status = getSmtpStatus({
            smtpHost: '',
            smtpPort: undefined,
            smtpSecure: undefined,
            smtpUser: '',
            smtpPassword: '',
            smtpFromName: '',
            smtpFromEmail: ''
        });

        expect(status.connected).toBe(true);
        expect(status.email).toBe('luc.moreau.1@gmail.com');
        expect(status.missingFields).toEqual([]);
    });

    it('fills missing SMTP fields from environment defaults before sending', async () => {
        const result = await sendSmtpEmail(
            {
                smtpHost: '',
                smtpPort: undefined,
                smtpSecure: undefined,
                smtpUser: '',
                smtpPassword: '',
                smtpFromName: '',
                smtpFromEmail: ''
            },
            {
                to: 'test@example.com',
                subject: 'SMTP test',
                html: '<p>Hello</p>'
            }
        );

        expect(mockCreateTransport).toHaveBeenCalledWith(expect.objectContaining({
            host: 'smtp.gmail.com',
            port: 587,
            secure: false,
            auth: {
                user: 'luc.moreau.1@gmail.com',
                pass: 'wscp wzfu nbvs tksx'
            }
        }));
        expect(mockSendMail).toHaveBeenCalledWith(expect.objectContaining({
            from: '"ResumeConverter@gmail.com" <luc.moreau.1@gmail.com>',
            to: 'test@example.com',
            subject: 'SMTP test'
        }));
        expect(result.sentTo).toBe('test@example.com');
    });
});
