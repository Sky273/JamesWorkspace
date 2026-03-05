import express from 'express';
import multer from 'multer';
import { authenticateToken, requireAdmin } from '../middleware/auth.middleware.js';
import { validateBody, validateParams, createTemplateSchema } from '../utils/validation.js';
import { templatesCache } from '../services/cache.service.js';
import { safeLog } from '../utils/logger.backend.js';
import { 
    selectWithTimeout, 
    findWithTimeout, 
    createWithTimeout, 
    updateWithTimeout, 
    destroyWithTimeout 
} from '../utils/postgresHelpers.js';
import { extractTemplateFromHTML, extractTemplateFromImage, extractTemplateFromCV } from '../services/templateExtraction.service.js';
import puppeteer from 'puppeteer';

// Configure multer for file uploads (memory storage for template extraction)
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only PDF and Word documents are allowed.'), false);
        }
    }
});

const router = express.Router();

// ============================================
// TEMPLATES ROUTES (PostgreSQL)
// ============================================

// GET /api/templates - Get all templates (with server-side pagination and filters)
router.get('/', authenticateToken, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 100;
        const offset = (page - 1) * limit;
        const { search, status } = req.query;
        
        // Build WHERE clause
        const conditions = [];
        const params = [];
        let paramIndex = 1;
        
        if (status && status !== 'all') {
            conditions.push(`status = $${paramIndex}`);
            params.push(status.toLowerCase());
            paramIndex++;
        }
        
        if (search) {
            conditions.push(`(LOWER(name) LIKE $${paramIndex} OR LOWER(description) LIKE $${paramIndex})`);
            params.push(`%${search.toLowerCase()}%`);
            paramIndex++;
        }
        
        const whereClause = conditions.length > 0 ? conditions.join(' AND ') : '';

        // Get total count first
        const countWhereClause = whereClause ? `WHERE ${whereClause}` : '';
        const countQuery = `SELECT COUNT(*) as total FROM templates ${countWhereClause}`;
        const countResult = await selectWithTimeout('templates', {
            rawQuery: countQuery,
            rawParams: params
        });
        const totalCount = parseInt(countResult[0]?.total || 0);

        // Fetch templates with pagination
        const templates = await selectWithTimeout('templates', {
            where: whereClause,
            params: params,
            orderBy: 'name ASC',
            limit: limit + 1,
            offset: offset
        });

        // Check if there are more records
        const hasMore = templates.length > limit;
        if (hasMore) {
            templates.pop();
        }

        const totalPages = Math.ceil(totalCount / limit);

        // Map to frontend format (using PascalCase for compatibility)
        const mappedTemplates = templates.map(template => ({
            id: template.id,
            Name: template.name,
            Description: template.description,
            Popular: template.popular || false,
            Status: template.status || 'active',
            Tags: template.tags || [],
            previewImage: template.preview_image_url || null,
            HeaderContent: template.header_content || '',
            TemplateContent: template.template_content,
            FooterContent: template.footer_content || '',
            FooterHeight: template.footer_height || 25,
            Stylesheet: template.stylesheet || '',
            lastUpdated: template.updated_at
        }));

        const response = {
            data: mappedTemplates,
            pagination: {
                page,
                limit,
                totalCount,
                totalPages,
                hasMore,
                nextPage: hasMore ? page + 1 : null
            }
        };

        return res.json(response);
    } catch (error) {
        safeLog('error', 'Error fetching templates', { error: error.message });
        return res.status(500).json({ 
            error: 'Failed to fetch templates',
            message: error.message 
        });
    }
});

