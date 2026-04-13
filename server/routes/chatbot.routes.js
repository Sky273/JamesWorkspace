/**
 * Chatbot Routes
 * Handles AI assistant using LLM with user guide context
 */

import express from 'express';
import { safeLog } from '../utils/logger.backend.js';
import { callLLM } from '../services/llm.service.js';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../middleware/asyncHandler.middleware.js';
import { validateBody, chatbotRequestSchema } from '../utils/validation.js';
import { getRequestMetadata } from '../services/security.service.js';
import { runAiActionWithCredits } from '../services/aiCredits.service.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load user guide markdown
let userGuideContent = '';
const MAX_GUIDE_LENGTH = 100000; // Limit guide size to avoid token limits

const loadUserGuide = async () => {
    try {
        const guidePath = path.join(__dirname, '../../USER_GUIDE.md');
        let content = await fs.readFile(guidePath, 'utf-8');
        
        // Truncate if too long to avoid token limits
        if (content.length > MAX_GUIDE_LENGTH) {
            content = content.substring(0, MAX_GUIDE_LENGTH) + '\n\n[Guide tronqué pour optimisation]';
            safeLog('warn', 'User guide truncated for chatbot', { 
                originalLength: content.length,
                truncatedLength: MAX_GUIDE_LENGTH
            });
        }
        
        userGuideContent = content;
        safeLog('info', 'User guide loaded for chatbot', { 
            length: userGuideContent.length 
        });
    } catch (error) {
        safeLog('error', 'Failed to load user guide', { 
            error: error.message 
        });
        userGuideContent = 'Guide utilisateur non disponible.';
    }
};

// Load user guide on startup
loadUserGuide();

const MAX_HISTORY_ENTRY_LENGTH = 10000;
const MAX_HISTORY_TOTAL_LENGTH = 50000;

/**
 * POST /api/chatbot/message
 * Send a message to the chatbot and get a response
 */
