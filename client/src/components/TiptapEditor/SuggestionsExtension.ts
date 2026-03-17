/**
 * ProseMirror Decoration-based Suggestions Extension for Tiptap
 *
 * Displays improvement suggestions as non-destructive visual overlays
 * (decorations) on section headings. The actual document content is never
 * modified, so getContent() always returns clean HTML.
 */

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';

// ============================================
// TYPES
// ============================================

export interface SuggestionsBySection {
  executiveSummary?: string[];
  skills?: string[];
  experiences?: string[];
  education?: string[];
  hobbiesLanguages?: string[];
  atsOptimization?: string[];
}

interface SuggestionsStorage {
  visible: boolean;
  suggestions: SuggestionsBySection;
}

// ============================================
// SECTION DETECTION (v2 — scored matching)
// ============================================

/**
 * Each marker carries a specificity score (higher = more distinctive)
 * and an optional `generic` flag. Generic markers are only matched
 * against headings or very short paragraphs to avoid false positives
 * in body text.  All marker texts are pre-normalised (lowercase, no
 * diacritics) so they can be compared with normalizeText() output.
 */
interface MarkerDef {
  text: string;
  specificity: number;
  generic?: boolean;
}

const SECTION_DEFS: Record<string, MarkerDef[]> = {
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
  atsOptimization: [], // Global — shown in top panel only
};

/** Minimum score a candidate must reach to be considered a valid match. */
const MIN_MATCH_SCORE = 20;

// ============================================
// TEXT NORMALISATION
// ============================================

/**
 * Lowercase, strip diacritics, normalise apostrophes.
 * "Compétences Techniques" → "competences techniques"
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[''ʼ`]/g, "'")
    .trim();
}

// ============================================
// SCORING ENGINE
// ============================================

interface CandidateMatch {
  pos: number;
  node: ProseMirrorNode;
  sectionKey: string;
  score: number;
}

/**
 * Check whether the first direct‐child text node of a paragraph
 * carries a bold mark — a common pattern for section headers
 * in CVs that don't use proper heading tags.
 */
function startsWithBold(node: ProseMirrorNode): boolean {
  if (node.type.name !== 'paragraph' || node.childCount === 0) return false;
  const first = node.child(0);
  return first.isText && first.marks.some((m) => m.type.name === 'bold');
}

/**
 * Score how well a document node matches a given section.
 * Returns -1 if no marker matches at all.
 */
function scoreMatch(
  node: ProseMirrorNode,
  normalizedText: string,
  textLength: number,
  markers: MarkerDef[],
): number {
  if (!markers.length) return -1;

  const isHeading = node.type.name === 'heading';
  const headingLevel: number = isHeading
    ? ((node.attrs as Record<string, number>).level ?? 6)
    : 99;
  const isParagraph = node.type.name === 'paragraph';

  // Long paragraphs are body text, never section headers
  if (isParagraph && textLength > 80) return -1;

  let bestScore = -1;

  for (const marker of markers) {
    // Generic markers only match headings or very short paragraphs
    if (marker.generic && isParagraph && textLength > 40) continue;

    if (!normalizedText.includes(marker.text)) continue;

    let score = 0;

    // ── Match quality ──────────────────────────────────────
    if (normalizedText === marker.text) {
      score += 50; // exact match
    } else if (normalizedText.startsWith(marker.text)) {
      score += 42; // starts with marker
    } else {
      const coverage = marker.text.length / normalizedText.length;
      if (coverage > 0.6) {
        score += 35; // marker is most of the text
      } else {
        // word-boundary check — marker appears as a distinct phrase
        const esc = marker.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const wb = new RegExp(
          `(?:^|[\\s,;:.!?/()\\[\\]|–—\\-])${esc}(?:[\\s,;:.!?/()\\[\\]|–—\\-]|$)`,
        );
        score += wb.test(normalizedText) ? 20 : 8;
      }
    }

    // ── Node type bonus ────────────────────────────────────
    if (isHeading) {
      score += headingLevel <= 3 ? 50 : 35;
    } else if (isParagraph) {
      // Bold short paragraphs behave like headings in many CVs
      score += startsWithBold(node) ? 25 : 10;
    }

    // ── Text brevity bonus (short text = likely a title) ───
    if (textLength < 30) score += 15;
    else if (textLength < 50) score += 8;
    else if (textLength < 80) score += 2;

    // ── Marker specificity ─────────────────────────────────
    score += marker.specificity;

    if (score > bestScore) bestScore = score;
  }

  return bestScore;
}

const SECTION_LABELS: Record<string, string> = {
  executiveSummary: 'Résumé exécutif',
  skills: 'Compétences',
  experiences: 'Expérience',
  education: 'Formation',
  hobbiesLanguages: 'Langues & Loisirs',
  atsOptimization: 'Optimisation ATS',
};

