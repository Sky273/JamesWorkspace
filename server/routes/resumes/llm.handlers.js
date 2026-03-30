/**
 * LLM-related route handlers for resumes (PostgreSQL)
 * Handles analyze, improve, match, and adapt operations
 */

import { createAdaptHandler } from './llm/handlers.adaptation.js';
import {
    createAnalyzeHandler,
    createAnalyzeTextHandler,
    createImproveByIdHandler,
    createImproveHandler,
    createMatchHandler
} from './llm/handlers.analysis.js';

export const analyzeHandler = createAnalyzeHandler();
export const analyzeTextHandler = createAnalyzeTextHandler();
export const improveHandler = createImproveHandler();
export const improveByIdHandler = createImproveByIdHandler();
export const matchHandler = createMatchHandler();
export const adaptHandler = createAdaptHandler();
