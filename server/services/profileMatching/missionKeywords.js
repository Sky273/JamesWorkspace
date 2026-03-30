import { updateWithTimeout } from '../../utils/postgresHelpers.js';
import { safeLog } from '../../utils/logger.backend.js';
import { getLLMSettings } from '../settings.service.js';
import { callBusinessChatCompletion } from '../llmProvider.service.js';
import { MISSION_KEYWORDS_EXTRACTION_PROMPT } from '../../config/prompts.backend.js';
import { normalizeUtf8Text, parseJsonFromLlmResponse } from '../openai/textUtils.js';
import { validateMissionKeywordsPayload } from './contracts.js';

async function extractMissionKeywords(missionTitle, missionContent, model, userMetadata = null) {
    const prompt = MISSION_KEYWORDS_EXTRACTION_PROMPT
        .replace('{MISSION_TITLE}', missionTitle || '')
        .replace('{MISSION_CONTENT}', missionContent || '');

    safeLog('info', 'Extracting mission keywords via LLM', { missionTitle });

    const response = await callBusinessChatCompletion({
        model,
        messages: [
            { role: 'system', content: 'You are a JSON-only keyword extraction API. Respond with valid JSON only.' },
            { role: 'user', content: prompt }
        ],
        maxTokens: 1024,
        temperature: 0.2,
        userMetadata,
        operationType: 'Mission Keywords Extraction'
    });

    try {
        return validateMissionKeywordsPayload(
            parseJsonFromLlmResponse(response.choices[0].message.content)
        );
    } catch (parseError) {
        safeLog('error', 'Failed to parse mission keywords response as JSON', {
            error: parseError.message
        });
        throw new Error(normalizeUtf8Text("Erreur lors de l'extraction des mots-clés de la mission."));
    }
}

async function getMissionKeywords(missionId, missionRecord, userMetadata = null) {
    const cachedKeywords = missionRecord.keywords;
    if (cachedKeywords) {
        try {
            const parsed = typeof cachedKeywords === 'string' ? JSON.parse(cachedKeywords) : cachedKeywords;
            if (parsed.skills || parsed.tools || parsed.industries || parsed.softSkills) {
                safeLog('info', 'Using cached mission keywords', { missionId });
                return validateMissionKeywordsPayload(parsed);
            }
        } catch {
            // Invalid cache, will re-extract.
        }
    }

    const settings = await getLLMSettings();
    const model = settings.llmModel;
    if (!model && settings.llmProvider !== 'ollama') {
        throw new Error('LLM model not configured in Settings.');
    }

    const keywords = await extractMissionKeywords(
        missionRecord.title,
        missionRecord.content,
        model,
        userMetadata
    );

    try {
        await updateWithTimeout('missions', missionId, { keywords });
        safeLog('info', 'Mission keywords cached', { missionId });
    } catch (cacheError) {
        safeLog('warn', 'Failed to cache mission keywords', { error: cacheError.message });
    }

    return keywords;
}

async function clearMissionKeywordsCache(missionId) {
    try {
        await updateWithTimeout('missions', missionId, { keywords: null });
        safeLog('info', 'Mission keywords cache cleared', { missionId });
        return true;
    } catch (error) {
        safeLog('error', 'Failed to clear mission keywords cache', { error: error.message });
        throw error;
    }
}

export {
    clearMissionKeywordsCache,
    extractMissionKeywords,
    getMissionKeywords
};