// ============================================
// DOM HELPERS  (widget factories)
// ============================================

function createBadgeWidget(
  sectionKey: string,
  suggestions: string[],
): HTMLElement {
  const wrapper = document.createElement('span');
  wrapper.className = 'suggestion-deco-badge';
  wrapper.setAttribute('contenteditable', 'false');

  // Pill
  const pill = document.createElement('span');
  pill.className = 'suggestion-deco-pill';
  pill.textContent = `💡 ${suggestions.length}`;
  wrapper.appendChild(pill);

  // Tooltip (shown on hover via CSS)
  const tooltip = document.createElement('div');
  tooltip.className = 'suggestion-deco-tooltip';

  const title = document.createElement('div');
  title.className = 'suggestion-deco-tooltip-title';
  title.textContent = `${SECTION_LABELS[sectionKey] || 'Suggestions'} (${suggestions.length})`;
  tooltip.appendChild(title);

  const list = document.createElement('ul');
  list.className = 'suggestion-deco-tooltip-list';
  suggestions.forEach((s) => {
    const li = document.createElement('li');
    li.textContent = s;
    list.appendChild(li);
  });
  tooltip.appendChild(list);

  wrapper.appendChild(tooltip);
  return wrapper;
}

function createGlobalPanel(
  suggestions: SuggestionsBySection,
): HTMLElement | null {
  const sectionOrder: (keyof SuggestionsBySection)[] = [
    'executiveSummary',
    'skills',
    'experiences',
    'education',
    'hobbiesLanguages',
    'atsOptimization',
  ];

  const entries: Array<{ key: string; label: string; items: string[] }> = [];
  for (const key of sectionOrder) {
    const items = suggestions[key];
    if (items?.length) {
      entries.push({ key, label: SECTION_LABELS[key] || key, items });
    }
  }

  if (entries.length === 0) return null;

  const totalCount = entries.reduce((sum, e) => sum + e.items.length, 0);

  const panel = document.createElement('div');
  panel.className = 'suggestion-deco-panel';
  panel.setAttribute('contenteditable', 'false');

  // Header
  const header = document.createElement('div');
  header.className = 'suggestion-deco-panel-header';
  const headerIcon = document.createElement('span');
  headerIcon.className = 'suggestion-deco-panel-icon';
  headerIcon.textContent = '💡';
  const headerText = document.createElement('span');
  headerText.textContent = "Suggestions d'amélioration";
  const headerCount = document.createElement('span');
  headerCount.className = 'suggestion-deco-panel-count';
  headerCount.textContent = String(totalCount);
  header.append(headerIcon, headerText, headerCount);
  panel.appendChild(header);

  // Sections
  for (const entry of entries) {
    const section = document.createElement('div');
    section.className = 'suggestion-deco-panel-section';

    const sTitle = document.createElement('div');
    sTitle.className = 'suggestion-deco-panel-section-title';
    const sTitleLabel = document.createElement('span');
    sTitleLabel.textContent = entry.label;
    const sTitleCount = document.createElement('span');
    sTitleCount.className = 'suggestion-deco-panel-section-count';
    sTitleCount.textContent = String(entry.items.length);
    sTitle.append(sTitleLabel, sTitleCount);
    section.appendChild(sTitle);

    const list = document.createElement('ul');
    list.className = 'suggestion-deco-panel-list';
    entry.items.forEach((item) => {
      const li = document.createElement('li');
      li.textContent = item;
      list.appendChild(li);
    });
    section.appendChild(list);
    panel.appendChild(section);
  }

  return panel;
}

// ============================================
// DECORATION BUILDER
// ============================================

