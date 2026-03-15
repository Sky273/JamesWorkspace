/**
 * Batch Jobs Worker Service
 * 
 * This file re-exports the modular batch jobs worker from ./batchJobsWorker/
 * 
 * Structure:
 * - ./batchJobsWorker/index.js          : Main entry point
 * - ./batchJobsWorker/helpers.js         : parseScore, removeSuggestionMarkers, generateTrigram
 * - ./batchJobsWorker/textExtraction.js  : PDF/DOCX/DOC text extraction
 * - ./batchJobsWorker/llmIntegration.js  : LLM rate limiting + analyze/improve
 * - ./batchJobsWorker/itemProcessors.js  : processImportItem, processImproveItem
 * - ./batchJobsWorker/exportGenerator.js : ZIP export generation
 * - ./batchJobsWorker/workerLifecycle.js : Worker init, start, stop
 */

export { initializeWorker, startWorker, stopWorker } from './batchJobsWorker/index.js';

import batchJobsWorker from './batchJobsWorker/index.js';
export default batchJobsWorker;
