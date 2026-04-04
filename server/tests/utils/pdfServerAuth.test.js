import { beforeEach, describe, expect, it } from 'vitest';

process.env.PDF_SERVER_INTERNAL_TOKEN = 'test-pdf-server-internal-token-minimum-32-chars';

import {
    PDF_SERVER_AUTH_HEADER,
    getPdfServerAuthHeaders,
    resolvePdfServerInternalToken
} from '../../utils/pdfServerAuth.js';

describe('pdfServerAuth', () => {
    beforeEach(() => {
        process.env.PDF_SERVER_INTERNAL_TOKEN = 'test-pdf-server-internal-token-minimum-32-chars';
    });

    it('returns the configured dedicated token when valid', () => {
        expect(resolvePdfServerInternalToken()).toBe(process.env.PDF_SERVER_INTERNAL_TOKEN);
    });

    it('returns null when the configured token is missing or too short', () => {
        expect(resolvePdfServerInternalToken('')).toBeNull();
        expect(resolvePdfServerInternalToken('short-token')).toBeNull();
    });

    it('adds the dedicated token to outbound PDF server headers', () => {
        expect(getPdfServerAuthHeaders({ 'Content-Type': 'application/json' })).toEqual({
            'Content-Type': 'application/json',
            [PDF_SERVER_AUTH_HEADER]: process.env.PDF_SERVER_INTERNAL_TOKEN
        });
    });
});
