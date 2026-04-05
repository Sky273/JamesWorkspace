function buildLogoImageTag(image) {
    return `<img src="data:${image.contentType};base64,${image.base64}" alt="Logo" class="template-logo" style="max-height:60px;">`;
}

function replaceContentPlaceholders(content, replacement, patterns) {
    if (!content) {
        return content;
    }

    return patterns.reduce((updatedContent, pattern) => updatedContent.replace(pattern, replacement), content);
}

const DOCX_LOGO_PATTERNS = [
    /\[LOGO\]/gi,
    /\[LOGO CABINET\]/gi,
    /-logo-/gi,
    /<img[^>]*src=['"]logo\.png['"][^>]*>/gi,
    /<img[^>]*src=['"][^'"]*placeholder[^'"]*['"][^>]*>/gi
];

const PDF_LOGO_PATTERNS = [
    /<img[^>]*src=['"]logo\.png['"][^>]*>/gi,
    /<img[^>]*src=['"][^'"]*logo[^'"]*['"][^>]*>/gi,
    /\[LOGO\]/gi,
    /-logo-/gi
];

function injectDocxExtractedImages(template, images) {
    if (!template || images.length === 0) {
        return false;
    }

    const logoTag = buildLogoImageTag(images[0]);
    template.headerContent = replaceContentPlaceholders(template.headerContent, logoTag, DOCX_LOGO_PATTERNS);
    template.templateContent = replaceContentPlaceholders(template.templateContent, logoTag, DOCX_LOGO_PATTERNS);
    template.footerContent = replaceContentPlaceholders(template.footerContent, logoTag, DOCX_LOGO_PATTERNS);
    return true;
}

function injectPdfExtractedLogo(template, image) {
    if (!template || !image) {
        return false;
    }

    const logoTag = buildLogoImageTag(image);
    template.headerContent = replaceContentPlaceholders(template.headerContent, logoTag, PDF_LOGO_PATTERNS);
    template.templateContent = replaceContentPlaceholders(template.templateContent, logoTag, PDF_LOGO_PATTERNS);
    return true;
}

export {
    injectDocxExtractedImages,
    injectPdfExtractedLogo
};
