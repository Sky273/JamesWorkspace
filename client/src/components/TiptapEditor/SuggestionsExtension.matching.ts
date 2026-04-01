import type { Node as ProseMirrorNode } from '@tiptap/pm/model';

export interface MarkerDef {
  text: string;
  specificity: number;
  generic?: boolean;
}

export interface CandidateMatch {
  pos: number;
  node: ProseMirrorNode;
  sectionKey: string;
  score: number;
}

export const SECTION_DEFS: Record<string, MarkerDef[]> = {
  executiveSummary: [
    { text: 'resume executif', specificity: 18 },
    { text: 'profil professionnel', specificity: 18 },
    { text: 'synthese professionnelle', specificity: 18 },
    { text: 'executive summary', specificity: 18 },
    { text: 'a propos de moi', specificity: 15 },
    { text: 'a propos', specificity: 12 },
    { text: 'summary', specificity: 10 },
    { text: 'profile', specificity: 8 },
    { text: 'profil', specificity: 8 },
    { text: 'resume', specificity: 6 },
    { text: 'presentation', specificity: 6 },
    { text: 'synthese', specificity: 6 },
    { text: 'introduction', specificity: 5, generic: true },
    { text: 'objectif', specificity: 5 },
    { text: 'sommaire', specificity: 5, generic: true },
    { text: 'about', specificity: 5 },
  ],
  skills: [
    { text: 'competences techniques', specificity: 18 },
    { text: 'competences cles', specificity: 18 },
    { text: 'technical skills', specificity: 18 },
    { text: 'stack technique', specificity: 18 },
    { text: 'environnement technique', specificity: 18 },
    { text: "domaines d'expertise", specificity: 15 },
    { text: 'savoir-faire', specificity: 12 },
    { text: 'competences', specificity: 10 },
    { text: 'skills', specificity: 10 },
    { text: 'expertise', specificity: 8 },
    { text: 'technologies', specificity: 6, generic: true },
    { text: 'outils', specificity: 4, generic: true },
  ],
  experiences: [
    { text: 'experiences professionnelles', specificity: 18 },
    { text: 'experience professionnelle', specificity: 18 },
    { text: 'professional experience', specificity: 18 },
    { text: 'work experience', specificity: 18 },
    { text: 'parcours professionnel', specificity: 18 },
    { text: 'experiences', specificity: 10 },
    { text: 'experience', specificity: 10 },
    { text: 'parcours', specificity: 8 },
    { text: 'postes', specificity: 5, generic: true },
    { text: 'emplois', specificity: 5, generic: true },
    { text: 'missions', specificity: 4, generic: true },
    { text: 'historique', specificity: 3, generic: true },
  ],
  education: [
    { text: 'formations et certifications', specificity: 18 },
    { text: 'formation academique', specificity: 18 },
    { text: 'diplomes et certifications', specificity: 18 },
    { text: 'formation professionnelle', specificity: 15 },
    { text: 'formation', specificity: 10 },
    { text: 'education', specificity: 10 },
    { text: 'diplomes', specificity: 10 },
    { text: 'diplome', specificity: 8 },
    { text: 'certifications', specificity: 8 },
    { text: 'cursus', specificity: 8 },
    { text: 'scolarite', specificity: 8 },
    { text: 'etudes', specificity: 6 },
    { text: 'academique', specificity: 5, generic: true },
  ],
  hobbiesLanguages: [
    { text: "centres d'interet", specificity: 18 },
    { text: 'langues et loisirs', specificity: 18 },
    { text: 'informations complementaires', specificity: 15 },
    { text: 'langues', specificity: 10 },
    { text: 'languages', specificity: 10 },
    { text: 'loisirs', specificity: 10 },
    { text: 'hobbies', specificity: 10 },
    { text: 'interests', specificity: 8 },
    { text: 'activites', specificity: 4, generic: true },
    { text: 'divers', specificity: 3, generic: true },
    { text: 'autres', specificity: 2, generic: true },
  ],
  atsOptimization: [],
};

export const MIN_MATCH_SCORE = 20;

export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[''Ê¼`]/g, "'")
    .trim();
}

export function startsWithBold(node: ProseMirrorNode): boolean {
  if (node.type.name !== 'paragraph' || node.childCount === 0) return false;
  const first = node.child(0);
  return first.isText && first.marks.some((mark) => mark.type.name === 'bold');
}

export function scoreMatch(
  node: ProseMirrorNode,
  normalizedText: string,
  textLength: number,
  markers: MarkerDef[],
): number {
  if (!markers.length) return -1;

  const isHeading = node.type.name === 'heading';
  const headingLevel = isHeading
    ? ((node.attrs as Record<string, number>).level ?? 6)
    : 99;
  const isParagraph = node.type.name === 'paragraph';

  if (isParagraph && textLength > 80) return -1;

  let bestScore = -1;

  for (const marker of markers) {
    if (marker.generic && isParagraph && textLength > 40) continue;
    if (!normalizedText.includes(marker.text)) continue;

    let score = 0;

    if (normalizedText === marker.text) score += 50;
    else if (normalizedText.startsWith(marker.text)) score += 42;
    else {
      const coverage = marker.text.length / normalizedText.length;
      if (coverage > 0.6) score += 35;
      else {
        const escaped = marker.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const wordBoundary = new RegExp(
          `(?:^|[\\s,;:.!?/()\\[\\]|â€“â€”\\-])${escaped}(?:[\\s,;:.!?/()\\[\\]|â€“â€”\\-]|$)`,
        );
        score += wordBoundary.test(normalizedText) ? 20 : 8;
      }
    }

    if (isHeading) score += headingLevel <= 3 ? 50 : 35;
    else if (isParagraph) score += startsWithBold(node) ? 25 : 10;

    if (textLength < 30) score += 15;
    else if (textLength < 50) score += 8;
    else if (textLength < 80) score += 2;

    score += marker.specificity;
    if (score > bestScore) bestScore = score;
  }

  return bestScore;
}
