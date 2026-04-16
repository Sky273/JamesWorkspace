import sanitizeHtml from 'sanitize-html';

const NULL_CHARACTER_REGEX = new RegExp(String.fromCharCode(0), 'g');

const SAFE_INLINE_CSS_PATTERNS = {
    color: [/^#[0-9a-f]{3,8}$/i, /^rgba?\([^)]{1,64}\)$/i, /^[a-z-]{1,32}$/i],
    'background-color': [/^#[0-9a-f]{3,8}$/i, /^rgba?\([^)]{1,64}\)$/i, /^[a-z-]{1,32}$/i],
    'text-align': [/^(left|right|center|justify)$/i],
    'font-weight': [/^(normal|bold|bolder|lighter|[1-9]00)$/i],
    'font-style': [/^(normal|italic|oblique)$/i],
    'text-decoration': [/^(none|underline|line-through|overline)$/i],
    'font-size': [/^(0|\d+(?:\.\d+)?(px|pt|em|rem|%))$/i],
    'font-family': [/^[\w\s,"'-]{1,120}$/],
    'line-height': [/^(normal|\d+(?:\.\d+)?|\d+(?:\.\d+)?(px|pt|em|rem|%))$/i],
    margin: [/^(0|auto|\d+(?:\.\d+)?(px|pt|em|rem|%))(\s+(0|auto|\d+(?:\.\d+)?(px|pt|em|rem|%))){0,3}$/i],
    'margin-top': [/^(0|auto|\d+(?:\.\d+)?(px|pt|em|rem|%))$/i],
    'margin-right': [/^(0|auto|\d+(?:\.\d+)?(px|pt|em|rem|%))$/i],
    'margin-bottom': [/^(0|auto|\d+(?:\.\d+)?(px|pt|em|rem|%))$/i],
    'margin-left': [/^(0|auto|\d+(?:\.\d+)?(px|pt|em|rem|%))$/i],
    padding: [/^(0|\d+(?:\.\d+)?(px|pt|em|rem|%))(\s+(0|\d+(?:\.\d+)?(px|pt|em|rem|%))){0,3}$/i],
    'padding-top': [/^(0|\d+(?:\.\d+)?(px|pt|em|rem|%))$/i],
    'padding-right': [/^(0|\d+(?:\.\d+)?(px|pt|em|rem|%))$/i],
    'padding-bottom': [/^(0|\d+(?:\.\d+)?(px|pt|em|rem|%))$/i],
    'padding-left': [/^(0|\d+(?:\.\d+)?(px|pt|em|rem|%))$/i],
    border: [/^[\w\s#(),.%'-]{1,120}$/],
    'border-top': [/^[\w\s#(),.%'-]{1,120}$/],
    'border-right': [/^[\w\s#(),.%'-]{1,120}$/],
    'border-bottom': [/^[\w\s#(),.%'-]{1,120}$/],
    'border-left': [/^[\w\s#(),.%'-]{1,120}$/],
    width: [/^(auto|\d+(?:\.\d+)?(px|pt|em|rem|%))$/i],
    height: [/^(auto|\d+(?:\.\d+)?(px|pt|em|rem|%))$/i],
    'max-width': [/^(none|\d+(?:\.\d+)?(px|pt|em|rem|%))$/i],
    'min-width': [/^(0|\d+(?:\.\d+)?(px|pt|em|rem|%))$/i],
    display: [/^(block|inline|inline-block|flex|grid|table|table-row|table-cell|none)$/i],
    'vertical-align': [/^(baseline|sub|super|top|text-top|middle|bottom|text-bottom)$/i],
    'white-space': [/^(normal|nowrap|pre|pre-wrap|pre-line|break-spaces)$/i],
    'list-style-type': [/^[a-z-]{1,32}$/i],
    'letter-spacing': [/^(normal|\d+(?:\.\d+)?(px|pt|em|rem))$/i]
};

const DOCUMENT_ALLOWED_TAGS = [
    'p', 'br', 'strong', 'em', 'u', 'b', 'i',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li', 'a', 'span', 'div',
    'blockquote', 'code', 'pre',
    'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'colgroup', 'col',
    'img', 'hr', 'section', 'article', 'header', 'footer'
];

const DOCUMENT_ALLOWED_ATTRIBUTES = {
    a: ['href', 'target', 'rel', 'class', 'id', 'style'],
    img: ['src', 'alt', 'title', 'width', 'height', 'class', 'id', 'style'],
    td: ['colspan', 'rowspan', 'class', 'id', 'style'],
    th: ['colspan', 'rowspan', 'class', 'id', 'style'],
    col: ['span', 'width', 'class', 'id', 'style'],
    '*': ['class', 'id', 'style', 'align']
};

function normalizeInput(value) {
    return typeof value === 'string' ? value.replace(NULL_CHARACTER_REGEX, '').trim() : '';
}

export function stripNullCharacters(value) {
    return typeof value === 'string' ? value.replace(NULL_CHARACTER_REGEX, '') : value;
}

export function stripNullCharactersDeep(value) {
    if (typeof value === 'string') {
        return stripNullCharacters(value);
    }

    if (Array.isArray(value)) {
        return value.map((item) => stripNullCharactersDeep(item));
    }

    if (value && typeof value === 'object' && !Buffer.isBuffer(value) && !(value instanceof Date)) {
        return Object.fromEntries(
            Object.entries(value).map(([key, nestedValue]) => [key, stripNullCharactersDeep(nestedValue)])
        );
    }

    return value;
}

export function sanitizeHtmlContent(content) {
    return sanitizeHtml(normalizeInput(content), {
        allowedTags: [
            'p', 'br', 'strong', 'em', 'u',
            'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
            'ul', 'ol', 'li', 'a', 'span', 'div',
            'blockquote', 'code', 'pre',
            'table', 'thead', 'tbody', 'tr', 'th', 'td'
        ],
        allowedAttributes: {
            a: ['href', 'target', 'rel'],
            '*': ['class', 'id']
        },
        allowedSchemes: ['http', 'https', 'mailto', 'tel'],
        allowProtocolRelative: false
    });
}

export function sanitizeDocumentHtmlContent(content) {
    return sanitizeHtml(normalizeInput(content), {
        allowedTags: DOCUMENT_ALLOWED_TAGS,
        allowedAttributes: DOCUMENT_ALLOWED_ATTRIBUTES,
        allowedSchemes: ['http', 'https', 'mailto', 'tel'],
        allowedSchemesByTag: {
            img: ['data', 'http', 'https']
        },
        allowedStyles: {
            '*': SAFE_INLINE_CSS_PATTERNS
        },
        allowProtocolRelative: false,
        parseStyleAttributes: true
    });
}

export function sanitizeDocumentStylesheet(stylesheet) {
    const normalized = normalizeInput(stylesheet);

    if (!normalized) {
        return '';
    }

    return normalized
        .replace(/<\/?style\b[^>]*>/gi, '')
        .replace(/@import\s+(?:url\()?[^;]+;?/gi, '')
        .replace(/expression\s*\([^)]*\)/gi, '')
        .replace(/javascript\s*:/gi, '')
        .replace(/vbscript\s*:/gi, '')
        .replace(/-moz-binding\s*:[^;]+;?/gi, '')
        .replace(/behavior\s*:[^;]+;?/gi, '')
        .replace(/url\(\s*(['"]?)(?!data:image\/)[^)]+\1\s*\)/gi, '')
        .replace(/[<>]/g, '')
        .trim();
}

export function sanitizeDocumentFilename(filename, extension) {
    const normalizedExtension = String(extension || '').replace(/[^a-z0-9]/gi, '').toLowerCase();
    const fallbackBase = 'document';
    const rawName = normalizeInput(filename)
        .replace(/[\\/]+/g, '_')
        .replace(/\.+/g, '.')
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .replace(/^\.+/, '')
        .replace(/^[_-]+/, '')
        .replace(/_+/g, '_');

    const safeBase = (rawName || fallbackBase)
        .replace(/\.(pdf|docx|doc)$/i, '')
        .replace(/^[_-]+/, '')
        .replace(/[._-]+$/g, '')
        .slice(0, 240) || fallbackBase;

    return normalizedExtension ? `${safeBase}.${normalizedExtension}` : safeBase;
}


