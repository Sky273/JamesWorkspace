const DEFAULT_ADVANCED_OCR_BACKEND = process.env.OCR_ADVANCED_BACKEND || 'none';
const PYTHON_CANDIDATES = process.platform === 'win32' ? ['python', 'py'] : ['python3', 'python'];

export function createPdfOcrIoService({
    fs,
    os,
    path,
    execFileAsync,
    hasPdfimagesCli,
    scoreOcrResult,
    advancedBackend = DEFAULT_ADVANCED_OCR_BACKEND,
    pythonCandidates = PYTHON_CANDIDATES,
    cwdProvider = () => process.cwd()
}) {
    let cachedPythonCommand = undefined;

    async function getPythonCommand() {
        if (cachedPythonCommand !== undefined) {
            return cachedPythonCommand;
        }

        for (const candidate of pythonCandidates) {
            try {
                if (candidate === 'py') {
                    await execFileAsync(candidate, ['-3', '--version']);
                } else {
                    await execFileAsync(candidate, ['--version']);
                }
                cachedPythonCommand = candidate;
                return cachedPythonCommand;
            } catch {
                // continue
            }
        }

        cachedPythonCommand = null;
        return cachedPythonCommand;
    }

    async function runPythonJson(scriptPath, args) {
        const python = await getPythonCommand();
        if (!python) {
            throw new Error('Python runtime unavailable');
        }

        const pythonArgs = python === 'py'
            ? ['-3', scriptPath, ...args]
            : [scriptPath, ...args];

        const { stdout } = await execFileAsync(python, pythonArgs, {
            maxBuffer: 20 * 1024 * 1024
        });

        return JSON.parse(stdout.trim());
    }

    async function extractEmbeddedImagesFromPdf(buffer, pageNum) {
        if (!(await hasPdfimagesCli())) {
            return [];
        }

        const basePath = path.join(
            os.tmpdir(),
            `resume-ocr-images-${process.pid}-${Date.now()}-${pageNum}`
        );
        const pdfPath = `${basePath}.pdf`;
        const outputPrefix = `${basePath}-img`;

        try {
            await fs.writeFile(pdfPath, buffer);
            await execFileAsync('pdfimages', [
                '-f', String(pageNum),
                '-l', String(pageNum),
                '-png',
                pdfPath,
                outputPrefix
            ], {
                maxBuffer: 10 * 1024 * 1024
            });

            const dir = path.dirname(outputPrefix);
            const prefixName = path.basename(outputPrefix);
            const files = await fs.readdir(dir);
            return files
                .filter((file) => file.startsWith(prefixName) && file.endsWith('.png'))
                .sort((a, b) => a.localeCompare(b))
                .map((file, index) => ({
                    name: `pdfimages-${String(index).padStart(2, '0')}`,
                    path: path.join(dir, file),
                    order: index
                }));
        } catch {
            return [];
        } finally {
            await fs.unlink(pdfPath).catch(() => {});
        }
    }

    async function recognizeWithTesseractCli(tempPath) {
        const psmModes = ['6', '11', '4'];
        let best = { text: '', confidence: 0, score: 0, engine: 'tesseract-cli', psm: null };

        for (const psm of psmModes) {
            const { stdout } = await execFileAsync('tesseract', [
                tempPath,
                'stdout',
                '-l',
                'fra+eng',
                '--psm',
                psm,
                'quiet'
            ], {
                maxBuffer: 10 * 1024 * 1024
            });

            const text = stdout || '';
            const score = scoreOcrResult(text, 0);
            if (score > best.score) {
                best = { text, confidence: 0, score, engine: 'tesseract-cli', psm };
            }
        }

        return best;
    }

    async function preparePythonOcrVariants(imagePath, pageNum) {
        const outputDir = path.join(
            os.tmpdir(),
            `resume-ocr-variants-${process.pid}-${Date.now()}-${pageNum}`
        );
        const scriptPath = path.join(cwdProvider(), 'server', 'scripts', 'prepare_ocr_variants.py');

        try {
            const result = await runPythonJson(scriptPath, [
                '--input', imagePath,
                '--output-dir', outputDir
            ]);
            return {
                variants: result?.variants || [],
                blocks: result?.blocks || []
            };
        } catch {
            return { variants: [], blocks: [] };
        }
    }

    async function recognizeWithAdvancedOcr(tempPath, backend = advancedBackend) {
        if (!backend || backend === 'none') {
            return null;
        }

        const scriptPath = path.join(cwdProvider(), 'server', 'scripts', 'advanced_ocr.py');

        try {
            const result = await runPythonJson(scriptPath, [
                '--image', tempPath,
                '--backend', backend
            ]);

            if (!result?.text) {
                return null;
            }

            return {
                text: result.text,
                confidence: Number(result.confidence) || 0,
                score: scoreOcrResult(result.text, Number(result.confidence) || 0),
                engine: result.engine || backend,
                psm: null
            };
        } catch {
            return null;
        }
    }

    async function renderPdfPageWithPdftoppm(pdfBuffer, pageNum, dpi = 300) {
        const basePath = path.join(
            os.tmpdir(),
            `resume-ocr-render-${process.pid}-${Date.now()}-${pageNum}`
        );
        const pdfPath = `${basePath}.pdf`;
        const outputPrefix = `${basePath}-page`;
        const outputPath = `${outputPrefix}-${pageNum}.png`;

        try {
            await fs.writeFile(pdfPath, pdfBuffer);
            await execFileAsync('pdftoppm', [
                '-f', String(pageNum),
                '-l', String(pageNum),
                '-r', String(dpi),
                '-png',
                pdfPath,
                outputPrefix
            ], {
                maxBuffer: 10 * 1024 * 1024
            });
            return outputPath;
        } finally {
            await fs.unlink(pdfPath).catch(() => {});
        }
    }

    return {
        getPythonCommand,
        runPythonJson,
        extractEmbeddedImagesFromPdf,
        recognizeWithTesseractCli,
        preparePythonOcrVariants,
        recognizeWithAdvancedOcr,
        renderPdfPageWithPdftoppm
    };
}
