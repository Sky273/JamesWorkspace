/**
 * SMTP Service
 * Handles automatic email sending via SMTP (nodemailer)
 * Used for GDPR consent requests and reminders
 * 
 * NOTE: nodemailer is loaded lazily to save memory at startup
 */

import { safeLog } from '../../utils/logger.backend.js';

// Lazy-loaded nodemailer module
let nodemailer = null;
let transporter = null;

/**
 * Get nodemailer module (lazy load)
 */
async function getNodemailer() {
    if (!nodemailer) {
        nodemailer = await import('nodemailer');
        safeLog('info', 'nodemailer module loaded lazily');
    }
    return nodemailer.default || nodemailer;
}

/**
 * Get or create SMTP transporter
 * @returns {Promise<Object>} nodemailer transporter
 */
async function getTransporter() {
    if (transporter) {
        return transporter;
    }

    const nm = await getNodemailer();

    // Get SMTP configuration from environment
    const smtpConfig = {
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASSWORD
        }
    };

    // Validate configuration
    if (!smtpConfig.host || !smtpConfig.auth.user || !smtpConfig.auth.pass) {
        safeLog('warn', 'SMTP not configured - email sending disabled', {
            hasHost: !!smtpConfig.host,
            hasUser: !!smtpConfig.auth.user,
            hasPass: !!smtpConfig.auth.pass
        });
        return null;
    }

    transporter = nm.createTransport(smtpConfig);

    // Verify connection
    try {
        await transporter.verify();
        safeLog('info', 'SMTP transporter verified successfully', { host: smtpConfig.host });
    } catch (error) {
        safeLog('error', 'SMTP transporter verification failed', { error: error.message });
        transporter = null;
        throw new Error('SMTP configuration invalid: ' + error.message);
    }

    return transporter;
}

/**
 * Check if SMTP is configured and available
 * @returns {Promise<boolean>}
 */
export async function isSmtpAvailable() {
    try {
        const t = await getTransporter();
        return t !== null;
    } catch {
        return false;
    }
}

/**
 * Send an email
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.html - HTML content
 * @param {string} [options.text] - Plain text content (fallback)
 * @param {string} [options.from] - Sender (defaults to SMTP_FROM_EMAIL)
 * @param {string} [options.replyTo] - Reply-to address
 * @returns {Promise<Object>} Send result
 */
export async function sendEmail({ to, subject, html, text, from, replyTo }) {
    const t = await getTransporter();
    
    if (!t) {
        throw new Error('SMTP not configured. Please set SMTP_HOST, SMTP_USER, and SMTP_PASSWORD environment variables.');
    }

    const fromName = process.env.SMTP_FROM_NAME || 'ResumeConverter';
    const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER;

    const mailOptions = {
        from: from || `"${fromName}" <${fromEmail}>`,
        to,
        subject,
        html,
        text: text || html.replace(/<[^>]*>/g, ''), // Strip HTML for plain text fallback
        replyTo: replyTo || fromEmail
    };

    try {
        const result = await t.sendMail(mailOptions);
        safeLog('info', 'Email sent successfully', { 
            to, 
            subject, 
            messageId: result.messageId 
        });
        return result;
    } catch (error) {
        safeLog('error', 'Failed to send email', { 
            to, 
            subject, 
            error: error.message 
        });
        throw error;
    }
}

/**
 * Send consent request email
 * @param {Object} options - Email options
 * @param {string} options.to - Candidate email
 * @param {string} options.candidateName - Candidate name
 * @param {string} options.firmName - Firm name
 * @param {string} options.firmLogo - Firm logo URL (optional)
 * @param {string} options.consentUrl - URL to consent page
 * @param {string} options.refuseUrl - URL to refuse consent
 * @param {number} options.expiryDays - Days until auto-deletion
 * @returns {Promise<Object>} Send result
 */
