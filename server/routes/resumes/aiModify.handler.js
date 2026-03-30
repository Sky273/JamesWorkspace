import { callBusinessChatCompletion } from '../../services/llmProvider.service.js';
import { getLLMSettings } from '../../services/settings.service.js';
import { safeLog } from '../../utils/logger.backend.js';
import { getRequestMetadata } from '../../services/security.service.js';
import metrics, { buildLLMMetricLabel } from '../../services/metrics.service.js';
import { normalizeUtf8Text, parseJsonFromLlmResponse, stripLlmThinkingContent } from '../../services/openai/textUtils.js';

/**
 * AI Modify Handler
 * Modifies resume content based on user instructions using LLM
 */
export async function aiModifyHandler(req, res) {
    try {
        const { content, instructions, selectedText } = req.body;
        
        if (!content || !instructions) {
            return res.status(400).json({ error: 'Content and instructions are required' });
        }

        const settings = await getLLMSettings();
        const model = settings.llmModel;
        const userMetadata = getRequestMetadata(req);
        const hasSelection = selectedText && selectedText.trim().length > 0;
        const metricsProvider = buildLLMMetricLabel(settings.llmProvider || 'openai', model || 'unknown');
        const inputChars = (content?.length || 0) + (instructions?.length || 0) + (selectedText?.length || 0);

        if (!model && settings.llmProvider !== 'ollama') {
            return res.status(500).json({ error: 'LLM model not configured in Settings.' });
        }

        // Build prompt for AI modification - different prompts for selection vs full content
        let modificationPrompt;
        
        if (hasSelection) {
            // Selection-based modification: only modify the selected portion
            modificationPrompt = normalizeUtf8Text(`Tu es un assistant spécialisé dans l'édition de CV professionnels.

INSTRUCTIONS DE L'UTILISATEUR :
${instructions}

TEXTE SÉLECTIONNÉ À MODIFIER (HTML) :
${selectedText}

CONTEXTE - CV COMPLET (pour référence uniquement, NE PAS retourner) :
${content}

RÈGLES STRICTES :
1. Applique UNIQUEMENT les modifications demandées sur le TEXTE SÉLECTIONNÉ
2. Retourne UNIQUEMENT le texte sélectionné modifié, PAS le CV complet
3. Conserve la structure HTML du texte sélectionné (balises, classes CSS, etc.)
4. Ne modifie que le contenu textuel selon les instructions
5. Si les instructions sont ambiguës, fais de ton mieux en restant conservateur

FORMAT DE RÉPONSE OBLIGATOIRE (JSON) :
{
  "modifiedSelection": "<html>le texte sélectionné modifié en HTML</html>",
  "message": "Un message court (1-2 phrases) décrivant les modifications apportées"
}

IMPORTANT : Retourne UNIQUEMENT ce JSON, sans texte avant ou après.`);
        } else {
            // Full content modification
            modificationPrompt = normalizeUtf8Text(`Tu es un assistant spécialisé dans l'édition de CV professionnels.

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

IMPORTANT : Retourne UNIQUEMENT ce JSON, sans texte avant ou après.`);
        }

        safeLog('info', 'AI Modify request', {
            instructionsLength: instructions.length,
            contentLength: content.length,
            hasSelection,
            selectedTextLength: selectedText?.length || 0,
            model
        });

        // Call LLM with strict system prompt
        let response;
        try {
            response = await callBusinessChatCompletion({
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
- Return ONLY a JSON object with the appropriate fields and "message" (string)
- For full content modification: use "modifiedContent" field with the complete HTML
- For selection modification: use "modifiedSelection" field with only the modified selection HTML
- The content fields must contain clean HTML without markdown
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
        } catch (error) {
            metrics.trackAiModifyActivity({
                provider: metricsProvider,
                event: 'run',
                failedRuns: 1,
                selectionRuns: hasSelection ? 1 : 0,
                inputChars,
                metadata: { source: 'provider-call', error: error.message }
            });
            throw error;
        }

        const rawResponse = stripLlmThinkingContent(response.choices[0].message.content);

        // Parse the JSON response from LLM
        let usedFallback = false;
        let parsedResponse;
        try {
            parsedResponse = parseJsonFromLlmResponse(rawResponse);
        } catch (parseError) {
            safeLog('error', 'Failed to parse LLM JSON response', { error: parseError.message, rawResponse: rawResponse.substring(0, 500) });
            // Fallback: treat the entire response as HTML content
            usedFallback = true;
            if (hasSelection) {
                parsedResponse = {
                    modifiedSelection: rawResponse,
                    message: normalizeUtf8Text('S\u00e9lection modifi\u00e9e avec succ\u00e8s.')
                };
            } else {
                parsedResponse = {
                    modifiedContent: rawResponse,
                    message: normalizeUtf8Text('Modifications appliqu\u00e9es avec succ\u00e8s. Le CV a \u00e9t\u00e9 modifi\u00e9 selon vos instructions.')
                };
            }
        }

        const { modifiedContent, modifiedSelection, message: responseMessage } = parsedResponse;

        safeLog('info', 'AI Modify completed', {
            originalLength: content.length,
            hasSelection,
            modifiedContentLength: modifiedContent?.length || 0,
            modifiedSelectionLength: modifiedSelection?.length || 0,
            message: responseMessage
        });

        // Return appropriate response based on whether it was a selection or full content modification
        const responseData = {
            message: responseMessage
        };
        
        if (hasSelection && modifiedSelection) {
            responseData.modifiedSelection = modifiedSelection;
        } else if (modifiedContent) {
            responseData.modifiedContent = modifiedContent;
        }

        metrics.trackAiModifyActivity({
            provider: metricsProvider,
            event: 'run',
            successfulRuns: 1,
            fallbackRuns: usedFallback ? 1 : 0,
            selectionRuns: hasSelection ? 1 : 0,
            inputChars,
            outputChars: (modifiedSelection?.length || 0) + (modifiedContent?.length || 0),
            metadata: { source: usedFallback ? 'plain-text-fallback' : 'structured-json' }
        });

        res.json(responseData);

    } catch (error) {
        safeLog('error', 'Error in AI modify', { error: error.message });
        const statusCode = error.response?.status || 500;
        const errorMessage = error.response?.data?.error || error.message || 'Failed to modify resume with AI';
        res.status(statusCode).json({ error: errorMessage });
    }
}





