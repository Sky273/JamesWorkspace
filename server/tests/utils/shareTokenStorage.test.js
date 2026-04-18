import { describe, expect, it, vi } from 'vitest';

vi.mock('../../config/constants.js', () => ({
    JWT_SECRET: 'test-jwt-secret-for-share-token-minimum-32-chars'
}));

import {
    createStoredShareToken,
    generateShareToken,
    getStoredShareTokenLookup,
    readStoredShareToken
} from '../../utils/shareTokenStorage.js';

describe('shareTokenStorage', () => {
    it('stores share tokens within the legacy 64-character column budget', () => {
        const token = generateShareToken();
        const storedToken = createStoredShareToken(token);

        expect(storedToken).toBe(token);
        expect(storedToken).toHaveLength(64);
        expect(readStoredShareToken(storedToken)).toBe(token);
    });

    it('builds lookup params that support both plain and legacy versioned token queries', () => {
        const lookup = getStoredShareTokenLookup('plain-token');

        expect(lookup.exactToken).toBe('plain-token');
        expect(lookup.v2Pattern.startsWith('v2:')).toBe(true);
        expect(lookup.v2Pattern.endsWith(':%')).toBe(true);
    });
});
