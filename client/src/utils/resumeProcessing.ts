/**
 * Resume Processing Utilities
 * Text extraction and resume improvement using Claude/OpenAI
 */

import { createAuthOptionsWithCsrf, fetchWithCsrfRetry } from './apiInterceptor';
import logger from './logger.frontend';

async function loadTextExtraction() {
    return import('./textExtraction');
}

export interface ResumeAnalysis {
    name: string;
    title: string;
    globalRating: string;
    skillsRating: string;
    experiencesRating: string;
    educationRating: string;
    atsOptimizationRating: string;
    executiveSummaryRating: string;
    hobbiesLanguagesRating: string;
    tags: {
        skills: string[];
        industries: string[];
        tools: string[];
        softSkills: string[];
    };
    suggestions: {
        executiveSummary: string[];
        skills: string[];
        experiences: string[];
        education: string[];
        hobbiesLanguages: string[];
        atsOptimization: string[];
    };
}

export interface ProcessedResume {
    text: string;
    analysis: ResumeAnalysis;
}

/**
 * Export a unified text extraction function with retry logic
 */
export async function extractResumeText(file: File): Promise<string> {
    if (!(file instanceof File)) {
        throw new Error('Input must be a File object');
    }

    const MAX_RETRIES = 2;
    let lastError: Error | null = null;
    
    logger.log(`Starting text extraction for file: ${file.name} (${file.type}, ${(file.size / 1024).toFixed(2)} KB)`);

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            logger.log(`Extraction attempt ${attempt}/${MAX_RETRIES}`);
            
            // PDF extraction
            if (file.type === 'application/pdf') {
                const { extractTextFromPDF } = await loadTextExtraction();
                const text = await extractTextFromPDF(file);
                
                // More lenient validation for OCR results
                if (!text || text.trim().length < 50) {
                    const errorMsg = text.includes('[Page') 
                        ? 'PDF extraction failed on multiple pages. File may be corrupted or protected.'
                        : 'PDF extraction returned very little text. File might be empty, corrupted, or heavily encrypted.';
                    
                    logger.warn(errorMsg);
                    
                    if (attempt < MAX_RETRIES) {
                        throw new Error('Insufficient text extracted from PDF');
                    } else {
                        throw new Error(`${errorMsg} Extracted ${text.length} characters after ${MAX_RETRIES} attempts.`);
                    }
                }
                
                logger.log(`Successfully extracted ${text.length} characters from PDF`);
                return text;
            }
            
            // DOCX extraction
            if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
                const { extractTextFromDOCX } = await loadTextExtraction();
                const text = await extractTextFromDOCX(file);
                if (!text || text.trim().length < 50) {
                    throw new Error('Insufficient text extracted from DOCX');
                }
                return text;
            }
            
            // DOC extraction (Word 97-2003)
            if (file.type === 'application/msword') {
                try {
                    const { extractTextFromDOC } = await loadTextExtraction();
                    const text = await extractTextFromDOC(file);
                    if (!text || text.trim().length < 50) {
                        throw new Error('Insufficient text extracted from DOC');
                    }
                    return text;
                } catch (docError) {
                    logger.warn('word-extractor failed for DOC file:', docError instanceof Error ? docError.message : 'Unknown error');
                    // Fallback: try treating as DOCX (some .doc files are actually .docx)
                    if (attempt === MAX_RETRIES) {
                        logger.log('Attempting fallback: treating DOC as DOCX...');
                        try {
                            const { extractTextFromDOCX } = await loadTextExtraction();
                            return await extractTextFromDOCX(file);
                        } catch (fallbackError) {
                            logger.error('Fallback extraction also failed:', fallbackError instanceof Error ? fallbackError.message : 'Unknown error');
                            throw docError;
                        }
                    }
                    throw docError;
                }
            }
            
            throw new Error(`Unsupported file type: ${file.type}`);
            
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            logger.error(`Extraction attempt ${attempt} failed: ${lastError.message}`);
            
            // Wait before retry (exponential backoff)
            if (attempt < MAX_RETRIES) {
                const waitTime = 1000 * attempt;
                logger.log(`Waiting ${waitTime}ms before retry...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        }
    }
    
    // All retries failed
    const errorMessage = `Failed to extract text after ${MAX_RETRIES} attempts: ${lastError?.message || 'Unknown error'}`;
    logger.error(errorMessage);
    throw new Error(errorMessage);
}

/**
 * Function to call Claude via backend proxy
 */
async function askClaude(prompt: string): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);
    
    try {
        const authOptions = await createAuthOptionsWithCsrf({
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                max_tokens: 8192,
                messages: [
                    {
                        role: 'user',
                        content: prompt,
                    },
                ],
            }),
        });
        const response = await fetchWithCsrfRetry('/api/llm/anthropic', {
            ...authOptions,
            signal: controller.signal
        }, 60000);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response from proxy' }));
            logger.error('Error from Anthropic proxy:', errorData);
            throw new Error(`Anthropic API error: ${response.status} - ${(errorData as { error?: { message?: string } }).error?.message || response.statusText}`);
        }

        const message = await response.json() as { content: Array<{ text: string }> };
        return message.content[0].text;

    } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
            throw new Error('Anthropic request timed out after 60s');
        }
        logger.error('Error calling Claude via proxy:', error);
        throw error;
    } finally {
        clearTimeout(timeoutId);
    }
}

/**
 * Analyze resume using OpenAI
 */
export const analyzeResume = async (text: string): Promise<ResumeAnalysis> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90000);
    
    try {
        const prompt = `Vous êtes un expert dans le domaine des ressources humaines disposant de compétences avancées dans le domaine des systèmes d'information et des technologies de l'information. Votre mission est d'analyser un CV et de fournir une evaluation detaillée. Analysez ce CV et fournissez une evaluation detaillée.

CV:
${text}

Répondez uniquement en JSON. Le JSON devra respecter le format suivant :
{
  "name": "Nom du candidat",
  "title": "Titre professionnel",
  "globalRating": "XX%",
  "executiveSummaryRating": "XX%",
  "skillsRating": "XX%",
  "experiencesRating": "XX%",
  "educationRating": "XX%",
  "hobbiesLanguagesRating": "XX%",
  "atsOptimizationRating": "XX%",
  "tags": {
    "skills": ["tag1", "tag2"],
    "industries": ["tag1", "tag2"],
    "tools": ["tag1", "tag2"],
    "softSkills": ["tag1", "tag2"]
  },
  "suggestions": {
    "executiveSummary": ["suggestion1", "suggestion2"],
    "skills": ["suggestion1", "suggestion2"],
    "experiences": ["suggestion1", "suggestion2"],
    "education": ["suggestion1", "suggestion2"],
    "hobbiesLanguages": ["suggestion1", "suggestion2"],
    "atsOptimization": ["suggestion1", "suggestion2"]
  }
}`;

        try {
            const authOptions = await createAuthOptionsWithCsrf({
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    max_tokens: 4096,
                    temperature: 0.2,
                    response_format: { type: "json_object" },
                    messages: [
                        {
                            role: 'system',
                            content: 'You are a JSON-only resume analysis API. You must ALWAYS respond with valid JSON matching the requested format. Do not include any explanatory text, comments, or markdown formatting outside the JSON structure.'
                        },
                        {
                            role: 'user',
                            content: prompt
                        }
                    ]
                })
            });
            
            const response = await fetchWithCsrfRetry('/api/llm/openai', {
                ...authOptions,
                signal: controller.signal
            }, 90000);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response' }));
                throw new Error(`OpenAI API error: ${response.status} - ${(errorData as { error?: { message?: string } }).error?.message || response.statusText}`);
            }

            const data = await response.json() as { choices: Array<{ message: { content: string } }> };
            const analysis = JSON.parse(data.choices[0].message.content) as ResumeAnalysis;
            
            // Validate the analysis object has all required fields
            const requiredFields = [
                'name', 'title', 'globalRating', 'executiveSummaryRating',
                'skillsRating', 'experiencesRating', 'educationRating',
                'hobbiesLanguagesRating', 'atsOptimizationRating', 'tags', 'suggestions'
            ];
            
            const missingFields = requiredFields.filter(field => !(field in analysis));
            if (missingFields.length > 0) {
                throw new Error(`Missing required fields in analysis: ${missingFields.join(', ')}`);
            }

            // Ensure all ratings are strings ending with %
            const ratingFields = ['globalRating', 'skillsRating', 'experiencesRating', 'educationRating', 'atsOptimizationRating', 'executiveSummaryRating', 'hobbiesLanguagesRating'] as const;
            ratingFields.forEach(field => {
                const value = analysis[field];
                if (typeof value === 'number') {
                    (analysis as unknown as Record<string, string>)[field] = `${value}%`;
                } else if (typeof value === 'string' && !value.endsWith('%')) {
                    (analysis as unknown as Record<string, string>)[field] = `${value}%`;
                }
            });
            
            // Ensure suggestions are arrays
            Object.keys(analysis.suggestions).forEach(key => {
                const suggestionKey = key as keyof typeof analysis.suggestions;
                if (!Array.isArray(analysis.suggestions[suggestionKey])) {
                    analysis.suggestions[suggestionKey] = [];
                }
            });
            
            // Ensure tags are objects with arrays
            Object.keys(analysis.tags).forEach(key => {
                const tagKey = key as keyof typeof analysis.tags;
                if (!Array.isArray(analysis.tags[tagKey])) {
                    analysis.tags[tagKey] = [];
                }
            });
            
            clearTimeout(timeoutId);
            return analysis;
        } catch (parseError) {
            clearTimeout(timeoutId);
            logger.error('Error parsing analysis JSON:', parseError);
            throw new Error(`Failed to parse analysis response: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
        }
    } catch (error) {
        logger.error('Error analyzing resume:', error);
        throw error;
    }
};

