const SECTION_HEADINGS = [
  'FORMATION ACADEMIQUE',
  'FORMATIONS ET DIPLOMES',
  'FORMATIONS',
  'FORMATION',
  'EXPERIENCES PROFESSIONNELLES',
  'EXPERIENCE PROFESSIONNELLE',
  'EXPERIENCES',
  'EXPERIENCE',
  'COMPETENCES PROFESSIONNELLES',
  'COMPETENCES TECHNIQUES',
  'COMPETENCES',
  'CERTIFICATIONS',
  'LANGUES',
  'CONTACT',
  'COORDONNEES',
  'POSTES RECHERCHES',
  'PROFIL',
  'RESUME',
  'LOISIRS',
  'PASSIONS ET SOFT SKILLS',
  'CENTRES D INTERET',
];

const SECTION_HEADING_REGEX = /\b(FORMATIONS?\s+ET\s+DIPLOMES?|FORMATION(?:S)?(?:\s+ACAD[ÉE]MIQUE)?|EXP[ÉE]RIENCE(?:S)?(?:\s+PROFESSIONNELLE(?:S)?)?|COMP[ÉE]TENCES?(?:\s+(?:TECHNIQUES?|PROFESSIONNELLES?))?|CERTIFICATIONS?|LANGUES?|CONTACT|COORDONN[ÉE]ES|POSTES\s+RECHERCH[ÉE]S|PROFIL|R[ÉE]SUM[ÉE]|LOISIRS|PASSIONS?\s+ET\s+SOFT\s+SKILLS|CENTRES?\s+D['’ ]INT[ÉE]R[ÊE]T)\b(?!\s*:)\s*/giu;

const DATE_BLOCK_REGEX = /\s+(?=(?:Depuis\s+)?(?:(?:0?[1-9]|1[0-2])\/\d{4}|\d{4})\s*(?:-|–|—|à)\s*(?:(?:0?[1-9]|1[0-2])\/\d{4}|\d{4}|Aujourd'hui|Aujourd’hui|Present|Présent))/giu;
const EXPERIENCE_SEPARATOR_REGEX = /\s*;\s+(?=[A-ZÀ-Ý])/gu;
const COMPANY_BOUNDARY_REGEX = /([a-zà-ÿ])\.([A-ZÀ-Ý][A-ZÀ-Ý '&/-]{2,}\s*(?:\(|\d{4}))/gu;
const EXPERIENCE_BLOCK_BREAK_REGEX = /([.])\s+(?=[A-ZÀ-Ý][A-ZÀ-Ý '&/-]{2,}\s*\()/gu;

function normalizePlainTextStructure(content: string): string {
  return content
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/g, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeHeadingText(line: string): string {
  return line
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['’]/g, ' ')
    .replace(/[^A-Za-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function injectSectionLineBreaks(content: string): string {
  return content
    .replace(/((?:0?[1-9]|1[0-2])\/\d{4})\s+((?:0?[1-9]|1[0-2])\/\d{4})/g, '$1 - $2')
    .replace(/\b((?:19|20)\d{2})\s+((?:19|20)\d{2})\b/g, '$1 - $2')
    .replace(COMPANY_BOUNDARY_REGEX, '$1.\n$2')
    .replace(EXPERIENCE_BLOCK_BREAK_REGEX, '$1\n\n')
    .replace(SECTION_HEADING_REGEX, '\n$1\n')
    .replace(/\s+-\s+(?=[A-Za-zÀ-ÿ])/gu, '\n- ')
    .replace(DATE_BLOCK_REGEX, '\n')
    .replace(EXPERIENCE_SEPARATOR_REGEX, '\n')
    .replace(/\s+\|\s+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function isSectionHeading(line: string): boolean {
  const compact = line.replace(/\s+/g, ' ').trim();
  const normalized = normalizeHeadingText(compact);

  if (SECTION_HEADINGS.includes(normalized)) {
    return true;
  }

  const letters = compact.match(/[A-Za-zÀ-ÿ]/g) || [];
  const uppercaseLetters = compact.match(/[A-ZÀ-Ý]/g) || [];
  const wordCount = compact.split(/\s+/).length;

  return letters.length > 0
    && compact.length <= 48
    && wordCount >= 2
    && wordCount <= 6
    && !/[.:@]/.test(compact)
    && !/^\d/.test(compact)
    && uppercaseLetters.length / letters.length >= 0.8;
}

function splitVisualSegments(line: string): string[] {
  return line
    .replace(/\s+\|\s+/g, '\n')
    .replace(EXPERIENCE_SEPARATOR_REGEX, '\n')
    .replace(DATE_BLOCK_REGEX, '\n')
    .replace(COMPANY_BOUNDARY_REGEX, '$1.\n$2')
    .replace(EXPERIENCE_BLOCK_BREAK_REGEX, '$1\n\n')
    .split('\n')
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function isHeadingContinuation(line: string): boolean {
  const compact = line.replace(/\s+/g, ' ').trim();
  if (!compact || compact.length > 28 || /[@:]/.test(compact)) {
    return false;
  }

  return /^(professionnelles?|techniques?|et dipl[oô]mes?|linguistiques?|personnelles?)$/iu.test(compact);
}

function mergeHeadingLines(lines: string[]): string[] {
  const merged: string[] = [];

  for (let index = 0; index < lines.length; index++) {
    const current = lines[index].trim();
    const next = lines[index + 1]?.trim() || '';

    if (current && isSectionHeading(current) && isHeadingContinuation(next)) {
      merged.push(`${current} ${next}`);
      index++;
      continue;
    }

    merged.push(lines[index]);
  }

  return merged;
}

export function isHtmlContent(content: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(content);
}

export function normalizeEditorContent(content: string): string {
  if (!content) {
    return '';
  }

  if (isHtmlContent(content)) {
    return content;
  }

  const normalized = injectSectionLineBreaks(normalizePlainTextStructure(content));
  if (!normalized) {
    return '';
  }

  const lines = mergeHeadingLines(normalized.split('\n'));
  const blocks: string[] = [];
  let currentParagraph: string[] = [];
  let currentList: string[] = [];
  const seenHeadings = new Set<string>();

  const flushParagraph = () => {
    if (currentParagraph.length === 0) {
      return;
    }
    blocks.push(`<p>${currentParagraph.map(escapeHtml).join('<br>')}</p>`);
    currentParagraph = [];
  };

  const flushList = () => {
    if (currentList.length === 0) {
      return;
    }
    blocks.push(`<ul>${currentList.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`);
    currentList = [];
  };

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index].trim();

    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }

    const bulletMatch = line.match(/^[-*•]\s+(.*)$/u);
    if (bulletMatch) {
      flushParagraph();
      currentList.push(bulletMatch[1].trim());
      continue;
    }

    if (isSectionHeading(line)) {
      const heading = normalizeHeadingText(line);
      const nextNonEmptyLine = lines.slice(index + 1).find((candidate) => candidate.trim());

      if (seenHeadings.has(heading) && (!nextNonEmptyLine || isSectionHeading(nextNonEmptyLine.trim()))) {
        continue;
      }

      flushParagraph();
      flushList();
      seenHeadings.add(heading);
      blocks.push(`<h2>${escapeHtml(heading)}</h2>`);
      continue;
    }

    flushList();
    currentParagraph.push(...splitVisualSegments(line));
  }

  flushParagraph();
  flushList();

  return blocks.join('');
}
