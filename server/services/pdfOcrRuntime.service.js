export function createPdfOcrRuntimeService({
    execFileAsync,
    getPythonCommand,
    runPythonJson,
    advancedBackend = 'none',
    scriptPathResolver = () => ''
}) {
    let cachedTesseractCliAvailability = null;
    let cachedPdftoppmAvailability = null;
    let cachedPdfimagesAvailability = null;

    async function hasBinary(binary, versionArgs) {
        try {
            await execFileAsync(binary, versionArgs);
            return true;
        } catch {
            return false;
        }
    }

    async function hasTesseractCli() {
        if (cachedTesseractCliAvailability !== null) {
            return cachedTesseractCliAvailability;
        }

        cachedTesseractCliAvailability = await hasBinary('tesseract', ['--version']);
        return cachedTesseractCliAvailability;
    }

    async function hasPdftoppmCli() {
        if (cachedPdftoppmAvailability !== null) {
            return cachedPdftoppmAvailability;
        }

        cachedPdftoppmAvailability = await hasBinary('pdftoppm', ['-v']);
        return cachedPdftoppmAvailability;
    }

    async function hasPdfimagesCli() {
        if (cachedPdfimagesAvailability !== null) {
            return cachedPdfimagesAvailability;
        }

        cachedPdfimagesAvailability = await hasBinary('pdfimages', ['-v']);
        return cachedPdfimagesAvailability;
    }

    async function hasAdvancedOcrBackend(backend = advancedBackend) {
        if (!backend || backend === 'none') {
            return false;
        }

        try {
            const scriptPath = scriptPathResolver('advanced_ocr.py');
            const result = await runPythonJson(scriptPath, ['--backend', backend, '--image', '__healthcheck__', '--healthcheck']);
            return !!result?.ok;
        } catch {
            return false;
        }
    }

    async function getOcrRuntimeDiagnostics() {
        const [tesseractCliAvailable, pdftoppmAvailable, pdfimagesAvailable, pythonCommand] = await Promise.all([
            hasTesseractCli(),
            hasPdftoppmCli(),
            hasPdfimagesCli(),
            getPythonCommand()
        ]);

        let advancedBackendAvailable = false;
        let preferredEngine = 'tesseract.js';
        let advancedBackendStatus = 'not_applicable';

        if (tesseractCliAvailable && pdftoppmAvailable) {
            preferredEngine = 'tesseract-cli';
        }

        if (advancedBackend && advancedBackend !== 'none' && pythonCommand) {
            advancedBackendAvailable = await hasAdvancedOcrBackend(advancedBackend);
            advancedBackendStatus = advancedBackendAvailable
                ? 'ok'
                : (preferredEngine === 'tesseract-cli' ? 'not_applicable' : 'warning');
        } else if (advancedBackend && advancedBackend !== 'none') {
            advancedBackendStatus = preferredEngine === 'tesseract-cli' ? 'not_applicable' : 'warning';
        }

        return {
            status: preferredEngine === 'tesseract-cli' ? 'ok' : 'warning',
            preferredEngine,
            tesseractCliAvailable,
            pdftoppmAvailable,
            pdfimagesAvailable,
            pythonCommand,
            advancedBackend,
            advancedBackendAvailable,
            advancedBackendStatus,
            notes: preferredEngine === 'tesseract-cli'
                ? (
                    advancedBackend && advancedBackend !== 'none' && !advancedBackendAvailable
                        ? 'CLI OCR pipeline available; advanced OCR fallback unavailable'
                        : 'CLI OCR pipeline available'
                )
                : 'Falling back to tesseract.js OCR pipeline'
        };
    }

    return {
        hasTesseractCli,
        hasPdftoppmCli,
        hasPdfimagesCli,
        hasAdvancedOcrBackend,
        getOcrRuntimeDiagnostics
    };
}
