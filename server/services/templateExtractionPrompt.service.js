const DEFAULT_TEMPLATE_EXTRACTION_HTML_SEGMENT_CHARS = 20000;
const DEFAULT_TEMPLATE_EXTRACTION_FRAGMENT_SEGMENT_CHARS = 6000;
const DEFAULT_TEMPLATE_EXTRACTION_STYLESHEET_SEGMENT_CHARS = 8000;
const DEFAULT_TEMPLATE_EXTRACTION_IMAGE_LINES = 10;

function buildLayoutContext(layoutAnalysis = {}) {
    if (!layoutAnalysis || Object.keys(layoutAnalysis).length === 0) {
        return '';
    }

    const {
        headerHtml = '',
        contentHtml = '',
        footerHtml = '',
        stylesheet = '',
        metrics = {}
    } = layoutAnalysis;

    return [
        '',
        '',
        '=== FRAGMENTS DE LAYOUT PRE-DECOUPES ===',
        'HEADER DETECTE:',
        headerHtml || '(vide)',
        '',
        'CONTENT DETECTE:',
        contentHtml || '(vide)',
        '',
        'FOOTER DETECTE:',
        footerHtml || '(vide)',
        '',
        'STYLESHEET DETECTEE:',
        stylesheet || '(vide)',
        '',
        'METRICS:',
        JSON.stringify(metrics)
    ].join('\n');
}

function truncatePromptSegment(value = '', maxChars = 0) {
    const normalized = String(value || '');
    if (!Number.isFinite(maxChars) || maxChars <= 0 || normalized.length <= maxChars) {
        return normalized;
    }

    const suffix = '\n...[truncated]';
    const sliceLength = Math.max(0, maxChars - suffix.length);
    return normalized.slice(0, sliceLength) + suffix;
}

function buildBoundedLayoutContext(layoutAnalysis = {}, { fragmentChars, stylesheetChars } = {}) {
    if (!layoutAnalysis || Object.keys(layoutAnalysis).length === 0) {
        return '';
    }

    return buildLayoutContext({
        ...layoutAnalysis,
        headerHtml: truncatePromptSegment(layoutAnalysis.headerHtml || '', fragmentChars),
        contentHtml: truncatePromptSegment(layoutAnalysis.contentHtml || '', fragmentChars),
        footerHtml: truncatePromptSegment(layoutAnalysis.footerHtml || '', fragmentChars),
        stylesheet: truncatePromptSegment(layoutAnalysis.stylesheet || '', stylesheetChars)
    });
}

function buildImageContext(images = [], { maxItems = DEFAULT_TEMPLATE_EXTRACTION_IMAGE_LINES } = {}) {
    if (images.length === 0) {
        return '';
    }

    const lines = [
        '',
        '',
        '=== IMAGES DU DOCUMENT ===',
        'Ces images sont deja presentes dans le HTML ou disponibles pour remplacer un logo.'
    ];

    images.slice(0, maxItems).forEach((img, index) => {
        lines.push(`Image ${index + 1}: ${img.name} (${img.contentType}, ${Math.round((img.base64?.length || 0) / 1024)}KB)`);
    });

    if (images.length > maxItems) {
        lines.push(`... ${images.length - maxItems} image(s) supplementaire(s) omise(s) du prompt`);
    }

    return lines.join('\n');
}

function buildStylesContext(extractedStyles = {}) {
    const lines = [];

    if (Array.isArray(extractedStyles.colors) && extractedStyles.colors.length > 0) {
        lines.push(`Couleurs detectees: ${extractedStyles.colors.join(', ')}`);
    }

    if (Array.isArray(extractedStyles.fonts) && extractedStyles.fonts.length > 0) {
        lines.push(`Polices detectees: ${extractedStyles.fonts.join(', ')}`);
    }

    if (lines.length === 0) {
        return '';
    }

    return ['', '', '=== STYLES EXTRAITS DU DOCUMENT ===', ...lines].join('\n');
}

export function buildTemplateExtractionUserInstruction({
    fileName,
    htmlContent,
    images,
    extractedStyles,
    layoutAnalysis,
    promptBudgetChars
}) {
    const layoutAware = !!layoutAnalysis;
    const htmlSegment = truncatePromptSegment(htmlContent, DEFAULT_TEMPLATE_EXTRACTION_HTML_SEGMENT_CHARS);
    const boundedLayoutContext = buildBoundedLayoutContext(layoutAnalysis, {
        fragmentChars: DEFAULT_TEMPLATE_EXTRACTION_FRAGMENT_SEGMENT_CHARS,
        stylesheetChars: DEFAULT_TEMPLATE_EXTRACTION_STYLESHEET_SEGMENT_CHARS
    });
    const imageContext = buildImageContext(images, {
        maxItems: DEFAULT_TEMPLATE_EXTRACTION_IMAGE_LINES
    });
    const stylesContext = buildStylesContext(extractedStyles);

    const sections = [
        `Voici le HTML du CV "${fileName}" a convertir en template:`,
        '',
        layoutAware && htmlContent.length > DEFAULT_TEMPLATE_EXTRACTION_HTML_SEGMENT_CHARS
            ? '[HTML complet omis du prompt car des fragments de layout structures sont disponibles et priorises]'
            : htmlSegment,
        imageContext,
        stylesContext,
        boundedLayoutContext,
        '',
        'Retourne le JSON du template avec tous les champs requis (name, description, headerContent, templateContent, footerContent, stylesheet, footerHeight, tags, extractedColors, extractedFonts).'
    ];

    const userInstruction = sections.filter((section) => typeof section === 'string').join('\n');
    if (userInstruction.length > promptBudgetChars) {
        throw new Error(`Template extraction payload too large (${userInstruction.length}/${promptBudgetChars} chars)`);
    }

    return userInstruction;
}

export function buildTemplateVisionUserContent({
    imageBase64,
    textContent = '',
    fileName = 'cv.pdf',
    extractedImages = []
}) {
    let instructionText = `Analyse cette image de CV (${fileName}) et cree un template HTML/CSS qui reproduit fidelement son style visuel.`;
    if (extractedImages.length > 0) {
        instructionText += `\n\nIMPORTANT: ${extractedImages.length} image(s) ont ete extraites du PDF. Pour les logos/images, utilise le placeholder -logo-.`;
    }

    const userContent = [
        {
            type: 'image_url',
            image_url: {
                url: `data:image/png;base64,${imageBase64}`,
                detail: 'high'
            }
        },
        {
            type: 'text',
            text: instructionText
        }
    ];

    if (textContent && textContent.length > 100) {
        userContent.push({
            type: 'text',
            text: `\n\nContexte textuel du CV:\n${textContent.substring(0, 3000)}`
        });
    }

    return userContent;
}
