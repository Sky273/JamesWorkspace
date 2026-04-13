/**
 * Unit tests for validation utilities
 */
import { describe, it, expect } from 'vitest';
import {
  isValidId,
  isValidEmail,
  sanitizeText,
  signInSchema,
  registerSchema,
  createUserSchema,
  createMissionSchema
} from '../utils/validation.js';

describe('Validation Utilities', () => {
  
  describe('isValidId', () => {
    it('should return true for valid UUIDs', () => {
      expect(isValidId('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
      expect(isValidId('00000000-0000-0000-0000-000000000001')).toBe(true);
    });

    it('should return false for invalid IDs', () => {
      expect(isValidId('')).toBe(false);
      expect(isValidId('abc')).toBe(false);
      expect(isValidId('recABCDEFGHIJKLMN')).toBe(false);
      expect(isValidId('not-a-uuid')).toBe(false);
      expect(isValidId(null)).toBe(false);
      expect(isValidId(undefined)).toBe(false);
    });
  });

  describe('isValidEmail', () => {
    it('should return true for valid emails', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name@domain.org')).toBe(true);
      expect(isValidEmail('user+tag@example.co.uk')).toBe(true);
      expect(isValidEmail('a@b.co')).toBe(true);
    });

    it('should return false for invalid emails', () => {
      expect(isValidEmail('')).toBe(false);
      expect(isValidEmail('notanemail')).toBe(false);
      expect(isValidEmail('@example.com')).toBe(false);
      expect(isValidEmail('test@')).toBe(false);
      expect(isValidEmail('test@.com')).toBe(false);
      expect(isValidEmail('test @example.com')).toBe(false);
    });
  });

  describe('sanitizeText', () => {
    it('should trim whitespace', () => {
      expect(sanitizeText('  hello  ')).toBe('hello');
      expect(sanitizeText('\n\ttext\n')).toBe('text');
    });

    it('should return empty string for non-string input', () => {
      expect(sanitizeText(null)).toBe('');
      expect(sanitizeText(undefined)).toBe('');
      expect(sanitizeText(123)).toBe('');
      expect(sanitizeText({})).toBe('');
    });

    it('should truncate long text', () => {
      const longText = 'a'.repeat(100000);
      const result = sanitizeText(longText);
      expect(result.length).toBeLessThanOrEqual(50000);
    });
  });
});

describe('Zod Schemas', () => {
  
  describe('signInSchema', () => {
    it('should validate correct sign-in data', () => {
      const validData = {
        email: 'test@example.com',
        password: 'password123'
      };
      expect(() => signInSchema.parse(validData)).not.toThrow();
    });

    it('should reject invalid email', () => {
      const invalidData = {
        email: 'notanemail',
        password: 'password123'
      };
      expect(() => signInSchema.parse(invalidData)).toThrow();
    });

    it('should reject short password', () => {
      const invalidData = {
        email: 'test@example.com',
        password: 'short'
      };
      expect(() => signInSchema.parse(invalidData)).toThrow();
    });

    it('should reject missing fields', () => {
      expect(() => signInSchema.parse({})).toThrow();
      expect(() => signInSchema.parse({ email: 'test@example.com' })).toThrow();
      expect(() => signInSchema.parse({ password: 'password123' })).toThrow();
    });
  });

  describe('registerSchema', () => {
    it('should validate correct registration data', () => {
      const validData = {
        email: 'test@example.com',
        password: 'password123',
        name: 'John Doe',
        website: '',
        formRenderedAt: Date.now()
      };
      expect(() => registerSchema.parse(validData)).not.toThrow();
    });

    it('should reject empty name', () => {
      const invalidData = {
        email: 'test@example.com',
        password: 'password123',
        name: ''
      };
      expect(() => registerSchema.parse(invalidData)).toThrow();
    });

    it('should reject missing anti-bot metadata', () => {
      const invalidData = {
        email: 'test@example.com',
        password: 'password123',
        name: 'John Doe'
      };
      expect(() => registerSchema.parse(invalidData)).toThrow();
    });
  });

  describe('createUserSchema', () => {
    it('should validate user creation with optional status', () => {
      const validData = {
        email: 'admin@example.com',
        password: 'securepass123',
        name: 'Admin User',
        status: 'Active',
        firmId: '123e4567-e89b-12d3-a456-426614174000'
      };
      expect(() => createUserSchema.parse(validData)).not.toThrow();
    });

    it('should reject invalid status', () => {
      const invalidData = {
        email: 'admin@example.com',
        password: 'securepass123',
        name: 'Admin User',
        status: 'InvalidStatus'
      };
      expect(() => createUserSchema.parse(invalidData)).toThrow();
    });

    it('should allow valid status values', () => {
      ['Active', 'Inactive', 'Pending'].forEach(status => {
        const data = {
          email: 'test@example.com',
          password: 'password123',
          name: 'Test User',
          status,
          firmId: '123e4567-e89b-12d3-a456-426614174000'
        };
        expect(() => createUserSchema.parse(data)).not.toThrow();
      });
    });

    it('should validate user creation with firmId', () => {
      const validData = {
        email: 'admin@example.com',
        password: 'securepass123',
        name: 'Admin User',
        status: 'Active',
        firmId: '123e4567-e89b-12d3-a456-426614174000'
      };
      expect(() => createUserSchema.parse(validData)).not.toThrow();
    });
  });

  describe('createMissionSchema', () => {
    it('should validate mission creation', () => {
      const validData = {
        title: 'Software Engineer Position',
        content: 'Job description here...',
        status: 'active'
      };
      expect(() => createMissionSchema.parse(validData)).not.toThrow();
    });

    it('should require title', () => {
      const invalidData = {
        content: 'Job description'
      };
      expect(() => createMissionSchema.parse(invalidData)).toThrow();
    });

    it('should reject empty title', () => {
      const invalidData = {
        title: '',
        content: 'Job description'
      };
      expect(() => createMissionSchema.parse(invalidData)).toThrow();
    });
  });

});
