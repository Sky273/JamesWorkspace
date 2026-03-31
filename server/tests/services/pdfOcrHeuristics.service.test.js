import { describe, it, expect } from 'vitest';
import {
    getScannedPageInfo,
    findInkBoundingBox,
    scoreOcrResult,
    getTextLength,
    scoreOcrCandidateQuality,
    buildOcrCandidate,
    scoreBlockSequence,
    buildBlockSequenceText
} from '../../services/pdfOcrHeuristics.service.js';

describe('pdfOcrHeuristics.service', () => {
    it('detects scanned pages when text layer is nearly empty', () => {
        expect(getScannedPageInfo({
            items: [{ str: '' }, { str: ' ' }]
        })).toEqual({
            totalTextLength: 1,
            scanned: true
        });
    });

    it('keeps native pages when enough text items are present', () => {
        expect(getScannedPageInfo({
            items: [
                { str: 'Professional' },
                { str: 'experience' },
                { str: 'with' },
                { str: 'solid' },
                { str: 'details' }
            ]
        })).toEqual({
            totalTextLength: 38,
            scanned: false
        });
    });

    it('finds the ink bounding box in raster data', () => {
        const width = 4;
        const height = 3;
        const pixels = new Uint8ClampedArray(width * height * 4).fill(255);
        const setPixel = (x, y, value) => {
            const offset = (y * width + x) * 4;
            pixels[offset] = value;
            pixels[offset + 1] = value;
            pixels[offset + 2] = value;
            pixels[offset + 3] = 255;
        };

        setPixel(1, 0, 0);
        setPixel(3, 2, 20);

        expect(findInkBoundingBox(pixels, width, height)).toEqual({
            minX: 1,
            minY: 0,
            maxX: 3,
            maxY: 2
        });
    });

    it('returns null when no dark pixel is present', () => {
        const pixels = new Uint8ClampedArray(2 * 2 * 4).fill(255);
        expect(findInkBoundingBox(pixels, 2, 2)).toBeNull();
    });

    it('scores OCR text with confidence bonus', () => {
        expect(scoreOcrResult('resume', 10)).toBe(26);
    });

    it('extracts text length from OCR candidate-like objects', () => {
        expect(getTextLength({ text: '  abc  ' })).toBe(3);
    });

    it('rewards realistic OCR candidate text over gibberish', () => {
        const goodScore = scoreOcrCandidateQuality(
            'Jane Doe\njane.doe@example.com\n+33 6 11 22 33 44\nEXPERIENCE\nEngineer 2024',
            88
        );
        const badScore = scoreOcrCandidateQuality('@@@ ### !!!', 88);

        expect(goodScore).toBeGreaterThan(badScore);
        expect(goodScore).toBeGreaterThan(100);
    });

    it('builds OCR candidates with computed quality score', () => {
        const candidate = buildOcrCandidate('pdftoppm-page', {
            text: 'John Doe\nEXPERIENCE\nDeveloper',
            confidence: 72,
            engine: 'tesseract-cli',
            psm: '6'
        });

        expect(candidate).toEqual(expect.objectContaining({
            variant: 'pdftoppm-page',
            confidence: 72,
            engine: 'tesseract-cli',
            psm: '6'
        }));
        expect(candidate.score).toBeGreaterThan(0);
    });

    it('builds block sequence text in order and skips empty blocks', () => {
        expect(buildBlockSequenceText([
            { order: 2, text: 'Third' },
            { order: 0, text: 'First' },
            { order: 1, text: 'Second' },
            { order: 3, text: '   ' }
        ])).toBe('First\n\nSecond\n\nThird');
    });

    it('scores block sequences by accumulating block OCR scores', () => {
        expect(scoreBlockSequence([
            { text: 'Alpha', confidence: 10 },
            { text: 'Beta', confidence: 20 }
        ])).toBe(scoreOcrResult('Alpha', 10) + scoreOcrResult('Beta', 20));
    });
});