router.post('/message', authenticateToken, validateBody(chatbotRequestSchema), asyncHandler(async (req, res) => {
    const { message, conversationHistory } = req.body;
    const userId = req.user?.id;
    const userName = req.user?.name;
    const normalizedHistory = Array.isArray(conversationHistory) ? conversationHistory : [];
    const oversizedHistoryEntry = normalizedHistory.find((entry) => typeof entry?.content === 'string' && entry.content.length > MAX_HISTORY_ENTRY_LENGTH);
    if (oversizedHistoryEntry) {
        return res.status(400).json({
            error: 'Conversation history entry exceeds maximum length'
        });
    }

    const totalHistoryLength = normalizedHistory.reduce((sum, entry) => sum + (typeof entry?.content === 'string' ? entry.content.length : 0), 0);
    if (totalHistoryLength > MAX_HISTORY_TOTAL_LENGTH) {
        return res.status(400).json({
            error: 'Conversation history exceeds maximum total length'
        });
    }

    safeLog('info', 'Processing chatbot message with LLM', { 
        userId, 
        userName,
        messageLength: message.length,
        historyLength: conversationHistory?.length || 0
    });

    // Build conversation context
    const systemPrompt = `Tu es un assistant IA pour l'application ResumeConverter, une plateforme de gestion et d'amélioration de CV assistée par intelligence artificielle.

Ton rôle est d'aider les utilisateurs à :
- Comprendre comment utiliser l'application
- Résoudre leurs problèmes
- Répondre à leurs questions sur les fonctionnalités
- Les guider dans l'utilisation des différentes sections

Tu dois être :
- Courtois et professionnel
- Concis mais complet dans tes réponses
- Capable de référencer le guide utilisateur ci-dessous
- Proactif pour suggérer des fonctionnalités pertinentes

FORMAT DE RÉPONSE :
- Utilise le format **Markdown** pour structurer tes réponses
- Utilise **gras** pour les termes importants et les noms de fonctionnalités
- Utilise des listes à puces (-) pour énumérer des étapes ou options
- Utilise des listes numérotées (1. 2. 3.) pour les procédures étape par étape
- Utilise \`code\` pour les noms de boutons, menus ou raccourcis clavier
- Utilise > pour les citations ou notes importantes
- Garde tes réponses bien structurées et faciles à lire
- Évite les blocs de texte trop longs, préfère des paragraphes courts

RÈGLES IMPORTANTES :
- Tu DOIS UNIQUEMENT répondre aux questions concernant ResumeConverter et son utilisation
- Si l'utilisateur pose une question hors sujet (politique, actualités, autres applications, conseils généraux non liés à l'app, etc.), tu dois poliment refuser et rediriger vers des questions sur ResumeConverter
- Ne réponds PAS aux questions de programmation générale, de rédaction de CV hors contexte de l'application, ou tout autre sujet non lié
- Reste strictement dans le cadre de l'assistance à l'utilisation de ResumeConverter

GUIDE UTILISATEUR :
${userGuideContent}

Réponds toujours en français, sauf si l'utilisateur pose sa question en anglais.`;

    // Build messages array for LLM
    const messages = [
        { role: 'system', content: systemPrompt }
    ];

    // Add conversation history
    if (normalizedHistory.length > 0) {
        normalizedHistory.forEach(msg => {
            if (msg.role === 'user' || msg.role === 'assistant') {
                messages.push({
                    role: msg.role,
                    content: msg.content
                });
            }
        });
    }

    // Add current user message
    messages.push({
        role: 'user',
        content: message
    });

    // Call LLM with retry logic
    let llmResponse;
    let lastError;
    
    try {
        llmResponse = await runAiActionWithCredits({
            firmId: req.user?.firmId || req.user?.firm_id || null,
            userId,
            actionType: 'chatbot.message',
            metadata: {
                ...getRequestMetadata(req),
                messageLength: message.length,
                historyLength: normalizedHistory.length
            }
        }, async (actionConfig = {}) => {
            const { maxTokens } = actionConfig;
            for (let attempt = 1; attempt <= 2; attempt++) {
                try {
                    const response = await callLLM(messages, {
                        temperature: 0.7,
                        max_tokens: maxTokens
                    });

                    if (response && response.content) {
                        return response;
                    }
                } catch (error) {
                    lastError = error;
                    safeLog('warn', `LLM call attempt ${attempt} failed`, {
                        error: error.message,
                        attempt
                    });

                    if (attempt < 2) {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                }
            }

            return null;
        });
    } catch (error) {
        if (error.code === 'INSUFFICIENT_CREDITS') {
            return res.status(402).json({
                error: 'Insufficient credits for this AI action',
                details: error.details
            });
        }
        throw error;
    }

    if (!llmResponse || !llmResponse.content) {
        safeLog('error', 'LLM returned empty response after retries', {
            lastError: lastError?.message
        });
        return res.status(500).json({
            error: 'Empty LLM response',
            response: 'Désolé, je n\'ai pas pu générer de réponse. Veuillez réessayer.'
        });
    }

    // Note: LLM metrics are now tracked inside llm.service.js to avoid double counting
    // The callLLM function tracks metrics automatically

    safeLog('info', 'Chatbot LLM response generated', { 
        userId,
        responseLength: llmResponse.content.length,
        model: llmResponse.model
    });

    res.json({
        response: llmResponse.content,
        metadata: {
            model: llmResponse.model,
            tokensUsed: llmResponse.usage
        }
    });
}));

/**
 * GET /api/chatbot/status
 * Check if chatbot service is configured and available
 */
router.get('/status', authenticateToken, (req, res) => {
    const isConfigured = userGuideContent.length > 0;
    res.json({
        configured: isConfigured,
        status: isConfigured ? 'available' : 'not_configured',
        userGuideLoaded: userGuideContent.length > 0,
        userGuideLength: userGuideContent.length
    });
});

export default router;
