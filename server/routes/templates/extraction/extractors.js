import multer from 'multer';
import { safeLog } from '../../../utils/logger.backend.js';
import { extractTemplateFromHTML, extractTemplateFromImage, extractTemplateFromCV } from '../../../services/templateExtraction.service.js';
import { extractTextFromPDFBuffer } from '../../../services/batchJobsWorker/textExtraction.js';
import puppeteer from 'puppeteer';

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        const allowedTypes = [
            'application/pdf',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/msword'
        ];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
            return;
        }
        cb(new Error('Invalid file type. Only PDF and Word documents are allowed.'), false);
    }
});

async function extractFromDOCX(buffer, fileName) {
    const JSZip = (await import('jszip')).default;
    const mammoth = (await import('mammoth')).default;
    const startTime = Date.now();
    safeLog('info', 'Starting DOCX template extraction', { fileName, bufferSize: buffer.length });

    const extractedImages = [];
    let extractedStyles = { colors: [], fonts: [] };

    try {
        const zip = await JSZip.loadAsync(buffer);
        const stylesFile = zip.file('word/styles.xml');
        if (stylesFile) {
            const stylesXml = await stylesFile.async('string');
            extractedStyles = parseDocxStyles(stylesXml);
            safeLog('debug', 'Extracted styles from DOCX', extractedStyles);
        }

        const mediaFiles = Object.keys(zip.files).filter((name) => name.startsWith('word/media/'));
        for (const mediaPath of mediaFiles) {
            try {
                const file = zip.file(mediaPath);
                if (!file) continue;
                const imageData = await file.async('base64');
                const ext = mediaPath.split('.').pop().toLowerCase();
                const contentType = ext === 'png'
                    ? 'image/png'
                    : ext === 'jpg' || ext === 'jpeg'
                        ? 'image/jpeg'
                        : ext === 'gif'
                            ? 'image/gif'
                            : 'image/png';
                extractedImages.push({
                    name: mediaPath.split('/').pop(),
                    base64: imageData,
                    contentType
                });
            } catch (imgErr) {
                safeLog('warn', 'Failed to extract image', { path: mediaPath, error: imgErr.message });
            }
        }

        safeLog('debug', 'Images extracted', { count: extractedImages.length, elapsed: Date.now() - startTime });
    } catch (zipError) {
        safeLog('warn', 'Could not parse DOCX as ZIP', { error: zipError.message });
    }

    let htmlContent = '';
    try {
        const options = {
            buffer,
            convertImage: mammoth.images.imgElement(async (image) => {
                try {
                    const imageBuffer = await image.read();
                    const base64 = imageBuffer.toString('base64');
                    const contentType = image.contentType || 'image/png';
                    return { src: `data:${contentType};base64,${base64}` };
                } catch {
                    return { src: '' };
                }
            }),
            styleMap: [
                "p[style-name='Heading 1'] => h1:fresh",
                "p[style-name='Heading 2'] => h2:fresh",
                "p[style-name='Heading 3'] => h3:fresh",
                "p[style-name='Title'] => h1.title:fresh",
                'b => strong',
                'i => em',
                'u => u'
            ],
            includeDefaultStyleMap: true
        };

        const htmlResult = await mammoth.convertToHtml(options);
        htmlContent = htmlResult.value || '';
        safeLog('info', 'DOCX converted to HTML', {
            htmlLength: htmlContent.length,
            imageCount: extractedImages.length,
            elapsed: Date.now() - startTime
        });
    } catch (mammothError) {
        safeLog('error', 'Mammoth conversion failed', { error: mammothError.message });
        throw new Error(`Failed to convert Word document: ${mammothError.message}`);
    }

    if (htmlContent.length < 50) {
        throw new Error('Could not extract sufficient content from the Word document.');
    }

    const result = await extractTemplateFromHTML(htmlContent, extractedImages, fileName, extractedStyles);
    result.extractionMethod = 'docx-html';
    injectExtractedImages(result.template, extractedImages);

    if (extractedStyles.colors.length > 0 && !result.template.extractedColors?.length) {
        result.template.extractedColors = extractedStyles.colors;
    }
    if (extractedStyles.fonts.length > 0 && !result.template.extractedFonts?.length) {
        result.template.extractedFonts = extractedStyles.fonts;
    }

    safeLog('info', 'DOCX extraction completed', {
        totalElapsed: Date.now() - startTime,
        templateName: result.template?.name
    });

    return result;
}