// GET /api/templates/:id - Get template by ID
router.get('/:id', authenticateToken, validateParams('id'), async (req, res) => {
    try {
        const { id } = req.params;
        const template = await findWithTimeout('templates', id);
        
        // Map to frontend format (using PascalCase for compatibility)
        const mappedTemplate = {
            id: template.id,
            Name: template.name,
            Description: template.description,
            Popular: template.popular || false,
            Status: template.status || 'active',
            Tags: template.tags || [],
            previewImage: template.preview_image_url || null,
            HeaderContent: template.header_content || '',
            TemplateContent: template.template_content || '',
            FooterContent: template.footer_content || '',
            FooterHeight: template.footer_height || 25,
            Stylesheet: template.stylesheet || '',
            lastUpdated: template.updated_at
        };
        
        res.json(mappedTemplate);
    } catch (error) {
        if (error.statusCode === 404) {
            return res.status(404).json({ error: 'Template not found' });
        }
        safeLog('error', 'Error fetching template', { error: error.message, templateId: req.params.id });
        return res.status(500).json({ 
            error: 'Failed to fetch template',
            message: error.message 
        });
    }
});

// POST /api/templates - Create template
router.post('/', authenticateToken, requireAdmin, validateBody(createTemplateSchema), async (req, res) => {
    try {
        templatesCache.invalidate('all_templates');
        
        const templateData = {
            name: req.body.Name,
            description: req.body.Description || null,
            popular: req.body.Popular || false,
            status: (req.body.Status || 'active').toLowerCase(),
            tags: req.body.Tags || [],
            preview_image_url: req.body.PreviewImage || null,
            header_content: req.body.HeaderContent || '',
            template_content: req.body.TemplateContent,
            footer_content: req.body.FooterContent || '',
            footer_height: req.body.FooterHeight || 25,
            stylesheet: req.body.Stylesheet || ''
        };

        const records = await createWithTimeout('templates', [{
            fields: templateData
        }]);
        
        // Map back to frontend format
        const result = records[0];
        res.json({
            id: result.id,
            Name: result.name,
            Description: result.description,
            Popular: result.popular,
            Status: result.status,
            Tags: result.tags,
            PreviewImage: result.preview_image_url,
            HeaderContent: result.header_content,
            TemplateContent: result.template_content,
            FooterContent: result.footer_content,
            FooterHeight: result.footer_height,
            Stylesheet: result.stylesheet,
            LastUpdated: result.updated_at
        });
    } catch (error) {
        if (error.code === '23505') {
            return res.status(400).json({ 
                error: 'Template with this name already exists' 
            });
        }
        safeLog('error', 'Error creating template', { error: error.message });
        return res.status(500).json({ 
            error: 'Failed to create template',
            message: error.message 
        });
    }
});

// PUT /api/templates/:id - Update template
router.put('/:id', authenticateToken, requireAdmin, validateParams('id'), async (req, res) => {
    try {
        templatesCache.invalidate('all_templates');
        
        const { id } = req.params;
        const templateData = {
            name: req.body.Name,
            description: req.body.Description,
            popular: req.body.Popular,
            status: req.body.Status ? req.body.Status.toLowerCase() : undefined,
            tags: req.body.Tags,
            preview_image_url: req.body.PreviewImage,
            header_content: req.body.HeaderContent,
            template_content: req.body.TemplateContent,
            footer_content: req.body.FooterContent,
            footer_height: req.body.FooterHeight,
            stylesheet: req.body.Stylesheet
        };

        // Remove undefined values
        Object.keys(templateData).forEach(key => {
            if (templateData[key] === undefined) {
                delete templateData[key];
            }
        });

        const records = await updateWithTimeout('templates', [{
            id: id,
            fields: templateData
        }]);
        
        // Map back to frontend format
        const result = records[0];
        res.json({
            id: result.id,
            Name: result.name,
            Description: result.description,
            Popular: result.popular,
            Status: result.status,
            Tags: result.tags,
            PreviewImage: result.preview_image_url,
            HeaderContent: result.header_content,
            TemplateContent: result.template_content,
            FooterContent: result.footer_content,
            FooterHeight: result.footer_height,
            Stylesheet: result.stylesheet,
            LastUpdated: result.updated_at
        });
    } catch (error) {
        if (error.statusCode === 404) {
            return res.status(404).json({ error: 'Template not found' });
        }
        if (error.code === '23505') {
            return res.status(400).json({ 
                error: 'Template with this name already exists' 
            });
        }
        safeLog('error', 'Error updating template', { error: error.message, templateId: req.params.id });
        return res.status(500).json({ 
            error: 'Failed to update template',
            message: error.message 
        });
    }
});

