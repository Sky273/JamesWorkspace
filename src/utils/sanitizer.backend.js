import sanitizeHtml from 'sanitize-html';
import { safeLog } from './logger.backend.js';

// ============================================
// SANITIZATION HELPERS
// ============================================

/**
 * Escape special characters in Airtable formulas to prevent injection
 */
export function escapeAirtableFormula(input) {
    if (!input || typeof input !== 'string') return input;
    
    // List of dangerous formula prefixes
    const dangerousPrefixes = ['=', '+', '-', '@', '\t', '\r', '\n'];
    
    // Check if input starts with dangerous character
    if (dangerousPrefixes.some(prefix => input.startsWith(prefix))) {
        // Log security event
        safeLog('warn', 'Potential formula injection attempt detected', { inputPreview: input.substring(0, 50) });
        // Prepend single quote to neutralize formula
        input = "'" + input;
    }
    
    // Escape special characters that could be used in formulas
    return input
        .replace(/\\/g, '\\\\')   // Escape backslashes first
        .replace(/'/g, "\\'")     // Escape single quotes
        .replace(/"/g, '\\"')     // Escape double quotes
        .replace(/\n/g, '\\n')    // Escape newlines
        .replace(/\r/g, '\\r')    // Escape carriage returns
        .replace(/\t/g, '\\t')    // Escape tabs
        .replace(/\{/g, '\\{')    // Escape curly braces (formula syntax)
        .replace(/\}/g, '\\}')
        .replace(/\(/g, '\\(')    // Escape parentheses (function calls)
        .replace(/\)/g, '\\)')
        .replace(/,/g, '\\,');    // Escape commas (argument separators)
}

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
