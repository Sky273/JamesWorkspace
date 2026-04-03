import { describe, expect, it } from 'vitest';

import { derivePdfServerFallbackToken } from '../../utils/pdfServerAuth.js';

describe('pdfServerAuth', () => {
    it('derives a stable opaque fallback token without exposing secret prefixes', () => {
        const jwtSecret = 'j'.repeat(32) + '-jwt-secret-material';
        const csrfSecret = 'c'.repeat(32) + '-csrf-secret-material';

        const token = derivePdfServerFallbackToken(jwtSecret, csrfSecret);

        expect(token).toHaveLength(43);
        expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
        expect(token.startsWith('j'.repeat(8))).toBe(false);
        expect(token.startsWith('c'.repeat(8))).toBe(false);
        expect(derivePdfServerFallbackToken(jwtSecret, csrfSecret)).toBe(token);
        expect(derivePdfServerFallbackToken(jwtSecret, `${csrfSecret}x`)).not.toBe(token);
    });

    it('returns null when required source secrets are too short', () => {
        expect(derivePdfServerFallbackToken('short', 'c'.repeat(40))).toBeNull();
        expect(derivePdfServerFallbackToken('j'.repeat(40), 'short')).toBeNull();
    });
});
