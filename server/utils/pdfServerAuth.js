import crypto from 'crypto';

export const PDF_SERVER_AUTH_HEADER = 'x-internal-service-token';

const DEV_TEST_FALLBACK_TOKEN = 'dev-test-pdf-server-internal-token-32chars';
const DERIVATION_SALT = 'resumeconverter-pdf-server-internal-token-v1';
const isProduction = process.env.NODE_ENV === 'production';
const configuredToken = process.env.PDF_SERVER_INTERNAL_TOKEN;

export function derivePdfServerFallbackToken(jwtSecret = process.env.JWT_SECRET, csrfSecret = process.env.CSRF_SECRET) {
    if (!jwtSecret || jwtSecret.length < 32 || !csrfSecret || csrfSecret.length < 32) {
        return null;
    }

    return crypto
        .createHash('sha256')
        .update(jwtSecret, 'utf8')
        .update(':', 'utf8')
        .update(csrfSecret, 'utf8')
        .update(':', 'utf8')
        .update(DERIVATION_SALT, 'utf8')
        .digest('base64url');
}

function resolvePdfServerInternalToken() {
    if (configuredToken && configuredToken.length >= 32) {
        return configuredToken;
    }

    if (!isProduction) {
        process.env.PDF_SERVER_INTERNAL_TOKEN = DEV_TEST_FALLBACK_TOKEN;
        return DEV_TEST_FALLBACK_TOKEN;
    }

    const derivedToken = derivePdfServerFallbackToken();
    if (derivedToken && derivedToken.length >= 32) {
        process.env.PDF_SERVER_INTERNAL_TOKEN = derivedToken;
        return derivedToken;
    }

    throw new Error(
        'CRITICAL: PDF_SERVER_INTERNAL_TOKEN must be set and at least 32 characters long. ' +
        'Use a dedicated secret for proxy-to-PDF authentication, or ensure JWT_SECRET and CSRF_SECRET are valid so a compatibility fallback can be derived.'
    );
}

export const PDF_SERVER_INTERNAL_TOKEN = resolvePdfServerInternalToken();

export function getPdfServerAuthHeaders(existingHeaders = {}) {
    return {
        ...existingHeaders,
        [PDF_SERVER_AUTH_HEADER]: PDF_SERVER_INTERNAL_TOKEN
    };
}
