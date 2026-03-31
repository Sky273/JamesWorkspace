import { describe, expect, it } from 'vitest';
import { normalizeEditorContent } from './contentNormalization';

describe('contentNormalization', () => {
  it('renders section headings as h2 blocks', () => {
    const result = normalizeEditorContent('CONTACT\njohn@example.com\n\nFORMATION\nMaster 2020');

    expect(result).toBe('<h2>CONTACT</h2><p>john@example.com</p><h2>FORMATION</h2><p>Master 2020</p>');
  });

  it('converts bullet lines into an HTML list', () => {
    const result = normalizeEditorContent('COMPETENCES\n- JavaScript\n- TypeScript');

    expect(result).toBe('<h2>COMPETENCES</h2><ul><li>JavaScript</li><li>TypeScript</li></ul>');
  });

  it('splits inline section headings and date blocks heuristically', () => {
    const result = normalizeEditorContent(
      'CONTACT john@example.com FORMATION ACADEMIQUE Master 2020 EXPERIENCES PROFESSIONNELLES 03/2022 - 12/2023 Consultant .Net | MENISYS Paris | France'
    );

    expect(result).toBe(
      '<h2>CONTACT</h2><p>john@example.com</p>'
      + '<h2>FORMATION ACADEMIQUE</h2><p>Master 2020</p>'
      + '<h2>EXPERIENCES PROFESSIONNELLES</h2><p>03/2022 - 12/2023 Consultant .Net<br>MENISYS Paris<br>France</p>'
    );
  });

  it('keeps existing HTML unchanged', () => {
    const html = '<p>Deja structure</p>';
    expect(normalizeEditorContent(html)).toBe(html);
  });

  it('preserves explicit plain-text paragraphs before applying heuristics', () => {
    const result = normalizeEditorContent(
      'Erwan KENMOE\n'
      + 'erwan.kenmoe@gmail.com / (+33) 07 69 00 04 10\n\n'
      + 'Mobilité : Île-De-France\n'
      + 'Postes recherchés : Chef de Projet / Ingénieur Qualité Performance\n\n'
      + 'FORMATIONS\n'
      + '2021 - 2022 : Master spécialisé'
    );

    expect(result).toBe(
      '<p>Erwan KENMOE<br>erwan.kenmoe@gmail.com / (+33) 07 69 00 04 10</p>'
      + '<p>Mobilité : Île-De-France<br>Postes recherchés : Chef de Projet / Ingénieur Qualité Performance</p>'
      + '<h2>FORMATIONS</h2><p>2021 - 2022 : Master spécialisé</p>'
    );
  });

  it('merges split headings and drops duplicate orphan headings', () => {
    const result = normalizeEditorContent(
      'Passions et soft skills\n'
      + 'Sports collectifs et individuels ; Arts graphiques\n\n'
      + 'COMPÉTENCES\n'
      + 'Professionnelles\n'
      + 'PDCA ; JIRA ; ISO 9001\n\n'
      + 'EXPÉRIENCES\n'
      + 'professionnelles\n'
      + 'TRESCAL (Depuis 2022) – Chef de projet AMOA ; Support aux clients ; Tests de validation.\n'
      + 'SPIREC (2021 – 2022) – Ingénieur d’Affaire ; Négociation.\n\n'
      + 'FORMATIONS\n'
      + 'et Diplômes\n'
      + '2021 - 2022 : Master spécialisé.\n\n'
      + 'COMPÉTENCES\n'
      + 'Professionnelles\n'
      + 'EXPÉRIENCES\n'
      + 'professionnelles\n'
      + 'FORMATIONS\n'
      + 'et Diplômes'
    );

    expect(result).toContain('<h2>PASSIONS ET SOFT SKILLS</h2>');
    expect(result).toContain('<h2>COMPETENCES PROFESSIONNELLES</h2>');
    expect(result).toContain('<h2>EXPERIENCES PROFESSIONNELLES</h2>');
    expect(result).toContain('<h2>FORMATIONS ET DIPLOMES</h2>');
    expect(result).toContain('<p>TRESCAL (Depuis 2022) – Chef de projet AMOA<br>Support aux clients<br>Tests de validation.</p>');
    expect(result).toContain('<p>SPIREC (2021 – 2022) – Ingénieur d’Affaire<br>Négociation.</p>');
    expect(result.match(/<h2>COMPETENCES PROFESSIONNELLES<\/h2>/g)).toHaveLength(1);
    expect(result.match(/<h2>EXPERIENCES PROFESSIONNELLES<\/h2>/g)).toHaveLength(1);
    expect(result.match(/<h2>FORMATIONS ET DIPLOMES<\/h2>/g)).toHaveLength(1);
  });
});
