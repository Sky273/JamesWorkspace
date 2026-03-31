import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPdfOcrIoService } from '../../services/pdfOcrIo.service.js';

describe('pdfOcrIo.service', () => {
    let fsMock;
    let execFileAsync;
    let hasPdfimagesCli;
    let service;

    beforeEach(() => {
        fsMock = {
            writeFile: vi.fn().mockResolvedValue(undefined),
            readdir: vi.fn().mockResolvedValue([]),
            unlink: vi.fn().mockResolvedValue(undefined)
        };
        execFileAsync = vi.fn();
        hasPdfimagesCli = vi.fn().mockResolvedValue(true);

        service = createPdfOcrIoService({
            fs: fsMock,
            os: { tmpdir: () => '/tmp' },
            path: {
                join: (...parts) => parts.join('/'),
                dirname: () => '/tmp',
                basename: () => 'resume-ocr-images-1-img'
            },
            execFileAsync,
            hasPdfimagesCli,
            scoreOcrResult: (text, confidence) => (text?.trim().length || 0) + ((confidence || 0) * 2),
            advancedBackend: 'paddleocr',
            pythonCandidates: ['python3', 'py'],
            cwdProvider: () => '/workspace'
        });
    });

    it('detects and caches the python command', async () => {
        execFileAsync.mockResolvedValueOnce({ stdout: 'Python 3.11' });

        await expect(service.getPythonCommand()).resolves.toBe('python3');
        await expect(service.getPythonCommand()).resolves.toBe('python3');

        expect(execFileAsync).toHaveBeenCalledTimes(1);
        expect(execFileAsync).toHaveBeenCalledWith('python3', ['--version']);
    });

    it('runs python scripts and parses json output', async () => {
        execFileAsync
            .mockResolvedValueOnce({ stdout: 'Python 3.11' })
            .mockResolvedValueOnce({ stdout: '{"ok":true,"value":42}' });

        await expect(service.runPythonJson('/script.py', ['--flag'])).resolves.toEqual({
            ok: true,
            value: 42
        });
    });

    it('extracts embedded images listed by pdfimages output files', async () => {
        fsMock.readdir.mockResolvedValue([
            'resume-ocr-images-1-img-000.png',
            'resume-ocr-images-1-img-001.png',
            'ignore.txt'
        ]);
        execFileAsync.mockResolvedValue({ stdout: '' });

        const result = await service.extractEmbeddedImagesFromPdf(Buffer.from('pdf'), 1);
        expect(result).toHaveLength(2);
        expect(result[0]).toEqual(expect.objectContaining({ name: 'pdfimages-00', order: 0 }));
        expect(fsMock.unlink).toHaveBeenCalled();
    });

    it('returns no embedded images when pdfimages is unavailable', async () => {
        hasPdfimagesCli.mockResolvedValue(false);
        await expect(service.extractEmbeddedImagesFromPdf(Buffer.from('pdf'), 1)).resolves.toEqual([]);
        expect(fsMock.writeFile).not.toHaveBeenCalled();
    });

    it('selects the best tesseract cli psm by score', async () => {
        execFileAsync
            .mockResolvedValueOnce({ stdout: 'short' })
            .mockResolvedValueOnce({ stdout: 'this is a much better extraction' })
            .mockResolvedValueOnce({ stdout: 'mid' });

        await expect(service.recognizeWithTesseractCli('/tmp/page.png')).resolves.toEqual({
            text: 'this is a much better extraction',
            confidence: 0,
            score: 32,
            engine: 'tesseract-cli',
            psm: '11'
        });
    });

    it('returns empty python variants when preparation fails', async () => {
        execFileAsync.mockResolvedValueOnce({ stdout: 'Python 3.11' }).mockRejectedValueOnce(new Error('fail'));

        await expect(service.preparePythonOcrVariants('/tmp/image.png', 2)).resolves.toEqual({
            variants: [],
            blocks: []
        });
    });

    it('recognizes with advanced OCR and normalizes the result', async () => {
        execFileAsync
            .mockResolvedValueOnce({ stdout: 'Python 3.11' })
            .mockResolvedValueOnce({ stdout: '{"text":"OCR text","confidence":80,"engine":"paddleocr"}' });

        await expect(service.recognizeWithAdvancedOcr('/tmp/page.png')).resolves.toEqual({
            text: 'OCR text',
            confidence: 80,
            score: 168,
            engine: 'paddleocr',
            psm: null
        });
    });

    it('renders a pdf page with pdftoppm and removes the temp pdf file', async () => {
        execFileAsync.mockResolvedValue({ stdout: '' });

        await expect(service.renderPdfPageWithPdftoppm(Buffer.from('pdf'), 3, 200))
            .resolves.toContain('-page-3.png');
        expect(fsMock.writeFile).toHaveBeenCalled();
        expect(fsMock.unlink).toHaveBeenCalled();
    });
});
