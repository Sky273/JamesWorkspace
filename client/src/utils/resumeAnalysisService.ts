/**
 * Resume Analysis Service
 * Handles OpenAI API calls for resume analysis
 */

import { createAuthOptionsWithCsrf, fetchWithAuth, createAuthOptions } from './apiInterceptor';
import logger from './logger.frontend';

// Types
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
    originalText?: string;
    error?: string;
}

export interface ImprovedResume {
    improvedText: string;
    improvements: {
        globalRating: string;
        skillsRating: string;
        experiencesRating: string;
        educationRating: string;
        atsOptimizationRating: string;
        executiveSummaryRating: string;
        hobbiesLanguagesRating: string;
    };
    changesSummary: string[];
    error?: string;
}

interface OpenAIMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

interface OpenAIResponse {
    choices: Array<{
        message: {
            content: string;
        };
    }>;
}

interface Settings {
    llmModel?: string;
}

// Cache for settings to avoid repeated API calls
let settingsCache: Settings | null = null;
let settingsCacheTime = 0;
const CACHE_DURATION = 60000; // 1 minute cache

// Helper function to get configured LLM model
async function getConfiguredModel(): Promise<string> {
    const now = Date.now();
    
    // Return cached model if still valid
    if (settingsCache && (now - settingsCacheTime) < CACHE_DURATION) {
        return settingsCache.llmModel || 'gpt-4o';
    }
    
    try {
        const response = await fetchWithAuth('/api/settings', createAuthOptions());
        if (response.ok) {
            const settings: Settings = await response.json();
            settingsCache = settings;
            settingsCacheTime = now;
            return settings.llmModel || 'gpt-4o';
        }
    } catch (error) {
        logger.error('Error fetching settings, using default model:', error);
    }
    
    return 'gpt-4o'; // Fallback
}

// Helper function to make OpenAI API calls
async function makeOpenAIRequest(data: Record<string, unknown>): Promise<OpenAIResponse> {
    const controller = new AbortController();
    // GPT-4o can sometimes take longer, especially with larger contexts or for JSON mode.
    const timeout = setTimeout(() => controller.abort(), 90000); // 90 second timeout

    try {
        const authOptions = await createAuthOptionsWithCsrf({
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        const response = await fetch('/api/llm/openai', {
            ...authOptions,
            signal: controller.signal
        });

        if (!response.ok) {
            const errorText = await response.text();
            let errorJson: { error?: { message?: string } } = {};
            try {
                errorJson = JSON.parse(errorText);
            } catch {
                // If error response is not JSON, use the raw text
            }
            logger.error('OpenAI API Error Response:', errorText);
            throw new Error(`OpenAI API error: ${response.status} - ${errorJson.error?.message || errorText}`);
        }

        return response.json();
    } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
            throw new Error('OpenAI API request timed out after 90 seconds');
        }
        logger.error('Error in makeOpenAIRequest:', error);
        throw error;
    } finally {
        clearTimeout(timeout);
    }
}

// Function to ensure we get valid JSON from OpenAI
async function getValidJSONResponse<T>(
    messages: OpenAIMessage[],
    expectedFormat: string,
    model: string
): Promise<T> {
    let retries = 3;
    let lastError: Error | null = null;

    const systemMessage: OpenAIMessage = {
        role: "system",
        content: `You are a JSON-only resume analysis API. You must ALWAYS respond with valid JSON matching this exact format: ${expectedFormat}. Do not include any explanatory text, comments, or markdown formatting outside the JSON structure. If you cannot perform the analysis or if the input is invalid, return a JSON object with an "error" field explaining the issue, but still adhere to the overall JSON structure where possible (e.g., by providing default or empty values for other fields).`
    };

    while (retries > 0) {
        try {
            const response = await makeOpenAIRequest({
                model: model,
                messages: [systemMessage, ...messages],
                temperature: 0.2,
                max_tokens: 4095,
                response_format: { type: "json_object" }
            });

            if (!response.choices || response.choices.length === 0 || !response.choices[0].message || !response.choices[0].message.content) {
                throw new Error('Invalid response structure from OpenAI: Missing choices or content.');
            }
            
            const content = response.choices[0].message.content.trim();
            
            try {
                return JSON.parse(content) as T;
            } catch (parseError) {
                logger.error('Invalid JSON in OpenAI response despite json_object mode:', content, parseError);
                throw new Error(`Failed to parse OpenAI response as JSON. Content: ${content}`);
            }
        } catch (error) {
            logger.error(`Error in getValidJSONResponse (attempt ${4 - retries} of 3): ${error instanceof Error ? error.message : error}`);
            lastError = error instanceof Error ? error : new Error(String(error));
            retries--;
            if (retries > 0) {
                await new Promise(resolve => setTimeout(resolve, (3 - retries) * 3000));
            }
        }
    }

    logger.error('All retries failed for OpenAI request:', lastError?.message);
    const defaultErrorResponse = { error: `Failed to get valid JSON response after multiple retries: ${lastError?.message || "Unknown error"}` } as T;
    return defaultErrorResponse;
}

