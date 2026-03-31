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

    it('should repair common degraded OCR CV artifacts', () => {
        const result = cleanExtractedResumeText(
            'PIERRE MARTIN Chetde Projet IT pierre.martin@emailcom | +33 699 88 77 66 PROFIL Chetde projet IT avec 12 ans d’expürience EXPERIENCE 20212025 Chefde Proyet',
            { ocrUsed: true }
        );

        expect(result.text).toContain('Chef de Projet');
        expect(result.text).toContain('pierre.martin@email.com');
        expect(result.text).toContain('2021 2025');
    });
});
