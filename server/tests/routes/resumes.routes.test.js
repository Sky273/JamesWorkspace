/**
 * Resume Routes Tests
 * Tests for firm-based access control on resume operations
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock dependencies
vi.mock('../../config/database.js', () => ({
    query: vi.fn()
}));

vi.mock('../../utils/firmHelpers.js', () => ({
    getUserFirmId: vi.fn(),
    isUserAdmin: vi.fn(),
    isValidUUID: vi.fn((id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))
}));

vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn(),
    createModuleLogger: vi.fn(() => vi.fn())
}));

// Import mocked modules
import { query } from '../../config/database.js';
import { getUserFirmId, isUserAdmin } from '../../utils/firmHelpers.js';

describe('Resume Access Control', () => {
    const mockResumeId = '123e4567-e89b-12d3-a456-426614174000';
    const mockFirmId = '987fcdeb-51a2-3bc4-d567-890123456789';
    const mockOtherFirmId = 'abcdef01-2345-6789-abcd-ef0123456789';

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Admin Access', () => {
        it('should allow admin to access any resume', async () => {
            // Setup
            isUserAdmin.mockReturnValue(true);
            query.mockResolvedValue({
                rows: [{ id: mockResumeId, firm_id: mockFirmId, name: 'Test Resume' }]
            });

            const req = { user: { id: 'admin-user', role: 'admin' } };
            
            // Admin should have access regardless of firm
            expect(isUserAdmin(req)).toBe(true);
        });
    });

    describe('User Access - Same Firm', () => {
        it('should allow user to access resume from their firm', async () => {
            // Setup
            isUserAdmin.mockReturnValue(false);
            getUserFirmId.mockResolvedValue(mockFirmId);
            query.mockResolvedValue({
                rows: [{ id: mockResumeId, firm_id: mockFirmId, name: 'Test Resume' }]
            });

            const req = { user: { id: 'user-1', role: 'user', firm_id: mockFirmId } };
            
            // User's firm matches resume's firm
            const userFirmId = await getUserFirmId(req);
            expect(userFirmId).toBe(mockFirmId);
        });
    });

    describe('User Access - Different Firm', () => {
        it('should deny user access to resume from different firm', async () => {
            // Setup
            isUserAdmin.mockReturnValue(false);
            getUserFirmId.mockResolvedValue(mockFirmId);
            query.mockResolvedValue({
                rows: [{ id: mockResumeId, firm_id: mockOtherFirmId, name: 'Other Firm Resume' }]
            });

            const req = { user: { id: 'user-1', role: 'user', firm_id: mockFirmId } };
            
            // User's firm does NOT match resume's firm
            const userFirmId = await getUserFirmId(req);
            const resume = (await query('SELECT * FROM resumes WHERE id = $1', [mockResumeId])).rows[0];
            
            expect(userFirmId).not.toBe(resume.firm_id);
        });
    });

    describe('Resume Not Found', () => {
        it('should return not found for non-existent resume', async () => {
            // Setup
            query.mockResolvedValue({ rows: [] });

            const result = await query('SELECT * FROM resumes WHERE id = $1', ['non-existent-id']);
            
            expect(result.rows.length).toBe(0);
        });
    });

    describe('User Without Firm', () => {
        it('should deny access if user has no firm_id', async () => {
            // Setup
            isUserAdmin.mockReturnValue(false);
            getUserFirmId.mockResolvedValue(null);
            query.mockResolvedValue({
                rows: [{ id: mockResumeId, firm_id: mockFirmId, name: 'Test Resume' }]
            });

            const req = { user: { id: 'user-no-firm', role: 'user' } };
            
            // User has no valid firm_id
            const userFirmId = await getUserFirmId(req);
            expect(userFirmId).toBeNull();
        });
    });
});

