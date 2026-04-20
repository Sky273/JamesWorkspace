import nodemailer from 'nodemailer';
import { SMTP_CONFIG } from '../../config/constants.js';
import { safeLog } from '../../utils/logger.backend.js';

let transporter = null;
let transporterCacheKey = null;

function normalizeOptionalString(value) {
    if (value === undefined || value === null) {
        return '';
    }
    return String(value).trim();
}

function stripHtml(value = '') {
    return String(value)
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/\s+/g, ' ')
        .trim();
}

function getMissingConfigurationFields() {
    const missing = [];

    if (!normalizeOptionalString(SMTP_CONFIG.host)) {
        missing.push('SMTP_HOST');
    }
    if (!Number.isInteger(SMTP_CONFIG.port) || SMTP_CONFIG.port <= 0) {
        missing.push('SMTP_PORT');
    }
    if (!normalizeOptionalString(SMTP_CONFIG.fromEmail)) {
        missing.push('SMTP_FROM_EMAIL');
    }

    const hasUser = Boolean(normalizeOptionalString(SMTP_CONFIG.user));
    const hasPassword = Boolean(normalizeOptionalString(SMTP_CONFIG.password));
    if (hasUser !== hasPassword) {
        missing.push(hasUser ? 'SMTP_PASSWORD' : 'SMTP_USER');
    }

    return missing;
}

function buildTransportCacheKey() {
    return JSON.stringify({
        host: normalizeOptionalString(SMTP_CONFIG.host),
        port: SMTP_CONFIG.port,
        secure: Boolean(SMTP_CONFIG.secure),
        user: normalizeOptionalString(SMTP_CONFIG.user),
        fromEmail: normalizeOptionalString(SMTP_CONFIG.fromEmail)
    });
}

function getTransporter() {
    const cacheKey = buildTransportCacheKey();
    if (transporter && transporterCacheKey === cacheKey) {
        return transporter;
    }

    const authUser = normalizeOptionalString(SMTP_CONFIG.user);
    const authPassword = normalizeOptionalString(SMTP_CONFIG.password);

    transporter = nodemailer.createTransport({
        host: SMTP_CONFIG.host,
        port: SMTP_CONFIG.port,
        secure: SMTP_CONFIG.secure,
        ...(authUser && authPassword
            ? {
                auth: {
                    user: authUser,
                    pass: authPassword
                }
            }
            : {})
    });
    transporterCacheKey = cacheKey;

    return transporter;
}

export function isSmtpConfigured() {
    return getMissingConfigurationFields().length === 0;
}

export function getSmtpStatus() {
    const missingFields = getMissingConfigurationFields();
    const configured = missingFields.length === 0;

    return {
        connected: configured,
        provider: 'smtp',
        email: normalizeOptionalString(SMTP_CONFIG.fromEmail) || undefined,
        managedByConfiguration: true,
        allowConnect: false,
        allowDisconnect: false,
        supportsOAuth: false,
        needsReauth: false,
        missingFields
    };
}

export async function sendSmtpEmail({ to, subject, html, text, attachments = [] }) {
    const missingFields = getMissingConfigurationFields();
    if (missingFields.length > 0) {
        const error = new Error(`SMTP mail provider is not fully configured: ${missingFields.join(', ')}`);
        error.code = 'SMTP_NOT_CONFIGURED';
        throw error;
    }

    const fromName = normalizeOptionalString(SMTP_CONFIG.fromName);
    const fromEmail = normalizeOptionalString(SMTP_CONFIG.fromEmail);
    const from = fromName ? `"${fromName.replace(/"/g, '\\"')}" <${fromEmail}>` : fromEmail;
    const plainText = normalizeOptionalString(text) || stripHtml(html);

    const result = await getTransporter().sendMail({
        from,
        to,
        subject,
        html,
        text: plainText || undefined,
        attachments
    });

    safeLog('info', 'Email sent via SMTP provider', {
        to,
        messageId: result.messageId,
        response: result.response
    });

    return {
        success: true,
        provider: 'smtp',
        messageId: result.messageId || null,
        sentTo: to
    };
}
