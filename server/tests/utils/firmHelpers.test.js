/**
 * Tests for firmHelpers.js
 * Firm-related utility functions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('../../config/database.js', () => ({
    query: vi.fn()
}));

vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn(),
    createModuleLogger: () => ({
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn()
    })
}));

import { query } from '../../config/database.js';
import { safeLog } from '../../utils/logger.backend.js';
import { 
    isValidUUID, 
    getUserFirmId, 
    getUserFirmName, 
    getFirmById, 
    isUserAdmin 
} from '../../utils/firmHelpers.js';

describe('firmHelpers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('isValidUUID', () => {
        it('should return true for valid UUID v4', () => {
            expect(isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
            expect(isValidUUID('6ba7b810-9dad-11d1-80b4-00c04fd430c8')).toBe(true);
        });

        it('should return true for valid UUID v1', () => {
            expect(isValidUUID('6ba7b810-9dad-11d1-80b4-00c04fd430c8')).toBe(true);
        });

        it('should return false for invalid UUID', () => {
            expect(isValidUUID('not-a-uuid')).toBe(false);
            expect(isValidUUID('550e8400-e29b-41d4-a716')).toBe(false);
            expect(isValidUUID('550e8400e29b41d4a716446655440000')).toBe(false);
        });

        it('should return false for null or undefined', () => {
            expect(isValidUUID(null)).toBe(false);
            expect(isValidUUID(undefined)).toBe(false);
        });

        it('should return false for non-string types', () => {
            expect(isValidUUID(123)).toBe(false);
            expect(isValidUUID({})).toBe(false);
            expect(isValidUUID([])).toBe(false);
        });

        it('should return false for empty string', () => {
            expect(isValidUUID('')).toBe(false);
        });

        it('should be case insensitive', () => {
            expect(isValidUUID('550E8400-E29B-41D4-A716-446655440000')).toBe(true);
            expect(isValidUUID('550e8400-E29B-41d4-A716-446655440000')).toBe(true);
        });
    });

    describe('getUserFirmId', () => {
        it('should return firm_id from user object', async () => {
            const req = {
                user: {
                    id: 'user-123',
                    firm_id: '550e8400-e29b-41d4-a716-446655440000'
                }
            };

            const result = await getUserFirmId(req);

            expect(result).toBe('550e8400-e29b-41d4-a716-446655440000');
        });

        it('should return firmId (camelCase) from user object', async () => {
            const req = {
                user: {
                    id: 'user-123',
                    firmId: '550e8400-e29b-41d4-a716-446655440000'
                }
            };

            const result = await getUserFirmId(req);

            expect(result).toBe('550e8400-e29b-41d4-a716-446655440000');
        });

        it('should prefer firm_id over firmId', async () => {
            const req = {
                user: {
                    firm_id: '550e8400-e29b-41d4-a716-446655440000',
                    firmId: '660e8400-e29b-41d4-a716-446655440000'
                }
            };

            const result = await getUserFirmId(req);

            expect(result).toBe('550e8400-e29b-41d4-a716-446655440000');
        });

        it('should return null for invalid UUID format', async () => {
            const req = {
                user: {
                    id: 'user-123',
                    firm_id: 'invalid-uuid'
                }
            };

            const result = await getUserFirmId(req);

            expect(result).toBeNull();
            expect(safeLog).toHaveBeenCalledWith('warn', expect.any(String), expect.any(Object));
        });

        it('should return null when no user object', async () => {
            const req = {};

            const result = await getUserFirmId(req);

            expect(result).toBeNull();
        });

        it('should return null when no firm_id in user', async () => {
            const req = {
                user: {
                    id: 'user-123'
                }
            };

            const result = await getUserFirmId(req);

            expect(result).toBeNull();
        });
    });

    describe('getUserFirmName', () => {
        it('should return firm name from user.firm', () => {
            const req = {
                user: {
                    firm: 'Acme Corp'
                }
            };

            const result = getUserFirmName(req);

            expect(result).toBe('Acme Corp');
        });

        it('should return firm name from user.Firm (capitalized)', () => {
            const req = {
                user: {
                    Firm: 'Acme Corp'
                }
            };

            const result = getUserFirmName(req);

            expect(result).toBe('Acme Corp');
        });

        it('should prefer firm over Firm', () => {
            const req = {
                user: {
                    firm: 'First Corp',
                    Firm: 'Second Corp'
                }
            };

            const result = getUserFirmName(req);

            expect(result).toBe('First Corp');
        });

        it('should return null when no firm name', () => {
            const req = {
                user: {}
            };

            const result = getUserFirmName(req);

            expect(result).toBeNull();
        });

        it('should return null when no user object', () => {
            const req = {};

            const result = getUserFirmName(req);

            expect(result).toBeNull();
        });
    });

    describe('getFirmById', () => {
        it('should return firm details when found', async () => {
            query.mockResolvedValue({
                rows: [{ id: '550e8400-e29b-41d4-a716-446655440000', name: 'Acme Corp' }]
            });

            const result = await getFirmById('550e8400-e29b-41d4-a716-446655440000');

            expect(result).toEqual({ id: '550e8400-e29b-41d4-a716-446655440000', name: 'Acme Corp' });
            expect(query).toHaveBeenCalledWith(
                'SELECT id, name FROM firms WHERE id = $1',
                ['550e8400-e29b-41d4-a716-446655440000']
            );
        });

        it('should return null when firm not found', async () => {
            query.mockResolvedValue({ rows: [] });

            const result = await getFirmById('550e8400-e29b-41d4-a716-446655440000');

            expect(result).toBeNull();
        });

        it('should return null for invalid UUID', async () => {
            const result = await getFirmById('invalid-uuid');

            expect(result).toBeNull();
            expect(query).not.toHaveBeenCalled();
        });

        it('should return null for null firmId', async () => {
            const result = await getFirmById(null);

            expect(result).toBeNull();
            expect(query).not.toHaveBeenCalled();
        });

        it('should return null and log error on database error', async () => {
            query.mockRejectedValue(new Error('Database connection failed'));

            const result = await getFirmById('550e8400-e29b-41d4-a716-446655440000');

            expect(result).toBeNull();
            expect(safeLog).toHaveBeenCalledWith('error', expect.any(String), expect.any(Object));
        });
    });

    describe('isUserAdmin', () => {
        it('should return true for admin role (lowercase)', () => {
            const req = {
                user: {
                    role: 'admin'
                }
            };

            expect(isUserAdmin(req)).toBe(true);
        });

        it('should return true for Admin role (capitalized)', () => {
            const req = {
                user: {
                    role: 'Admin'
                }
            };

            expect(isUserAdmin(req)).toBe(true);
        });

        it('should return true for ADMIN role (uppercase)', () => {
            const req = {
                user: {
                    role: 'ADMIN'
                }
            };

            expect(isUserAdmin(req)).toBe(true);
        });

        it('should return true for Role property (capitalized)', () => {
            const req = {
                user: {
                    Role: 'admin'
                }
            };

            expect(isUserAdmin(req)).toBe(true);
        });

        it('should return false for user role', () => {
            const req = {
                user: {
                    role: 'user'
                }
            };

            expect(isUserAdmin(req)).toBe(false);
        });

        it('should return false for no role', () => {
            const req = {
                user: {}
            };

            expect(isUserAdmin(req)).toBe(false);
        });

        it('should return false for no user object', () => {
            const req = {};

            expect(isUserAdmin(req)).toBe(false);
        });

        it('should return false for other roles', () => {
            const req = {
                user: {
                    role: 'manager'
                }
            };

            expect(isUserAdmin(req)).toBe(false);
        });
    });
});
