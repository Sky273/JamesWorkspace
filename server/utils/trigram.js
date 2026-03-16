/**
 * Trigram Generation Utility
 * Generates a 3-letter trigram from a candidate name.
 * Format: 1st letter of first name + 2 first letters of last name
 * Examples: "Jean Dupont" -> "JDU", "Marie Martin" -> "MMA", "Pierre-Louis Durand" -> "PDU"
 * 
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
