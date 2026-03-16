/**
 * OpenAI Service
 * Re-exports all OpenAI functionality from modular sub-modules.
 * 
 * Structure:
 * - ./openai/apiClient.js          : Core API call with GPT-5 support, circuit breaker
 * - ./openai/textUtils.js           : HTML entity decoding, text/HTML cleanup
 * - ./openai/resumeOperations.js    : Resume analysis and improvement
 * - ./openai/missionOperations.js   : Resume-mission matching and adaptation
 */

// API Client
export { callOpenAI, callOpenAIWithCircuitBreaker, getOpenAICircuitBreakerStatus } from './openai/apiClient.js';

// Text utilities
export { cleanupText, cleanupHtml, decodeHtmlEntities } from './openai/textUtils.js';

// Resume operations
export { analyzeResume, improveResume } from './openai/resumeOperations.js';

// Mission operations
export { matchResumeWithMission, adaptResumeToMission } from './openai/missionOperations.js';