function injectExtractedImages(template, images) {
    if (!template || images.length === 0) return;

    const logoImage = images[0];
    const logoBase64 = `data:${logoImage.contentType};base64,${logoImage.base64}`;
    const logoTag = `<img src="${logoBase64}" alt="Logo" class="template-logo" style="max-height:60px;">`;

    const replacePlaceholders = (content) => {
        if (!content) return content;
        return content
            .replace(/\[LOGO\]/gi, logoTag)
            .replace(/\[LOGO CABINET\]/gi, logoTag)
            .replace(/-logo-/gi, logoTag)
            .replace(/<img[^>]*src=['"]logo\.png['"][^>]*>/gi, logoTag)
            .replace(/<img[^>]*src=['"][^'"]*placeholder[^'"]*['"][^>]*>/gi, logoTag);
    };

    template.headerContent = replacePlaceholders(template.headerContent);
    template.templateContent = replacePlaceholders(template.templateContent);
    template.footerContent = replacePlaceholders(template.footerContent);
}

function parseDocxStyles(stylesXml) {
    const colors = new Set();
    const fonts = new Set();

    const colorRegex = /w:(?:val|color)="([0-9A-Fa-f]{6})"/g;
    let match;
    while ((match = colorRegex.exec(stylesXml)) !== null) {
        const color = match[1].toUpperCase();
        if (color !== '000000' && color !== 'FFFFFF' && color !== 'AUTO') {
            colors.add(`#${color}`);
        }
    }

    const fontRegex = /w:(?:ascii|hAnsi|cs)="([^"]+)"/g;
    while ((match = fontRegex.exec(stylesXml)) !== null) {
        const font = match[1];
        if (!['Times New Roman', 'Arial', 'Calibri'].includes(font)) {
            fonts.add(font);
        }
    }

    return {
        colors: Array.from(colors).slice(0, 10),
        fonts: Array.from(fonts).slice(0, 5)
    };
}

async function extractImagesFromPDF(buffer) {
    const extractedImages = [];
    try {
        const { PDFDocument } = await import('pdf-lib');
        const pdfDoc = await PDFDocument.load(buffer);
        const pages = pdfDoc.getPages();
        safeLog('info', 'Extracting images from PDF', { numPages: pages.length });

        const pdfObjects = pdfDoc.context.indirectObjects;
        for (const [_ref, obj] of pdfObjects) {
            try {
                if (!obj || !obj.dict) continue;
                const subtype = obj.dict.get(pdfDoc.context.obj('/Subtype'));
                if (!subtype || subtype.toString() !== '/Image') continue;

                const width = obj.dict.get(pdfDoc.context.obj('/Width'));
                const height = obj.dict.get(pdfDoc.context.obj('/Height'));
                if (!width || !height) continue;

                const stream = obj.getContents ? obj.getContents() : null;
                if (!stream || stream.length <= 100) continue;

                const isJpeg = stream[0] === 0xff && stream[1] === 0xd8 && stream[2] === 0xff;
                const isPng = stream[0] === 0x89 && stream[1] === 0x50 && stream[2] === 0x4e && stream[3] === 0x47;
                if (!isJpeg && !isPng) continue;

                const base64 = Buffer.from(stream).toString('base64');
                extractedImages.push({
                    name: `pdf_image_${extractedImages.length + 1}`,
                    base64,
                    contentType: isJpeg ? 'image/jpeg' : 'image/png',
                    width: width.numberValue || 0,
                    height: height.numberValue || 0
                });
            } catch (objError) {
                safeLog('debug', 'Could not process PDF object', { error: objError.message });
            }
        }

        if (extractedImages.length === 0) {
            safeLog('debug', 'No standard images found in PDF, images may be in a different format');
        }
    } catch (error) {
        safeLog('warn', 'PDF image extraction failed', { error: error.message, stack: error.stack?.substring(0, 500) });
    }
    return extractedImages;
}

async function extractPdfText(buffer, fileName) {
    try {
        const pdfParseModule = await import('pdf-parse');
        const pdfParse = typeof pdfParseModule?.default === 'function'
            ? pdfParseModule.default
            : typeof pdfParseModule === 'function'
                ? pdfParseModule
                : typeof pdfParseModule?.pdfParse === 'function'
                    ? pdfParseModule.pdfParse
                    : null;

        if (!pdfParse) {
            throw new Error('pdf-parse module does not expose a callable parser');
        }

        const pdfData = await pdfParse(buffer);
        return pdfData?.text || '';
    } catch (error) {
        safeLog('warn', 'pdf-parse extraction failed, falling back to pdfjs-dist', { fileName, error: error.message });
        return extractTextFromPDFBuffer(buffer);
    }
}

async function extractFromPDF(buffer, fileName) {
    let browser = null;
    try {
        let textContent = '';
        try {
            textContent = await extractPdfText(buffer, fileName);
        } catch (textError) {
            safeLog('warn', 'PDF text extraction failed, continuing with vision only', { error: textError.message });
        }

        const extractedImages = await extractImagesFromPDF(buffer);
        safeLog('info', 'PDF image extraction complete', { imageCount: extractedImages.length });
        safeLog('info', 'Converting PDF to image for vision analysis', {
            bufferSize: buffer.length,
            fileName
        });

        browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-web-security',
                '--allow-file-access-from-files'
            ]
        });

        const page = await browser.newPage();
        page.on('console', (msg) => {
            safeLog('debug', `PDF Page Console [${msg.type()}]: ${msg.text()}`);
        });
        page.on('pageerror', (error) => {
            safeLog('error', 'PDF Page Error', { error: error.message });
        });
        await page.setViewport({ width: 1200, height: 1600, deviceScaleFactor: 2 });

        const pdfBase64 = buffer.toString('base64');
        await page.setContent(`
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { margin: 0; padding: 0; background: white; }
                    #canvas { display: block; }
                    #status { position: absolute; top: 10px; left: 10px; font-family: monospace; font-size: 12px; }
                </style>
            </head>
            <body>
                <div id="status">Loading PDF.js...</div>
                <canvas id="canvas"></canvas>
                <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
                <script>
                    const statusEl = document.getElementById('status');
                    async function renderPDF() {
                        try {
                            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
                            statusEl.textContent = 'Decoding PDF data...';
                            const pdfBase64 = '${pdfBase64}';
                            const pdfData = atob(pdfBase64);
                            const pdfArray = new Uint8Array(pdfData.length);
                            for (let i = 0; i < pdfData.length; i++) {
                                pdfArray[i] = pdfData.charCodeAt(i);
                            }
                            statusEl.textContent = 'Loading PDF document...';
                            const loadingTask = pdfjsLib.getDocument({ data: pdfArray });
                            const pdf = await loadingTask.promise;
                            statusEl.textContent = 'Rendering page 1...';
                            const pdfPage = await pdf.getPage(1);
                            const scale = 2;
                            const viewport = pdfPage.getViewport({ scale: scale });
                            const canvas = document.getElementById('canvas');
                            const context = canvas.getContext('2d');
                            canvas.height = viewport.height;
                            canvas.width = viewport.width;
                            await pdfPage.render({ canvasContext: context, viewport }).promise;
                            statusEl.style.display = 'none';
                            window.pdfRendered = true;
                        } catch (err) {
                            console.error('PDF render error:', err);
                            statusEl.textContent = 'Error: ' + (err.message || String(err));
                            window.pdfError = err.message || String(err);
                        }
                    }
                    if (typeof pdfjsLib !== 'undefined') {
                        renderPDF();
                    } else {
                        window.pdfError = 'PDF.js library failed to load';
                    }
                </script>
            </body>
            </html>
        `, { waitUntil: 'networkidle0', timeout: 60000 });

        await page.waitForFunction(() => window.pdfRendered || window.pdfError, { timeout: 120000 });
        const pdfError = await page.evaluate(() => window.pdfError);
        if (pdfError) {
            throw new Error(`PDF rendering failed: ${pdfError}`);
        }

        const canvasDimensions = await page.evaluate(() => {
            const canvas = document.getElementById('canvas');
            return { width: canvas.width, height: canvas.height };
        });

        const canvasElement = await page.$('#canvas');
        const imageBuffer = await canvasElement.screenshot({ type: 'png' });
        const imageBase64 = imageBuffer.toString('base64');
        safeLog('info', 'PDF converted to image', {
            imageSize: `${Math.round(imageBase64.length / 1024)}KB`,
            dimensions: canvasDimensions
        });

        await browser.close();
        browser = null;

        const result = await extractTemplateFromImage(imageBase64, textContent, fileName, extractedImages);
        result.extractionMethod = 'pdf-vision';

        if (extractedImages.length > 0 && result.template) {
            const logoImage = extractedImages[0];
            const logoBase64Data = `data:${logoImage.contentType};base64,${logoImage.base64}`;
            const replacement = `<img src="${logoBase64Data}" alt="Logo" class="template-logo" style="max-height:60px;">`;
            if (result.template.headerContent) {
                result.template.headerContent = result.template.headerContent
                    .replace(/<img[^>]*src=['"]logo\.png['"][^>]*>/gi, replacement)
                    .replace(/<img[^>]*src=['"][^'"]*logo[^'"]*['"][^>]*>/gi, replacement)
                    .replace(/\[LOGO\]/gi, replacement)
                    .replace(/-logo-/gi, replacement);
            }
            if (result.template.templateContent) {
                result.template.templateContent = result.template.templateContent
                    .replace(/<img[^>]*src=['"]logo\.png['"][^>]*>/gi, replacement)
                    .replace(/<img[^>]*src=['"][^'"]*logo[^'"]*['"][^>]*>/gi, replacement)
                    .replace(/\[LOGO\]/gi, replacement)
                    .replace(/-logo-/gi, replacement);
            }
            safeLog('info', 'Replaced logo placeholders with extracted image');
        }

        return result;
    } catch (error) {
        if (browser) {
            await browser.close();
        }
        safeLog('error', 'PDF vision extraction failed', { error: error.message });
        safeLog('info', 'Falling back to text-only extraction');
        try {
            const fallbackText = await extractPdfText(buffer, fileName);
            if (fallbackText && fallbackText.trim().length > 50) {
                const result = await extractTemplateFromCV(fallbackText, fileName);
                result.extractionMethod = 'pdf-text-fallback';
                return result;
            }
        } catch (fallbackError) {
            safeLog('error', 'Fallback extraction also failed', { error: fallbackError.message });
        }
        throw error;
    }
}

export {
    extractFromDOCX,
    extractFromPDF,
    upload
};
