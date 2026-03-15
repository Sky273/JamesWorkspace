/**
 * Batch Jobs Worker - Utility helpers
 * Pure functions for score parsing, text cleanup, trigram generation
 */

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

/**
 * Generate a trigram from candidate name (first letter of first name + first two letters of last name)
 * Examples: "Jean Dupont" -> "JDU", "Marie Martin" -> "MMA", "Pierre-Louis Durand" -> "PDU"
 * @param {string} name - Full name of the candidate
 * @returns {string} - Trigram in uppercase (3 characters)
 */
export function generateTrigram(name) {
    if (!name || typeof name !== 'string') {
        return 'XXX';
    }
    
    // Clean and normalize the name
    const cleanedName = name
        .trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove accents
        .toUpperCase();
    
    // Split by spaces, hyphens, or other separators
    const parts = cleanedName.split(/[\s\-_.,]+/).filter(p => p.length > 0);
    
    if (parts.length === 0) {
        return 'XXX';
    }
    
    if (parts.length === 1) {
        // Only one part: take first 3 letters
        const single = parts[0];
        return (single.substring(0, 3) + 'XX').substring(0, 3);
    }
    
    // Multiple parts: first letter of first name + first two letters of last name
    const firstName = parts[0];
    const lastName = parts[parts.length - 1]; // Take the last part as surname
    
    const firstInitial = firstName.charAt(0) || 'X';
    const lastInitials = (lastName.substring(0, 2) + 'XX').substring(0, 2);
    
    return firstInitial + lastInitials;
}