function buildDecorations(
  doc: ProseMirrorNode,
  storage: SuggestionsStorage,
): DecorationSet {
  if (!storage.visible) return DecorationSet.empty;

  const { suggestions } = storage;
  if (!suggestions || Object.keys(suggestions).length === 0)
    return DecorationSet.empty;

  const totalCount = Object.values(suggestions)
    .flat()
    .filter(Boolean).length;
  if (totalCount === 0) return DecorationSet.empty;

  // ── Pass 1: collect scored candidates ────────────────────
  const candidates: CandidateMatch[] = [];

  doc.descendants((node, pos) => {
    if (!node.isBlock) return;
    if (node.type.name !== 'heading' && node.type.name !== 'paragraph') return;

    const rawText = node.textContent.trim();
    if (!rawText) return;

    const normalized = normalizeText(rawText);
    if (!normalized) return;

    for (const [sectionKey, markers] of Object.entries(SECTION_DEFS)) {
      const sectionSuggestions =
        suggestions[sectionKey as keyof SuggestionsBySection];
      if (!sectionSuggestions?.length) continue;

      const score = scoreMatch(node, normalized, rawText.length, markers);
      if (score >= MIN_MATCH_SCORE) {
        candidates.push({ pos, node, sectionKey, score });
      }
    }
  });

  // ── Pass 2: greedy assignment (highest scores first) ─────
  candidates.sort((a, b) => b.score - a.score);

  const assignedSections = new Set<string>();
  const assignedPositions = new Set<number>();
  const decorations: Decoration[] = [];

  for (const c of candidates) {
    if (assignedSections.has(c.sectionKey)) continue;
    if (assignedPositions.has(c.pos)) continue;

    assignedSections.add(c.sectionKey);
    assignedPositions.add(c.pos);

    const sectionSuggestions =
      suggestions[c.sectionKey as keyof SuggestionsBySection]!;

    // Node decoration: highlight the heading / paragraph
    decorations.push(
      Decoration.node(c.pos, c.pos + c.node.nodeSize, {
        class: 'suggestion-deco-highlight',
      }),
    );

    // Widget decoration: badge at end of node content
    const widget = createBadgeWidget(c.sectionKey, sectionSuggestions);
    decorations.push(
      Decoration.widget(c.pos + c.node.nodeSize - 1, () => widget, {
        side: 1,
        key: `suggestion-badge-${c.sectionKey}`,
      }),
    );
  }

  // ── Global panel for unmatched / ATS suggestions ─────────
  const unmatchedSuggestions: SuggestionsBySection = {};
  let hasUnmatched = false;

  for (const [key, items] of Object.entries(suggestions)) {
    if (!items?.length) continue;
    if (!assignedSections.has(key) || key === 'atsOptimization') {
      (unmatchedSuggestions as Record<string, string[]>)[key] =
        items as string[];
      hasUnmatched = true;
    }
  }

  if (hasUnmatched) {
    const panelData =
      assignedSections.size === 0 ? suggestions : unmatchedSuggestions;
    const panel = createGlobalPanel(panelData);
    if (panel) {
      decorations.push(
        Decoration.widget(0, () => panel, {
          side: -1,
          key: 'suggestion-global-panel',
        }),
      );
    }
  }

  return DecorationSet.create(doc, decorations);
}

// ============================================
// PLUGIN KEY
// ============================================

const suggestionsPluginKey = new PluginKey('suggestions');

// ============================================
// TIPTAP EXTENSION
// ============================================

export interface SuggestionsOptions {
  suggestions: SuggestionsBySection;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    suggestions: {
      setSuggestions: (suggestions: SuggestionsBySection) => ReturnType;
      toggleSuggestions: () => ReturnType;
    };
  }
}

export const SuggestionsExtension = Extension.create<
  SuggestionsOptions,
  SuggestionsStorage
>({
  name: 'suggestions',

  addOptions() {
    return {
      suggestions: {} as SuggestionsBySection,
    };
  },

  addStorage() {
    return {
      visible: true,
      suggestions: this.options.suggestions || {},
    };
  },

  addCommands() {
    return {
      setSuggestions:
        (suggestions: SuggestionsBySection) =>
        ({ tr, dispatch }) => {
          this.storage.suggestions = suggestions;
          if (dispatch) {
            dispatch(tr.setMeta(suggestionsPluginKey, { type: 'update' }));
          }
          return true;
        },

      toggleSuggestions:
        () =>
        ({ tr, dispatch }) => {
          this.storage.visible = !this.storage.visible;
          if (dispatch) {
            dispatch(tr.setMeta(suggestionsPluginKey, { type: 'toggle' }));
          }
          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    const storage = this.storage;

    return [
      new Plugin({
        key: suggestionsPluginKey,
        state: {
          init(_, { doc }) {
            return buildDecorations(doc, storage);
          },
          apply(tr, old, _, newState) {
            if (tr.getMeta(suggestionsPluginKey) || tr.docChanged) {
              return buildDecorations(newState.doc, storage);
            }
            return old.map(tr.mapping, tr.doc);
          },
        },
        props: {
          decorations(state) {
            return this.getState(state);
          },
        },
      }),
    ];
  },
});

// ============================================
// PARSE UTILITY
// ============================================

/**
 * Parse suggestions from a JSON string or object.
 * Handles various formats returned by the analysis API.
 */
export function parseSuggestions(
  input: string | object | undefined | null,
): SuggestionsBySection {
  if (!input) return {};

  try {
    const parsed: unknown =
      typeof input === 'string' ? JSON.parse(input) : input;

    if (typeof parsed === 'object' && parsed !== null) {
      return parsed as SuggestionsBySection;
    }
  } catch {
    // ignore parse errors
  }

  return {};
}
