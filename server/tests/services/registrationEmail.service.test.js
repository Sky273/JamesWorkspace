import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSendEmail = vi.fn();

vi.mock('../../services/mail/gdprMailService.js', () => ({
    sendEmail: (...args) => mockSendEmail(...args)
}));

import { sendRegistrationConfirmationEmail } from '../../services/registrationEmail.service.js';

describe('registrationEmail.service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.FRONTEND_URL = 'https://resumeconverter.net';
        mockSendEmail.mockResolvedValue({ success: true });
    });

    it('includes a sign-in button and absolute sign-in URL in the activation email', async () => {
        await sendRegistrationConfirmationEmail({
            to: 'user@example.com',
            name: 'Jean Test'
        });

        expect(mockSendEmail).toHaveBeenCalledTimes(1);

        const payload = mockSendEmail.mock.calls[0][0];
        expect(payload.subject).toContain('actif');
        expect(payload.html).toContain('Se connecter');
        expect(payload.html).toContain('https://resumeconverter.net/signin');
        expect(payload.html).toContain('href="https://resumeconverter.net/signin"');
        expect(payload.text).toContain('Connectez-vous ici : https://resumeconverter.net/signin');
    });

    it('normalizes FRONTEND_URL when it already ends with a trailing slash', async () => {
        process.env.FRONTEND_URL = 'https://resumeconverter.net/';

        await sendRegistrationConfirmationEmail({
            to: 'user@example.com',
            name: 'Jean Test'
        });

        const payload = mockSendEmail.mock.calls[0][0];
        expect(payload.html).toContain('https://resumeconverter.net/signin');
        expect(payload.html).not.toContain('https://resumeconverter.net//signin');
    });
});