// POST /api/templates/extract-from-cv - Extract template from uploaded CV
// Supports DOCX (HTML + images extraction) and PDF (vision-based extraction)
router.post('/extract-from-cv', authenticateToken, requireAdmin, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const { buffer, originalname, mimetype } = req.file;
        let result;
        
        safeLog('info', 'Starting template extraction', { 
            fileName: originalname,
            mimetype,
            fileSize: buffer.length,
            userId: req.user?.id
        });

        if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            // DOCX: Extract HTML with styles and images
            result = await extractFromDOCX(buffer, originalname);
        } else if (mimetype === 'application/pdf') {
            // PDF: Convert to image and use vision analysis
            result = await extractFromPDF(buffer, originalname);
        } else if (mimetype === 'application/msword') {
            return res.status(400).json({ error: 'Old .doc format is not supported. Please convert to .docx or PDF.' });
        } else {
            return res.status(400).json({ error: 'Unsupported file type.' });
        }

        res.json({
            success: true,
            template: result.template,
            model: result.model,
            usage: result.usage,
            extractionMethod: result.extractionMethod
        });

    } catch (error) {
        safeLog('error', 'Template extraction failed', { 
            error: error.message,
            stack: error.stack
        });
        return res.status(500).json({ 
            error: 'Failed to extract template from CV',
            message: error.message 
        });
    }
});

/**
 * Extract template from DOCX file using direct HTML extraction
 * Optimized for speed - no Puppeteer rendering
 */
async function extractFromDOCX(buffer, fileName) {
    const JSZip = (await import('jszip')).default;
    const mammoth = (await import('mammoth')).default;
    
    const startTime = Date.now();
    safeLog('info', 'Starting DOCX template extraction', { fileName, bufferSize: buffer.length });
    
    // Step 1: Extract images and styles from DOCX (fast, parallel)
    const extractedImages = [];
    let extractedStyles = { colors: [], fonts: [] };
    
    try {
        const zip = await JSZip.loadAsync(buffer);
        
        // Extract styles
        const stylesFile = zip.file('word/styles.xml');
        if (stylesFile) {
            const stylesXml = await stylesFile.async('string');
            extractedStyles = parseDocxStyles(stylesXml);
            safeLog('debug', 'Extracted styles from DOCX', extractedStyles);
        }
        
        // Extract all images from word/media folder
        const mediaFiles = Object.keys(zip.files)
            .filter(name => name.startsWith('word/media/'));
            
        for (const mediaPath of mediaFiles) {
            try {
                const file = zip.file(mediaPath);
                if (file) {
                    const imageData = await file.async('base64');
                    const ext = mediaPath.split('.').pop().toLowerCase();
                    const contentType = ext === 'png' ? 'image/png' : 
                                       ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 
                                       ext === 'gif' ? 'image/gif' : 'image/png';
                    
                    extractedImages.push({
                        name: mediaPath.split('/').pop(),
                        base64: imageData,
                        contentType
                    });
                }
            } catch (imgErr) {
                safeLog('warn', 'Failed to extract image', { path: mediaPath, error: imgErr.message });
            }
        }
        
        safeLog('debug', 'Images extracted', { count: extractedImages.length, elapsed: Date.now() - startTime });
    } catch (zipError) {
        safeLog('warn', 'Could not parse DOCX as ZIP', { error: zipError.message });
    }
    
    // Step 2: Convert DOCX to HTML with mammoth
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
                "b => strong",
                "i => em",
                "u => u"
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
        throw new Error('Failed to convert Word document: ' + mammothError.message);
    }
    
    if (htmlContent.length < 50) {
        throw new Error('Could not extract sufficient content from the Word document.');
    }
    
    // Step 3: Direct HTML-based extraction (fast, no Puppeteer)
    const result = await extractTemplateFromHTML(htmlContent, extractedImages, fileName, extractedStyles);
    result.extractionMethod = 'docx-html';
    
    // Inject extracted images into result
    injectExtractedImages(result.template, extractedImages);
    
    // Add extracted styles
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

