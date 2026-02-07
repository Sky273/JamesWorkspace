/**
 * Unit tests for validation utilities
 */
import { describe, it, expect } from 'vitest';
import {
  isValidAirtableId,
  isValidEmail,
  sanitizeText,
  signInSchema,
  registerSchema,
  createUserSchema,
  createMissionSchema,
  airtableIdSchema
} from '../utils/validation.js';

describe('Validation Utilities', () => {
  
  describe('isValidAirtableId', () => {
    it('should return true for valid Airtable IDs', () => {
      expect(isValidAirtableId('recABCDEFGHIJKLMN')).toBe(true);
      expect(isValidAirtableId('rec1234567890abcd')).toBe(true);
      expect(isValidAirtableId('recXyZ123AbC456De')).toBe(true);
    });

    it('should return false for invalid Airtable IDs', () => {
      expect(isValidAirtableId('')).toBe(false);
      expect(isValidAirtableId('abc')).toBe(false);
      expect(isValidAirtableId('recABC')).toBe(false); // Too short
      expect(isValidAirtableId('recABCDEFGHIJKLMNO')).toBe(false); // Too long
      expect(isValidAirtableId('xxxABCDEFGHIJKLMN')).toBe(false); // Wrong prefix
      expect(isValidAirtableId('rec-BCDEFGHIJKLMN')).toBe(false); // Invalid char
      expect(isValidAirtableId(null)).toBe(false);
      expect(isValidAirtableId(undefined)).toBe(false);
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
        name: 'John Doe'
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
  });

  describe('createUserSchema', () => {
    it('should validate user creation with optional status', () => {
      const validData = {
        email: 'admin@example.com',
        password: 'securepass123',
        name: 'Admin User',
        status: 'Active'
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
          status
        };
        expect(() => createUserSchema.parse(data)).not.toThrow();
      });
    });
  });

  describe('createMissionSchema', () => {
    it('should validate mission creation', () => {
      const validData = {
        Title: 'Software Engineer Position',
        Content: 'Job description here...',
        Status: 'Active'
      };
      expect(() => createMissionSchema.parse(validData)).not.toThrow();
    });

    it('should require Title', () => {
      const invalidData = {
        Content: 'Job description'
      };
      expect(() => createMissionSchema.parse(invalidData)).toThrow();
    });

    it('should reject empty Title', () => {
      const invalidData = {
        Title: '',
        Content: 'Job description'
      };
      expect(() => createMissionSchema.parse(invalidData)).toThrow();
    });
  });

  describe('airtableIdSchema', () => {
    it('should validate correct Airtable IDs', () => {
      expect(() => airtableIdSchema.parse('recABCDEFGHIJKLMN')).not.toThrow();
    });

    it('should reject invalid Airtable IDs', () => {
      expect(() => airtableIdSchema.parse('invalid')).toThrow();
      expect(() => airtableIdSchema.parse('')).toThrow();
    });
  });
});
