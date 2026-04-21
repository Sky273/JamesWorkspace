import { decryptToken, encryptToken } from '../../config/oauth.config.js';
import { getCanonicalSettingsRecord, invalidateSettingsCache, updateSettings } from '../settings.service.js';

const MAIL_DELIVERY_PROVIDER_VALUES = new Set(['gmail', 'smtp', 'auto']);
const DEFAULT_SMTP_PORT = 587;
const DEFAULT_SMTP_FROM_NAME = 'ResumeConverter';

function normalizeString(value) {
    if (value === undefined || value === null) {
        return '';
    }
    return String(value).trim();
}

function normalizeProvider(value) {
    const normalized = normalizeString(value).toLowerCase();
    if (!MAIL_DELIVERY_PROVIDER_VALUES.has(normalized)) {
        return 'gmail';
    }
    return normalized;
}

function normalizePort(value) {
    const parsed = Number.parseInt(String(value ?? DEFAULT_SMTP_PORT), 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_SMTP_PORT;
}

function buildDefaultGdprRedirectUri() {
    return `${process.env.BACKEND_URL || 'http://localhost:3001'}/api/gdpr/mail/callback`;
}

function buildEnvironmentMailSystemConfig() {
    const smtpUser = normalizeString(process.env.SMTP_USER);

    return {
        provider: normalizeProvider(process.env.GDPR_MAIL_PROVIDER || process.env.MAIL_DELIVERY_PROVIDER || 'gmail'),
        smtpHost: normalizeString(process.env.SMTP_HOST),
        smtpPort: normalizePort(process.env.SMTP_PORT),
        smtpSecure: String(process.env.SMTP_SECURE || '').toLowerCase() === 'true',
        smtpUser,
        smtpPassword: process.env.SMTP_PASSWORD || '',
        smtpFromName: normalizeString(process.env.SMTP_FROM_NAME) || DEFAULT_SMTP_FROM_NAME,
        smtpFromEmail: normalizeString(process.env.SMTP_FROM_EMAIL) || smtpUser,
        googleGdprRedirectUri: normalizeString(process.env.GOOGLE_GDPR_REDIRECT_URI) || buildDefaultGdprRedirectUri(),
        source: 'environment'
    };
}

function hasMeaningfulStringValue(value) {
    return normalizeString(value).length > 0;
}

function rowHasPersistedMailConfig(row) {
    if (!row) {
        return false;
    }

    return [
        row.mail_delivery_provider,
        row.smtp_host,
        row.smtp_port,
        row.smtp_secure,
        row.smtp_user,
        row.smtp_password_encrypted,
        row.smtp_from_name,
        row.smtp_from_email,
        row.google_gdpr_redirect_uri
    ].some((value) => {
        if (typeof value === 'string') {
            return hasMeaningfulStringValue(value);
        }

        return value !== undefined && value !== null;
    });
}

function resolveBooleanValue(persistedValue, envValue, fallback = false) {
    if (persistedValue !== undefined && persistedValue !== null) {
        return Boolean(persistedValue);
    }
    if (envValue !== undefined && envValue !== null) {
        return Boolean(envValue);
    }
    return fallback;
}

function resolvePortValue(persistedValue, envValue) {
    if (persistedValue !== undefined && persistedValue !== null && normalizeString(persistedValue) !== '') {
        return normalizePort(persistedValue);
    }
    return normalizePort(envValue);
}

function resolveStringValue(persistedValue, envValue, fallback = '') {
    if (persistedValue !== undefined && persistedValue !== null && normalizeString(persistedValue) !== '') {
        return normalizeString(persistedValue);
    }

    if (envValue !== undefined && envValue !== null && normalizeString(envValue) !== '') {
        return normalizeString(envValue);
    }

    return fallback;
}

function resolvePasswordValue(persistedValue, envValue) {
    if (persistedValue !== undefined && persistedValue !== null && normalizeString(persistedValue) !== '') {
        return persistedValue ? decryptToken(persistedValue) : '';
    }
    return envValue || '';
}

export function getEffectiveMailDeliveryProvider(config) {
    if (config.provider === 'auto') {
        return config.smtpConfigured ? 'smtp' : 'gmail';
    }
    return config.provider;
}

export async function resolveMailSystemConfig() {
    const environmentConfig = buildEnvironmentMailSystemConfig();
    const settingsRecord = await getCanonicalSettingsRecord();
    const hasPersistedConfig = rowHasPersistedMailConfig(settingsRecord);
    const source = hasPersistedConfig ? 'database' : 'environment';

    const config = hasPersistedConfig
        ? {
            provider: normalizeProvider(settingsRecord?.mail_delivery_provider || environmentConfig.provider),
            smtpHost: resolveStringValue(settingsRecord?.smtp_host, environmentConfig.smtpHost),
            smtpPort: resolvePortValue(settingsRecord?.smtp_port, environmentConfig.smtpPort),
            smtpSecure: resolveBooleanValue(settingsRecord?.smtp_secure, environmentConfig.smtpSecure, false),
            smtpUser: resolveStringValue(settingsRecord?.smtp_user, environmentConfig.smtpUser),
            smtpPassword: resolvePasswordValue(settingsRecord?.smtp_password_encrypted, environmentConfig.smtpPassword),
            smtpFromName: resolveStringValue(settingsRecord?.smtp_from_name, environmentConfig.smtpFromName, DEFAULT_SMTP_FROM_NAME),
            smtpFromEmail: resolveStringValue(settingsRecord?.smtp_from_email, environmentConfig.smtpFromEmail),
            googleGdprRedirectUri: resolveStringValue(
                settingsRecord?.google_gdpr_redirect_uri,
                environmentConfig.googleGdprRedirectUri,
                buildDefaultGdprRedirectUri()
            ),
            source
        }
        : {
            provider: environmentConfig.provider,
            smtpHost: environmentConfig.smtpHost,
            smtpPort: environmentConfig.smtpPort,
            smtpSecure: environmentConfig.smtpSecure,
            smtpUser: environmentConfig.smtpUser,
            smtpPassword: environmentConfig.smtpPassword,
            smtpFromName: environmentConfig.smtpFromName,
            smtpFromEmail: environmentConfig.smtpFromEmail,
            googleGdprRedirectUri: environmentConfig.googleGdprRedirectUri,
            source
        };

    config.hasSmtpPassword = Boolean(config.smtpPassword);
    config.smtpConfigured = Boolean(
        config.smtpHost
        && config.smtpPort
        && config.smtpFromEmail
        && (
            (!config.smtpUser && !config.smtpPassword)
            || (config.smtpUser && config.smtpPassword)
        )
    );
    config.effectiveProvider = getEffectiveMailDeliveryProvider(config);

    return config;
}

export async function getMailSystemConfigForAdmin() {
    const config = await resolveMailSystemConfig();

    return {
        provider: config.provider,
        effectiveProvider: config.effectiveProvider,
        source: config.source,
        smtpHost: config.smtpHost,
        smtpPort: config.smtpPort,
        smtpSecure: config.smtpSecure,
        smtpUser: config.smtpUser,
        smtpPassword: config.smtpPassword,
        smtpFromName: config.smtpFromName,
        smtpFromEmail: config.smtpFromEmail,
        googleGdprRedirectUri: config.googleGdprRedirectUri,
        hasSmtpPassword: config.hasSmtpPassword,
        smtpConfigured: config.smtpConfigured,
        googleClientConfigured: Boolean(normalizeString(process.env.GOOGLE_CLIENT_ID) && normalizeString(process.env.GOOGLE_CLIENT_SECRET))
    };
}

export async function updateMailSystemConfig(payload) {
    const settingsRecord = await getCanonicalSettingsRecord({ createIfMissing: true });

    const fields = {
        mail_delivery_provider: normalizeProvider(payload.provider),
        smtp_host: normalizeString(payload.smtpHost),
        smtp_port: normalizePort(payload.smtpPort),
        smtp_secure: Boolean(payload.smtpSecure),
        smtp_user: normalizeString(payload.smtpUser),
        smtp_from_name: normalizeString(payload.smtpFromName) || DEFAULT_SMTP_FROM_NAME,
        smtp_from_email: normalizeString(payload.smtpFromEmail),
        google_gdpr_redirect_uri: normalizeString(payload.googleGdprRedirectUri)
    };

    if (payload.clearSmtpPassword) {
        fields.smtp_password_encrypted = '';
    } else if (payload.smtpPassword !== undefined && normalizeString(payload.smtpPassword)) {
        fields.smtp_password_encrypted = encryptToken(String(payload.smtpPassword));
    }

    await updateSettings(settingsRecord.id, fields);
    await invalidateSettingsCache();

    return getMailSystemConfigForAdmin();
}
