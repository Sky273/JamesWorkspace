function buildLogoImageTag(image) {
    return `<img src="data:${image.contentType};base64,${image.base64}" alt="Logo" class="template-logo" style="max-height:60px;">`;
}

function buildExtractedImageTag(image, index = 0) {
    return `<img src="data:${image.contentType};base64,${image.base64}" alt="Image extraite ${index + 1}" class="template-extracted-image" style="width:100%;height:100%;display:block;object-fit:contain;">`;
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

function hydrateTemplateImageSlots(template, images = []) {
    if (!template || images.length === 0) {
        return false;
    }

    let imageIndex = 0;
    let replacements = 0;
    const slotPattern = /<div([^>]*class=['"][^'"]*template-image-slot[^'"]*['"][^>]*)><\/div>/gi;
    const fields = ['headerContent', 'templateContent', 'footerContent'];

    for (const field of fields) {
        const currentContent = template[field];
        if (!currentContent) {
            continue;
        }

        template[field] = currentContent.replace(slotPattern, (match, attrs = '') => {
            if (imageIndex >= images.length) {
                return match;
            }

            const imageTag = buildExtractedImageTag(images[imageIndex], imageIndex);
            imageIndex += 1;
            replacements += 1;
            return `<div${attrs}>${imageTag}</div>`;
        });
    }

    return replacements > 0;
}

export {
    injectDocxExtractedImages,
    injectPdfExtractedLogo,
    hydrateTemplateImageSlots
};
