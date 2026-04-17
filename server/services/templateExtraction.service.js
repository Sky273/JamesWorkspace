/**
 * Template Extraction Service
 * Extracts CV template structure from uploaded CV files using LLM
 * Supports both HTML/layout analysis and visual PDF fallback.
 */

import { callLLM, callLLMWithVision } from './llm.service.js';
import { safeLog } from '../utils/logger.backend.js';
import {
    sanitizeDocumentHtmlContent,
    sanitizeDocumentStylesheet
} from '../utils/sanitizer.backend.js';

const TEMPLATE_EXTRACTION_OPERATION_TYPE = 'Template Extraction';
const TEMPLATE_EXTRACTION_VISION_OPERATION_TYPE = 'Template Extraction Vision Fallback';
const TEMPLATE_EXTRACTION_HTML_TIMEOUT_MS = Number.parseInt(process.env.TEMPLATE_EXTRACTION_HTML_TIMEOUT_MS || '120000', 10);
const DEFAULT_TEMPLATE_EXTRACTION_PROMPT_BUDGET_CHARS = Number.parseInt(process.env.TEMPLATE_EXTRACTION_PROMPT_BUDGET_CHARS || '50000', 10);
const DEFAULT_TEMPLATE_EXTRACTION_HTML_SEGMENT_CHARS = 20000;
const DEFAULT_TEMPLATE_EXTRACTION_FRAGMENT_SEGMENT_CHARS = 6000;
const DEFAULT_TEMPLATE_EXTRACTION_STYLESHEET_SEGMENT_CHARS = 8000;
const DEFAULT_TEMPLATE_EXTRACTION_IMAGE_LINES = 10;

const HTML_EXTRACTION_PROMPT = [
    'Tu es un expert en creation de templates de CV reutilisables.',
    '',
    "TACHE : convertir le HTML/CSS d'un CV en template VIDE reutilisable.",
    '',
    'REGLES CRITIQUES :',
    '1. AUCUNE information personnelle (pas de nom, email, telephone, adresse, dates, entreprises, ecoles)',
    '2. AUCUN contenu de CV (pas de titres de sections comme "Competences", "Experiences", etc.)',
    '3. UN SEUL placeholder -content- pour TOUT le corps du CV',
    '',
    'STRUCTURE DU TEMPLATE :',
    '1. HEADER : en-tete avec logo/nom de societe -> headerContent (remplacer le logo par -logo-)',
    '2. FOOTER : pied de page societe -> footerContent (garder les infos societe non personnelles)',
    '3. CORPS : structure MINIMALISTE avec 3 placeholders UNIQUEMENT :',
    '   - -name- : nom du candidat',
    '   - -title- : titre/poste',
    '   - -content- : UN SEUL bloc pour TOUT le contenu (pas de sections separees)',
    '',
    'IMPORTANT :',
    '- Conserve la mise en page, les espacements, les couleurs et les polices quand ils sont visibles',
    '- Si des fragments header/content/footer sont fournis, utilise-les comme point de depart prioritaire',
    '- Les images/logo peuvent etre conservees en base64 ou remplacees par -logo-',
    '',
    'Tu DOIS retourner un JSON avec TOUS ces champs :',
    '{',
    '  "name": "string - nom du template",',
    '  "description": "string - description du style",',
    '  "headerContent": "string - HTML du header avec -logo-",',
    '  "templateContent": "string - HTML minimaliste avec -name-, -title-, -content-",',
    '  "footerContent": "string - HTML du footer",',
    '  "stylesheet": "string - CSS complet",',
    '  "footerHeight": 25,',
    '  "tags": ["tag1", "tag2"],',
    '  "extractedColors": ["#color1"],',
    '  "extractedFonts": ["font1"]',
    '}',
    '',
    'Reponds UNIQUEMENT avec le JSON, sans texte avant ou apres.'
].join('\n');

const VISION_EXTRACTION_PROMPT = [
    'Tu es un expert en creation de templates de CV reutilisables.',
    '',
    "TACHE : analyser cette image de CV et creer un template HTML/CSS VIDE (sans contenu).",
    '',
    'REGLES CRITIQUES :',
    '1. AUCUNE information personnelle (pas de nom, email, telephone, adresse, dates, entreprises, ecoles)',
    '2. AUCUN contenu de CV',
    '3. UN SEUL placeholder -content- pour TOUT le corps du CV',
    '4. Pour les logos/images, utilise le placeholder : -logo-',
    '',
    'Retourne UNIQUEMENT un JSON avec les champs name, description, headerContent, templateContent, footerContent, stylesheet, footerHeight, tags, extractedColors, extractedFonts.'
].join('\n');

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

