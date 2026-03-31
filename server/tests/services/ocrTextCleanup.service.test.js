import { describe, expect, it } from 'vitest';

import { cleanExtractedResumeText, isPlaceholderCandidateName } from '../../services/ocrTextCleanup.service.js';

describe('ocrTextCleanup.service', () => {
    it('should normalize common OCR spacing artifacts in emails', () => {
        const result = cleanExtractedResumeText('luc . moreau @ gmail . com', { ocrUsed: true });
        expect(result.text).toBe('luc.moreau@gmail.com');
    });

    it('should flag generic OCR placeholder names', () => {
        expect(isPlaceholderCandidateName('CANDIDAT 1')).toBe(true);
        expect(isPlaceholderCandidateName('XXX')).toBe(true);
        expect(isPlaceholderCandidateName('Luc Moreau')).toBe(false);
    });
});
