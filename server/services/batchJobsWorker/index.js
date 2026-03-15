/**
 * Batch Jobs Worker Service - Main Entry Point
 * Re-exports all public functions from submodules for backward compatibility
 * 
 * Structure:
 * - helpers.js         : parseScore, removeSuggestionMarkers, generateTrigram
 * - textExtraction.js  : PDF/DOCX/DOC text extraction from buffers
 * - llmIntegration.js  : LLM rate limiting + analyze/improve with LLM
 * - itemProcessors.js  : processImportItem, processImproveItem
 * - exportGenerator.js : ZIP export generation (PDF/DOCX)
 * - workerLifecycle.js : Worker init, start, stop, batch processing loop
 */

import { initializeWorker, startWorker, stopWorker } from './workerLifecycle.js';

export { initializeWorker, startWorker, stopWorker };

export default {
    initializeWorker,
    startWorker,
    stopWorker
};
