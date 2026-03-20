import sanitizeHtml from 'sanitize-html';
import { safeLog } from './logger.backend.js';

// ============================================
// SANITIZATION HELPERS
// ============================================

/**
 * Sanitize HTML content to prevent XSS
 */
export function sanitizeHtmlContent(content) {
    return sanitizeHtml(content, {
        allowedTags: [
            'p', 'br', 'strong', 'em', 'u', 
            'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
            'ul', 'ol', 'li', 'a', 'span', 'div',
            'blockquote', 'code', 'pre',
            'table', 'thead', 'tbody', 'tr', 'th', 'td'
        ],
        allowedAttributes: {
            'a': ['href', 'target', 'rel'],
            '*': ['class', 'id']
        },
        allowedSchemes: ['http', 'https', 'mailto', 'tel']
    });
}
