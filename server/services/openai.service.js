/**
 * OpenAI Service
 * Re-exports OpenAI functionality from modular sub-modules.
 */

export { callOpenAIChat, callOpenAIVisionChat } from './openaiChat.service.js';
export { callOpenAI, callOpenAIWithCircuitBreaker, getOpenAICircuitBreakerStatus } from './openai/apiClient.js';
export { cleanupText, cleanupHtml, decodeHtmlEntities, stripLlmThinkingContent, extractJsonPayload, parseJsonFromLlmResponse } from './openai/textUtils.js';
export { analyzeResume, improveResume } from './openai/resumeOperations.js';
export { matchResumeWithMission, adaptResumeToMission } from './openai/missionOperations.js';
