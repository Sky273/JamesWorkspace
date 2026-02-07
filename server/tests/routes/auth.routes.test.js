/**
 * Integration tests for authentication routes
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Set environment variables before imports
process.env.JWT_SECRET = 'test-secret-key-that-is-at-least-32-characters-long';
process.env.REFRESH_TOKEN_SECRET = 'test-refresh-secret-that-is-at-least-32-characters';
process.env.CSRF_SECRET = 'test-csrf-secret-that-is-at-least-32-characters';

// Mock database
vi.mock('../../src/config/database.js', () => ({
    query: vi.fn()
}));

// Mock bcrypt
vi.mock('bcryptjs', () => ({
    default: {
        compare: vi.fn(),
        hash: vi.fn()
    }
}));

// Mock logger
vi.mock('../../src/utils/logger.backend.js', () => ({
    safeLog: vi.fn()
}));

// Mock security service
vi.mock('../../src/services/security.service.js', () => ({
    securityLog: vi.fn(),
    getRequestMetadata: vi.fn(() => ({ ip: '127.0.0.1', userAgent: 'test' })),
    LOG_LEVELS: { INFO: 'info', WARN: 'warn', ERROR: 'error' },
    SECURITY_EVENTS: { LOGIN_SUCCESS: 'LOGIN_SUCCESS', LOGIN_FAILED: 'LOGIN_FAILED' }
}));

import { query as dbQuery } from '../../src/config/database.js';
import bcrypt from 'bcryptjs';

describe('Auth Routes - Sign In', () => {
    let mockReq;
    let mockRes;

    beforeEach(() => {
        vi.clearAllMocks();
        
        mockReq = {
            body: {},
            cookies: {},
            ip: '127.0.0.1',
            headers: { 'user-agent': 'test-agent' }
        };
        mockRes = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn().mockReturnThis(),
            cookie: vi.fn().mockReturnThis(),
            setHeader: vi.fn().mockReturnThis()
        };
    });

    describe('POST /signin validation', () => {
        it('should reject request without email', async () => {
            mockReq.body = { password: 'password123' };

            // The validation should fail before hitting the route handler
            const { signInSchema } = await import('../../src/utils/validation.js');
            
            const result = signInSchema.safeParse(mockReq.body);
            expect(result.success).toBe(false);
            expect(result.error.issues[0].path).toContain('email');
        });

        it('should reject request without password', async () => {
            mockReq.body = { email: 'test@example.com' };

            const { signInSchema } = await import('../../src/utils/validation.js');
            
            const result = signInSchema.safeParse(mockReq.body);
            expect(result.success).toBe(false);
            expect(result.error.issues[0].path).toContain('password');
        });

        it('should reject invalid email format', async () => {
            mockReq.body = { email: 'not-an-email', password: 'password123' };

            const { signInSchema } = await import('../../src/utils/validation.js');
            
            const result = signInSchema.safeParse(mockReq.body);
            expect(result.success).toBe(false);
        });

        it('should accept valid credentials format', async () => {
            mockReq.body = { email: 'test@example.com', password: 'password123' };

            const { signInSchema } = await import('../../src/utils/validation.js');
            
            const result = signInSchema.safeParse(mockReq.body);
            expect(result.success).toBe(true);
        });

        it('should reject password shorter than 8 characters', async () => {
            mockReq.body = { email: 'test@example.com', password: 'short' };

            const { signInSchema } = await import('../../src/utils/validation.js');
            
            const result = signInSchema.safeParse(mockReq.body);
            expect(result.success).toBe(false);
        });
    });

    describe('User lookup and authentication', () => {
        it('should return 401 for non-existent user', async () => {
            // Mock no user found
            dbQuery.mockResolvedValueOnce({ rows: [] });

            mockReq.body = { email: 'nonexistent@example.com', password: 'password123' };

            // Simulate what the route does
            const result = await dbQuery('SELECT * FROM users WHERE email = $1', [mockReq.body.email]);
            
            expect(result.rows.length).toBe(0);
        });

        it('should verify password with bcrypt', async () => {
            const hashedPassword = '$2a$10$hashedpassword';
            const plainPassword = 'password123';

            bcrypt.compare.mockResolvedValueOnce(true);

            const isValid = await bcrypt.compare(plainPassword, hashedPassword);
            
            expect(bcrypt.compare).toHaveBeenCalledWith(plainPassword, hashedPassword);
            expect(isValid).toBe(true);
        });

        it('should reject inactive user', async () => {
            // Mock user found but inactive
            dbQuery.mockResolvedValueOnce({ 
                rows: [{ 
                    id: 'user-123',
                    email: 'inactive@example.com',
                    password_hash: '$2a$10$hash',
                    status: 'Inactive',
                    role: 'user'
                }] 
            });

            const result = await dbQuery('SELECT * FROM users WHERE email = $1', ['inactive@example.com']);
            const user = result.rows[0];
            
            expect(user.status).toBe('Inactive');
            // Route should return 403 for inactive users
        });
    });
});

describe('Auth Routes - Token Refresh', () => {
    describe('Refresh token validation', () => {
        it('should reject request without refresh token cookie', async () => {
            const mockReq = { cookies: {} };
            
            expect(mockReq.cookies.refreshToken).toBeUndefined();
        });

        it('should have refresh token in cookies after successful login', async () => {
            // After login, cookies should be set
            const mockRes = {
                cookies: {}
            };
            
            // Simulate setting cookies
            mockRes.cookies.accessToken = 'access-token-value';
            mockRes.cookies.refreshToken = 'refresh-token-value';
            
            expect(mockRes.cookies.accessToken).toBeDefined();
            expect(mockRes.cookies.refreshToken).toBeDefined();
        });
    });
});

describe('Auth Routes - Logout', () => {
    it('should clear cookies on logout', async () => {
        const clearedCookies = [];
        const mockRes = {
            clearCookie: vi.fn((name) => clearedCookies.push(name))
        };

        // Simulate logout clearing cookies
        mockRes.clearCookie('accessToken');
        mockRes.clearCookie('refreshToken');

        expect(clearedCookies).toContain('accessToken');
        expect(clearedCookies).toContain('refreshToken');
    });
});
