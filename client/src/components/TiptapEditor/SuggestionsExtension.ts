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
// SECTION DETECTION
// ============================================

const SECTION_MARKERS: Record<string, string[]> = {
  executiveSummary: [
    'profil', 'résumé', 'summary', 'profile', 'présentation',
    'introduction', 'objectif', 'sommaire', 'à propos', 'about',
  ],
  skills: [
    'compétences', 'skills', 'technologies', 'outils', 'expertise',
    'savoir-faire', 'compétences techniques', 'technical skills',
    'stack technique', 'environnement technique',
  ],
  experiences: [
    'expérience', 'experience', 'parcours', 'missions', 'postes',
    'emplois', 'expériences professionnelles', 'professional experience',
    'work experience', 'historique',
  ],
  education: [
    'formation', 'education', 'diplômes', 'études', 'certifications',
    'académique', 'cursus', 'scolarité', 'diplôme',
  ],
  hobbiesLanguages: [
    'langues', 'languages', 'loisirs', 'hobbies', "centres d'intérêt",
    'interests', 'activités', 'divers', 'autres',
  ],
  atsOptimization: [], // Global — shown in top panel only
};

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

  const decorations: Decoration[] = [];
  const matchedSections = new Set<string>();

  // Walk document to find section headings
  doc.descendants((node, pos) => {
    if (!node.isBlock) return;
    if (node.type.name !== 'heading' && node.type.name !== 'paragraph') return;

    const text = node.textContent.toLowerCase().trim();
    if (!text) return;

    for (const [sectionKey, markers] of Object.entries(SECTION_MARKERS)) {
      if (matchedSections.has(sectionKey)) continue;
      if (!markers.length) continue; // skip marker-less sections (ATS)

      const sectionSuggestions =
        suggestions[sectionKey as keyof SuggestionsBySection];
      if (!sectionSuggestions?.length) continue;

      const matched = markers.some((m) => text.includes(m));
      if (!matched) continue;

      matchedSections.add(sectionKey);

      // Node decoration: highlight the heading
      decorations.push(
        Decoration.node(pos, pos + node.nodeSize, {
          class: 'suggestion-deco-highlight',
        }),
      );

      // Widget decoration: badge at end of heading content
      const widget = createBadgeWidget(sectionKey, sectionSuggestions);
      decorations.push(
        Decoration.widget(pos + node.nodeSize - 1, () => widget, {
          side: 1,
          key: `suggestion-badge-${sectionKey}`,
        }),
      );

      break; // one match per node
    }
  });

  // Global panel for unmatched / ATS suggestions
  const unmatchedSuggestions: SuggestionsBySection = {};
  let hasUnmatched = false;

  for (const [key, items] of Object.entries(suggestions)) {
    if (!items?.length) continue;
    if (!matchedSections.has(key) || key === 'atsOptimization') {
      (unmatchedSuggestions as Record<string, string[]>)[key] =
        items as string[];
      hasUnmatched = true;
    }
  }

  if (hasUnmatched) {
    const panelData =
      matchedSections.size === 0 ? suggestions : unmatchedSuggestions;
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
