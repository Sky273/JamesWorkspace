/**
 * Unit tests for sanitization utilities
 */
import { describe, it, expect } from 'vitest';
import { escapeAirtableFormula, sanitizeHtmlContent } from '../utils/sanitizer.backend.js';

describe('Sanitizers', () => {
  
  describe('escapeAirtableFormula', () => {
    it('should escape single quotes', () => {
      expect(escapeAirtableFormula("O'Brien")).toBe("O\\'Brien");
      expect(escapeAirtableFormula("It's a test")).toBe("It\\'s a test");
    });

    it('should escape double quotes', () => {
      expect(escapeAirtableFormula('Say "hello"')).toBe('Say \\"hello\\"');
    });

    it('should escape backslashes', () => {
      expect(escapeAirtableFormula('path\\to\\file')).toBe('path\\\\to\\\\file');
    });

    it('should handle multiple special characters', () => {
      const input = "John's \"test\" file\\path";
      const result = escapeAirtableFormula(input);
      expect(result).toBe("John\\'s \\\"test\\\" file\\\\path");
    });

    it('should return input unchanged for non-string input', () => {
      // Function returns input as-is for non-strings (null, undefined, numbers)
      // This is safe because Airtable formulas only need escaping for strings
      expect(escapeAirtableFormula(null)).toBe(null);
      expect(escapeAirtableFormula(undefined)).toBe(undefined);
      expect(escapeAirtableFormula(123)).toBe(123);
    });

    it('should handle empty string', () => {
      expect(escapeAirtableFormula('')).toBe('');
    });

    it('should handle string without special characters', () => {
      expect(escapeAirtableFormula('normal text')).toBe('normal text');
    });

    it('should prevent formula injection attempts', () => {
      // These patterns could be used for injection if not escaped
      const malicious1 = "test' OR '1'='1";
      const result1 = escapeAirtableFormula(malicious1);
      expect(result1).not.toContain("' OR '");
      
      const malicious2 = 'test", RECORD_ID()="';
      const result2 = escapeAirtableFormula(malicious2);
      expect(result2).not.toContain('", RECORD_ID()="');
    });
  });

  describe('sanitizeHtmlContent', () => {
    it('should remove script tags', () => {
      const input = '<p>Hello</p><script>alert("xss")</script>';
      const result = sanitizeHtmlContent(input);
      expect(result).not.toContain('<script>');
      expect(result).not.toContain('alert');
      expect(result).toContain('<p>Hello</p>');
    });

    it('should remove onclick attributes', () => {
      const input = '<button onclick="alert(1)">Click</button>';
      const result = sanitizeHtmlContent(input);
      expect(result).not.toContain('onclick');
    });

    it('should allow safe HTML tags', () => {
      const input = '<p><strong>Bold</strong> and <em>italic</em></p>';
      const result = sanitizeHtmlContent(input);
      expect(result).toContain('<p>');
      expect(result).toContain('<strong>');
      expect(result).toContain('<em>');
    });

    it('should handle empty input', () => {
      expect(sanitizeHtmlContent('')).toBe('');
      expect(sanitizeHtmlContent(null)).toBe('');
      expect(sanitizeHtmlContent(undefined)).toBe('');
    });

    it('should remove javascript: URLs', () => {
      const input = '<a href="javascript:alert(1)">Click</a>';
      const result = sanitizeHtmlContent(input);
      expect(result).not.toContain('javascript:');
    });

    it('should allow safe URLs', () => {
      const input = '<a href="https://example.com">Link</a>';
      const result = sanitizeHtmlContent(input);
      expect(result).toContain('https://example.com');
    });
  });
});
