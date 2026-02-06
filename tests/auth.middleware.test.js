/**
 * Unit tests for authentication middleware
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock environment variables
process.env.JWT_SECRET = 'test-secret-key-that-is-at-least-32-characters-long';
process.env.CSRF_SECRET = 'test-csrf-secret-that-is-at-least-32-characters';

import {
  authenticateToken,
  requireAdmin,
  isUserAdmin,
  hasCustomerAccess
} from '../src/middleware/auth.middleware.js';
import { generateAccessToken } from '../src/services/jwt.service.js';

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

  describe('hasCustomerAccess', () => {
    it('should return true for admin regardless of customer', () => {
      mockReq.user = { role: 'admin', customer: 'Company A' };
      expect(hasCustomerAccess(mockReq, 'Company B')).toBe(true);
    });

    it('should return true if user customer matches resource customer', () => {
      mockReq.user = { role: 'user', customer: 'Company A' };
      expect(hasCustomerAccess(mockReq, 'Company A')).toBe(true);
    });

    it('should return false if user customer does not match', () => {
      mockReq.user = { role: 'user', customer: 'Company A' };
      expect(hasCustomerAccess(mockReq, 'Company B')).toBe(false);
    });

    it('should return falsy value if user has no customer', () => {
      mockReq.user = { role: 'user', customer: null };
      // Returns null (falsy) when userCustomer is null due to short-circuit evaluation
      expect(hasCustomerAccess(mockReq, 'Company A')).toBeFalsy();
    });
  });
});
