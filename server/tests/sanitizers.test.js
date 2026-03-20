/**
 * Unit tests for sanitization utilities
 */
import { describe, it, expect } from 'vitest';
import { sanitizeHtmlContent } from '../utils/sanitizer.backend.js';

describe('Sanitizers', () => {
  
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
