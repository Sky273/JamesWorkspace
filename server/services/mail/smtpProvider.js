import nodemailer from 'nodemailer';
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

function normalizeSmtpConfig(config = {}) {
    const envUser = normalizeOptionalString(process.env.SMTP_USER);
    const envFromEmail = normalizeOptionalString(process.env.SMTP_FROM_EMAIL) || envUser;
    const envPortRaw = Number.parseInt(String(process.env.SMTP_PORT || ''), 10);

    return {
        host: normalizeOptionalString(config.smtpHost) || normalizeOptionalString(process.env.SMTP_HOST),
        port: Number.isInteger(config.smtpPort)
            ? config.smtpPort
            : (Number.parseInt(String(config.smtpPort || ''), 10) || envPortRaw),
        secure: config.smtpSecure !== undefined
            ? Boolean(config.smtpSecure)
            : String(process.env.SMTP_SECURE || '').toLowerCase() === 'true',
        user: normalizeOptionalString(config.smtpUser) || envUser,
        password: config.smtpPassword || process.env.SMTP_PASSWORD || '',
        fromName: normalizeOptionalString(config.smtpFromName)
            || normalizeOptionalString(process.env.SMTP_FROM_NAME),
        fromEmail: normalizeOptionalString(config.smtpFromEmail) || envFromEmail
    };
}

function getMissingConfigurationFields(config = {}) {
    const smtpConfig = normalizeSmtpConfig(config);
    const missing = [];

    if (!smtpConfig.host) {
        missing.push('SMTP_HOST');
    }
    if (!Number.isInteger(smtpConfig.port) || smtpConfig.port <= 0) {
        missing.push('SMTP_PORT');
    }
    if (!smtpConfig.fromEmail) {
        missing.push('SMTP_FROM_EMAIL');
    }

    const hasUser = Boolean(smtpConfig.user);
    const hasPassword = Boolean(normalizeOptionalString(smtpConfig.password));
    if (hasUser !== hasPassword) {
        missing.push(hasUser ? 'SMTP_PASSWORD' : 'SMTP_USER');
    }

    return missing;
}

function buildTransportCacheKey(config = {}) {
    const smtpConfig = normalizeSmtpConfig(config);
    return JSON.stringify({
        host: smtpConfig.host,
        port: smtpConfig.port,
        secure: smtpConfig.secure,
        user: smtpConfig.user,
        fromEmail: smtpConfig.fromEmail
    });
}

function getTransporter(config = {}) {
    const smtpConfig = normalizeSmtpConfig(config);
    const cacheKey = buildTransportCacheKey(smtpConfig);
    if (transporter && transporterCacheKey === cacheKey) {
        return transporter;
    }

    const authUser = smtpConfig.user;
    const authPassword = normalizeOptionalString(smtpConfig.password);

    transporter = nodemailer.createTransport({
        host: smtpConfig.host,
        port: smtpConfig.port,
        secure: smtpConfig.secure,
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

export function isSmtpConfigured(config = {}) {
    return getMissingConfigurationFields(config).length === 0;
}

export function getSmtpStatus(config = {}) {
    const smtpConfig = normalizeSmtpConfig(config);
    const missingFields = getMissingConfigurationFields(smtpConfig);
    const configured = missingFields.length === 0;

    return {
        connected: configured,
        provider: 'smtp',
        email: smtpConfig.fromEmail || undefined,
        managedByConfiguration: true,
        allowConnect: false,
        allowDisconnect: false,
        supportsOAuth: false,
        needsReauth: false,
        missingFields
    };
}

export async function sendSmtpEmail(config = {}, { to, subject, html, text, attachments = [] }) {
    const smtpConfig = normalizeSmtpConfig(config);
    const missingFields = getMissingConfigurationFields(smtpConfig);
    if (missingFields.length > 0) {
        const error = new Error(`SMTP mail provider is not fully configured: ${missingFields.join(', ')}`);
        error.code = 'SMTP_NOT_CONFIGURED';
        throw error;
    }

    const fromName = smtpConfig.fromName;
    const fromEmail = smtpConfig.fromEmail;
    const from = fromName ? `"${fromName.replace(/"/g, '\\"')}" <${fromEmail}>` : fromEmail;
    const plainText = normalizeOptionalString(text) || stripHtml(html);

    const result = await getTransporter(smtpConfig).sendMail({
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