/**
 * Inject extracted images into template placeholders
 */
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

/**
 * Parse DOCX styles.xml to extract colors and fonts
 */
function parseDocxStyles(stylesXml) {
    const colors = new Set();
    const fonts = new Set();
    
    // Extract colors (format: w:val="RRGGBB" or w:color="RRGGBB")
    const colorRegex = /w:(?:val|color)="([0-9A-Fa-f]{6})"/g;
    let match;
    while ((match = colorRegex.exec(stylesXml)) !== null) {
        const color = match[1].toUpperCase();
        if (color !== '000000' && color !== 'FFFFFF' && color !== 'AUTO') {
            colors.add(`#${color}`);
        }
    }
    
    // Extract fonts (w:ascii="FontName" or w:hAnsi="FontName")
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

/**
 * Extract images from PDF using pdf-lib
 * pdf-lib provides direct access to embedded images in the PDF
 */
async function extractImagesFromPDF(buffer) {
    const extractedImages = [];
    
    try {
        const { PDFDocument } = await import('pdf-lib');
        
        // Load the PDF document
        const pdfDoc = await PDFDocument.load(buffer);
        const pages = pdfDoc.getPages();
        
        safeLog('info', 'Extracting images from PDF', { numPages: pages.length });
        
        // Get all embedded images from the PDF
        // pdf-lib stores images in the document's XObject dictionary
        const pdfObjects = pdfDoc.context.indirectObjects;
        
        for (const [ref, obj] of pdfObjects) {
            try {
                // Check if this is an image XObject
                if (obj && obj.dict) {
                    const subtype = obj.dict.get(pdfDoc.context.obj('/Subtype'));
                    if (subtype && subtype.toString() === '/Image') {
                        const width = obj.dict.get(pdfDoc.context.obj('/Width'));
                        const height = obj.dict.get(pdfDoc.context.obj('/Height'));
                        
                        if (width && height) {
                            // Try to get the image stream data
                            const stream = obj.getContents ? obj.getContents() : null;
                            
                            if (stream && stream.length > 100) {
                                // Check for JPEG signature (FFD8FF)
                                const isJpeg = stream[0] === 0xFF && stream[1] === 0xD8 && stream[2] === 0xFF;
                                
                                if (isJpeg) {
                                    const base64 = Buffer.from(stream).toString('base64');
                                    
                                    extractedImages.push({
                                        name: `pdf_image_${extractedImages.length + 1}`,
                                        base64,
                                        contentType: 'image/jpeg',
                                        width: width.numberValue || 0,
                                        height: height.numberValue || 0
                                    });
                                    
                                    safeLog('info', 'Extracted JPEG image from PDF', {
                                        name: `pdf_image_${extractedImages.length}`,
                                        width: width.numberValue,
                                        height: height.numberValue,
                                        sizeKB: Math.round(base64.length / 1024)
                                    });
                                }
                                // Check for PNG signature (89504E47)
                                else if (stream[0] === 0x89 && stream[1] === 0x50 && stream[2] === 0x4E && stream[3] === 0x47) {
                                    const base64 = Buffer.from(stream).toString('base64');
                                    
                                    extractedImages.push({
                                        name: `pdf_image_${extractedImages.length + 1}`,
                                        base64,
                                        contentType: 'image/png',
                                        width: width.numberValue || 0,
                                        height: height.numberValue || 0
                                    });
                                    
                                    safeLog('info', 'Extracted PNG image from PDF', {
                                        name: `pdf_image_${extractedImages.length}`,
                                        width: width.numberValue,
                                        height: height.numberValue,
                                        sizeKB: Math.round(base64.length / 1024)
                                    });
                                }
                            }
                        }
                    }
                }
            } catch (objError) {
                // Skip objects that can't be processed
                safeLog('debug', 'Could not process PDF object', { error: objError.message });
            }
        }
        
        // If no images found with pdf-lib, log for debugging
        if (extractedImages.length === 0) {
            safeLog('debug', 'No standard images found in PDF, images may be in a different format');
        }
        
    } catch (error) {
        safeLog('warn', 'PDF image extraction failed', { error: error.message, stack: error.stack?.substring(0, 500) });
    }
    
    return extractedImages;
}

/**
 * Extract template from PDF file using vision analysis
 */
async function extractFromPDF(buffer, fileName) {
    let browser = null;
    
    try {
        // First, extract text for context
        let textContent = '';
        try {
            const pdfParse = (await import('pdf-parse')).default;
            const pdfData = await pdfParse(buffer);
            textContent = pdfData.text;
        } catch (textError) {
            safeLog('warn', 'PDF text extraction failed, continuing with vision only', { error: textError.message });
        }
        
        // Extract images from PDF
        const extractedImages = await extractImagesFromPDF(buffer);
        safeLog('info', 'PDF image extraction complete', { imageCount: extractedImages.length });
        
        // Convert PDF to image using Puppeteer
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
        
        // Listen for console messages from the page
        page.on('console', msg => {
            safeLog('debug', `PDF Page Console [${msg.type()}]: ${msg.text()}`);
        });
        
        page.on('pageerror', error => {
            safeLog('error', 'PDF Page Error', { error: error.message });
        });
        
        // Set viewport for good quality
        await page.setViewport({ width: 1200, height: 1600, deviceScaleFactor: 2 });
        
        // Create a data URL from the PDF buffer
        const pdfBase64 = buffer.toString('base64');
        safeLog('debug', 'PDF converted to base64', { base64Length: pdfBase64.length });
        
        // Use PDF.js to render the PDF in the browser
        // Using PDF.js 3.x which has better compatibility with Puppeteer
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
                            // Set worker
                            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
                            
                            statusEl.textContent = 'Decoding PDF data...';
                            console.log('Starting PDF render...');
                            
                            const pdfBase64 = '${pdfBase64}';
                            const pdfData = atob(pdfBase64);
                            const pdfArray = new Uint8Array(pdfData.length);
                            for (let i = 0; i < pdfData.length; i++) {
                                pdfArray[i] = pdfData.charCodeAt(i);
                            }
                            
                            statusEl.textContent = 'Loading PDF document...';
                            console.log('PDF data decoded, length:', pdfArray.length);
                            
                            const loadingTask = pdfjsLib.getDocument({ data: pdfArray });
                            const pdf = await loadingTask.promise;
                            console.log('PDF loaded, pages:', pdf.numPages);
                            
                            statusEl.textContent = 'Rendering page 1...';
                            const pdfPage = await pdf.getPage(1);
                            
                            const scale = 2;
                            const viewport = pdfPage.getViewport({ scale: scale });
                            
                            const canvas = document.getElementById('canvas');
                            const context = canvas.getContext('2d');
                            canvas.height = viewport.height;
                            canvas.width = viewport.width;
                            
                            console.log('Canvas size:', canvas.width, 'x', canvas.height);
                            
                            const renderContext = {
                                canvasContext: context,
                                viewport: viewport
                            };
                            
                            await pdfPage.render(renderContext).promise;
                            
                            statusEl.style.display = 'none';
                            console.log('PDF rendered successfully');
                            window.pdfRendered = true;
                        } catch (err) {
                            console.error('PDF render error:', err);
                            statusEl.textContent = 'Error: ' + (err.message || String(err));
                            window.pdfError = err.message || String(err);
                        }
                    }
                    
                    // Wait for PDF.js to load then render
                    if (typeof pdfjsLib !== 'undefined') {
                        renderPDF();
                    } else {
                        window.pdfError = 'PDF.js library failed to load';
                    }
                </script>
            </body>
            </html>
        `, { waitUntil: 'networkidle0', timeout: 60000 });
        
        // Wait for PDF to render
        await page.waitForFunction(() => window.pdfRendered || window.pdfError, { timeout: 120000 }); // 2 minutes timeout
        
        // Check for errors
        const pdfError = await page.evaluate(() => window.pdfError);
        if (pdfError) {
            throw new Error(`PDF rendering failed: ${pdfError}`);
        }
        
        // Get canvas dimensions
        const canvasDimensions = await page.evaluate(() => {
            const canvas = document.getElementById('canvas');
            return { width: canvas.width, height: canvas.height };
        });
        
        // Take screenshot of the canvas
        const canvasElement = await page.$('#canvas');
        const imageBuffer = await canvasElement.screenshot({ type: 'png' });
        const imageBase64 = imageBuffer.toString('base64');
        
        safeLog('info', 'PDF converted to image', {
            imageSize: Math.round(imageBase64.length / 1024) + 'KB',
            dimensions: canvasDimensions
        });
        
        await browser.close();
        browser = null;
        
        // Call the vision-based extraction service with extracted images
        const result = await extractTemplateFromImage(imageBase64, textContent, fileName, extractedImages);
        result.extractionMethod = 'pdf-vision';
        
        // Add extracted images to result if LLM didn't include them
        if (extractedImages.length > 0 && result.template) {
            // Replace logo placeholders with actual images
            const logoImage = extractedImages[0];
            const logoBase64 = `data:${logoImage.contentType};base64,${logoImage.base64}`;
            
            if (result.template.headerContent) {
                // Replace various logo placeholder patterns
                result.template.headerContent = result.template.headerContent
                    .replace(/<img[^>]*src=['"]logo\.png['"][^>]*>/gi, `<img src="${logoBase64}" alt="Logo" class="template-logo" style="max-height:60px;">`)
                    .replace(/<img[^>]*src=['"][^'"]*logo[^'"]*['"][^>]*>/gi, `<img src="${logoBase64}" alt="Logo" class="template-logo" style="max-height:60px;">`)
                    .replace(/\[LOGO\]/gi, `<img src="${logoBase64}" alt="Logo" class="template-logo" style="max-height:60px;">`)
                    .replace(/-logo-/gi, `<img src="${logoBase64}" alt="Logo" class="template-logo" style="max-height:60px;">`);
            }
            
            if (result.template.templateContent) {
                result.template.templateContent = result.template.templateContent
                    .replace(/<img[^>]*src=['"]logo\.png['"][^>]*>/gi, `<img src="${logoBase64}" alt="Logo" class="template-logo" style="max-height:60px;">`)
                    .replace(/<img[^>]*src=['"][^'"]*logo[^'"]*['"][^>]*>/gi, `<img src="${logoBase64}" alt="Logo" class="template-logo" style="max-height:60px;">`)
                    .replace(/\[LOGO\]/gi, `<img src="${logoBase64}" alt="Logo" class="template-logo" style="max-height:60px;">`)
                    .replace(/-logo-/gi, `<img src="${logoBase64}" alt="Logo" class="template-logo" style="max-height:60px;">`);
            }
            
            safeLog('info', 'Replaced logo placeholders with extracted image');
        }
        
        return result;
        
    } catch (error) {
        if (browser) {
            await browser.close();
        }
        safeLog('error', 'PDF vision extraction failed', { error: error.message });
        
        // Fallback to text-only extraction
        safeLog('info', 'Falling back to text-only extraction');
        try {
            const pdfParse = (await import('pdf-parse')).default;
            const pdfData = await pdfParse(buffer);
            if (pdfData.text && pdfData.text.trim().length > 50) {
                const result = await extractTemplateFromCV(pdfData.text, fileName);
                result.extractionMethod = 'pdf-text-fallback';
                return result;
            }
        } catch (fallbackError) {
            safeLog('error', 'Fallback extraction also failed', { error: fallbackError.message });
        }
        
        throw error;
    }
}

// DELETE /api/templates/:id - Delete template
router.delete('/:id', authenticateToken, requireAdmin, validateParams('id'), async (req, res) => {
    try {
        const { id } = req.params;
        
        templatesCache.invalidate('all_templates');
        await destroyWithTimeout('templates', [id]);
        
        res.json({ message: 'Template deleted successfully' });
    } catch (error) {
        if (error.statusCode === 404) {
            return res.status(404).json({ error: 'Template not found' });
        }
        safeLog('error', 'Error deleting template', { error: error.message, templateId: req.params.id });
        return res.status(500).json({ 
            error: 'Failed to delete template',
            message: error.message 
        });
    }
});

export default router;
