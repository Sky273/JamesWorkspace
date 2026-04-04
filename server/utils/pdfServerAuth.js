export const PDF_SERVER_AUTH_HEADER = 'x-internal-service-token';

export function resolvePdfServerInternalToken(configuredToken = process.env.PDF_SERVER_INTERNAL_TOKEN) {
    return configuredToken && configuredToken.length >= 32 ? configuredToken : null;
}

export function getPdfServerAuthHeaders(existingHeaders = {}) {
    const token = resolvePdfServerInternalToken();
    if (!token) {
        const error = new Error('PDF_SERVER_INTERNAL_TOKEN must be set and at least 32 characters long.');
        error.code = 'PDF_SERVER_AUTH_NOT_CONFIGURED';
        throw error;
    }

    return {
        ...existingHeaders,
        [PDF_SERVER_AUTH_HEADER]: token
    };
}
