import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPdfOcrRuntimeService } from '../../services/pdfOcrRuntime.service.js';

describe('pdfOcrRuntime.service', () => {
    let execFileAsync;
    let getPythonCommand;
    let runPythonJson;
    let service;

    beforeEach(() => {
        execFileAsync = vi.fn();
        getPythonCommand = vi.fn().mockResolvedValue('python3');
        runPythonJson = vi.fn().mockResolvedValue({ ok: true });
        service = createPdfOcrRuntimeService({
            execFileAsync,
            getPythonCommand,
            runPythonJson,
            advancedBackend: 'paddleocr',
            scriptPathResolver: (scriptName) => `/scripts/${scriptName}`
        });
    });

    it('reports cli OCR as preferred when required binaries are available', async () => {
        execFileAsync.mockImplementation(async (binary) => {
            if (binary === 'tesseract' || binary === 'pdftoppm' || binary === 'pdfimages') {
                return { stdout: '' };
            }
            throw new Error('unexpected binary');
        });

        await expect(service.getOcrRuntimeDiagnostics()).resolves.toEqual(expect.objectContaining({
            status: 'ok',
            preferredEngine: 'tesseract-cli',
            tesseractCliAvailable: true,
            pdftoppmAvailable: true,
            pdfimagesAvailable: true,
            pythonCommand: 'python3',
            advancedBackend: 'paddleocr',
            advancedBackendAvailable: true,
            advancedBackendStatus: 'ok'
        }));
        expect(runPythonJson).toHaveBeenCalledWith(
            '/scripts/advanced_ocr.py',
            ['--backend', 'paddleocr', '--image', '__healthcheck__', '--healthcheck']
        );
    });

    it('falls back to tesseract.js when cli pipeline is unavailable', async () => {
        execFileAsync.mockRejectedValue(new Error('missing'));

        await expect(service.getOcrRuntimeDiagnostics()).resolves.toEqual(expect.objectContaining({
            status: 'warning',
            preferredEngine: 'tesseract.js',
            tesseractCliAvailable: false,
            pdftoppmAvailable: false,
            pdfimagesAvailable: false,
            advancedBackendAvailable: true,
            advancedBackendStatus: 'ok'
        }));
    });

    it('marks advanced backend as not applicable when cli pipeline is healthy but backend check fails', async () => {
        execFileAsync.mockResolvedValue({ stdout: '' });
        runPythonJson.mockRejectedValue(new Error('backend down'));

        await expect(service.getOcrRuntimeDiagnostics()).resolves.toEqual(expect.objectContaining({
            preferredEngine: 'tesseract-cli',
            advancedBackendAvailable: false,
            advancedBackendStatus: 'not_applicable'
        }));
    });

    it('caches binary availability checks', async () => {
        execFileAsync.mockResolvedValue({ stdout: '' });

        await service.hasTesseractCli();
        await service.hasTesseractCli();

        expect(execFileAsync).toHaveBeenCalledTimes(1);
        expect(execFileAsync).toHaveBeenCalledWith('tesseract', ['--version']);
    });

    it('returns false for advanced backend when disabled', async () => {
        const disabledService = createPdfOcrRuntimeService({
            execFileAsync,
            getPythonCommand,
            runPythonJson,
            advancedBackend: 'none',
            scriptPathResolver: (scriptName) => `/scripts/${scriptName}`
        });

        await expect(disabledService.hasAdvancedOcrBackend()).resolves.toBe(false);
        expect(runPythonJson).not.toHaveBeenCalled();
    });
});