export async function sendConsentRequestEmail({
    to,
    candidateName,
    firmName,
    firmLogo,
    consentUrl,
    refuseUrl,
    expiryDays = 14
}) {
    const subject = `Demande de consentement - Conservation de votre CV - ${firmName}`;
    
    const html = generateConsentEmailHtml({
        candidateName,
        firmName,
        firmLogo,
        consentUrl,
        refuseUrl,
        expiryDays
    });

    return sendEmail({ to, subject, html });
}

/**
 * Send consent reminder email
 * @param {Object} options - Same as sendConsentRequestEmail
 * @param {number} options.daysRemaining - Days remaining before deletion
 * @returns {Promise<Object>} Send result
 */
export async function sendConsentReminderEmail({
    to,
    candidateName,
    firmName,
    firmLogo,
    consentUrl,
    refuseUrl,
    daysRemaining
}) {
    const subject = `Rappel - Demande de consentement - ${firmName}`;
    
    const html = generateConsentReminderHtml({
        candidateName,
        firmName,
        firmLogo,
        consentUrl,
        refuseUrl,
        daysRemaining
    });

    return sendEmail({ to, subject, html });
}

/**
 * Generate HTML for consent request email
 */
function generateConsentEmailHtml({
    candidateName,
    firmName,
    firmLogo,
    consentUrl,
    refuseUrl,
    expiryDays
}) {
    const logoHtml = firmLogo 
        ? `<img src="${firmLogo}" alt="${firmName}" style="max-height: 60px; max-width: 200px;" />`
        : `<h1 style="color: #1f2937; margin: 0;">${firmName}</h1>`;

    return `
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Demande de consentement</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
    <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
            <td style="padding: 40px 20px;">
                <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                    <!-- Header -->
                    <tr>
                        <td style="padding: 30px; text-align: center; background-color: #f9fafb; border-bottom: 1px solid #e5e7eb;">
                            ${logoHtml}
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px 30px;">
                            <p style="font-size: 16px; color: #374151; margin: 0 0 20px;">
                                Bonjour <strong>${candidateName}</strong>,
                            </p>
                            
                            <p style="font-size: 14px; color: #4b5563; line-height: 1.6; margin: 0 0 20px;">
                                Le cabinet <strong>${firmName}</strong> souhaite conserver votre CV dans son vivier de talents 
                                afin de vous proposer des opportunités professionnelles correspondant à votre profil.
                            </p>
                            
                            <p style="font-size: 14px; color: #4b5563; line-height: 1.6; margin: 0 0 20px;">
                                Conformément au Règlement Général sur la Protection des Données (RGPD), nous vous 
                                demandons votre consentement explicite pour :
                            </p>
                            
                            <ul style="font-size: 14px; color: #4b5563; line-height: 1.8; margin: 0 0 20px; padding-left: 20px;">
                                <li>Stocker votre CV dans notre base de données sécurisée</li>
                                <li>Vous contacter pour des opportunités professionnelles pertinentes</li>
                                <li>Conserver vos données pendant une durée maximale de 2 ans</li>
                            </ul>
                            
                            <p style="font-size: 14px; color: #4b5563; line-height: 1.6; margin: 0 0 30px;">
                                <strong>Vos droits :</strong> Vous pouvez retirer votre consentement à tout moment, 
                                demander l'accès, la rectification ou la suppression de vos données.
                            </p>
                            
                            <!-- Buttons -->
                            <table role="presentation" style="width: 100%; border-collapse: collapse;">
                                <tr>
                                    <td style="padding: 0 10px 10px 0; width: 50%;">
                                        <a href="${consentUrl}" 
                                           style="display: block; padding: 14px 24px; background-color: #10b981; color: #ffffff; text-decoration: none; text-align: center; border-radius: 6px; font-weight: bold; font-size: 14px;">
                                            ✓ J'accepte
                                        </a>
                                    </td>
                                    <td style="padding: 0 0 10px 10px; width: 50%;">
                                        <a href="${refuseUrl}" 
                                           style="display: block; padding: 14px 24px; background-color: #ef4444; color: #ffffff; text-decoration: none; text-align: center; border-radius: 6px; font-weight: bold; font-size: 14px;">
                                            ✗ Je refuse
                                        </a>
                                    </td>
                                </tr>
                            </table>
                            
                            <p style="font-size: 13px; color: #9ca3af; line-height: 1.6; margin: 30px 0 0; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                                <strong>Important :</strong> Si vous ne répondez pas dans un délai de <strong>${expiryDays} jours</strong>, 
                                votre CV sera automatiquement supprimé de notre base de données.
                            </p>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="padding: 20px 30px; background-color: #f9fafb; border-top: 1px solid #e5e7eb;">
                            <p style="font-size: 12px; color: #9ca3af; margin: 0; text-align: center;">
                                Ce message et ses pièces jointes sont confidentiels et destinés exclusivement à leur destinataire.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
    `.trim();
}

