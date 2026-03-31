import { describe, expect, it, vi } from 'vitest';

vi.mock('../../config/constants.js', () => ({
    JWT_SECRET: 'test-jwt-secret-for-crypto-minimum-32-chars-long'
}));

import { decryptSecret, encryptSecret, isEncryptedSecret } from '../../utils/secretCrypto.js';

describe('secretCrypto', () => {
    it('encrypts and decrypts a secret value', () => {
        const encrypted = encryptSecret('super-secret', { purpose: 'unit-test' });

        expect(isEncryptedSecret(encrypted)).toBe(true);
        expect(encrypted).not.toBe('super-secret');
        expect(decryptSecret(encrypted, { purpose: 'unit-test' })).toBe('super-secret');
    });

    it('passes through plaintext values for backward compatibility', () => {
        expect(decryptSecret('legacy-plain-secret', { purpose: 'unit-test' })).toBe('legacy-plain-secret');
    });
});
