/**
 * Tests for Template Extraction Service
 * Tests LLM response processing, placeholder validation, and image substitution
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn()
}));

vi.mock('../../services/llm.service.js', () => ({
    callLLM: vi.fn(),
    callLLMWithVision: vi.fn()
}));

import { callLLM, callLLMWithVision } from '../../services/llm.service.js';
import {
    extractTemplateFromHTML,
    extractTemplateFromImage,
    extractTemplateFromCV
} from '../../services/templateExtraction.service.js';

const STANDARD_TEMPLATE_EXTRACTION_TIMEOUT_MS = 15 * 60 * 1000;

const validTemplateJSON = JSON.stringify({
    name: 'Modern Template',
    description: 'A modern CV template',
    headerContent: '<div class="header">-logo-</div>',
    templateContent: '<h1>-name-</h1><h2>-title-</h2><div>-content-</div>',
    footerContent: '<div class="footer">Company</div>',
    stylesheet: 'body { font-family: Arial; }',
    footerHeight: 25,
    tags: ['modern'],
    extractedColors: ['#4f46e5'],
    extractedFonts: ['Arial']
});

describe('Template Extraction Service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('extractTemplateFromHTML', () => {
        it('should return parsed template on valid LLM response', async () => {
            callLLM.mockResolvedValueOnce({
                content: validTemplateJSON,
                model: 'gpt-4',
                usage: { total_tokens: 500 }
            });

            const result = await extractTemplateFromHTML('<html>CV content</html>');

            expect(result.success).toBe(true);
            expect(result.template.name).toBe('Modern Template');
            expect(result.template.templateContent).toContain('-name-');
            expect(result.template.templateContent).toContain('-title-');
            expect(result.template.templateContent).toContain('-content-');
            expect(result.model).toBe('gpt-4');
            expect(callLLM).toHaveBeenCalledWith(
                expect.any(Array),
                expect.objectContaining({
                    operationType: 'Template Extraction',
                    timeout: STANDARD_TEMPLATE_EXTRACTION_TIMEOUT_MS,
                    userMetadata: expect.objectContaining({
                        actionType: 'template.extract'
                    })
                })
            );
        });

        it('requests the platform-standard extraction timeout', async () => {
            callLLM.mockResolvedValueOnce({
                content: validTemplateJSON,
                model: 'gpt-4',
                usage: { total_tokens: 500 }
            });

            await extractTemplateFromHTML('<html>CV content</html>');

            expect(callLLM).toHaveBeenCalledWith(
                expect.any(Array),
                expect.objectContaining({
                    timeout: STANDARD_TEMPLATE_EXTRACTION_TIMEOUT_MS,
                    operationType: 'Template Extraction'
                })
            );
        });

        it('should handle markdown-wrapped JSON response', async () => {
            callLLM.mockResolvedValueOnce({
                content: '```json\n' + validTemplateJSON + '\n```',
                model: 'gpt-4',
                usage: {}
            });

            const result = await extractTemplateFromHTML('<html>CV</html>');

            expect(result.success).toBe(true);
            expect(result.template.name).toBe('Modern Template');
        });

        it('should add missing -content- placeholder', async () => {
            const noContent = JSON.stringify({
                name: 'Test',
                templateContent: '<h1>-name-</h1><h2>-title-</h2>',
                stylesheet: 'body{}'
            });
            callLLM.mockResolvedValueOnce({ content: noContent, model: 'gpt-4', usage: {} });

            const result = await extractTemplateFromHTML('<html>CV</html>');

            expect(result.template.templateContent).toContain('-content-');
        });

        it('should add missing -name- placeholder', async () => {
            const noName = JSON.stringify({
                name: 'Test',
                templateContent: '<div>-content-</div><h2>-title-</h2>',
                stylesheet: 'body{}'
            });
            callLLM.mockResolvedValueOnce({ content: noName, model: 'gpt-4', usage: {} });

            const result = await extractTemplateFromHTML('<html>CV</html>');

            expect(result.template.templateContent).toContain('-name-');
        });

        it('should add missing -title- placeholder', async () => {
            const noTitle = JSON.stringify({
                name: 'Test',
                templateContent: '<h1>-name-</h1><div>-content-</div>',
                stylesheet: 'body{}'
            });
            callLLM.mockResolvedValueOnce({ content: noTitle, model: 'gpt-4', usage: {} });

            const result = await extractTemplateFromHTML('<html>CV</html>');

            expect(result.template.templateContent).toContain('-title-');
        });

        it('should throw if LLM returns empty response', async () => {
            callLLM.mockResolvedValueOnce(null);

            await expect(extractTemplateFromHTML('<html>CV</html>'))
                .rejects.toThrow();
        });

        it('should throw if LLM returns unparseable JSON', async () => {
            callLLM.mockResolvedValueOnce({ content: 'not json at all', model: 'gpt-4', usage: {} });

            await expect(extractTemplateFromHTML('<html>CV</html>'))
                .rejects.toThrow('Failed to parse template extraction response');
        });

        it('should throw if templateContent is missing from LLM response', async () => {
            callLLM.mockResolvedValueOnce({
                content: JSON.stringify({ name: 'Test' }),
                model: 'gpt-4',
                usage: {}
            });

            await expect(extractTemplateFromHTML('<html>CV</html>'))
                .rejects.toThrow('LLM did not provide templateContent');
        });

        it('should replace [LOGO] placeholders with images', async () => {
            const withLogo = JSON.stringify({
                name: 'Logo Template',
                headerContent: '<div>[LOGO]</div>',
                templateContent: '<h1>-name-</h1><h2>-title-</h2><div>-content-</div>',
                stylesheet: 'body{}'
            });
            callLLM.mockResolvedValueOnce({ content: withLogo, model: 'gpt-4', usage: {} });

            const images = [{ name: 'logo.png', base64: 'abc123', contentType: 'image/png' }];
            const result = await extractTemplateFromHTML('<html>CV</html>', images);

            expect(result.template.headerContent).toContain('data:image/png;base64,abc123');
            expect(result.template.headerContent).not.toContain('[LOGO]');
        });

        it('should provide default values for missing optional fields', async () => {
            const minimal = JSON.stringify({
                templateContent: '<h1>-name-</h1><h2>-title-</h2><div>-content-</div>'
            });
            callLLM.mockResolvedValueOnce({ content: minimal, model: 'gpt-4', usage: {} });

            const result = await extractTemplateFromHTML('<html>CV</html>', [], 'test.docx');

            expect(result.template.name).toContain('test.docx');
            expect(result.template.description).toContain('test.docx');
            expect(result.template.headerContent).toBe('');
            expect(result.template.footerContent).toBe('');
            expect(result.template.footerHeight).toBe(25);
            expect(result.template.tags).toEqual(['extrait', 'automatique']);
        });

        it('should include image context and style context in LLM call', async () => {
            callLLM.mockResolvedValueOnce({ content: validTemplateJSON, model: 'gpt-4', usage: {} });

            const images = [{ name: 'logo.png', base64: 'abc', contentType: 'image/png' }];
            const styles = { colors: ['#333'], fonts: ['Roboto'] };
            await extractTemplateFromHTML('<html>CV</html>', images, 'cv.docx', styles);

            const userMsg = callLLM.mock.calls[0][0][1].content;
            expect(userMsg).toContain('IMAGES DU DOCUMENT');
            expect(userMsg).toContain('STYLES EXTRAITS');
            expect(userMsg).toContain('#333');
            expect(userMsg).toContain('Roboto');
        });

        it('should include structured layout fragments in the LLM call when provided', async () => {
            callLLM.mockResolvedValueOnce({ content: validTemplateJSON, model: 'gpt-4', usage: {} });

            await extractTemplateFromHTML('<div>Layout</div>', [], 'cv.pdf', {}, {
                layoutAnalysis: {
                    headerHtml: '<div>Header</div>',
                    contentHtml: '<div>Content</div>',
                    footerHtml: '<div>Footer</div>',
                    stylesheet: '.template-page{width:600px;}',
                    metrics: { totalLines: 3 }
                }
            });

            const userMsg = callLLM.mock.calls[0][0][1].content;
            expect(userMsg).toContain('FRAGMENTS DE LAYOUT PRE-DECOUPES');
            expect(userMsg).toContain('Header');
            expect(userMsg).toContain('Footer');
            expect(userMsg).toContain('totalLines');
        });

        it('should omit full raw html from the prompt when it is huge and layout fragments are available', async () => {
            callLLM.mockResolvedValueOnce({ content: validTemplateJSON, model: 'gpt-4', usage: {} });
            const hugeHtml = `<div>${'X'.repeat(30000)}</div>`;

            await extractTemplateFromHTML(hugeHtml, [], 'cv.pdf', {}, {
                layoutAnalysis: {
                    headerHtml: '<div>Header</div>',
                    contentHtml: '<div>Content</div>',
                    footerHtml: '<div>Footer</div>',
                    stylesheet: '.template-page{width:600px;}',
                    metrics: { totalLines: 3 }
                }
            });

            const userMsg = callLLM.mock.calls[0][0][1].content;
            expect(userMsg).toContain('HTML complet omis du prompt');
            expect(userMsg).not.toContain('X'.repeat(1000));
            expect(userMsg).toContain('FRAGMENTS DE LAYOUT PRE-DECOUPES');
        });

        it('should bound layout fragments in the prompt', async () => {
            callLLM.mockResolvedValueOnce({ content: validTemplateJSON, model: 'gpt-4', usage: {} });
            const hugeFragment = 'Y'.repeat(10000);

            await extractTemplateFromHTML('<div>small</div>', [], 'cv.pdf', {}, {
                layoutAnalysis: {
                    headerHtml: hugeFragment,
                    contentHtml: hugeFragment,
                    footerHtml: hugeFragment,
                    stylesheet: hugeFragment,
                    metrics: { totalLines: 3 }
                }
            });

            const userMsg = callLLM.mock.calls[0][0][1].content;
            expect(userMsg.length).toBeLessThan(50000);
            expect(userMsg).toContain('[truncated]');
        });

        it('should fall back to a deterministic layout template when the LLM call fails and layout data exists', async () => {
            callLLM.mockRejectedValueOnce(new Error('Upstream timeout after 120000ms'));

            const result = await extractTemplateFromHTML('<div>Layout</div>', [], 'cv.pdf', { colors: ['#123456'], fonts: ['Inter'] }, {
                layoutAnalysis: {
                    headerHtml: '<header><div>Mehdi Hennad</div></header>',
                    contentHtml: '<main><div>Body content</div></main>',
                    footerHtml: '<footer><div>01 02 03 04 05</div></footer>',
                    stylesheet: '.page { color: #123456; }',
                    imageBlocks: [{ region: 'header', left: 10, top: 10, width: 80, height: 40 }]
                }
            });

            expect(result.success).toBe(true);
            expect(result.model).toBe('deterministic-layout-fallback');
            expect(result.template.headerContent).toContain('-logo-');
            expect(result.template.headerContent).not.toContain('Mehdi Hennad');
            expect(result.template.footerContent).not.toContain('01 02 03 04 05');
            expect(result.template.templateContent).toContain('-name-');
            expect(result.template.templateContent).toContain('-title-');
            expect(result.template.templateContent).toContain('-content-');
            expect(result.template.stylesheet).toContain('.template-layout-fallback');
            expect(result.template.extractedColors).toEqual(['#123456']);
            expect(result.template.extractedFonts).toEqual(['Inter']);
        });

        it('should fall back to deterministic layout extraction when the prompt budget is exceeded before the LLM call', async () => {
            const result = await extractTemplateFromHTML('<div>small</div>', [], 'cv.pdf', { colors: ['#123456'] }, {
                promptBudgetChars: 200,
                layoutAnalysis: {
                    headerHtml: 'H'.repeat(1000),
                    contentHtml: 'C'.repeat(1000),
                    footerHtml: 'F'.repeat(1000),
                    stylesheet: 'S'.repeat(1000),
                    metrics: { totalLines: 3 }
                }
            });

            expect(result.success).toBe(true);
            expect(result.model).toBe('deterministic-layout-fallback');
            expect(callLLM).not.toHaveBeenCalled();
        });

        it('sanitizes returned HTML and stylesheet fragments', async () => {
            callLLM.mockResolvedValueOnce({
                content: JSON.stringify({
                    name: 'Unsafe Template',
                    headerContent: '<div><script>alert(1)</script>Header</div>',
                    templateContent: '<h1>-name-</h1><img src="javascript:alert(1)"><div>-content-</div>',
                    footerContent: '<div onclick="alert(1)">Footer</div>',
                    stylesheet: '@import "https://evil.test/x.css"; body { color: red; }'
                }),
                model: 'gpt-4',
                usage: {}
            });

            const result = await extractTemplateFromHTML('<html>CV</html>');

            expect(result.template.headerContent).not.toContain('<script>');
            expect(result.template.templateContent).not.toContain('javascript:');
            expect(result.template.footerContent).not.toContain('onclick');
            expect(result.template.stylesheet).not.toContain('@import');
        });

        it('replaces extracted candidate text with template placeholders', async () => {
            callLLM.mockResolvedValueOnce({
                content: JSON.stringify({
                    name: 'Candidate Template',
                    headerContent: '<div class="brand">Cabinet Nova</div>',
                    templateContent: [
                        '<section class="hero">',
                        '<h1>Jean Dupont</h1>',
                        '<h2>Senior Product Designer</h2>',
                        '<div class="summary">12 rue de Paris, jean.dupont@example.com, +33 6 00 00 00 00</div>',
                        '<div class="experience"><p>Experience professionnelle detaillee</p></div>',
                        '</section>'
                    ].join(''),
                    stylesheet: 'body{}'
                }),
                model: 'gpt-4',
                usage: {}
            });

            const result = await extractTemplateFromHTML('<html>CV</html>');

            expect(result.template.headerContent).toContain('Cabinet Nova');
            expect(result.template.templateContent).toContain('-name-');
            expect(result.template.templateContent).toContain('-title-');
            expect(result.template.templateContent).toContain('-content-');
            expect(result.template.templateContent).not.toContain('Jean Dupont');
            expect(result.template.templateContent).not.toContain('Senior Product Designer');
            expect(result.template.templateContent).not.toContain('jean.dupont@example.com');
            expect(result.template.templateContent).not.toContain('Experience professionnelle detaillee');
        });
    });

    describe('extractTemplateFromImage', () => {
        it('should call callLLMWithVision and return template', async () => {
            callLLMWithVision.mockResolvedValueOnce({
                content: validTemplateJSON,
                model: 'gpt-4-vision',
                usage: {}
            });

            const result = await extractTemplateFromImage('base64imagedata');

            expect(result.success).toBe(true);
            expect(result.template.name).toBe('Modern Template');
            expect(callLLMWithVision).toHaveBeenCalledTimes(1);
            expect(callLLMWithVision).toHaveBeenCalledWith(
                expect.any(String),
                expect.any(Array),
                expect.objectContaining({
                    operationType: 'Template Extraction Vision Fallback',
                    timeout: STANDARD_TEMPLATE_EXTRACTION_TIMEOUT_MS,
                    userMetadata: expect.objectContaining({
                        actionType: 'template.extract'
                    })
                })
            );
        });

        it('should include text content as context when long enough', async () => {
            callLLMWithVision.mockResolvedValueOnce({ content: validTemplateJSON, model: 'gpt-4-vision', usage: {} });

            const longText = 'A'.repeat(200);
            await extractTemplateFromImage('base64data', longText, 'cv.pdf');

            const userContent = callLLMWithVision.mock.calls[0][1];
            const textParts = userContent.filter(p => p.type === 'text');
            expect(textParts.some(p => p.text.includes('Contexte textuel'))).toBe(true);
        });

        it('should throw on LLM error', async () => {
            callLLMWithVision.mockRejectedValueOnce(new Error('Vision API error'));

            await expect(extractTemplateFromImage('base64data'))
                .rejects.toThrow('Vision API error');
        });
    });

    describe('extractTemplateFromCV (legacy)', () => {
        it('should delegate to extractTemplateFromHTML', async () => {
            callLLM.mockResolvedValueOnce({ content: validTemplateJSON, model: 'gpt-4', usage: {} });

            const result = await extractTemplateFromCV('CV text content', 'legacy.pdf');

            expect(result.success).toBe(true);
            expect(callLLM).toHaveBeenCalledTimes(1);
        });
    });
});
