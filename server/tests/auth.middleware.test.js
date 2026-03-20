/**
 * Unit tests for authentication middleware
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock environment variables
process.env.JWT_SECRET = 'test-secret-key-that-is-at-least-32-characters-long';
process.env.CSRF_SECRET = 'test-csrf-secret-that-is-at-least-32-characters';

// Mock the logger
vi.mock('../utils/logger.backend.js', () => ({
    safeLog: vi.fn()
}));

// Mock the database (required by tokenBlacklist.service.js)
vi.mock('../config/database.js', () => ({
    query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 })
}));

import {
  authenticateToken,
  requireAdmin,
  isUserAdmin,
  hasFirmAccess,
  hasCustomerAccess,
  requireFirmAccess
} from '../middleware/auth.middleware.js';
import { generateAccessToken } from '../services/jwt.service.js';

describe('Auth Middleware', () => {
  
  let mockReq;
  let mockRes;
  let nextFn;

  beforeEach(() => {
    mockReq = {
      cookies: {},
      user: null
    };
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      setHeader: vi.fn()
    };
    nextFn = vi.fn();
  });

  describe('authenticateToken', () => {
    it('should return 401 if no token provided', () => {
      authenticateToken(mockReq, mockRes, nextFn);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ 
        error: 'Access token required',
        code: 'TOKEN_MISSING'
      }));
      expect(nextFn).not.toHaveBeenCalled();
    });

    it('should return 401 for invalid token', () => {
      mockReq.cookies.accessToken = 'invalid-token';

      authenticateToken(mockReq, mockRes, nextFn);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(nextFn).not.toHaveBeenCalled();
    });

    it('should call next() and set req.user for valid token', () => {
      const user = {
        id: 'recABCDEFGHIJKLMN',
        email: 'test@example.com',
        name: 'Test User',
        status: 'Active',
        role: 'user'
      };
      const token = generateAccessToken(user);
      mockReq.cookies.accessToken = token;

      authenticateToken(mockReq, mockRes, nextFn);

      expect(nextFn).toHaveBeenCalled();
      expect(mockReq.user).toBeDefined();
      expect(mockReq.user.id).toBe(user.id);
      expect(mockReq.user.email).toBe(user.email);
    });
  });

  describe('requireAdmin', () => {
    it('should return 403 if user is not admin', () => {
      mockReq.user = { role: 'user' };

      requireAdmin(mockReq, mockRes, nextFn);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Access denied. Admin privileges required.'
      });
      expect(nextFn).not.toHaveBeenCalled();
    });

    it('should call next() if user is admin', () => {
      mockReq.user = { role: 'admin' };

      requireAdmin(mockReq, mockRes, nextFn);

      expect(nextFn).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should handle case-insensitive role check', () => {
      mockReq.user = { role: 'ADMIN' };
      requireAdmin(mockReq, mockRes, nextFn);
      expect(nextFn).toHaveBeenCalled();
    });
  });

  describe('isUserAdmin', () => {
    it('should return true for admin user', () => {
      mockReq.user = { role: 'admin' };
      expect(isUserAdmin(mockReq)).toBe(true);
    });

    it('should return false for non-admin user', () => {
      mockReq.user = { role: 'user' };
      expect(isUserAdmin(mockReq)).toBe(false);
    });

    it('should return false if no user', () => {
      mockReq.user = null;
      expect(isUserAdmin(mockReq)).toBe(false);
    });

    it('should handle missing role', () => {
      mockReq.user = {};
      expect(isUserAdmin(mockReq)).toBe(false);
    });
  });

  describe('authenticateToken - branch coverage', () => {
    it('should return 403 for token with missing id or email', () => {
      // Token with id but no email
      const user = { id: 'user-123', email: '', name: 'Test', status: 'Active', role: 'user' };
      const token = generateAccessToken(user);
      mockReq.cookies.accessToken = token;

      authenticateToken(mockReq, mockRes, nextFn);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Invalid token payload'
      }));
      expect(nextFn).not.toHaveBeenCalled();
    });

    it('should return 403 for inactive user', () => {
      const user = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        status: 'Inactive',
        role: 'user'
      };
      const token = generateAccessToken(user);
      mockReq.cookies.accessToken = token;

      authenticateToken(mockReq, mockRes, nextFn);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Account is inactive'
      }));
      expect(nextFn).not.toHaveBeenCalled();
    });

    it('should set X-Token-Expires-In header on valid token', () => {
      const user = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        status: 'Active',
        role: 'user'
      };
      const token = generateAccessToken(user);
      mockReq.cookies.accessToken = token;

      authenticateToken(mockReq, mockRes, nextFn);

      expect(mockRes.setHeader).toHaveBeenCalledWith('X-Token-Expires-In', expect.any(String));
      expect(nextFn).toHaveBeenCalled();
    });
  });

  describe('hasCustomerAccess (alias for hasFirmAccess)', () => {
    it('should return true for admin regardless of firm', () => {
      mockReq.user = { role: 'admin', firm: 'Company A' };
      expect(hasCustomerAccess(mockReq, 'Company B')).toBe(true);
    });

    it('should return true if user firm matches resource firm', () => {
      mockReq.user = { role: 'user', firm: 'Company A' };
      expect(hasCustomerAccess(mockReq, 'Company A')).toBe(true);
    });

    it('should return false if user firm does not match', () => {
      mockReq.user = { role: 'user', firm: 'Company A' };
      expect(hasCustomerAccess(mockReq, 'Company B')).toBe(false);
    });

    it('should return falsy value if user has no firm', () => {
      mockReq.user = { role: 'user', firm: null };
      // Returns falsy when userFirm is null due to short-circuit evaluation
      expect(hasCustomerAccess(mockReq, 'Company A')).toBeFalsy();
    });
  });

  describe('hasFirmAccess', () => {
    it('should return true for admin accessing any firm', () => {
      mockReq.user = { role: 'admin', firm: 'Firm A' };
      expect(hasFirmAccess(mockReq, 'Firm B')).toBe(true);
    });

    it('should return true for user accessing own firm', () => {
      mockReq.user = { role: 'user', firm: 'Firm A' };
      expect(hasFirmAccess(mockReq, 'Firm A')).toBe(true);
    });

    it('should return false for user accessing different firm', () => {
      mockReq.user = { role: 'user', firm: 'Firm A' };
      expect(hasFirmAccess(mockReq, 'Firm B')).toBe(false);
    });

    it('should return falsy when user has no firm', () => {
      mockReq.user = { role: 'user' };
      expect(hasFirmAccess(mockReq, 'Firm A')).toBeFalsy();
    });
  });

  describe('requireFirmAccess', () => {
    it('should call next() when user has firm access', async () => {
      mockReq.user = { role: 'admin', firm: 'Firm A' };
      const getResourceFirm = vi.fn().mockResolvedValue('Firm B');
      const middleware = requireFirmAccess(getResourceFirm);

      await middleware(mockReq, mockRes, nextFn);

      expect(nextFn).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should return 403 when user lacks firm access', async () => {
      mockReq.user = { role: 'user', firm: 'Firm A' };
      const getResourceFirm = vi.fn().mockResolvedValue('Firm B');
      const middleware = requireFirmAccess(getResourceFirm);

      await middleware(mockReq, mockRes, nextFn);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Access denied'
      }));
      expect(nextFn).not.toHaveBeenCalled();
    });

    it('should return 500 when getResourceFirm throws', async () => {
      mockReq.user = { role: 'user', firm: 'Firm A' };
      const getResourceFirm = vi.fn().mockRejectedValue(new Error('DB error'));
      const middleware = requireFirmAccess(getResourceFirm);

      await middleware(mockReq, mockRes, nextFn);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Authorization check failed'
      }));
      expect(nextFn).not.toHaveBeenCalled();
    });
  });

  describe('requireAdmin - edge cases', () => {
    it('should return 403 if user is null', () => {
      mockReq.user = null;
      requireAdmin(mockReq, mockRes, nextFn);
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(nextFn).not.toHaveBeenCalled();
    });

    it('should return 403 if user has no role', () => {
      mockReq.user = { id: 'user-123' };
      requireAdmin(mockReq, mockRes, nextFn);
      expect(mockRes.status).toHaveBeenCalledWith(403);
    });
  });
});
