import { describe, expect, it } from 'vitest';

import { shouldBypassCache } from '../../utils/requestCacheControl.js';

describe('requestCacheControl', () => {
    it('returns true for explicit refresh query flags', () => {
        expect(shouldBypassCache({ query: { refresh: '1' } })).toBe(true);
        expect(shouldBypassCache({ query: { refresh: 'true' } })).toBe(true);
    });

    it('returns false when refresh is absent or disabled', () => {
        expect(shouldBypassCache({ query: {} })).toBe(false);
        expect(shouldBypassCache({ query: { refresh: '0' } })).toBe(false);
        expect(shouldBypassCache({})).toBe(false);
    });
});

