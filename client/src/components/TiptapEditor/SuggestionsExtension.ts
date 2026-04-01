/**
 * ProseMirror Decoration-based Suggestions Extension for Tiptap.
 */

import { Extension } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import {
  type CandidateMatch,
  MIN_MATCH_SCORE,
  normalizeText,
  scoreMatch,
  SECTION_DEFS,
} from './SuggestionsExtension.matching';
import {
  createBadgeWidget,
  createGlobalPanel,
} from './SuggestionsExtension.widgets';
import {
  getSuggestionsCount,
  parseSuggestions,
  type SuggestionsBySection,
} from './suggestions.shared';

interface SuggestionsStorage {
  visible: boolean;
  suggestions: SuggestionsBySection;
}

function buildDecorations(
  doc: ProseMirrorNode,
  storage: SuggestionsStorage,
): DecorationSet {
  if (!storage.visible) return DecorationSet.empty;

  const { suggestions } = storage;
  if (!suggestions || Object.keys(suggestions).length === 0) {
    return DecorationSet.empty;
  }

  if (getSuggestionsCount(suggestions) === 0) {
    return DecorationSet.empty;
  }

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

  candidates.sort((a, b) => b.score - a.score);

  const assignedSections = new Set<string>();
  const assignedPositions = new Set<number>();
  const decorations: Decoration[] = [];

  for (const candidate of candidates) {
    if (assignedSections.has(candidate.sectionKey)) continue;
    if (assignedPositions.has(candidate.pos)) continue;

    assignedSections.add(candidate.sectionKey);
    assignedPositions.add(candidate.pos);

    const sectionSuggestions =
      suggestions[candidate.sectionKey as keyof SuggestionsBySection] ?? [];

    decorations.push(
      Decoration.node(candidate.pos, candidate.pos + candidate.node.nodeSize, {
        class: 'suggestion-deco-highlight',
      }),
    );

    decorations.push(
      Decoration.widget(
        candidate.pos + candidate.node.nodeSize - 1,
        () => createBadgeWidget(candidate.sectionKey, sectionSuggestions),
        {
          side: 1,
          key: `suggestion-badge-${candidate.sectionKey}`,
        },
      ),
    );
  }

  const unmatchedSuggestions: SuggestionsBySection = {};
  let hasUnmatched = false;

  for (const [key, items] of Object.entries(suggestions)) {
    if (!items?.length) continue;
    if (!assignedSections.has(key) || key === 'atsOptimization') {
      (unmatchedSuggestions as Record<string, string[]>)[key] = items;
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

const suggestionsPluginKey = new PluginKey('suggestions');

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

export { parseSuggestions };