function sanitizeTemplateData(templateData) {
    templateData.headerContent = sanitizeDocumentHtmlContent(templateData.headerContent || '');
    templateData.templateContent = sanitizeDocumentHtmlContent(templateData.templateContent || '');
    templateData.footerContent = sanitizeDocumentHtmlContent(templateData.footerContent || '');
    templateData.stylesheet = sanitizeDocumentStylesheet(templateData.stylesheet || '');
    templateData.footerHeight = templateData.footerHeight || 25;
    templateData.description = templateData.description || '';
    templateData.tags = Array.isArray(templateData.tags) ? templateData.tags : ['extrait', 'automatique'];
    templateData.extractedColors = Array.isArray(templateData.extractedColors) ? templateData.extractedColors : [];
    templateData.extractedFonts = Array.isArray(templateData.extractedFonts) ? templateData.extractedFonts : [];
}

function stripTextNodes(html = '') {
    return String(html || '').replace(/>([^<]+)</g, '><').trim();
}

function mergeFallbackStylesheet(stylesheet = '') {
    const fallbackRules = [
        '.template-layout-fallback { display: flex; flex-direction: column; gap: 12px; }',
        '.template-layout-fallback .candidate-name { font-size: 24px; font-weight: 700; line-height: 1.2; }',
        '.template-layout-fallback .candidate-title { font-size: 16px; line-height: 1.3; opacity: 0.85; }',
        '.template-layout-fallback .cv-content { margin-top: 16px; }',
        '.template-layout-fallback .template-header-logo { display: flex; align-items: center; min-height: 40px; }'
    ].join('\n');

    return [sanitizeDocumentStylesheet(stylesheet || ''), fallbackRules].filter(Boolean).join('\n');
}

function buildFallbackTemplateFromLayout(fileName, layoutAnalysis = {}, extractedStyles = {}) {
    const headerHasImageRegion = Array.isArray(layoutAnalysis?.imageBlocks)
        && layoutAnalysis.imageBlocks.some((block) => block?.region === 'header');
    const strippedHeader = stripTextNodes(layoutAnalysis?.headerHtml || '');
    const strippedFooter = stripTextNodes(layoutAnalysis?.footerHtml || '');
    const headerContent = [headerHasImageRegion ? '<div class="template-header-logo">-logo-</div>' : '', strippedHeader]
        .filter(Boolean)
        .join('\n');

    const template = {
        name: `Template extrait - ${fileName}`,
        description: `Template genere automatiquement depuis la structure PDF de ${fileName}`,
        headerContent,
        templateContent: [
            '<section class="template-layout-fallback">',
            '  <div class="candidate-name">-name-</div>',
            '  <div class="candidate-title">-title-</div>',
            '  <div class="cv-content">-content-</div>',
            '</section>'
        ].join('\n'),
        footerContent: strippedFooter,
        stylesheet: mergeFallbackStylesheet(layoutAnalysis?.stylesheet || ''),
        footerHeight: 25,
        tags: ['extrait', 'automatique', 'fallback-layout'],
        extractedColors: Array.isArray(extractedStyles.colors) ? extractedStyles.colors : [],
        extractedFonts: Array.isArray(extractedStyles.fonts) ? extractedStyles.fonts : []
    };

    sanitizeTemplateData(template);
    normalizeTemplatePlaceholders(template);
    ensureRequiredPlaceholders(template);

    return {
        success: true,
        template,
        model: 'deterministic-layout-fallback',
        usage: null
    };
}

const SIMPLE_TEXT_ELEMENT_REGEX = /<(h1|h2|h3|h4|p|div|span|strong|em|li)(\b[^>]*)>([^<>]*\S[^<>]*)<\/\1>/gi;
const PLACEHOLDER_TOKEN_REGEX = /-(name|title|content|logo)-/gi;

function normalizeSpacing(value = '') {
    return value.replace(/\s+/g, ' ').trim();
}

