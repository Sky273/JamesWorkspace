/**
 * OpenAI Text Utilities
 * HTML entity decoding, text cleanup, and HTML cleanup functions
 */

/**
 * HTML entities mapping for text cleanup
 */
const HTML_ENTITIES = {
    '&nbsp;': ' ',
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
    '&laquo;': '«',
    '&raquo;': '»',
    '&ldquo;': '\u201C',
    '&rdquo;': '\u201D',
    '&lsquo;': '\u2018',
    '&rsquo;': '\u2019',
    '&ndash;': '–',
    '&mdash;': '—',
    '&hellip;': '…',
    '&bull;': '•',
    '&middot;': '·',
    '&copy;': '©',
    '&reg;': '®',
    '&trade;': '™',
    '&euro;': '€',
    '&pound;': '£',
    '&yen;': '¥',
    '&cent;': '¢',
    '&deg;': '°',
    '&plusmn;': '±',
    '&times;': '×',
    '&divide;': '÷',
    '&frac12;': '½',
    '&frac14;': '¼',
    '&frac34;': '¾',
    '&sup2;': '²',
    '&sup3;': '³',
    '&acute;': '´',
    '&cedil;': '¸',
    '&iexcl;': '¡',
    '&iquest;': '¿',
    '&sect;': '§',
    '&para;': '¶',
    '&dagger;': '†',
    '&Dagger;': '‡',
    '&permil;': '‰'
};

/**
 * Convert HTML entities to their corresponding characters
 * @param {string} text - Text with HTML entities
 * @returns {string} - Text with entities converted
 */
export function decodeHtmlEntities(text) {
    if (!text) return text;
    
    let decoded = text;
    
    // Replace named HTML entities
    for (const [entity, char] of Object.entries(HTML_ENTITIES)) {
        decoded = decoded.replace(new RegExp(entity, 'gi'), char);
    }
    
    // Replace numeric HTML entities (decimal: &#123; and hex: &#x7B;)
    decoded = decoded.replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(parseInt(dec, 10)));
    decoded = decoded.replace(/&#x([0-9a-fA-F]+);/g, (match, hex) => String.fromCharCode(parseInt(hex, 16)));
    
    return decoded;
}

/**
 * Clean up text by removing HTML tags and normalizing whitespace
 * Used before analysis to get cleaner text for LLM processing
 * @param {string} text - Text to clean (may contain HTML)
 * @returns {string} - Clean plain text
 */
export function cleanupText(text) {
    if (!text) return text;
    
    let cleaned = text;
    
    // Convert HTML entities first
    cleaned = decodeHtmlEntities(cleaned);
    
    // Convert <br> and </p> to newlines before removing tags
    cleaned = cleaned.replace(/<br\s*\/?>/gi, '\n');
    cleaned = cleaned.replace(/<\/p>/gi, '\n');
    cleaned = cleaned.replace(/<\/li>/gi, '\n');
    cleaned = cleaned.replace(/<\/h[1-6]>/gi, '\n\n');
    
    // Remove all HTML tags
    cleaned = cleaned.replace(/<[^>]*>/g, '');
    
    // Normalize whitespace
    cleaned = cleaned.replace(/[ \t]+/g, ' ');  // Multiple spaces/tabs to single space
    cleaned = cleaned.replace(/\n[ \t]+/g, '\n');  // Remove leading spaces on lines
    cleaned = cleaned.replace(/[ \t]+\n/g, '\n');  // Remove trailing spaces on lines
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');  // Max 2 consecutive newlines
    
    return cleaned.trim();
}

/**
 * Clean up common HTML formatting issues from AI-generated content
 * Preserves HTML tags but fixes structural issues
 * Used after improvement to clean the improved_text field
 * @param {string} html - HTML content to clean
 * @returns {string} - Cleaned HTML
 */
export function cleanupHtml(html) {
    if (!html) return html;
    
    let cleaned = html;
    
    // Convert HTML entities to their corresponding characters
    cleaned = decodeHtmlEntities(cleaned);
    
    // Remove nested <p> tags inside <li> elements
    cleaned = cleaned.replace(/<li>\s*<p>(.*?)<\/p>\s*<\/li>/gi, '<li>$1</li>');
    
    // Remove <p> tags wrapping <ul> or <ol> lists
    cleaned = cleaned.replace(/<p>\s*(<ul[^>]*>)/gi, '$1');
    cleaned = cleaned.replace(/(<\/ul>)\s*<\/p>/gi, '$1');
    cleaned = cleaned.replace(/<p>\s*(<ol[^>]*>)/gi, '$1');
    cleaned = cleaned.replace(/(<\/ol>)\s*<\/p>/gi, '$1');
    
    // Remove <p> tags wrapping headings
    cleaned = cleaned.replace(/<p>\s*(<h[1-6][^>]*>)/gi, '$1');
    cleaned = cleaned.replace(/(<\/h[1-6]>)\s*<\/p>/gi, '$1');
    
    // Remove empty <p> tags
    cleaned = cleaned.replace(/<p>\s*<\/p>/gi, '');
    
    // Remove <p> tags inside <p> tags (nested paragraphs)
    cleaned = cleaned.replace(/<p>\s*<p>/gi, '<p>');
    cleaned = cleaned.replace(/<\/p>\s*<\/p>/gi, '</p>');
    
    // Clean up multiple consecutive <br> tags
    cleaned = cleaned.replace(/(<br\s*\/?>\s*){3,}/gi, '<br><br>');
    
    // Remove <p> tags wrapping only whitespace and <br>
    cleaned = cleaned.replace(/<p>\s*(<br\s*\/?>\s*)*<\/p>/gi, '');
    
    return cleaned;
}
