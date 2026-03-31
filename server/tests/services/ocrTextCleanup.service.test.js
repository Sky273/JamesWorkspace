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
    it('should apply minimal section formatting even without OCR', () => {
        const result = cleanExtractedResumeText(
            'CONTACT john.doe@email.com FORMATION ACADEMIQUE Master 2020 EXPERIENCES PROFESSIONNELLES 03/2022 - 12/2023 Consultant .Net | MENISYS Paris | France COMPETENCES - JavaScript - TypeScript',
            { ocrUsed: false }
        );

        expect(result.text).toContain('CONTACT\njohn.doe@email.com');
        expect(result.text).toContain('\nFORMATION ACADEMIQUE\nMaster 2020');
        expect(result.text).toContain('\nEXPERIENCES PROFESSIONNELLES\n03/2022 - 12/2023');
        expect(result.text).toContain('\nMENISYS Paris\nFrance');
        expect(result.text).toContain('\nCOMPETENCES\n- JavaScript');
    });

    it('should better separate major sections and experience blocks from word extracts', () => {
        const result = cleanExtractedResumeText(
            'Passions et soft skills Sports collectifs et individuels ; Arts graphiques COMPÉTENCES Professionnelles PDCA ; JIRA ; ISO 9001 EXPÉRIENCES professionnelles TRESCAL (Depuis 2022) – Chef de projet AMOA ; Support aux clients ; Tests de validation. SPIREC (2021 – 2022) – Ingénieur d’Affaire ; Négociation. FORMATIONS et Diplômes 2021 - 2022 : Master spécialisé.',
            { ocrUsed: false }
        );

        expect(result.text).toContain('Passions et soft skills');
        expect(result.text).toContain('\nCOMPÉTENCES Professionnelles\n');
        expect(result.text).toContain('PDCA\nJIRA\nISO 9001');
        expect(result.text).toContain('\nEXPÉRIENCES professionnelles\nTRESCAL (Depuis 2022) – Chef de projet AMOA');
        expect(result.text).toContain('Support aux clients\nTests de validation.');
        expect(result.text).toContain('SPIREC (2021 – 2022) – Ingénieur d’Affaire\nNégociation.');
        expect(result.text).toContain('\nFORMATIONS et Diplômes\n2021 - 2022 : Master spécialisé.');
    });
});
