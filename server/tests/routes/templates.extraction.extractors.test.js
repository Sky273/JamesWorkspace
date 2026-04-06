/**
 * Tests for template extraction helpers
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockExtractTemplateFromImage = vi.fn();
const mockExtractTemplateFromCV = vi.fn();
const mockReadFile = vi.fn(async (filePath) => {
    const normalized = String(filePath);
    if (normalized.includes('pdf.min.mjs')) {
        return 'pdfjs-module-source';
    }
    if (normalized.includes('pdf.worker.min.mjs')) {
        return 'pdfjs-worker-source';
    }
    return '';
});

const mockPdfParse = vi.fn();
const mockPdfDocumentLoad = vi.fn();
const mockPuppeteerLaunch = vi.fn();

vi.mock('fs/promises', () => ({
    default: {
        readFile: (...args) => mockReadFile(...args)
    },
    readFile: (...args) => mockReadFile(...args)
}));

vi.mock('../../services/templateExtraction.service.js', () => ({
    extractTemplateFromHTML: vi.fn(),
    extractTemplateFromImage: (...args) => mockExtractTemplateFromImage(...args),
    extractTemplateFromCV: (...args) => mockExtractTemplateFromCV(...args)
}));

vi.mock('../../services/batchJobsWorker/textExtraction.js', () => ({
    extractTextFromPDFBuffer: vi.fn()
}));

vi.mock('puppeteer', () => ({
    default: {
        launch: (...args) => mockPuppeteerLaunch(...args)
    }
}));

vi.mock('pdf-parse', () => ({
    default: (...args) => mockPdfParse(...args)
}));

vi.mock('pdf-lib', () => ({
    PDFDocument: {
        load: (...args) => mockPdfDocumentLoad(...args)
    }
}));

vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn()
}));

import { extractFromPDF } from '../../routes/templates/extraction/extractors.js';

describe('template extraction extractors', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        mockPdfParse.mockResolvedValue({
            text: 'PDF text content for extraction'
        });

        mockPdfDocumentLoad.mockResolvedValue({
            getPages: () => [{}],
            context: {
                indirectObjects: [],
                obj: (value) => value
            }
        });

        const page = {
            on: vi.fn(),
            setViewport: vi.fn().mockResolvedValue(undefined),
            setContent: vi.fn().mockImplementation(async (_html, _options) => undefined),
            waitForFunction: vi.fn().mockResolvedValue(undefined),
            evaluate: vi.fn().mockImplementation(async (fn) => {
                const source = String(fn);
                if (source.includes('window.pdfError')) {
                    return undefined;
                }
                return { width: 2400, height: 3200 };
            }),
            $: vi.fn().mockResolvedValue({
                screenshot: vi.fn().mockResolvedValue(Buffer.from('png'))
            })
        };

        mockPuppeteerLaunch.mockResolvedValue({
            newPage: vi.fn().mockResolvedValue(page),
            close: vi.fn().mockResolvedValue(undefined)
        });

        mockExtractTemplateFromImage.mockResolvedValue({
            template: { name: 'Extracted template' },
            model: 'mock-model',
            usage: { total_tokens: 1 },
            extractionMethod: 'pdf-vision'
        });
    });

    it('launches chromium without permissive web-security flags', async () => {
        const result = await extractFromPDF(Buffer.from('%PDF-1.7 sample'), 'sample.pdf');

        expect(result.extractionMethod).toBe('pdf-vision');
        expect(mockPuppeteerLaunch).toHaveBeenCalledTimes(1);

        const [launchOptions] = mockPuppeteerLaunch.mock.calls[0];
        expect(launchOptions).toMatchObject({
            headless: true,
            args: expect.arrayContaining([
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage'
            ])
        });
        expect(launchOptions.args).not.toContain('--disable-web-security');
        expect(launchOptions.args).not.toContain('--allow-file-access-from-files');
        expect(mockExtractTemplateFromImage).toHaveBeenCalledWith(
            expect.any(String),
            'PDF text content for extraction',
            'sample.pdf',
            []
        );
    });
});
