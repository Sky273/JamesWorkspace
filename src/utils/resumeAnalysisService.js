// src/utils/resumeAnalysisService.js

import { createAuthOptionsWithCsrf } from './apiInterceptor';
import { fetchWithAuth, createAuthOptions } from './apiInterceptor';
import logger from './logger.frontend';

// Cache for settings to avoid repeated API calls
let settingsCache = null;
let settingsCacheTime = 0;
const CACHE_DURATION = 60000; // 1 minute cache

// Helper function to get configured LLM model
async function getConfiguredModel() {
    const now = Date.now();
    
    // Return cached model if still valid
    if (settingsCache && (now - settingsCacheTime) < CACHE_DURATION) {
        return settingsCache.llmModel || 'gpt-4o';
    }
    
    try {
        const response = await fetchWithAuth('/api/settings', createAuthOptions());
        if (response.ok) {
            const settings = await response.json();
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
async function makeOpenAIRequest(data) {
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
            let errorJson = {};
            try {
                errorJson = JSON.parse(errorText); // OpenAI often returns JSON errors
            } catch (e) {
                // If error response is not JSON, use the raw text
            }
            logger.error('OpenAI API Error Response:', errorText);
            // Prefer the structured error message if available
            throw new Error(`OpenAI API error: ${response.status} - ${errorJson.error?.message || errorText}`);
        }

        return response.json();
    } catch (error) {
        if (error.name === 'AbortError') {
            throw new Error('OpenAI API request timed out after 90 seconds');
        }
        logger.error('Error in makeOpenAIRequest:', error);
        throw error; // Re-throw the error to be caught by the caller
    } finally {
        clearTimeout(timeout);
    }
}

// Function to ensure we get valid JSON from OpenAI
async function getValidJSONResponse(messages, expectedFormat, model) {
    let retries = 3;
    let lastError = null;

    const systemMessage = {
        role: "system",
        content: `You are a JSON-only resume analysis API. You must ALWAYS respond with valid JSON matching this exact format: ${expectedFormat}. Do not include any explanatory text, comments, or markdown formatting outside the JSON structure. If you cannot perform the analysis or if the input is invalid, return a JSON object with an "error" field explaining the issue, but still adhere to the overall JSON structure where possible (e.g., by providing default or empty values for other fields).`
    };

    while (retries > 0) {
        try {
            const response = await makeOpenAIRequest({
                model: model,
                messages: [systemMessage, ...messages],
                temperature: 0.2, // Lower temperature for more deterministic JSON output
                max_tokens: 4095, // Maximize tokens for GPT-4o, response_format needs it
                response_format: { type: "json_object" } // Request JSON mode
            });

            if (!response.choices || response.choices.length === 0 || !response.choices[0].message || !response.choices[0].message.content) {
                throw new Error('Invalid response structure from OpenAI: Missing choices or content.');
            }
            
            const content = response.choices[0].message.content.trim();
            
            try {
                // Directly parse, as json_object mode should ensure valid JSON string.
                return JSON.parse(content);
            } catch (parseError) {
                logger.error('Invalid JSON in OpenAI response despite json_object mode:', content, parseError);
                throw new Error(`Failed to parse OpenAI response as JSON. Content: ${content}`);
            }
        } catch (error) {
            logger.error(`Error in getValidJSONResponse (attempt ${4 - retries} of 3):`, error.message);
            lastError = error;
            retries--;
            if (retries > 0) {
                await new Promise(resolve => setTimeout(resolve, (3 - retries) * 3000)); // Exponential backoff
            }
        }
    }

    logger.error('All retries failed for OpenAI request:', lastError?.message);
    // Construct a default error response.
    const defaultErrorResponse = { error: `Failed to get valid JSON response after multiple retries: ${lastError?.message || "Unknown error"}` };
    try {
        const parsedFormat = JSON.parse(expectedFormat);
        Object.keys(parsedFormat).forEach(key => {
            if (key !== "error") {
                 defaultErrorResponse[key] = parsedFormat[key] === "X%" ? "0%" : (Array.isArray(parsedFormat[key]) ? [] : (typeof parsedFormat[key] === 'object' ? {} : "N/A"));
            }
        });
        // Specific handling for nested structures like tags, suggestions, improvements
        if (parsedFormat.tags && typeof parsedFormat.tags === 'object') {
            defaultErrorResponse.tags = {};
            Object.keys(parsedFormat.tags).forEach(tagKey => { defaultErrorResponse.tags[tagKey] = []; });
        }
        if (parsedFormat.suggestions && typeof parsedFormat.suggestions === 'object') {
            defaultErrorResponse.suggestions = {};
            Object.keys(parsedFormat.suggestions).forEach(suggestionKey => { defaultErrorResponse.suggestions[suggestionKey] = []; });
        }
         if (parsedFormat.improvements && typeof parsedFormat.improvements === 'object') {
            defaultErrorResponse.improvements = {};
            Object.keys(parsedFormat.improvements).forEach(improvementKey => { defaultErrorResponse.improvements[improvementKey] = "0%"; });
        }
    } catch (e) {
        logger.error("Could not parse expectedFormat to create detailed default error response", e);
    }
    return defaultErrorResponse;
}

export const resumeAnalysisService = {
    async analyzeResume(text) {
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

            const messages = [
                {
                    role: "user",
                    content: `Analysez ce CV et fournissez des scores et des suggestions en JSON:\n\nle CV:\n${text}\n\nPrérequis:\n1. Note globale (0-100%)\n2. Evaluation des competences (0-100%)\n3. Evaluation de l'experience (0-100%)\n4. Analyse de l'éducation (0-100%)\n5. Optimisation pour les ATS (0-100%)\n6. Evaluation du sommaire (0-100%)\n7. Informations additionnelles (0-100%)\n8. Liste de toutes les competences identifiées\n9. Liste d'industries pertinentes\n10. Liste des outils et technologies\n11. Liste des soft skills\nFournissez des suggestions spécifiques pour chaque section\n\nVotre réponse doit contenir uniquement du JSON valide correspondant à ce format. N'incluez pas de texte en dehors de la structure JSON.`
                }
            ];

            const model = await getConfiguredModel();
            const analysis = await getValidJSONResponse(messages, expectedFormat, model);
            
            return {
                ...analysis,
                originalText: text
            };
        } catch (error) {
            logger.error('Error analyzing resume:', error);
            // Ensure the thrown error is an actual Error object
            if (error instanceof Error) {
                throw error;
            } else {
                throw new Error('Failed to analyze resume. Please try again. Details: ' + String(error));
            }
        }
    },

    async improveResume(text, analysis) {
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

            const messages = [
                {
                    role: "user",
                    content: `Améliorez ce cv sur la base de l'analyse suivante. Retournez du JSON valide avec les améliorations apportées.:\n\nCV original:\n${text}\n\nAnalyse et suggestions existantes:\n${JSON.stringify(analysis, null, 2)}\n\nPrérequis:\n1. Fournissez un texte de CV amélioré complet (champ "improvedText").\n2. Mettez à jour les scores d'évaluation (champ "improvements") pour refléter le CV amélioré.\n3. Listez les modifications spécifiques et clés que vous avez apportées (champ "changesSummary").\n\nVotre réponse doit contenir uniquement du JSON valide correspondant au format spécifié. N'incluez pas de texte en dehors de la structure JSON.`
                }
            ];
            
            const model = await getConfiguredModel();
            return await getValidJSONResponse(messages, expectedFormat, model);
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