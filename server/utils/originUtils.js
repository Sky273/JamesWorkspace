export function normalizeOrigin(origin) {
    if (typeof origin !== 'string') {
        return '';
    }

    const trimmed = origin.trim();
    if (!trimmed) {
        return '';
    }

    try {
        const url = new URL(trimmed);
        return url.origin.toLowerCase();
    } catch {
        return trimmed.replace(/\/+$/, '').toLowerCase();
    }
}

function buildHttpsOriginFromCookieDomain(cookieDomain) {
    if (typeof cookieDomain !== 'string') {
        return '';
    }

    const trimmed = cookieDomain.trim().replace(/^\.+/, '');
    if (!trimmed) {
        return '';
    }

    return normalizeOrigin(`https://${trimmed}`);
}

function extractOriginFromUrlLikeValue(value) {
    const normalized = normalizeOrigin(value);
    if (normalized) {
        return normalized;
    }

    return '';
}

export function buildAllowedOrigins(env = process.env) {
    const configuredOrigins = [
        ...(env.ALLOWED_ORIGINS ? env.ALLOWED_ORIGINS.split(',') : []),
        env.FRONTEND_URL,
        env.VITE_APP_URL,
        env.APP_URL,
        env.PUBLIC_APP_URL,
        env.PUBLIC_BASE_URL,
        extractOriginFromUrlLikeValue(env.GOOGLE_AUTH_REDIRECT_URI),
        extractOriginFromUrlLikeValue(env.GOOGLE_REDIRECT_URI),
        extractOriginFromUrlLikeValue(env.GOOGLE_GDPR_REDIRECT_URI),
        extractOriginFromUrlLikeValue(env.GOOGLE_CALENDAR_REDIRECT_URI),
        buildHttpsOriginFromCookieDomain(env.COOKIE_DOMAIN)
    ];

    const defaultOrigins = [
        'http://localhost:5173',
        'http://localhost:4173',
        'http://localhost:3000',
        'http://localhost:3001',
        'https://localhost',
        'https://localhost:3443',
        'http://localhost:3002'
    ];

    return [...new Set(
        [...configuredOrigins, ...defaultOrigins]
            .map(normalizeOrigin)
            .filter(Boolean)
    )];
}
