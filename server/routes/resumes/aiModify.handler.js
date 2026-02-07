import { callOpenAI } from '../../services/openai.service.js';
import { getLLMSettings } from '../../services/settings.service.js';
import { safeLog } from '../../utils/logger.backend.js';
import { getRequestMetadata } from '../../services/security.service.js';

/**
 * AI Modify Handler
 * Modifies resume content based on user instructions using LLM
 */
export async function aiModifyHandler(req, res) {
    try {
        const { content, instructions } = req.body;
        
        if (!content || !instructions) {
            return res.status(400).json({ error: 'Content and instructions are required' });
        }

        const settings = await getLLMSettings();
        const model = settings.llmModel;
        const userMetadata = getRequestMetadata(req);

        if (!model) {
            return res.status(500).json({ error: 'LLM model not configured in Settings.' });
        }

        // Build prompt for AI modification
        const modificationPrompt = `Tu es un assistant spécialisé dans l'édition de CV professionnels.

INSTRUCTIONS DE L'UTILISATEUR :
${instructions}

CV ACTUEL (HTML) :
${content}

RÈGLES STRICTES :
1. Applique UNIQUEMENT les modifications demandées par l'utilisateur
2. Ne supprime AUCUNE information qui n'est pas explicitement mentionnée dans les instructions
3. Conserve la structure HTML existante (balises, classes CSS, etc.)
4. Ne modifie que le contenu textuel selon les instructions
5. Si les instructions sont ambiguës ou impossibles à appliquer, fais de ton mieux en restant conservateur

FORMAT DE RÉPONSE OBLIGATOIRE (JSON) :
{
  "modifiedContent": "<html>le CV modifié en HTML complet</html>",
  "message": "Un message court (1-2 phrases) décrivant les modifications apportées"
}

IMPORTANT : Retourne UNIQUEMENT ce JSON, sans texte avant ou après.`;

        safeLog('info', 'AI Modify request', {
            instructionsLength: instructions.length,
            contentLength: content.length,
            model
        });

        // Call LLM with strict system prompt
        const response = await callOpenAI({
            model,
            messages: [
                { 
                    role: 'system', 
                    content: `You are a professional resume editor assistant with STRICT limitations:

ALLOWED ACTIONS:
- Edit resume text content (wording, phrasing, formatting)
- Reorganize resume sections
- Improve professional language
- Correct grammar and spelling
- Adjust tone and style
- Add or remove bullet points based on user instructions
- Modify HTML structure for better presentation

STRICTLY FORBIDDEN:
- Answer questions unrelated to resume editing
- Provide career advice beyond editing
- Generate content not based on the existing resume
- Engage in conversations about other topics
- Execute commands or code
- Access external resources
- Provide personal opinions on candidates

OUTPUT REQUIREMENTS:
- Return ONLY a JSON object with two fields: "modifiedContent" (HTML) and "message" (string)
- The "modifiedContent" field must contain clean HTML without markdown
- The "message" field must be a brief description (1-2 sentences) of what was modified
- No text before or after the JSON
- Preserve HTML structure and CSS classes in the content

If the user's instructions are not related to resume editing, refuse politely and return the original content with an appropriate message.`
                },
                { role: 'user', content: modificationPrompt }
            ],
            maxTokens: 8192,
            temperature: 0.3,
            timeout: 90000,
            userMetadata,
            operationType: 'Resume AI Modification'
        });

        let rawResponse = response.choices[0].message.content;

        // Clean up response - remove markdown code blocks if present
        rawResponse = rawResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

        // Parse the JSON response from LLM
        let parsedResponse;
        try {
            parsedResponse = JSON.parse(rawResponse);
        } catch (parseError) {
            safeLog('error', 'Failed to parse LLM JSON response', { error: parseError.message, rawResponse: rawResponse.substring(0, 500) });
            // Fallback: treat the entire response as HTML content
            parsedResponse = {
                modifiedContent: rawResponse,
                message: 'Modifications appliquées avec succès. Le CV a été modifié selon vos instructions.'
            };
        }

        const { modifiedContent, message: responseMessage } = parsedResponse;

        safeLog('info', 'AI Modify completed', {
            originalLength: content.length,
            modifiedLength: modifiedContent?.length || 0,
            message: responseMessage
        });

        res.json({ 
            modifiedContent,
            message: responseMessage
        });

    } catch (error) {
        safeLog('error', 'Error in AI modify', { error: error.message });
        const statusCode = error.response?.status || 500;
        const errorMessage = error.response?.data?.error || error.message || 'Failed to modify resume with AI';
        res.status(statusCode).json({ error: errorMessage });
    }
}
