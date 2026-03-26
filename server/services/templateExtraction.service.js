/**
 * Template Extraction Service
 * Extracts CV template structure from uploaded CV files using LLM
 * Supports both visual analysis (PDF -> image) and HTML extraction (DOCX)
 */

import { callLLM } from './llm.service.js';
import { callLLMWithVision } from './llm.service.js';
import { safeLog } from '../utils/logger.backend.js';

/**
 * Prompt for extracting template from HTML content (DOCX)
 * CRITICAL: This prompt instructs the LLM to PRESERVE the exact HTML structure
 */
const HTML_EXTRACTION_PROMPT = [
    "Tu es un expert en cr?ation de templates de CV r?utilisables.",
    "",
    "T?CHE : convertir le HTML d'un CV en template VIDE r?utilisable.",
    "",
    "R?GLES CRITIQUES :",
    "1. AUCUNE information personnelle (pas de nom, email, t?l?phone, adresse, dates, entreprises, ?coles)",
    "2. AUCUN contenu de CV (pas de titres de sections comme \"Comp?tences\", \"Exp?riences\", etc.)",
    "3. UN SEUL placeholder -content- pour TOUT le corps du CV",
    "",
    "STRUCTURE DU TEMPLATE :",
    "1. HEADER : en-t?te avec logo/nom de soci?t? -> headerContent (remplacer le logo par -logo-)",
    "2. FOOTER : pied de page soci?t? -> footerContent (garder les infos soci?t?)",
    "3. CORPS : structure MINIMALISTE avec 3 placeholders UNIQUEMENT :",
    "   - -name- : nom du candidat",
    "   - -title- : titre/poste",
    "   - -content- : UN SEUL bloc pour TOUT le contenu (pas de sections s?par?es)",
    "",
    "EXEMPLE CORRECT de templateContent :",
    "\"<div class='cv-header'><h1>-name-</h1><h2>-title-</h2></div><div class='cv-body'>-content-</div>\"",
    "",
    "EXEMPLE INCORRECT (? NE PAS faire) :",
    "\"<h3>Contact</h3>-content-<h3>Comp?tences</h3>-content-<h3>Exp?riences</h3>-content-\"",
    "",
    "IMPORTANT :",
    "- Conserve les images base64 (<img src=\"data:...\">) ou remplace-les par -logo-",
    "- Cr?e un stylesheet CSS bas? sur les couleurs et polices observ?es",
    "",
    "Tu DOIS retourner un JSON avec TOUS ces champs :",
    "",
    "{",
    "  \"name\": \"string - nom du template\",",
    "  \"description\": \"string - description du style\",",
    "  \"headerContent\": \"string - HTML du header avec -logo-\",",
    "  \"templateContent\": \"string - HTML minimaliste avec -name-, -title-, -content- (UN SEUL -content-)\",",
    "  \"footerContent\": \"string - HTML du footer\",",
    "  \"stylesheet\": \"string - CSS complet\",",
    "  \"footerHeight\": 25,",
    "  \"tags\": [\"tag1\", \"tag2\"],",
    "  \"extractedColors\": [\"#color1\"],",
    "  \"extractedFonts\": [\"font1\"]",
    "}",
    "",
    "R?ponds UNIQUEMENT avec le JSON, sans texte avant ou apr?s."
].join('\n');

