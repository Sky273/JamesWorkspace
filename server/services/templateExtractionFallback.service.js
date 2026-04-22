import { safeLog } from '../utils/logger.backend.js';
import {
    sanitizeDocumentHtmlContent,
    sanitizeDocumentStylesheet
} from '../utils/sanitizer.backend.js';
import {
    hydrateTemplateImageSlots,
    injectDocxExtractedImages,
    injectPdfExtractedLogo
} from '../routes/templates/extraction/imagePlaceholders.js';

const SIMPLE_TEXT_ELEMENT_REGEX = /<(h1|h2|h3|h4|p|div|span|strong|em|li)(\b[^>]*)>([^<>]*\S[^<>]*)<\/\1>/gi;
const PLACEHOLDER_TOKEN_REGEX = /-(name|title|content|logo)-/gi;
const TEMPLATE_LINE_REGEX = /<div([^>]*class=['"][^'"]*(template-region-(header|content|footer)-line-\d+)[^'"]*['"][^>]*)>([\s\S]*?)<\/div>/gi;

function parseNumber(value, fallback = 0) {
    const parsed = Number.parseFloat(String(value ?? ''));
    return Number.isFinite(parsed) ? parsed : fallback;
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

function stripHtmlTags(value = '') {
    return String(value || '').replace(/<[^>]+>/g, ' ');
}

function decodeHtmlEntities(value = '') {
    return String(value || '')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, '\'');
}

function extractLineMetricsFromStylesheet(stylesheet = '') {
    const metrics = new Map();
    const classRuleRegex = /\.([a-z0-9_-]+)\{([^}]*)\}/gi;
    let match;

    while ((match = classRuleRegex.exec(stylesheet)) !== null) {
        const [, className = '', declarations = ''] = match;
        if (!/^template-region-(header|content|footer)-line-\d+$/i.test(className)) {
            continue;
        }

        const fontSizeMatch = declarations.match(/font-size:\s*([0-9.]+)px/i);
        const topMatch = declarations.match(/top:\s*([0-9.]+)px/i);
        const leftMatch = declarations.match(/left:\s*([0-9.]+)px/i);

        metrics.set(className, {
            fontSize: parseNumber(fontSizeMatch?.[1], 0),
            top: parseNumber(topMatch?.[1], Number.MAX_SAFE_INTEGER),
            left: parseNumber(leftMatch?.[1], 0)
        });
    }

    return metrics;
}

function extractTemplateLines(html = '', stylesheet = '') {
    const metrics = extractLineMetricsFromStylesheet(stylesheet);
    const lines = [];
    let match;

    while ((match = TEMPLATE_LINE_REGEX.exec(String(html || ''))) !== null) {
        const [, attrs = '', className = '', region = 'content', innerHtml = ''] = match;
        const text = normalizeSpacing(decodeHtmlEntities(stripHtmlTags(innerHtml)));
        const lineMetrics = metrics.get(className) || {};
        lines.push({
            attrs,
            className,
            region,
            text,
            fontSize: lineMetrics.fontSize ?? 0,
            top: lineMetrics.top ?? Number.MAX_SAFE_INTEGER,
            left: lineMetrics.left ?? 0
        });
    }

    return lines;
}

function scoreLineForIdentity(line) {
    const text = line?.text || '';
    if (!text) {
        return -Infinity;
    }

    let score = (line.fontSize || 0) * 10;
    if (line.region === 'header') {
        score += 25;
    }

    if (text.length >= 6 && text.length <= 60) {
        score += 12;
    }

    if (/[@+]|www\.|http|linkedin|github|\.com|\.fr|\d{2,}/i.test(text)) {
        score -= 20;
    }

    return score;
}

function chooseLayoutPlaceholderTargets(layoutAnalysis = {}) {
    const stylesheet = layoutAnalysis?.stylesheet || '';
    const headerLines = extractTemplateLines(layoutAnalysis?.headerHtml || '', stylesheet);
    const contentLines = extractTemplateLines(layoutAnalysis?.contentHtml || '', stylesheet);
    const candidateLines = [...headerLines, ...contentLines];

    const sortedByIdentity = [...candidateLines]
        .filter((line) => line.text)
        .sort((left, right) => {
            const scoreDiff = scoreLineForIdentity(right) - scoreLineForIdentity(left);
            if (scoreDiff !== 0) {
                return scoreDiff;
            }
            if (left.top !== right.top) {
                return left.top - right.top;
            }
            return left.left - right.left;
        });

    const nameLine = sortedByIdentity[0] || null;
    const titleLine = sortedByIdentity.find((line) => line.className !== nameLine?.className) || null;
    const contentLine = contentLines.find((line) => line.className !== nameLine?.className && line.className !== titleLine?.className) || null;

    return {
        nameLine,
        titleLine,
        contentLine
    };
}

function replaceTemplateLineText(html = '', className = '', replacement = '') {
    if (!html || !className) {
        return html;
    }

    const escapedClassName = className.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const lineRegex = new RegExp(`(<div[^>]*class=['"][^'"]*${escapedClassName}[^'"]*['"][^>]*>)([\\s\\S]*?)(<\\/div>)`, 'i');
    return String(html).replace(lineRegex, `$1${replacement}$3`);
}

function blankUnassignedTemplateLines(html = '', assignedClassNames = new Set()) {
    if (!html) {
        return html;
    }

    return String(html).replace(TEMPLATE_LINE_REGEX, (match, attrs = '', className = '', _region = '', innerHtml = '') => {
        if (assignedClassNames.has(className)) {
            return match;
        }

        const currentText = normalizeSpacing(decodeHtmlEntities(stripHtmlTags(innerHtml)));
        if (!currentText) {
            return match;
        }

        return `<div${attrs}></div>`;
    });
}

function buildLayoutDrivenSections(templateData, layoutAnalysis = {}) {
    const sourceHeader = layoutAnalysis?.headerHtml || '';
    const sourceContent = layoutAnalysis?.contentHtml || '';
    const sourceFooter = layoutAnalysis?.footerHtml || '';

    if (!sourceHeader && !sourceContent && !sourceFooter) {
        return null;
    }

    const { nameLine, titleLine, contentLine } = chooseLayoutPlaceholderTargets(layoutAnalysis);
    const assignedClassNames = new Set(
        [nameLine?.className, titleLine?.className, contentLine?.className].filter(Boolean)
    );

    let headerContent = sourceHeader;
    let templateContent = sourceContent;
    let footerContent = sourceFooter;

    const applyReplacement = (line, replacement) => {
        if (!line) {
            return;
        }

        if (line.region === 'header') {
            headerContent = replaceTemplateLineText(headerContent, line.className, replacement);
            return;
        }

        if (line.region === 'footer') {
            footerContent = replaceTemplateLineText(footerContent, line.className, replacement);
            return;
        }

        templateContent = replaceTemplateLineText(templateContent, line.className, replacement);
    };

    applyReplacement(nameLine, '-name-');
    applyReplacement(titleLine, '-title-');
    applyReplacement(contentLine, '-content-');

    headerContent = blankUnassignedTemplateLines(headerContent, assignedClassNames);
    templateContent = blankUnassignedTemplateLines(templateContent, assignedClassNames);
    footerContent = blankUnassignedTemplateLines(footerContent, assignedClassNames);

    if (!templateContent.includes('-name-')) {
        templateContent = `<div class="candidate-name">-name-</div>${templateContent}`;
    }

    if (!templateContent.includes('-title-')) {
        templateContent = `<div class="candidate-title">-title-</div>${templateContent}`;
    }

    if (!templateContent.includes('-content-')) {
        templateContent += '<div class="cv-content">-content-</div>';
    }

    templateData.headerContent = headerContent;
    templateData.templateContent = templateContent;
    templateData.footerContent = footerContent;

    return templateData;
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

    if (context?.layoutAnalysis) {
        buildLayoutDrivenSections(templateData, context.layoutAnalysis);
    } else {
        normalizeTemplatePlaceholders(templateData);
    }
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

export function buildFallbackTemplateFromLayout(fileName, layoutAnalysis = {}, extractedStyles = {}, images = []) {
    const headerHasImageRegion = Array.isArray(layoutAnalysis?.imageBlocks)
        && layoutAnalysis.imageBlocks.some((block) => block?.region === 'header');
    const template = {
        name: `Template extrait - ${fileName}`,
        description: `Template genere automatiquement depuis la structure PDF de ${fileName}`,
        headerContent: layoutAnalysis?.headerHtml || '',
        templateContent: layoutAnalysis?.contentHtml || '',
        footerContent: layoutAnalysis?.footerHtml || '',
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
    buildLayoutDrivenSections(template, layoutAnalysis);
    if (!template.templateContent.includes('-name-') || !template.templateContent.includes('-title-') || !template.templateContent.includes('-content-')) {
        normalizeTemplatePlaceholders(template);
    }
    if (!template.headerContent.includes('template-image-slot') && !template.headerContent.includes('-logo-') && headerHasImageRegion) {
        template.headerContent = ['<div class="template-header-logo">-logo-</div>', stripTextNodes(template.headerContent)]
            .filter(Boolean)
            .join('\n');
    } else if (!template.headerContent.includes('-name-') && !template.headerContent.includes('-title-')) {
        template.headerContent = stripTextNodes(template.headerContent);
    }
    template.footerContent = stripTextNodes(template.footerContent);
    ensureRequiredPlaceholders(template);
    hydrateTemplateImageSlots(template, images);
    if (images.length > 0) {
        injectPdfExtractedLogo(template, images[0]);
        injectDocxExtractedImages(template, images);
        enforceEmbeddedTemplateImages(template, images);
    }

    return {
        success: true,
        template,
        model: 'deterministic-layout-fallback',
        usage: null
    };
}