export const resumeAnalysisService = {
    async analyzeResume(text: string): Promise<ResumeAnalysis> {
        try {
            const expectedFormat = `{
                "name": "Nom du candidat",
                "title": "Titre professionnel",
                "globalRating": "X%",
                "skillsRating": "X%",
                "experiencesRating": "X%",
                "educationRating": "X%",
                "atsOptimizationRating": "X%",
                "executiveSummaryRating": "X%",
                "hobbiesLanguagesRating": "X%",
                "tags": {
                    "skills": ["skill1", "skill2"],
                    "industries": ["industry1", "industry2"],
                    "tools": ["tool1", "tool2"],
                    "softSkills": ["soft1", "soft2"]
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

            const messages: OpenAIMessage[] = [
                {
                    role: "user",
                    content: `Analysez ce CV et fournissez des scores et des suggestions en JSON:\n\nle CV:\n${text}\n\nPrérequis:\n1. Note globale (0-100%)\n2. Evaluation des competences (0-100%)\n3. Evaluation de l'experience (0-100%)\n4. Analyse de l'éducation (0-100%)\n5. Optimisation pour les ATS (0-100%)\n6. Evaluation du sommaire (0-100%)\n7. Informations additionnelles (0-100%)\n8. Liste de toutes les competences identifiées\n9. Liste d'industries pertinentes\n10. Liste des outils et technologies\n11. Liste des soft skills\nFournissez des suggestions spécifiques pour chaque section\n\nVotre réponse doit contenir uniquement du JSON valide correspondant à ce format. N'incluez pas de texte en dehors de la structure JSON.`
                }
            ];

            const model = await getConfiguredModel();
            const analysis = await getValidJSONResponse<ResumeAnalysis>(messages, expectedFormat, model);
            
            return {
                ...analysis,
                originalText: text
            };
        } catch (error) {
            logger.error('Error analyzing resume:', error);
            if (error instanceof Error) {
                throw error;
            } else {
                throw new Error('Failed to analyze resume. Please try again. Details: ' + String(error));
            }
        }
    },

    async improveResume(text: string, analysis: ResumeAnalysis): Promise<ImprovedResume> {
        try {
            const expectedFormat = `{
                "improvedText": "CV amélioré ici en format texte brut.",
                "improvements": {
                    "globalRating": "X%",
                    "skillsRating": "X%",
                    "experiencesRating": "X%",
                    "educationRating": "X%",
                    "atsOptimizationRating": "X%",
                    "executiveSummaryRating": "X%",
                    "hobbiesLanguagesRating": "X%"
                },
                "changesSummary": ["Résumé du changement 1", "Résumé du changement 2"]
            }`;

            const messages: OpenAIMessage[] = [
                {
                    role: "user",
                    content: `Améliorez ce cv sur la base de l'analyse suivante. Retournez du JSON valide avec les améliorations apportées.:\n\nCV original:\n${text}\n\nAnalyse et suggestions existantes:\n${JSON.stringify(analysis, null, 2)}\n\nPrérequis:\n1. Fournissez un texte de CV amélioré complet (champ "improvedText").\n2. Mettez à jour les scores d'évaluation (champ "improvements") pour refléter le CV amélioré.\n3. Listez les modifications spécifiques et clés que vous avez apportées (champ "changesSummary").\n\nVotre réponse doit contenir uniquement du JSON valide correspondant au format spécifié. N'incluez pas de texte en dehors de la structure JSON.`
                }
            ];
            
            const model = await getConfiguredModel();
            return await getValidJSONResponse<ImprovedResume>(messages, expectedFormat, model);
        } catch (error) {
            logger.error('Error improving resume:', error);
            if (error instanceof Error) {
                throw error;
            } else {
                throw new Error('Failed to improve resume. Please try again. Details: ' + String(error));
            }
        }
    }
};
