import { describe, expect, it, vi } from 'vitest';
import { createOcrPageEvaluator, recognizeBlockSequence } from '../../services/pdfOcrPageOrchestrator.service.js';

describe('pdfOcrPageOrchestrator.service', () => {
    it('tracks the best OCR candidate while reporting attempts', () => {
        const onOcrVariantAttempt = vi.fn();
        const evaluator = createOcrPageEvaluator({
            pageNum: 2,
            maxVariantsPerPage: 5,
            maxOcrTimePerPageMs: 10_000,
            earlyAcceptScore: 200,
            onOcrVariantAttempt,
            buildCandidate: (variant, recognition) => ({
                variant,
                ...recognition,
                score: recognition.score
            })
        });

        evaluator.recordCandidate('base', { text: 'short', confidence: 0, engine: 'tesseract-cli', psm: '6', score: 10 });
        evaluator.recordCandidate('better', { text: 'longer text', confidence: 0, engine: 'tesseract-cli', psm: '11', score: 30 });

        expect(evaluator.getBestVariant()).toEqual(expect.objectContaining({
            variant: 'better',
            score: 30
        }));
        expect(onOcrVariantAttempt).toHaveBeenCalledTimes(2);
    });

    it('stops exploration after reaching an early accept score', () => {
        const evaluator = createOcrPageEvaluator({
            pageNum: 1,
            maxVariantsPerPage: 10,
            maxOcrTimePerPageMs: 10_000,
            earlyAcceptScore: 50,
            onOcrVariantAttempt: vi.fn(),
            buildCandidate: (variant, recognition) => ({
                variant,
                ...recognition,
                score: recognition.score
            })
        });

        evaluator.recordCandidate('excellent', { text: 'x', confidence: 0, engine: 'tesseract-cli', psm: '6', score: 55 });
        expect(evaluator.shouldStopExploration()).toBe(true);
    });

    it('considers externally built candidates', () => {
        const evaluator = createOcrPageEvaluator({
            pageNum: 1,
            maxVariantsPerPage: 10,
            maxOcrTimePerPageMs: 10_000,
            earlyAcceptScore: 100,
            onOcrVariantAttempt: vi.fn(),
            buildCandidate: (variant, recognition) => ({
                variant,
                ...recognition,
                score: recognition.score
            })
        });

        evaluator.considerCandidate({ variant: 'blocks', text: 'assembled', score: 80 });
        expect(evaluator.getBestVariant()).toEqual(expect.objectContaining({ variant: 'blocks', score: 80 }));
    });

    it('recognizes block sequences in order and computes average confidence', async () => {
        const onOcrVariantAttempt = vi.fn();

        const result = await recognizeBlockSequence({
            blocks: [
                { path: '/tmp/2.png', order: 2 },
                { path: '/tmp/0.png', order: 0 },
                { path: '/tmp/1.png', order: 1 }
            ],
            recognizer: vi
                .fn()
                .mockResolvedValueOnce({ text: 'Third', confidence: 30, engine: 'tesseract-cli', psm: '6' })
                .mockResolvedValueOnce({ text: 'First', confidence: 90, engine: 'tesseract-cli', psm: '6' })
                .mockResolvedValueOnce({ text: 'Second', confidence: 60, engine: 'tesseract-cli', psm: '6' }),
            onOcrVariantAttempt,
            pageNum: 4,
            variantPrefix: 'blocks',
            buildSequenceText: (results) => results
                .sort((a, b) => a.order - b.order)
                .map((item) => item.text)
                .join('\n\n'),
            scoreSequence: (results) => results.reduce((sum, item) => sum + item.confidence, 0)
        });

        expect(result).toEqual({
            variant: 'blocks',
            text: 'First\n\nSecond\n\nThird',
            confidence: 60,
            score: 180,
            engine: 'tesseract-cli',
            psm: 'blocks'
        });
        expect(onOcrVariantAttempt).toHaveBeenCalledTimes(3);
    });

    it('returns null for empty block sequences', async () => {
        await expect(recognizeBlockSequence({
            blocks: [],
            recognizer: vi.fn(),
            onOcrVariantAttempt: vi.fn(),
            pageNum: 1,
            buildSequenceText: () => '',
            scoreSequence: () => 0
        })).resolves.toBeNull();
    });
});
