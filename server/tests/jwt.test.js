/**
 * Unit tests for JWT service
 */
import { describe, it, expect, vi } from 'vitest';

// Mock environment variables before importing the module
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
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
  verifyRefreshToken,
  extractRoleFromUser
} from '../services/jwt.service.js';

describe('JWT Service', () => {
  
  const mockUser = {
    id: 'recABCDEFGHIJKLMN',
    email: 'test@example.com',
    name: 'Test User',
    status: 'active',
    role: 'user',
    firm: 'Test Company',
    customer: 'Test Company'
  };

  describe('generateAccessToken', () => {
    it('should generate a valid JWT token', () => {
      const token = generateAccessToken(mockUser);
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });

    it('should include user data in token payload', async () => {
      const token = generateAccessToken(mockUser);
      const decoded = await verifyToken(token);
      
      expect(decoded.id).toBe(mockUser.id);
      expect(decoded.sub).toBe(mockUser.id);
      expect(decoded.email).toBeUndefined();
      expect(decoded.name).toBeUndefined();
      expect(decoded.role).toBe(mockUser.role);
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate a valid refresh token', () => {
      const token = generateRefreshToken(mockUser);
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
    });

    it('should include minimal user data', async () => {
      const token = generateRefreshToken(mockUser);
      // Use verifyRefreshToken since refresh tokens use a different secret
      const decoded = await verifyRefreshToken(token);
      
      expect(decoded.id).toBe(mockUser.id);
      expect(decoded.sub).toBe(mockUser.id);
      expect(decoded.email).toBeUndefined();
      // Refresh token should not include full user data
      expect(decoded.name).toBeUndefined();
    });
  });

  describe('verifyToken', () => {
    it('should verify a valid token', async () => {
      const token = generateAccessToken(mockUser);
      const decoded = await verifyToken(token);
      
      expect(decoded).not.toBeNull();
      expect(decoded.id).toBe(mockUser.id);
    });

    it('should return null for invalid token', async () => {
      await expect(verifyToken('invalid.token.here')).resolves.toBeNull();
    });

    it('should return null for empty token', async () => {
      await expect(verifyToken('')).resolves.toBeNull();
      await expect(verifyToken(null)).resolves.toBeNull();
      await expect(verifyToken(undefined)).resolves.toBeNull();
    });

    it('should return null for tampered token', async () => {
      const token = generateAccessToken(mockUser);
      const tamperedToken = token.slice(0, -5) + 'xxxxx';
      await expect(verifyToken(tamperedToken)).resolves.toBeNull();
    });
  });

  describe('extractRoleFromUser', () => {
    it('should extract admin role', () => {
      expect(extractRoleFromUser({ Role: 'Admin' })).toBe('admin');
      expect(extractRoleFromUser({ Role: 'ADMIN' })).toBe('admin');
      expect(extractRoleFromUser({ role: 'admin' })).toBe('admin');
    });

    it('should extract user role', () => {
      expect(extractRoleFromUser({ Role: 'User' })).toBe('user');
      expect(extractRoleFromUser({ Role: 'USER' })).toBe('user');
      expect(extractRoleFromUser({ role: 'user' })).toBe('user');
    });

    it('should default to user for missing role', () => {
      expect(extractRoleFromUser({})).toBe('user');
      expect(extractRoleFromUser({ Role: null })).toBe('user');
      expect(extractRoleFromUser({ Role: '' })).toBe('user');
    });

    it('should default to user for invalid role', () => {
      expect(extractRoleFromUser({ Role: 'superadmin' })).toBe('user');
      expect(extractRoleFromUser({ Role: 'moderator' })).toBe('user');
    });
  });
});
