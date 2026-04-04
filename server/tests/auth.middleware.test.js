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

vi.mock('../services/users.service.js', () => ({
    findUserById: vi.fn()
}));

import {
  authenticateToken,
  requireAdmin,
  isUserAdmin,
  hasFirmAccess,
  requireFirmAccess,
  resetAuthUserCacheForTests,
  getAuthUserCacheSizeForTests
} from '../middleware/auth.middleware.js';
import { generateAccessToken } from '../services/jwt.service.js';
import { findUserById } from '../services/users.service.js';

describe('Auth Middleware', () => {
  
  let mockReq;
  let mockRes;
  let nextFn;

  beforeEach(() => {
    vi.clearAllMocks();
    resetAuthUserCacheForTests();
    findUserById.mockResolvedValue(null);
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
    it('should return 401 if no token provided', async () => {
      await authenticateToken(mockReq, mockRes, nextFn);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ 
        error: 'Access token required',
        code: 'TOKEN_MISSING'
      }));
      expect(nextFn).not.toHaveBeenCalled();
    });

    it('should return 401 for invalid token', async () => {
      mockReq.cookies.accessToken = 'invalid-token';

      await authenticateToken(mockReq, mockRes, nextFn);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(nextFn).not.toHaveBeenCalled();
    });

    it('should call next() and set req.user for valid token', async () => {
      const user = {
        id: 'recABCDEFGHIJKLMN',
        email: 'test@example.com',
        name: 'Test User',
        status: 'Active',
        role: 'user'
      };
      const token = generateAccessToken(user);
      mockReq.cookies.accessToken = token;
      findUserById.mockResolvedValueOnce({
        id: user.id,
        email: user.email,
        name: user.name,
        status: user.status,
        role: user.role,
        firm_id: 'firm-1',
        firm_name: 'Firm One'
      });

      await authenticateToken(mockReq, mockRes, nextFn);

      expect(nextFn).toHaveBeenCalled();
      expect(mockReq.user).toBeDefined();
      expect(mockReq.user.id).toBe(user.id);
      expect(mockReq.user.email).toBe(user.email);
      expect(mockReq.user.firmId).toBe('firm-1');
      expect(mockReq.user.firm_id).toBeUndefined();
    });

    it('should reuse a short-lived cached user profile across repeated authenticated requests', async () => {
      const user = {
        id: 'recABCDEFGHIJKLMN',
        email: 'test@example.com',
        name: 'Test User',
        status: 'Active',
        role: 'user'
      };
      const token = generateAccessToken(user);
      const cachedDbUser = {
        id: user.id,
        email: user.email,
        name: user.name,
        status: user.status,
        role: user.role,
        firm_id: 'firm-1',
        firm_name: 'Firm One'
      };
      findUserById.mockResolvedValue(cachedDbUser);

      const firstReq = { cookies: { accessToken: token }, user: null };
      const secondReq = { cookies: { accessToken: token }, user: null };

      await authenticateToken(firstReq, mockRes, nextFn);
      expect(getAuthUserCacheSizeForTests()).toBe(1);
      await authenticateToken(secondReq, mockRes, nextFn);

      expect(findUserById).toHaveBeenCalledTimes(1);
      expect(secondReq.user.firmId).toBe('firm-1');
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
    it('should return 403 for token with missing id or email', async () => {
      // Token with id but no email
      const user = { id: 'user-123', email: '', name: 'Test', status: 'Active', role: 'user' };
      const token = generateAccessToken(user);
      mockReq.cookies.accessToken = token;

      await authenticateToken(mockReq, mockRes, nextFn);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Invalid token payload'
      }));
      expect(nextFn).not.toHaveBeenCalled();
    });

    it('should return 403 for inactive user', async () => {
      const user = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        status: 'Inactive',
        role: 'user'
      };
      const token = generateAccessToken(user);
      mockReq.cookies.accessToken = token;
      findUserById.mockResolvedValueOnce({
        id: user.id,
        email: user.email,
        name: user.name,
        status: 'Inactive',
        role: user.role,
        firm_id: 'firm-1',
        firm_name: 'Firm One'
      });

      await authenticateToken(mockReq, mockRes, nextFn);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Account is inactive'
      }));
      expect(nextFn).not.toHaveBeenCalled();
    });

    it('should set X-Token-Expires-In header on valid token', async () => {
      const user = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        status: 'Active',
        role: 'user'
      };
      const token = generateAccessToken(user);
      mockReq.cookies.accessToken = token;
      findUserById.mockResolvedValueOnce({
        id: user.id,
        email: user.email,
        name: user.name,
        status: user.status,
        role: user.role,
        firm_id: 'firm-1',
        firm_name: 'Firm One'
      });

      await authenticateToken(mockReq, mockRes, nextFn);

      expect(mockRes.setHeader).toHaveBeenCalledWith('X-Token-Expires-In', expect.any(String));
      expect(nextFn).toHaveBeenCalled();
    });

    it('should use current database role and firm instead of stale token claims', async () => {
      const token = generateAccessToken({
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        status: 'Active',
        role: 'user',
        firm_id: 'old-firm'
      });
      mockReq.cookies.accessToken = token;
      findUserById.mockResolvedValueOnce({
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        status: 'active',
        role: 'admin',
        firm_id: 'new-firm',
        firm_name: 'Updated Firm'
      });

      await authenticateToken(mockReq, mockRes, nextFn);

      expect(mockReq.user.role).toBe('admin');
      expect(mockReq.user.firmId).toBe('new-firm');
      expect(mockReq.user.firmName).toBe('Updated Firm');
      expect(mockReq.user.firm_id).toBeUndefined();
    });

    it('should reuse the short-lived authenticated user cache across repeated requests', async () => {
      const user = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        status: 'Active',
        role: 'user'
      };
      const token = generateAccessToken(user);
      findUserById.mockResolvedValue({
        id: user.id,
        email: user.email,
        name: user.name,
        status: user.status,
        role: user.role,
        firm_id: 'firm-1',
        firm_name: 'Firm One'
      });

      const firstReq = { cookies: { accessToken: token }, user: null };
      const secondReq = { cookies: { accessToken: token }, user: null };
      const firstRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
        setHeader: vi.fn()
      };
      const secondRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
        setHeader: vi.fn()
      };
      const firstNext = vi.fn();
      const secondNext = vi.fn();

      await authenticateToken(firstReq, firstRes, firstNext);
      await authenticateToken(secondReq, secondRes, secondNext);

      expect(findUserById).toHaveBeenCalledTimes(1);
      expect(firstNext).toHaveBeenCalled();
      expect(secondNext).toHaveBeenCalled();
      expect(secondReq.user.firmId).toBe('firm-1');
    });
  });

  describe('hasFirmAccess', () => {
    it('should return true for admin accessing any firm', () => {
      mockReq.user = { role: 'admin', firmId: 'firm-1' };
      expect(hasFirmAccess(mockReq, { firm_id: 'firm-2' })).toBe(true);
    });

    it('should return true for user accessing own firm_id', () => {
      mockReq.user = { role: 'user', firmId: 'firm-1' };
      expect(hasFirmAccess(mockReq, { firm_id: 'firm-1' })).toBe(true);
    });

    it('should return false for user accessing different firm_id', () => {
      mockReq.user = { role: 'user', firmId: 'firm-1' };
      expect(hasFirmAccess(mockReq, { firm_id: 'firm-2' })).toBe(false);
    });

    it('should prefer firm IDs when both user and resource have IDs', () => {
      mockReq.user = { role: 'user', firm: 'Firm A', firmId: 'firm-1' };
      expect(hasFirmAccess(mockReq, { firm_id: 'firm-1', firm: 'Other Label' })).toBe(true);
      expect(hasFirmAccess(mockReq, { id: 'firm-2', name: 'Firm A' })).toBe(false);
    });

    it('should return falsy when user has no firm_id', () => {
      mockReq.user = { role: 'user' };
      expect(hasFirmAccess(mockReq, { firm_id: 'firm-1' })).toBeFalsy();
    });
  });

  describe('requireFirmAccess', () => {
    it('should call next() when user has firm access', async () => {
      mockReq.user = { role: 'admin', firmId: 'firm-1' };
      const getResourceFirm = vi.fn().mockResolvedValue({ firm_id: 'firm-2' });
      const middleware = requireFirmAccess(getResourceFirm);

      await middleware(mockReq, mockRes, nextFn);

      expect(nextFn).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should return 403 when user lacks firm access', async () => {
      mockReq.user = { role: 'user', firm: 'Firm A', firmId: 'firm-1' };
      const getResourceFirm = vi.fn().mockResolvedValue({ firm_id: 'firm-2', firm: 'Firm A' });
      const middleware = requireFirmAccess(getResourceFirm);

      await middleware(mockReq, mockRes, nextFn);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Access denied'
      }));
      expect(nextFn).not.toHaveBeenCalled();
    });

    it('should return 500 when getResourceFirm throws', async () => {
      mockReq.user = { role: 'user', firmId: 'firm-1' };
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