const VISION_EXTRACTION_PROMPT = [
    "Tu es un expert en cr?ation de templates de CV r?utilisables.",
    "",
    "T?CHE : analyser cette image de CV et cr?er un template HTML/CSS VIDE (sans contenu).",
    "",
    "R?GLES CRITIQUES :",
    "1. AUCUNE information personnelle (pas de nom, email, t?l?phone, adresse, dates, entreprises, ?coles)",
    "2. AUCUN contenu de CV (pas de titres de sections comme \"Comp?tences\", \"Exp?riences\", \"Contact\", etc.)",
    "3. UN SEUL placeholder -content- pour TOUT le corps du CV (pas plusieurs -content- s?par?s)",
    "4. Pour les logos/images, utilise le placeholder : -logo-",
    "",
    "STRUCTURE DU TEMPLATE :",
    "1. HEADER : bandeau color? avec logo de soci?t? -> headerContent avec -logo-",
    "2. FOOTER : pied de page soci?t? -> footerContent (garder les infos soci?t?)",
    "3. CORPS : structure MINIMALISTE avec 3 placeholders UNIQUEMENT :",
    "   - -name- : nom du candidat",
    "   - -title- : titre/poste",
    "   - -content- : UN SEUL bloc pour TOUT le contenu",
    "",
    "EXEMPLE CORRECT de templateContent :",
    "\"<div class='cv-header'><h1>-name-</h1><h2>-title-</h2></div><div class='cv-body'>-content-</div>\"",
    "",
    "EXEMPLE INCORRECT (? NE PAS faire) :",
    "\"<h3>Contact</h3>-content-<h3>Comp?tences</h3>-content-<h3>Exp?riences</h3>-content-\"",
    "",
    "ANALYSE L'IMAGE POUR EXTRAIRE :",
    "- les couleurs exactes (#hex) utilis?es",
    "- les polices de caract?res",
    "- les espacements et la mise en page",
    "",
    "Tu DOIS retourner un JSON avec TOUS ces champs :",
    "",
    "{",
    "  \"name\": \"string - nom du template bas? sur la soci?t?\",",
    "  \"description\": \"string - description du style visuel\",",
    "  \"headerContent\": \"string - HTML du header avec -logo-\",",
    "  \"templateContent\": \"string - HTML minimaliste avec -name-, -title-, -content- (UN SEUL -content-)\",",
    "  \"footerContent\": \"string - HTML du footer (coordonn?es soci?t? autoris?es)\",",
    "  \"stylesheet\": \"string - CSS complet avec couleurs exactes\",",
    "  \"footerHeight\": 25,",
    "  \"tags\": [\"tag1\", \"tag2\"],",
    "  \"extractedColors\": [\"#hex1\", \"#hex2\"],",
    "  \"extractedFonts\": [\"font1\", \"font2\"]",
    "}",
    "",
    "R?ponds UNIQUEMENT avec le JSON."
].join('\n');
/**
 * Extract template from DOCX HTML content
 * @param {string} htmlContent - HTML extracted from DOCX with styles
 * @param {Array} images - Array of extracted images {name, base64, contentType}
 * @param {string} fileName - Original file name
 * @param {Object} extractedStyles - Colors and fonts extracted from styles.xml
 * @returns {Promise<Object>} - Extracted template
 */
export async function extractTemplateFromHTML(htmlContent, images = [], fileName = 'cv.docx', extractedStyles = {}) {
    try {
        safeLog('info', 'Starting HTML-based template extraction', {
            htmlLength: htmlContent?.length,
            imageCount: images.length,
            fileName,
            hasExtractedStyles: !!extractedStyles.colors?.length
        });

        // Build context with images info
        let imageContext = '';
        if (images.length > 0) {
            imageContext = '\n\n=== IMAGES DU DOCUMENT (À CONSERVER INTÉGRALEMENT) ===\n';
            imageContext += 'Ces images sont déjà incluses dans le HTML ci-dessus sous forme de balises <img src="data:...">.\n';
            imageContext += 'Tu DOIS les conserver EXACTEMENT comme elles apparaissent dans le HTML.\n\n';
            images.forEach((img, idx) => {
                imageContext += `Image ${idx + 1}: ${img.name} (${img.contentType}, ${Math.round(img.base64.length / 1024)}KB)\n`;
            });
        }

        // Add extracted styles info to help LLM
        let stylesContext = '';
        if (extractedStyles.colors?.length > 0 || extractedStyles.fonts?.length > 0) {
            stylesContext = '\n\n=== STYLES EXTRAITS DU DOCUMENT ===\n';
            if (extractedStyles.colors?.length > 0) {
                stylesContext += `Couleurs détectées: ${extractedStyles.colors.join(', ')}\n`;
            }
            if (extractedStyles.fonts?.length > 0) {
                stylesContext += `Polices détectées: ${extractedStyles.fonts.join(', ')}\n`;
            }
            stylesContext += 'Utilise ces couleurs et polices dans le CSS généré.\n';
        }

        // Build user instruction with full HTML content including images
        const userInstruction = `Voici le HTML du CV "${fileName}" à convertir en template:

${htmlContent}
${imageContext}${stylesContext}

Retourne le JSON du template avec tous les champs requis (name, description, headerContent, templateContent, footerContent, stylesheet, footerHeight, tags, extractedColors, extractedFonts).`;

        const messages = [
            {
                role: 'system',
                content: HTML_EXTRACTION_PROMPT
            },
            {
                role: 'user',
                content: userInstruction
            }
        ];

        const response = await callLLM(messages, {
            temperature: 0.1,
            max_tokens: 32000 // Large for base64 images
        });

        return processLLMResponse(response, fileName, images);

    } catch (error) {
        safeLog('error', 'HTML template extraction failed', { error: error.message });
        throw error;
    }
}

