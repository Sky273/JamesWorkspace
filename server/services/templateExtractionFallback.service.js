import { safeLog } from '../utils/logger.backend.js';
import {
    sanitizeDocumentHtmlContent,
    sanitizeDocumentStylesheet
} from '../utils/sanitizer.backend.js';
import {
    hydrateTemplateImageSlots,
    injectDocxExtractedImages
} from '../routes/templates/extraction/imagePlaceholders.js';

const SIMPLE_TEXT_ELEMENT_REGEX = /<(h1|h2|h3|h4|p|div|span|strong|em|li)(\b[^>]*)>([^<>]*\S[^<>]*)<\/\1>/gi;
const PLACEHOLDER_TOKEN_REGEX = /-(name|title|content|logo)-/gi;

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

function mergeRecoveredStylesheet(templateStylesheet = '', sourceStylesheet = '') {
    const sanitizedTemplateStylesheet = sanitizeDocumentStylesheet(templateStylesheet || '');
    const sanitizedSourceStylesheet = sanitizeDocumentStylesheet(sourceStylesheet || '');
    const assetRules = [
        '.template-logo{display:block;max-width:100%;height:auto;object-fit:contain;}',
        '.template-extracted-image{width:100%;height:100%;display:block;object-fit:contain;}',
        '.template-image-slot{overflow:hidden;}'
    ].join('\n');

    return [
        sanitizedSourceStylesheet,
        sanitizedTemplateStylesheet,
        assetRules
    ].filter(Boolean).join('\n');
}

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

function buildImageDataUrl(image) {
    if (!image?.contentType || !image?.base64) {
        return null;
    }

    return `data:${image.contentType};base64,${image.base64}`;
}

function enforceEmbeddedImageSources(html = '', images = [], state = { imageIndex: 0 }) {
    if (!html) {
        return html;
    }

    return String(html).replace(/<img\b([^>]*)\bsrc=(['"])([^'"]+)\2([^>]*)>/gi, (match, before = '', quote, src = '', after = '') => {
        if (String(src).trim().toLowerCase().startsWith('data:image/')) {
            return match;
        }

        const replacementImage = images[state.imageIndex] || images[0];
        const dataUrl = buildImageDataUrl(replacementImage);
        state.imageIndex += 1;

        if (!dataUrl) {
            return `<img${before}${after}>`;
        }

        return `<img${before}src="${dataUrl}"${after}>`;
    });
}

function enforceEmbeddedTemplateImages(templateData, images = []) {
    const state = { imageIndex: 0 };
    templateData.headerContent = enforceEmbeddedImageSources(templateData.headerContent || '', images, state);
    templateData.templateContent = enforceEmbeddedImageSources(templateData.templateContent || '', images, state);
    templateData.footerContent = enforceEmbeddedImageSources(templateData.footerContent || '', images, state);
}

export function processTemplateExtractionResponse(response, fileName, images = [], context = {}) {
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
    hydrateTemplateImageSlots(templateData, images);
    injectImages(templateData, images);
    injectDocxExtractedImages(templateData, images);
    enforceEmbeddedTemplateImages(templateData, images);
    templateData.stylesheet = mergeRecoveredStylesheet(
        templateData.stylesheet,
        context?.sourceStylesheet || ''
    );
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

export function buildFallbackTemplateFromLayout(fileName, layoutAnalysis = {}, extractedStyles = {}) {
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
        stylesheet: mergeRecoveredStylesheet(
            mergeFallbackStylesheet(layoutAnalysis?.stylesheet || ''),
            layoutAnalysis?.stylesheet || ''
        ),
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
