/**
 * Frontend Sanitizer Utility
 * TypeScript version
 */

import DOMPurify from 'isomorphic-dompurify';

interface SanitizeOptions {
  ALLOWED_TAGS?: string[];
  ALLOWED_ATTR?: string[];
  FORBID_TAGS?: string[];
  FORBID_ATTR?: string[];
  ALLOW_DATA_ATTR?: boolean;
  ALLOWED_URI_REGEXP?: RegExp;
  KEEP_CONTENT?: boolean;
}

interface SafeHtml {
  __html: string;
}

/**
 * Sanitize HTML content to prevent XSS attacks
 */
export const sanitizeHtml = (html: string | null | undefined, options: SanitizeOptions = {}): string => {
  if (!html || typeof html !== 'string') {
    return '';
  }

  const defaultConfig: SanitizeOptions = {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li', 'a', 'span', 'div', 'blockquote', 'code', 'pre',
      'table', 'thead', 'tbody', 'tr', 'th', 'td', 'img'
    ],
    ALLOWED_ATTR: [
      'href', 'target', 'rel', 'class', 'id', 'src', 'alt', 'title'
    ],
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'base', 'link', 'meta', 'form'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'onchange', 'onsubmit'],
    ALLOW_DATA_ATTR: false,
    ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp):|[^a-z]|[a-z+.-]+(?:[^a-z+.:-]|$))/i,
    KEEP_CONTENT: true,
    ...options
  };

  return DOMPurify.sanitize(html, defaultConfig);
};

/**
 * Sanitize HTML with strict configuration (for user-generated content)
 */
export const sanitizeUserHtml = (html: string | null | undefined): string => {
  return sanitizeHtml(html, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'ul', 'ol', 'li', 'a'],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
    ALLOW_DATA_ATTR: false
  });
};

/**
 * Create a safe HTML object for React's dangerouslySetInnerHTML
 */
export const createSafeHtml = (html: string | null | undefined, options: SanitizeOptions = {}): SafeHtml => {
  return {
    __html: sanitizeHtml(html, options)
  };
};
