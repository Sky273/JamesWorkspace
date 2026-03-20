/**
 * Tests for TOTP Service (2FA)
 * Tests encryption, token verification, and 2FA lifecycle
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies before importing the service
vi.mock('../../config/database.js', () => ({
    query: vi.fn()
}));

vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn()
}));

vi.mock('qrcode', () => ({
    default: {
        toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,mockQRCode')
    }
}));

// Set environment variable for encryption
process.env.JWT_SECRET = 'test-secret-key-for-encryption-32chars';

// Import after mocks
import { query } from '../../config/database.js';
import totpService from '../../services/totp.service.js';

describe('TOTP Service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('generateTotpSecret', () => {
        it('should generate a secret, QR code, and backup codes', async () => {
            const userId = 'test-user-id';
            const userEmail = 'test@example.com';

            query.mockResolvedValueOnce({ rows: [], rowCount: 1 });

            const result = await totpService.generateTotpSecret(userId, userEmail);

            expect(result).toHaveProperty('secret');
            expect(result).toHaveProperty('qrCodeDataUrl');
            expect(result).toHaveProperty('backupCodes');
            expect(result.secret).toMatch(/^[A-Z2-7]+=*$/); // Base32 format
            expect(result.qrCodeDataUrl).toContain('data:image');
            expect(result.backupCodes).toHaveLength(8);
            expect(result.backupCodes[0]).toMatch(/^[A-F0-9]{8}$/); // Hex uppercase
        });

        it('should store encrypted pending secret in database', async () => {
            const userId = 'test-user-id';
            const userEmail = 'test@example.com';

            query.mockResolvedValueOnce({ rows: [], rowCount: 1 });

            await totpService.generateTotpSecret(userId, userEmail);

            expect(query).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE users'),
                expect.arrayContaining([
                    expect.stringContaining(':'), // Encrypted format iv:authTag:encrypted
                    expect.stringContaining(':'),
                    userId
                ])
            );
        });
    });

    describe('verifyAndEnable2FA', () => {
        it('should return error if user not found', async () => {
            query.mockResolvedValueOnce({ rows: [] });

            const result = await totpService.verifyAndEnable2FA('nonexistent-user', '123456');

            expect(result.success).toBe(false);
            expect(result.message).toContain('non trouvé');
        });

        it('should return error if no pending secret', async () => {
            query.mockResolvedValueOnce({ 
                rows: [{ totp_pending_secret: null, totp_pending_backup_codes: null }] 
            });

            const result = await totpService.verifyAndEnable2FA('test-user', '123456');

            expect(result.success).toBe(false);
            expect(result.message).toContain('en attente');
        });

        it('should return error for invalid TOTP code', async () => {
            // First generate a real secret to get properly encrypted data
            query.mockResolvedValueOnce({ rows: [], rowCount: 1 });
            await totpService.generateTotpSecret('test-user', 'test@example.com');
            const encryptedSecret = query.mock.calls[0][1][0];
            const encryptedBackup = query.mock.calls[0][1][1];

            query.mockResolvedValueOnce({
                rows: [{ totp_pending_secret: encryptedSecret, totp_pending_backup_codes: encryptedBackup }]
            });

            const result = await totpService.verifyAndEnable2FA('test-user', '000000');

            expect(result.success).toBe(false);
            expect(result.message).toContain('invalide');
        });
    });

    describe('verifyTotpCode', () => {
        it('should return invalid if user not found', async () => {
            query.mockResolvedValueOnce({ rows: [] });

            const result = await totpService.verifyTotpCode('nonexistent-user', '123456');

            expect(result.valid).toBe(false);
            expect(result.usedBackupCode).toBe(false);
        });

        it('should return invalid if 2FA not enabled', async () => {
            query.mockResolvedValueOnce({ 
                rows: [{ totp_enabled: false, totp_secret: null }] 
            });

            const result = await totpService.verifyTotpCode('test-user', '123456');

            expect(result.valid).toBe(false);
        });

        it('should return invalid if totp_secret is null', async () => {
            query.mockResolvedValueOnce({
                rows: [{ totp_enabled: true, totp_secret: null, totp_backup_codes: null }]
            });

            const result = await totpService.verifyTotpCode('test-user', '123456');

            expect(result.valid).toBe(false);
            expect(result.usedBackupCode).toBe(false);
        });

        it('should return invalid for wrong TOTP code with real encrypted secret', async () => {
            // Generate a real secret
            query.mockResolvedValueOnce({ rows: [], rowCount: 1 });
            await totpService.generateTotpSecret('test-user', 'test@example.com');
            const encryptedSecret = query.mock.calls[0][1][0];
            const encryptedBackup = query.mock.calls[0][1][1];

            query.mockResolvedValueOnce({
                rows: [{
                    totp_enabled: true,
                    totp_secret: encryptedSecret,
                    totp_backup_codes: encryptedBackup
                }]
            });
            // Mock the update query for backup code consumption (won't be called for wrong code)

            const result = await totpService.verifyTotpCode('test-user', '000000');

            expect(result.valid).toBe(false);
            expect(result.usedBackupCode).toBe(false);
        });

        it('should validate with backup code', async () => {
            // Generate a real secret to get encrypted backup codes
            query.mockResolvedValueOnce({ rows: [], rowCount: 1 });
            const generated = await totpService.generateTotpSecret('test-user', 'test@example.com');
            const encryptedSecret = query.mock.calls[0][1][0];
            const encryptedBackup = query.mock.calls[0][1][1];

            // Use one of the real backup codes
            const backupCode = generated.backupCodes[0];

            query.mockResolvedValueOnce({
                rows: [{
                    totp_enabled: true,
                    totp_secret: encryptedSecret,
                    totp_backup_codes: encryptedBackup
                }]
            });
            // Mock the UPDATE query for backup code removal
            query.mockResolvedValueOnce({ rows: [], rowCount: 1 });

            const result = await totpService.verifyTotpCode('test-user', backupCode);

            expect(result.valid).toBe(true);
            expect(result.usedBackupCode).toBe(true);
        });
    });

    describe('is2FAEnabled', () => {
        it('should return true if 2FA is enabled', async () => {
            query.mockResolvedValueOnce({ rows: [{ totp_enabled: true }] });

            const result = await totpService.is2FAEnabled('test-user');

            expect(result).toBe(true);
        });

        it('should return false if 2FA is not enabled', async () => {
            query.mockResolvedValueOnce({ rows: [{ totp_enabled: false }] });

            const result = await totpService.is2FAEnabled('test-user');

            expect(result).toBe(false);
        });

        it('should return false if user not found', async () => {
            query.mockResolvedValueOnce({ rows: [] });

            const result = await totpService.is2FAEnabled('nonexistent-user');

            expect(result).toBe(false);
        });
    });

    describe('get2FAStatus', () => {
        it('should return disabled status if user not found', async () => {
            query.mockResolvedValueOnce({ rows: [] });

            const result = await totpService.get2FAStatus('nonexistent-user');

            expect(result.enabled).toBe(false);
            expect(result.enabledAt).toBeNull();
            expect(result.backupCodesRemaining).toBe(0);
        });

        it('should return status with backup codes count', async () => {
            const enabledAt = new Date();
            query.mockResolvedValueOnce({ 
                rows: [{ 
                    totp_enabled: true, 
                    totp_enabled_at: enabledAt,
                    totp_backup_codes: null // No backup codes
                }] 
            });

            const result = await totpService.get2FAStatus('test-user');

            expect(result.enabled).toBe(true);
            expect(result.enabledAt).toEqual(enabledAt);
            expect(result.backupCodesRemaining).toBe(0);
        });

        it('should count encrypted backup codes correctly', async () => {
            // Generate real encrypted backup codes
            query.mockResolvedValueOnce({ rows: [], rowCount: 1 });
            await totpService.generateTotpSecret('test-user', 'test@example.com');
            const encryptedBackup = query.mock.calls[0][1][1];

            query.mockResolvedValueOnce({
                rows: [{
                    totp_enabled: true,
                    totp_enabled_at: new Date(),
                    totp_backup_codes: encryptedBackup
                }]
            });

            const result = await totpService.get2FAStatus('test-user');

            expect(result.enabled).toBe(true);
            expect(result.backupCodesRemaining).toBe(8);
        });

        it('should return 0 backup codes on decryption error', async () => {
            query.mockResolvedValueOnce({
                rows: [{
                    totp_enabled: true,
                    totp_enabled_at: new Date(),
                    totp_backup_codes: 'corrupted:data:here'
                }]
            });

            const result = await totpService.get2FAStatus('test-user');

            expect(result.enabled).toBe(true);
            expect(result.backupCodesRemaining).toBe(0);
        });

        it('should return false for disabled user', async () => {
            query.mockResolvedValueOnce({
                rows: [{
                    totp_enabled: false,
                    totp_enabled_at: null,
                    totp_backup_codes: null
                }]
            });

            const result = await totpService.get2FAStatus('test-user');

            expect(result.enabled).toBe(false);
        });
    });

    describe('disable2FA', () => {
        it('should fail if verification code is invalid', async () => {
            // Mock verifyTotpCode to return invalid
            query.mockResolvedValueOnce({ 
                rows: [{ totp_enabled: false }] 
            });

            const result = await totpService.disable2FA('test-user', '000000');

            expect(result.success).toBe(false);
            expect(result.message).toContain('invalide');
        });

        it('should disable 2FA with valid backup code', async () => {
            // Generate real secret and backup codes
            query.mockResolvedValueOnce({ rows: [], rowCount: 1 });
            const generated = await totpService.generateTotpSecret('test-user', 'test@example.com');
            const encryptedSecret = query.mock.calls[0][1][0];
            const encryptedBackup = query.mock.calls[0][1][1];

            // Mock verifyTotpCode query - returns enabled user with secret
            query.mockResolvedValueOnce({
                rows: [{
                    totp_enabled: true,
                    totp_secret: encryptedSecret,
                    totp_backup_codes: encryptedBackup
                }]
            });
            // Mock backup code update query
            query.mockResolvedValueOnce({ rows: [], rowCount: 1 });
            // Mock disable2FA UPDATE query
            query.mockResolvedValueOnce({ rows: [], rowCount: 1 });

            const result = await totpService.disable2FA('test-user', generated.backupCodes[0]);

            expect(result.success).toBe(true);
            expect(result.message).toContain('désactivé');
        });
    });

    describe('regenerateBackupCodes', () => {
        it('should fail if verification code is invalid', async () => {
            // Mock verifyTotpCode to return invalid
            query.mockResolvedValueOnce({ 
                rows: [{ totp_enabled: false }] 
            });

            const result = await totpService.regenerateBackupCodes('test-user', '000000');

            expect(result.success).toBe(false);
            expect(result.message).toContain('invalide');
        });

        it('should regenerate backup codes with valid backup code', async () => {
            // Generate real secret and backup codes
            query.mockResolvedValueOnce({ rows: [], rowCount: 1 });
            const generated = await totpService.generateTotpSecret('test-user', 'test@example.com');
            const encryptedSecret = query.mock.calls[0][1][0];
            const encryptedBackup = query.mock.calls[0][1][1];

            // Mock verifyTotpCode query
            query.mockResolvedValueOnce({
                rows: [{
                    totp_enabled: true,
                    totp_secret: encryptedSecret,
                    totp_backup_codes: encryptedBackup
                }]
            });
            // Mock backup code update (from verifyTotpCode)
            query.mockResolvedValueOnce({ rows: [], rowCount: 1 });
            // Mock regeneration UPDATE query
            query.mockResolvedValueOnce({ rows: [], rowCount: 1 });

            const result = await totpService.regenerateBackupCodes('test-user', generated.backupCodes[0]);

            expect(result.success).toBe(true);
            expect(result.backupCodes).toHaveLength(8);
            expect(result.message).toContain('codes de secours');
            // Ensure new codes are different from old ones
            expect(result.backupCodes).not.toEqual(generated.backupCodes);
        });
    });
});

describe('Encryption/Decryption', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // Test encryption by generating a secret and verifying it can be stored/retrieved
    it('should encrypt secrets in a recoverable format', async () => {
        const userId = 'encryption-test-user';
        const userEmail = 'encrypt@test.com';

        query.mockResolvedValueOnce({ rows: [], rowCount: 1 });

        const result = await totpService.generateTotpSecret(userId, userEmail);

        // The secret should be a valid base32 string
        expect(result.secret).toBeTruthy();
        expect(result.secret.length).toBeGreaterThan(10);
        
        // Verify the query was called with encrypted data
        const callArgs = query.mock.calls[0][1];
        const encryptedSecret = callArgs[0];
        
        // Encrypted format should be iv:authTag:encrypted
        const parts = encryptedSecret.split(':');
        expect(parts).toHaveLength(3);
        expect(parts[0].length).toBe(32); // IV is 16 bytes = 32 hex chars
        expect(parts[1].length).toBe(32); // Auth tag is 16 bytes = 32 hex chars
    });
});
