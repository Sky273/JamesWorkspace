import { CSRF_SECRET, JWT_SECRET } from '../config/constants.js';

export const PDF_SERVER_AUTH_HEADER = 'x-internal-service-token';
export const PDF_SERVER_INTERNAL_TOKEN = process.env.PDF_SERVER_INTERNAL_TOKEN || CSRF_SECRET || JWT_SECRET;

export function getPdfServerAuthHeaders(existingHeaders = {}) {
    return {
        ...existingHeaders,
        [PDF_SERVER_AUTH_HEADER]: PDF_SERVER_INTERNAL_TOKEN
    };
}