function replaceFirstSimpleTextElement(html, replacement) {
    let replaced = false;
    return html.replace(SIMPLE_TEXT_ELEMENT_REGEX, (match, tag, attrs = '', text = '') => {
        if (replaced) {
            return match;
        }

        const normalizedText = normalizeSpacing(text);
        if (!normalizedText || PLACEHOLDER_TOKEN_REGEX.test(normalizedText)) {
            PLACEHOLDER_TOKEN_REGEX.lastIndex = 0;
            return match;
        }

        replaced = true;
        PLACEHOLDER_TOKEN_REGEX.lastIndex = 0;
        return `<${tag}${attrs}>${replacement}</${tag}>`;
    });
}

function stripNonPlaceholderText(html) {
    return html.replace(/>([^<]+)</g, (_match, text = '') => {
        const placeholders = text.match(PLACEHOLDER_TOKEN_REGEX) || [];
        PLACEHOLDER_TOKEN_REGEX.lastIndex = 0;
        if (placeholders.length === 0) {
            return '><';
        }

        return `>${placeholders.join(' ')}<`;
    });
}

function normalizeTemplatePlaceholders(templateData) {
    let templateContent = templateData.templateContent || '';

    if (!templateContent.includes('-name-')) {
        templateContent = replaceFirstSimpleTextElement(templateContent, '-name-');
    }

    if (!templateContent.includes('-title-')) {
        templateContent = replaceFirstSimpleTextElement(templateContent, '-title-');
    }

    if (!templateContent.includes('-content-')) {
        templateContent += '\n<div class="cv-content">-content-</div>';
    }

    templateContent = stripNonPlaceholderText(templateContent);
    templateData.templateContent = templateContent;

    if (templateData.headerContent?.includes('-name-')) {
        templateData.headerContent = stripNonPlaceholderText(templateData.headerContent);
    }
}

function ensureRequiredPlaceholders(templateData) {
    if (!templateData.templateContent.includes('-content-')) {
        safeLog('warn', 'LLM did not include -content- placeholder, adding fallback block');
        templateData.templateContent += '\n<div class="cv-content">-content-</div>';
    }

    if (!templateData.templateContent.includes('-name-')) {
        safeLog('warn', 'LLM did not include -name- placeholder, adding fallback block');
        templateData.templateContent = '<div class="candidate-name">-name-</div>\n' + templateData.templateContent;
    }

    if (!templateData.templateContent.includes('-title-')) {
        safeLog('warn', 'LLM did not include -title- placeholder, adding fallback block');
        if (templateData.templateContent.includes('-name-')) {
            templateData.templateContent = templateData.templateContent.replace(
                /-name-/,
                '-name-</div>\n<div class="candidate-title">-title-'
            );
        } else {
            templateData.templateContent = '<div class="candidate-title">-title-</div>\n' + templateData.templateContent;
        }
    }
}

function injectImages(templateData, images = []) {
    if (images.length === 0) {
        return;
    }

    const logoImage = images[0];
    const logoBase64 = `data:${logoImage.contentType};base64,${logoImage.base64}`;
    const replacement = `<img src="${logoBase64}" alt="Logo" class="template-logo" style="max-height:60px;">`;

    if (templateData.headerContent) {
        templateData.headerContent = templateData.headerContent
            .replace(/\[LOGO\]/gi, replacement)
            .replace(/\[LOGO CABINET\]/gi, replacement);
    }

    if (templateData.templateContent) {
        templateData.templateContent = templateData.templateContent.replace(/\[LOGO\]/gi, replacement);
    }
}