/**
 * Extract template from PDF image using vision analysis
 * @param {string} imageBase64 - Base64 encoded image of the PDF page
 * @param {string} textContent - Optional text content for context
 * @param {string} fileName - Original file name
 * @param {Array} extractedImages - Images extracted from the PDF
 * @returns {Promise<Object>} - Extracted template
 */
export async function extractTemplateFromImage(imageBase64, textContent = '', fileName = 'cv.pdf', extractedImages = []) {
    try {
        safeLog('info', 'Starting vision-based template extraction', {
            imageSize: Math.round(imageBase64.length / 1024) + 'KB',
            hasTextContent: !!textContent,
            fileName,
            extractedImagesCount: extractedImages.length
        });

        // Build instruction text
        let instructionText = `Analyse cette image de CV (${fileName}) et crée un template HTML/CSS qui reproduit fidèlement son style visuel.`;
        
        // If we have extracted images, tell the LLM to use placeholders
        if (extractedImages.length > 0) {
            instructionText += `\n\nIMPORTANT: ${extractedImages.length} image(s) ont été extraites du PDF. Pour les logos/images, utilise le placeholder -logo- dans le HTML. Ces images seront automatiquement insérées après.`;
        }

        // Build message with image for vision model
        const userContent = [
            {
                type: 'image_url',
                image_url: {
                    url: `data:image/png;base64,${imageBase64}`,
                    detail: 'high'
                }
            },
            {
                type: 'text',
                text: instructionText
            }
        ];

        // Add text content for additional context if available
        if (textContent && textContent.length > 100) {
            userContent.push({
                type: 'text',
                text: `\n\nContexte textuel du CV (pour référence):\n${textContent.substring(0, 3000)}`
            });
        }

        const response = await callLLMWithVision(
            VISION_EXTRACTION_PROMPT,
            userContent,
            {
                temperature: 0.2,
                max_tokens: 20000
            }
        );

        return processLLMResponse(response, fileName, extractedImages);

    } catch (error) {
        safeLog('error', 'Vision template extraction failed', { error: error.message });
        throw error;
    }
}

/**
 * Process LLM response and validate template data
 * @param {Object} response - LLM response
 * @param {string} fileName - Original file name
 * @param {Array} images - Optional images to include
 * @returns {Object} - Processed template result
 */