/**
 * Generate HTML for consent reminder email
 */
function generateConsentReminderHtml({
    candidateName,
    firmName,
    firmLogo,
    consentUrl,
    refuseUrl,
    daysRemaining
}) {
    const logoHtml = firmLogo 
        ? `<img src="${firmLogo}" alt="${firmName}" style="max-height: 60px; max-width: 200px;" />`
        : `<h1 style="color: #1f2937; margin: 0;">${firmName}</h1>`;

    return `
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Rappel - Demande de consentement</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
    <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
            <td style="padding: 40px 20px;">
                <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                    <!-- Header -->
                    <tr>
                        <td style="padding: 30px; text-align: center; background-color: #fef3c7; border-bottom: 1px solid #fcd34d;">
                            ${logoHtml}
                            <p style="margin: 15px 0 0; color: #92400e; font-weight: bold;">⏰ Rappel</p>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px 30px;">
                            <p style="font-size: 16px; color: #374151; margin: 0 0 20px;">
                                Bonjour <strong>${candidateName}</strong>,
                            </p>
                            
                            <p style="font-size: 14px; color: #4b5563; line-height: 1.6; margin: 0 0 20px;">
                                Nous vous avons récemment envoyé une demande de consentement pour la conservation 
                                de votre CV par le cabinet <strong>${firmName}</strong>.
                            </p>
                            
                            <p style="font-size: 14px; color: #dc2626; line-height: 1.6; margin: 0 0 20px; padding: 15px; background-color: #fef2f2; border-radius: 6px;">
                                <strong>⚠️ Attention :</strong> Sans réponse de votre part dans les 
                                <strong>${daysRemaining} jours</strong> restants, votre CV sera automatiquement supprimé.
                            </p>
                            
                            <!-- Buttons -->
                            <table role="presentation" style="width: 100%; border-collapse: collapse;">
                                <tr>
                                    <td style="padding: 0 10px 10px 0; width: 50%;">
                                        <a href="${consentUrl}" 
                                           style="display: block; padding: 14px 24px; background-color: #10b981; color: #ffffff; text-decoration: none; text-align: center; border-radius: 6px; font-weight: bold; font-size: 14px;">
                                            ✓ J'accepte
                                        </a>
                                    </td>
                                    <td style="padding: 0 0 10px 10px; width: 50%;">
                                        <a href="${refuseUrl}" 
                                           style="display: block; padding: 14px 24px; background-color: #ef4444; color: #ffffff; text-decoration: none; text-align: center; border-radius: 6px; font-weight: bold; font-size: 14px;">
                                            ✗ Je refuse
                                        </a>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="padding: 20px 30px; background-color: #f9fafb; border-top: 1px solid #e5e7eb;">
                            <p style="font-size: 12px; color: #9ca3af; margin: 0; text-align: center;">
                                Ce message et ses pièces jointes sont confidentiels et destinés exclusivement à leur destinataire.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
    `.trim();
}

/**
 * Destroy SMTP transporter (for graceful shutdown)
 */
export function destroySmtpTransporter() {
    if (transporter) {
        transporter.close();
        transporter = null;
        safeLog('info', 'SMTP transporter closed');
    }
}

export default {
    isSmtpAvailable,
    sendEmail,
    sendConsentRequestEmail,
    sendConsentReminderEmail,
    destroySmtpTransporter
};