/**
 * Improve resume using Claude
 */
export const improveResume = async (originalText: string, analysis: ResumeAnalysis): Promise<string> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
    try {
        const prompt = `En tant qu'expert en ressources humaines doté d'une connaissance approfondie dans le domaine des technologies de l'information (IT) et des systèmes d'information (IS), parlant couramment anglais et français, vous devez améliorer un CV en fonction d'une analyse préalable.

Analyse précédente:
${JSON.stringify(analysis, null, 2)}

CV:
${originalText}

Vos améliorations doivent cibler le fait d'atteindre les meilleurs scores dans chaque catégorie, et ce sans inventer de nouveaux éléments ni en supprimant des éléments par rapport au cv original.

Formatter les titres en utilisant des balises <h2>.

Merci de fournir le cv amélioré au format HTML en réponse.`;

        const response = await askClaude(prompt);

        if (!response) {
            throw new Error('Invalid response from Claude API');
        }

        return response.trim();
    } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
            throw new Error('Request timed out. Please try again.');
        }
        logger.error('Error improving resume:', error);
        throw error;
    } finally {
        clearTimeout(timeoutId);
    }
};

/**
 * Process resume: extract text, analyze, and optionally improve
 */
export async function processResume(input: File | string, isImprovement: boolean = false): Promise<ProcessedResume> {
    try {
        let text: string;
        let analysis: ResumeAnalysis;
        
        if (isImprovement) {
            // If we're improving, input is already text
            text = input as string;
            // First analyze the current text
            analysis = await analyzeResume(text);
            // Then get the improved version from Claude
            text = await improveResume(text, analysis);
            // Finally analyze the improved version
            analysis = await analyzeResume(text);
        } else {
            // If we're processing a new file
            if (!(input instanceof File)) {
                throw new Error('Input must be a File object');
            }

            // Extract text based on file type
            if (input.type === 'application/pdf') {
                const { extractTextFromPDF } = await loadTextExtraction();
                text = await extractTextFromPDF(input);
            } else if (input.type === 'application/msword' || input.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
                const { extractTextFromDOCX } = await loadTextExtraction();
                text = await extractTextFromDOCX(input);
            } else {
                throw new Error('Unsupported file type');
            }
            
            // Analyze the original resume
            analysis = await analyzeResume(text);
        }

        return {
            text,
            analysis
        };
    } catch (error) {
        logger.error('Error processing resume:', error);
        throw error;
    }
}
