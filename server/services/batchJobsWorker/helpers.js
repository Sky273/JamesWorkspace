/**
 * Batch Jobs Worker - Utility helpers
 * Pure functions for score parsing, text cleanup, trigram generation
 */

// Re-export generateTrigram from shared utility for backward compatibility
export { generateTrigram } from '../../utils/trigram.js';

/**
 * Parse a score value to integer (handles "84%", 84, "84", etc.)
 * @param {any} value - Score value
 * @returns {number|null} - Integer score or null
 */
export function parseScore(value) {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number') return Math.round(value);
    if (typeof value === 'string') {
        // Remove % and any whitespace
        const cleaned = value.replace('%', '').trim();
        const num = parseInt(cleaned, 10);
        return isNaN(num) ? null : num;
    }
    return null;
}

export function removeSuggestionMarkers(content) {
    let cleaned = content || '';
    cleaned = cleaned.replace(/<span[^>]*style="[^"]*(?:#F59E0B|#D97706)[^"]*"[^>]*>[^<]*<\/span>/g, '');
    cleaned = cleaned.replace(/<span[^>]*>[^<]*💡[^<]*<\/span>/g, '');
    cleaned = cleaned.replace(/<span[^>]*title="[^"]*"[^>]*>💡[^<]*<\/span>/g, '');
    let previous = '';
    while (previous !== cleaned) {
        previous = cleaned;
        cleaned = cleaned.replace(/<div[^>]*(?:class="suggestion-highlight"|style="[^"]*border-left:\s*4px\s+solid\s+#F59E0B)[^>]*>([\s\S]*?)<\/div>/g, '$1');
    }
    cleaned = cleaned.replace(/<div[^>]*class="suggestion-panel"[^>]*>[\s\S]*?<\/ul>\s*<\/div>/g, '');
    cleaned = cleaned.replace(/<div[^>]*style="[^"]*background:\s*linear-gradient\(135deg,\s*#FEF3C7[^"]*"[^>]*>[\s\S]*?<\/ul>\s*<\/div>/g, '');
    cleaned = cleaned.replace(/💡\s*\d*/g, '');
    cleaned = cleaned.replace(/<span[^>]*>\s*<\/span>/g, '');
    cleaned = cleaned.replace(/<div[^>]*>\s*<\/div>/g, '');
    cleaned = cleaned.replace(/\s{2,}/g, ' ');
    return cleaned;
}

