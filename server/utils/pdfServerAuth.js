export const PDF_SERVER_AUTH_HEADER = 'x-internal-service-token';

const DEV_TEST_FALLBACK_TOKEN = 'dev-test-pdf-server-internal-token-32chars';
const isProduction = process.env.NODE_ENV === 'production';
const configuredToken = process.env.PDF_SERVER_INTERNAL_TOKEN;

function resolvePdfServerInternalToken() {
    if (configuredToken && configuredToken.length >= 32) {
        return configuredToken;
    }

    if (!isProduction) {
        process.env.PDF_SERVER_INTERNAL_TOKEN = DEV_TEST_FALLBACK_TOKEN;
        return DEV_TEST_FALLBACK_TOKEN;
    }

    throw new Error(
        'CRITICAL: PDF_SERVER_INTERNAL_TOKEN must be set and at least 32 characters long. ' +
        'Use a dedicated secret for proxy-to-PDF authentication.'
    );
}

export const PDF_SERVER_INTERNAL_TOKEN = resolvePdfServerInternalToken();

export function getPdfServerAuthHeaders(existingHeaders = {}) {
    return {
        ...existingHeaders,
        [PDF_SERVER_AUTH_HEADER]: PDF_SERVER_INTERNAL_TOKEN
    };
}
