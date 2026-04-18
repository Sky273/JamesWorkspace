import { describe, expect, it } from 'vitest';
import {
    injectDocxExtractedImages,
    injectPdfExtractedLogo,
    hydrateTemplateImageSlots
} from '../../routes/templates/extraction/imagePlaceholders.js';

const testImage = {
    base64: 'ZmFrZS1sb2dv',
    contentType: 'image/png'
};

describe('template extraction image placeholders', () => {
    it('replaces DOCX logo placeholders across header, body and footer', () => {
        const template = {
            headerContent: '<div>[LOGO]</div>',
            templateContent: '<div>[LOGO CABINET] <img src="logo.png"> -logo- <img src="placeholder.png"></div>',
            footerContent: '<footer>[logo]</footer>'
        };

        const updated = injectDocxExtractedImages(template, [testImage]);

        expect(updated).toBe(true);
        expect(template.headerContent).toContain('data:image/png;base64,ZmFrZS1sb2dv');
        expect(template.templateContent).not.toContain('[LOGO CABINET]');
        expect(template.templateContent).not.toContain('logo.png');
        expect(template.templateContent).not.toContain('placeholder.png');
        expect(template.footerContent).toContain('template-logo');
    });

    it('replaces PDF logo placeholders only in header and body', () => {
        const template = {
            headerContent: '<div><img src="logo.png"></div>',
            templateContent: '<div>[LOGO] <img src="brand-logo.svg"> -logo-</div>',
            footerContent: '<footer>[LOGO]</footer>'
        };

        const updated = injectPdfExtractedLogo(template, testImage);

        expect(updated).toBe(true);
        expect(template.headerContent).toContain('data:image/png;base64,ZmFrZS1sb2dv');
        expect(template.templateContent).not.toContain('[LOGO]');
        expect(template.templateContent).not.toContain('brand-logo.svg');
        expect(template.footerContent).toBe('<footer>[LOGO]</footer>');
    });

    it('returns false when no template or image is provided', () => {
        expect(injectDocxExtractedImages(null, [testImage])).toBe(false);
        expect(injectDocxExtractedImages({}, [])).toBe(false);
        expect(injectPdfExtractedLogo(null, testImage)).toBe(false);
        expect(injectPdfExtractedLogo({}, null)).toBe(false);
    });

    it('hydrates detected image slots with extracted images in sequence', () => {
        const template = {
            headerContent: '<div class="template-image-slot header-slot"></div>',
            templateContent: '<div class="template-image-slot body-slot"></div>',
            footerContent: '<div>footer</div>'
        };
        const images = [
            testImage,
            { base64: 'ZmFrZS1pbWFnZS0y', contentType: 'image/jpeg' }
        ];

        const updated = hydrateTemplateImageSlots(template, images);

        expect(updated).toBe(true);
        expect(template.headerContent).toContain('data:image/png;base64,ZmFrZS1sb2dv');
        expect(template.templateContent).toContain('data:image/jpeg;base64,ZmFrZS1pbWFnZS0y');
        expect(template.headerContent).toContain('template-extracted-image');
    });
});
