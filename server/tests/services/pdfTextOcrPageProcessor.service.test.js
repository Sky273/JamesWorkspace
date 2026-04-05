import { describe, expect, it, vi } from 'vitest';
import { createPdfOcrPageProcessor } from '../../services/pdfTextOcrPageProcessor.service.js';

function createHarness() {
    const fsMock = {
        unlink: vi.fn().mockResolvedValue(undefined),
        rm: vi.fn().mockResolvedValue(undefined)
    };

    const services = {
        fs: fsMock,
        hasTesseractCli: vi.fn().mockResolvedValue(true),
        hasPdftoppmCli: vi.fn().mockResolvedValue(true),
        hasPdfimagesCli: vi.fn().mockResolvedValue(false),
        renderPdfPageWithPdftoppm: vi.fn().mockResolvedValue('/tmp/rendered-page.png'),
        recognizeWithTesseractCli: vi.fn().mockResolvedValue({
            text: 'Recognized OCR text',
            confidence: 72,
            score: 144,
            engine: 'tesseract-cli',
            psm: '6'
        }),
        preparePythonOcrVariants: vi.fn().mockResolvedValue({
            outputDir: '/tmp/resume-ocr-variants-1',
            variants: [],
            blocks: []
        }),
        recognizeWithAdvancedOcr: vi.fn(),
        extractEmbeddedImagesFromPdf: vi.fn(),
        createCanvasModule: vi.fn(),
        createTesseractWorker: vi.fn(),
        createOcrPageEvaluator: vi.fn().mockReturnValue({
            recordCandidate: vi.fn(),
            getBestVariant: vi.fn(() => ({
                text: 'Recognized OCR text',
                confidence: 72,
                score: 144,
                engine: 'tesseract-cli',
                psm: '6',
                variant: 'pdftoppm-page'
            })),
            shouldStopExploration: vi.fn(() => false),
            considerCandidate: vi.fn()
        }),
        recognizeBlockSequence: vi.fn(),
        createOcrVariantBuffers: vi.fn(),
        writeTempVariantBuffer: vi.fn()
    };

    const processor = createPdfOcrPageProcessor({
        settings: {
            maxScannedOcrPages: 10,
            maxOcrRenderPixels: 4_000_000,
            minOcrTextLength: 1,
            advancedOcrTriggerTextLength: 200,
            ocrRenderScale: 1,
            advancedOcrBackend: 'none',
            embeddedImageTriggerTextLength: 100,
            embeddedImageStrongTextLength: 100,
            maxEmbeddedImagesPerPage: 0,
            maxVariantsPerPage: 5,
            maxOcrTimePerPageMs: 10_000,
            earlyAcceptScore: 1_000
        },
        workerRef: { current: null },
        callbacks: {},
        services,
        heuristics: {
            locateInkBoundingBox: vi.fn(),
            calculateOcrResultScore: vi.fn((text, confidence) => (text?.length || 0) + (confidence || 0)),
            getRecognizedTextLength: vi.fn((candidate) => candidate?.text?.trim().length || 0),
            calculateOcrCandidateQuality: vi.fn((text, confidence) => (text?.length || 0) + (confidence || 0)),
            createOcrCandidate: vi.fn((variant, recognition) => ({ variant, ...recognition })),
            calculateBlockSequenceScore: vi.fn(() => 0),
            createBlockSequenceText: vi.fn(() => '')
        }
    });

    return { fsMock, services, processor };
}

describe('pdfTextOcrPageProcessor.service', () => {
    it('removes the python OCR output directory in the nominal CLI flow', async () => {
        const { fsMock, services, processor } = createHarness();
        const state = {
            ocrPageCount: 0,
            ocrUsed: false,
            totalOcrConfidence: 0,
            failedOcrPages: 0,
            recentResults: []
        };

        await expect(processor({
            page: {},
            pageNum: 3,
            buffer: Buffer.from('pdf'),
            state
        })).resolves.toBe('Recognized OCR text\n\n');

        expect(services.renderPdfPageWithPdftoppm).toHaveBeenCalledTimes(1);
        expect(services.preparePythonOcrVariants).toHaveBeenCalledTimes(1);
        expect(fsMock.rm).toHaveBeenCalledWith('/tmp/resume-ocr-variants-1', {
            recursive: true,
            force: true
        });
        expect(fsMock.unlink).toHaveBeenCalledWith('/tmp/rendered-page.png');
    });
});
