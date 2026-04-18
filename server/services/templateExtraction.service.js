/**
 * Template Extraction Service
 * Extracts CV template structure from uploaded CV files using LLM
 * Supports both HTML/layout analysis and visual PDF fallback.
 */

import { callLLM, callLLMWithVision } from './llm.service.js';
import { safeLog } from '../utils/logger.backend.js';
import { LLM_OPERATION_TIMEOUT_MS } from '../config/constants.js';
import {
    buildFallbackTemplateFromLayout,
    processTemplateExtractionResponse
} from './templateExtractionFallback.service.js';
import {
    buildTemplateExtractionUserInstruction,
    buildTemplateVisionUserContent
} from './templateExtractionPrompt.service.js';

const TEMPLATE_EXTRACTION_OPERATION_TYPE = 'Template Extraction';
const TEMPLATE_EXTRACTION_VISION_OPERATION_TYPE = 'Template Extraction Vision Fallback';
const TEMPLATE_EXTRACTION_TIMEOUT_MS = LLM_OPERATION_TIMEOUT_MS;
const DEFAULT_TEMPLATE_EXTRACTION_PROMPT_BUDGET_CHARS = Number.parseInt(process.env.TEMPLATE_EXTRACTION_PROMPT_BUDGET_CHARS || '50000', 10);
const HTML_EXTRACTION_PROMPT = [
    'Tu es un expert en creation de templates de CV reutilisables.',
    '',
    "TACHE : convertir le HTML/CSS d'un CV en template VIDE reutilisable.",
    '',
    'REGLES CRITIQUES :',
    '1. AUCUNE information personnelle (pas de nom, email, telephone, adresse, dates, entreprises, ecoles)',
    '2. AUCUN contenu de CV (pas de titres de sections comme "Competences", "Experiences", etc.)',
    '3. UN SEUL placeholder -content- pour TOUT le corps du CV',
    '',
    'STRUCTURE DU TEMPLATE :',
    '1. HEADER : en-tete avec logo/nom de societe -> headerContent (remplacer le logo par -logo-)',
    '2. FOOTER : pied de page societe -> footerContent (garder les infos societe non personnelles)',
    '3. CORPS : structure MINIMALISTE avec 3 placeholders UNIQUEMENT :',
    '   - -name- : nom du candidat',
    '   - -title- : titre/poste',
    '   - -content- : UN SEUL bloc pour TOUT le contenu (pas de sections separees)',
    '',
    'IMPORTANT :',
    '- Conserve la mise en page, les espacements, les couleurs et les polices quand ils sont visibles',
    '- Si des fragments header/content/footer sont fournis, utilise-les comme point de depart prioritaire',
    '- Les images/logo peuvent etre conservees en base64 ou remplacees par -logo-',
    '',
    'Tu DOIS retourner un JSON avec TOUS ces champs :',
    '{',
    '  "name": "string - nom du template",',
    '  "description": "string - description du style",',
    '  "headerContent": "string - HTML du header avec -logo-",',
    '  "templateContent": "string - HTML minimaliste avec -name-, -title-, -content-",',
    '  "footerContent": "string - HTML du footer",',
    '  "stylesheet": "string - CSS complet",',
    '  "footerHeight": 25,',
    '  "tags": ["tag1", "tag2"],',
    '  "extractedColors": ["#color1"],',
    '  "extractedFonts": ["font1"]',
    '}',
    '',
    'Reponds UNIQUEMENT avec le JSON, sans texte avant ou apres.'
].join('\n');

const VISION_EXTRACTION_PROMPT = [
    'Tu es un expert en creation de templates de CV reutilisables.',
    '',
    "TACHE : analyser cette image de CV et creer un template HTML/CSS VIDE (sans contenu).",
    '',
    'REGLES CRITIQUES :',
    '1. AUCUNE information personnelle (pas de nom, email, telephone, adresse, dates, entreprises, ecoles)',
    '2. AUCUN contenu de CV',
    '3. UN SEUL placeholder -content- pour TOUT le corps du CV',
    '4. Pour les logos/images, utilise le placeholder : -logo-',
    '',
    'Retourne UNIQUEMENT un JSON avec les champs name, description, headerContent, templateContent, footerContent, stylesheet, footerHeight, tags, extractedColors, extractedFonts.'
].join('\n');

export async function extractTemplateFromHTML(htmlContent, images = [], fileName = 'cv.docx', extractedStyles = {}, options = {}) {
    try {
        safeLog('info', 'Starting HTML-based template extraction', {
            htmlLength: htmlContent?.length,
            imageCount: images.length,
            fileName,
            hasExtractedStyles: !!extractedStyles.colors?.length,
            hasLayoutAnalysis: !!options.layoutAnalysis
        });
        const promptBudgetChars = options.promptBudgetChars ?? DEFAULT_TEMPLATE_EXTRACTION_PROMPT_BUDGET_CHARS;
        const userInstruction = buildTemplateExtractionUserInstruction({
            fileName,
            htmlContent,
            images,
            extractedStyles,
            layoutAnalysis: options.layoutAnalysis,
            promptBudgetChars
        });

        const response = await callLLM([
            { role: 'system', content: HTML_EXTRACTION_PROMPT },
            { role: 'user', content: userInstruction }
        ], {
            operationType: TEMPLATE_EXTRACTION_OPERATION_TYPE,
            temperature: 0.1,
            max_tokens: options.maxTokens ?? 32000,
            timeout: options.timeout ?? TEMPLATE_EXTRACTION_TIMEOUT_MS,
            userMetadata: {
                actionType: 'template.extract',
                fileName
            }
        });

        return processTemplateExtractionResponse(response, fileName, images);
    } catch (error) {
        safeLog('error', 'HTML template extraction failed', { error: error.message });
        if (options.layoutAnalysis) {
            safeLog('warn', 'Falling back to deterministic layout template extraction', {
                fileName,
                error: error.message,
                timeoutMs: options.timeout ?? TEMPLATE_EXTRACTION_TIMEOUT_MS
            });
            return buildFallbackTemplateFromLayout(fileName, options.layoutAnalysis, extractedStyles);
        }
        throw error;
    }
}

export async function extractTemplateFromImage(imageBase64, textContent = '', fileName = 'cv.pdf', extractedImages = [], options = {}) {
    try {
        safeLog('info', 'Starting vision-based template extraction', {
            imageSize: Math.round(imageBase64.length / 1024) + 'KB',
            hasTextContent: !!textContent,
            fileName,
            extractedImagesCount: extractedImages.length
        });

        const userContent = buildTemplateVisionUserContent({
            imageBase64,
            textContent,
            fileName,
            extractedImages
        });

        const response = await callLLMWithVision(VISION_EXTRACTION_PROMPT, userContent, {
            operationType: TEMPLATE_EXTRACTION_VISION_OPERATION_TYPE,
            temperature: 0.2,
            max_tokens: options.maxTokens ?? 20000,
            timeout: options.timeout ?? TEMPLATE_EXTRACTION_TIMEOUT_MS,
            userMetadata: {
                actionType: 'template.extract',
                fileName
            }
        });

        return processTemplateExtractionResponse(response, fileName, extractedImages);
    } catch (error) {
        safeLog('error', 'Vision template extraction failed', { error: error.message });
        throw error;
    }
}

/**
 * Legacy function for backward compatibility.
 */
export async function extractTemplateFromCV(cvText, fileName = 'cv.pdf', options = {}) {
    safeLog('warn', 'Using legacy text-only extraction - results may be limited');
    return extractTemplateFromHTML(cvText, [], fileName, {}, options);
}
