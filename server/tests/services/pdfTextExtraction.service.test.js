import { describe, expect, it } from 'vitest';

import { getForcedDocumentOcrDecision } from '../../services/pdfTextExtraction.service.js';

describe('pdfTextExtraction.service', () => {
    it('does not force full-document OCR when the threshold is disabled', () => {
        expect(getForcedDocumentOcrDecision({
            normalizedTextLength: 0,
            forceDocumentOcrTextLength: 0,
            totalPages: 25,
            maxForcedDocumentOcrPages: 10
        })).toEqual({
            shouldRun: false,
            reason: 'disabled'
        });
    });

    it('does not force full-document OCR when extracted text already meets the threshold', () => {
        expect(getForcedDocumentOcrDecision({
            normalizedTextLength: 120,
            forceDocumentOcrTextLength: 50,
            totalPages: 25,
            maxForcedDocumentOcrPages: 10
        })).toEqual({
            shouldRun: false,
            reason: 'threshold_met'
        });
    });

    it('skips full-document OCR when the page budget would be exceeded', () => {
        expect(getForcedDocumentOcrDecision({
            normalizedTextLength: 12,
            forceDocumentOcrTextLength: 50,
            totalPages: 25,
            maxForcedDocumentOcrPages: 10
        })).toEqual({
            shouldRun: false,
            reason: 'page_budget_exceeded'
        });
    });

    it('allows full-document OCR when the threshold is unmet and the page budget allows it', () => {
        expect(getForcedDocumentOcrDecision({
            normalizedTextLength: 12,
            forceDocumentOcrTextLength: 50,
            totalPages: 4,
            maxForcedDocumentOcrPages: 10
        })).toEqual({
            shouldRun: true,
            reason: 'threshold_unmet'
        });
    });
});