function processLLMResponse(response, fileName, images = []) {
    if (!response || !response.content) {
        throw new Error('LLM returned empty response');
    }

    let templateData;
    try {
        let cleanContent = response.content.trim();
        safeLog('debug', 'LLM response content', {
            contentLength: cleanContent.length,
            content: cleanContent.substring(0, 2000)
        });

        if (cleanContent.startsWith('```json')) {
            cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (cleanContent.startsWith('```')) {
            cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }

        templateData = JSON.parse(cleanContent);
    } catch (parseError) {
        safeLog('error', 'Failed to parse LLM response', {
            error: parseError.message,
            responsePreview: response.content.substring(0, 1000)
        });
        throw new Error('Failed to parse template extraction response');
    }

    if (!templateData.name) {
        templateData.name = `Template extrait - ${fileName}`;
    }

    if (!templateData.templateContent) {
        safeLog('error', 'LLM did not provide templateContent', {
            response: JSON.stringify(templateData).substring(0, 500)
        });
        throw new Error('LLM did not provide templateContent - extraction failed');
    }

    if (!templateData.stylesheet) {
        safeLog('warn', 'LLM did not provide stylesheet, using default');
        templateData.stylesheet = [
            'body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }',
            '.candidate-name { font-size: 24px; font-weight: bold; color: #2563eb; margin-bottom: 5px; }',
            '.candidate-title { font-size: 18px; color: #64748b; margin-bottom: 20px; }',
            '.cv-content { margin-top: 20px; }',
            'h1, h2, h3 { color: #1e40af; }'
        ].join('\n');
    }

    normalizeTemplatePlaceholders(templateData);
    ensureRequiredPlaceholders(templateData);
    injectImages(templateData, images);
    sanitizeTemplateData(templateData);

    if (!templateData.description) {
        templateData.description = `Template extrait depuis ${fileName}`;
    }

    safeLog('info', 'Template extraction completed', {
        templateName: templateData.name,
        hasHeader: !!templateData.headerContent,
        hasFooter: !!templateData.footerContent,
        stylesheetLength: templateData.stylesheet?.length,
        extractedColors: templateData.extractedColors,
        extractedFonts: templateData.extractedFonts
    });

    return {
        success: true,
        template: templateData,
        model: response.model,
        usage: response.usage
    };
}

function buildTemplateExtractionUserInstruction({
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

export async function extractTemplateFromHTML(htmlContent, images = [], fileName = 'cv.docx', extractedStyles = {}, options = {}) {
    try {
        safeLog('info', 'Starting HTML-based template extraction', {
            htmlLength: htmlContent?.length,
            imageCount: images.length,
            fileName,
            hasExtractedStyles: !!extractedStyles.colors?.length,
            hasLayoutAnalysis: !!options.layoutAnalysis
        });
        const promptBudgetChars = options.promptBudgetChars ?? DEFAULT_TEMPLATE_EXTRACTION_PROMPT_BUDGET_CHARS;
        const userInstruction = buildTemplateExtractionUserInstruction({
            fileName,
            htmlContent,
            images,
            extractedStyles,
            layoutAnalysis: options.layoutAnalysis,
            promptBudgetChars
        });

        const response = await callLLM([
            { role: 'system', content: HTML_EXTRACTION_PROMPT },
            { role: 'user', content: userInstruction }
        ], {
            operationType: TEMPLATE_EXTRACTION_OPERATION_TYPE,
            temperature: 0.1,
            max_tokens: options.maxTokens ?? 32000,
            timeout: options.timeout ?? TEMPLATE_EXTRACTION_HTML_TIMEOUT_MS,
            userMetadata: {
                actionType: 'template.extract',
                fileName
            }
        });

        return processLLMResponse(response, fileName, images);
    } catch (error) {
        safeLog('error', 'HTML template extraction failed', { error: error.message });
        if (options.layoutAnalysis) {
            safeLog('warn', 'Falling back to deterministic layout template extraction', {
                fileName,
                error: error.message,
                timeoutMs: options.timeout ?? TEMPLATE_EXTRACTION_HTML_TIMEOUT_MS
            });
            return buildFallbackTemplateFromLayout(fileName, options.layoutAnalysis, extractedStyles);
        }
        throw error;
    }
}

export async function extractTemplateFromImage(imageBase64, textContent = '', fileName = 'cv.pdf', extractedImages = [], options = {}) {
    try {
        safeLog('info', 'Starting vision-based template extraction', {
            imageSize: Math.round(imageBase64.length / 1024) + 'KB',
            hasTextContent: !!textContent,
            fileName,
            extractedImagesCount: extractedImages.length
        });

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

        const response = await callLLMWithVision(VISION_EXTRACTION_PROMPT, userContent, {
            operationType: TEMPLATE_EXTRACTION_VISION_OPERATION_TYPE,
            temperature: 0.2,
            max_tokens: options.maxTokens ?? 20000,
            userMetadata: {
                actionType: 'template.extract',
                fileName
            }
        });

        return processLLMResponse(response, fileName, extractedImages);
    } catch (error) {
        safeLog('error', 'Vision template extraction failed', { error: error.message });
        throw error;
    }
}

/**
 * Legacy function for backward compatibility.
 */
export async function extractTemplateFromCV(cvText, fileName = 'cv.pdf', options = {}) {
    safeLog('warn', 'Using legacy text-only extraction - results may be limited');
    return extractTemplateFromHTML(cvText, [], fileName, {}, options);
}
