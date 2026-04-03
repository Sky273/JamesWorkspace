import { describe, expect, it } from 'vitest';
import { normalizeEditorContent } from './contentNormalization';

describe('contentNormalization', () => {
  it('keeps existing HTML unchanged', () => {
    const html = '<p>Deja structure</p>';
    expect(normalizeEditorContent(html)).toBe(html);
  });

  it('preserves plain-text paragraphs using explicit blank lines only', () => {
    const result = normalizeEditorContent(
      'CONTACT\n'
      + 'john@example.com\n\n'
      + 'FORMATION\n'
      + 'Master 2020'
    );

    expect(result).toBe(
      '<p>CONTACT<br>john@example.com</p>'
      + '<p>FORMATION<br>Master 2020</p>'
    );
  });

  it('converts explicit bullet lines into an HTML list', () => {
    const result = normalizeEditorContent(
      'COMPETENCES\n'
      + '- JavaScript\n'
      + '- TypeScript'
    );

    expect(result).toBe(
      '<p>COMPETENCES</p>'
      + '<ul><li>JavaScript</li><li>TypeScript</li></ul>'
    );
  });

  it('does not invent sections from inline keywords or dates', () => {
    const result = normalizeEditorContent(
      'CONTACT john@example.com FORMATION ACADEMIQUE Master 2020 EXPERIENCES PROFESSIONNELLES 03/2022 - 12/2023 Consultant .Net | MENISYS Paris | France'
    );

    expect(result).toBe(
      '<p>CONTACT john@example.com FORMATION ACADEMIQUE Master 2020 EXPERIENCES PROFESSIONNELLES 03/2022 - 12/2023 Consultant .Net | MENISYS Paris | France</p>'
    );
  });

  it('escapes HTML and preserves line breaks inside a paragraph', () => {
    const result = normalizeEditorContent(
      'Nom <Admin>\n'
      + 'Utilise & verifie'
    );

    expect(result).toBe('<p>Nom &lt;Admin&gt;<br>Utilise &amp; verifie</p>');
  });
});
