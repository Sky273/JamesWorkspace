/**
 * Tests for Batch Jobs Worker - LLM Integration
 * Rate limiting semaphore: acquireLLMSlot, releaseLLMSlot, resetLLMQueue
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn()
}));

// Mock all dynamic imports used by analyzeResumeWithLLM/improveResumeWithLLM
vi.mock('../../services/openai.service.js', () => ({
    analyzeResume: vi.fn(),
    improveResume: vi.fn(),
    cleanupText: vi.fn(t => t)
}));
vi.mock('../../services/settings.service.js', () => ({
    getLLMSettings: vi.fn(() => ({ llmModel: 'gpt-4o', cvMode: 'nominative', 'Analysis Prompt': 'prompt {TEXT} {FILENAME} {ACCEPTED_INDUSTRIES} {ANONYMIZATION_RULES}' })),
    calculateWeightedGlobalRating: vi.fn((a) => a)
}));
vi.mock('../../services/industry.service.js', () => ({
    getAcceptedIndustriesString: vi.fn(() => 'IT, Finance'),
    getIndustryMappingString: vi.fn(() => '- Informatique, Tech → IT\n- Banque → Finance')
}));
vi.mock('../../config/prompts.backend.js', () => ({
    DEFAULT_ANALYSIS_PROMPT: 'analyze {TEXT} {FILENAME} {ACCEPTED_INDUSTRIES} {INDUSTRY_MAPPING} {ANONYMIZATION_RULES}',
    DEFAULT_IMPROVEMENT_PROMPT: 'improve {TEXT} {ANALYSIS} {FILENAME} {ACCEPTED_INDUSTRIES} {INDUSTRY_MAPPING} {ANONYMIZATION_RULES}',
    ANONYMIZATION_RULES_ANONYMOUS: 'anon rules {FILENAME}',
    ANONYMIZATION_RULES_NOMINATIVE: 'nominative rules {FILENAME}'
}));

import {
    acquireLLMSlot,
    analyzeResumeWithLLM,
    analyzeImprovedResumeWithLLM,
    improveResumeWithLLM,
    preAnalyzeResumeWithLLM,
    releaseLLMSlot,
    resetLLMQueue
} from '../../services/batchJobsWorker/llmIntegration.js';

describe('Batch Jobs Worker - LLM Integration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        resetLLMQueue();
        delete process.env.E2E_DISABLE_EXTERNAL_LLM;
    });

    describe('acquireLLMSlot / releaseLLMSlot', () => {
        it('should acquire a slot immediately when under limit', async () => {
            await acquireLLMSlot();
            // Should resolve without hanging
            releaseLLMSlot();
        });

        it('should queue requests when at max concurrency', async () => {
            // Acquire 20 slots (MAX_CONCURRENT_LLM)
            const slots = [];
            for (let i = 0; i < 20; i++) {
                slots.push(acquireLLMSlot());
            }
            await Promise.all(slots);

            // 21st should be queued
            let resolved = false;
            const queued = acquireLLMSlot().then(() => { resolved = true; });

            // Give micro-task a chance to run
            await new Promise(r => setTimeout(r, 10));
            expect(resolved).toBe(false);

            // Release one slot - queued request should resolve
            releaseLLMSlot();
            await queued;
            expect(resolved).toBe(true);

            // Clean up
            resetLLMQueue();
        });
    });

    describe('releaseLLMSlot', () => {
        it('should not go below zero active requests', () => {
            // Release without acquiring should not crash
            releaseLLMSlot();
            releaseLLMSlot();
            // No error means success
        });
    });

    describe('resetLLMQueue', () => {
        it('should clear all active and queued requests', async () => {
            // Acquire some slots
            await acquireLLMSlot();
            await acquireLLMSlot();

            resetLLMQueue();

            // Should be able to acquire again immediately
            await acquireLLMSlot();
            releaseLLMSlot();
            resetLLMQueue();
        });
    });

    describe('E2E mocked LLM mode', () => {
        it('should return mocked analysis when external LLM is disabled', async () => {
            process.env.E2E_DISABLE_EXTERNAL_LLM = 'true';

            const result = await analyzeResumeWithLLM('<p>CV test</p>', 'firm-1', 'candidate.docx');

            expect(result.globalRating).toBe(76);
            expect(result.tags.skills).toContain('React');
        });

        it('should return mocked pre-analysis text when external LLM is disabled', async () => {
            process.env.E2E_DISABLE_EXTERNAL_LLM = 'true';

            const result = await preAnalyzeResumeWithLLM('Texte source', 'firm-1', 'candidate.docx');

            expect(result).toBe('Texte source');
        });

        it('should return mocked improvement when external LLM is disabled', async () => {
            process.env.E2E_DISABLE_EXTERNAL_LLM = 'true';

            const result = await improveResumeWithLLM('<p>CV test</p>', null, 'firm-1', 'candidate.docx');

            expect(result.text).toContain('Version optimisée E2E');
            expect(result.analysis.globalRating).toBe(88);
        });

        it('should return mocked post-improvement analysis when external LLM is disabled', async () => {
            process.env.E2E_DISABLE_EXTERNAL_LLM = 'true';

            const result = await analyzeImprovedResumeWithLLM('<p>CV amélioré</p>', 'firm-1', 'candidate.docx');

            expect(result.globalRating).toBe(88);
        });
    });
});