function processLLMResponse(response, fileName, images = []) {
    if (!response || !response.content) {
        throw new Error('LLM returned empty response');
    }

    // Parse JSON response
    let templateData;
    try {
        let cleanContent = response.content.trim();
        
        // Log full response for debugging
        safeLog('debug', 'LLM response content', { 
            contentLength: cleanContent.length,
            content: cleanContent.substring(0, 2000)
        });
        
        // Remove markdown code blocks if present
        if (cleanContent.startsWith('```json')) {
            cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (cleanContent.startsWith('```')) {
            cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }
        
        templateData = JSON.parse(cleanContent);
    } catch (parseError) {
        safeLog('error', 'Failed to parse LLM response', { 
            error: parseError.message,
            responsePreview: response.content.substring(0, 1000)
        });
        throw new Error('Failed to parse template extraction response');
    }

    // Validate and provide defaults for missing fields
    if (!templateData.name) {
        templateData.name = `Template extrait - ${fileName}`;
    }
    
    if (!templateData.templateContent) {
        safeLog('error', 'LLM did not provide templateContent', { response: JSON.stringify(templateData).substring(0, 500) });
        throw new Error('LLM did not provide templateContent - extraction failed');
    }
    
    // Provide default stylesheet if missing
    if (!templateData.stylesheet) {
        safeLog('warn', 'LLM did not provide stylesheet, using default');
        templateData.stylesheet = `
/* Default stylesheet - customize as needed */
body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
.candidate-name { font-size: 24px; font-weight: bold; color: #2563eb; margin-bottom: 5px; }
.candidate-title { font-size: 18px; color: #64748b; margin-bottom: 20px; }
.cv-content { margin-top: 20px; }
h1, h2, h3 { color: #1e40af; }
        `.trim();
    }

    // Only add placeholders if they are completely missing - don't override LLM's structure
    // The LLM should have placed them correctly based on the original document structure
    if (!templateData.templateContent.includes('-content-')) {
        safeLog('warn', 'LLM did not include -content- placeholder, adding at end');
        templateData.templateContent += '\n<div class="cv-content">-content-</div>';
    }
    if (!templateData.templateContent.includes('-name-')) {
        safeLog('warn', 'LLM did not include -name- placeholder, adding at start');
        templateData.templateContent = '<div class="candidate-name">-name-</div>\n' + templateData.templateContent;
    }
    if (!templateData.templateContent.includes('-title-')) {
        safeLog('warn', 'LLM did not include -title- placeholder, adding after name');
        // Try to add after -name- if possible
        if (templateData.templateContent.includes('-name-')) {
            templateData.templateContent = templateData.templateContent.replace(
                /-name-/,
                '-name-</div>\n<div class="candidate-title">-title-'
            );
        } else {
            templateData.templateContent = '<div class="candidate-title">-title-</div>\n' + templateData.templateContent;
        }
    }

    // Replace logo placeholders with actual images if available
    // This handles cases where the LLM couldn't include the full base64 in its response
    if (images.length > 0) {
        const logoImage = images[0];
        const logoBase64 = `data:${logoImage.contentType};base64,${logoImage.base64}`;
        
        // Check in headerContent
        if (templateData.headerContent) {
            if (templateData.headerContent.includes('[LOGO]')) {
                templateData.headerContent = templateData.headerContent.replace(
                    /\[LOGO\]/g, 
                    `<img src="${logoBase64}" alt="Logo" class="template-logo" style="max-height:60px;">`
                );
            }
            if (templateData.headerContent.includes('[LOGO CABINET]')) {
                templateData.headerContent = templateData.headerContent.replace(
                    /\[LOGO CABINET\]/g,
                    `<img src="${logoBase64}" alt="Logo" class="template-logo" style="max-height:60px;">`
                );
            }
        }
        
        // Also check in templateContent for logo placeholders
        if (templateData.templateContent.includes('[LOGO]')) {
            templateData.templateContent = templateData.templateContent.replace(
                /\[LOGO\]/g,
                `<img src="${logoBase64}" alt="Logo" class="template-logo" style="max-height:60px;">`
            );
        }
    }

    // Set defaults
    templateData.headerContent = templateData.headerContent || '';
    templateData.footerContent = templateData.footerContent || '';
    templateData.footerHeight = templateData.footerHeight || 25;
    templateData.description = templateData.description || `Template extrait depuis ${fileName}`;
    templateData.tags = templateData.tags || ['extrait', 'automatique'];

    safeLog('info', 'Template extraction completed', {
        templateName: templateData.name,
        hasHeader: !!templateData.headerContent,
        hasFooter: !!templateData.footerContent,
        stylesheetLength: templateData.stylesheet?.length,
        extractedColors: templateData.extractedColors,
        extractedFonts: templateData.extractedFonts
    });

    return {
        success: true,
        template: templateData,
        model: response.model,
        usage: response.usage
    };
}

/**
 * Legacy function for backward compatibility
 * @deprecated Use extractTemplateFromHTML or extractTemplateFromImage instead
 */
export async function extractTemplateFromCV(cvText, fileName = 'cv.pdf') {
    safeLog('warn', 'Using legacy text-only extraction - results may be limited');
    
    // Fall back to HTML extraction with text content
    return extractTemplateFromHTML(cvText, [], fileName);
}
