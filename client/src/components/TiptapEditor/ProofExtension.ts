import { Extension } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import {
  MIN_MATCH_SCORE,
  normalizeText,
  scoreMatch,
  SECTION_DEFS,
} from './SuggestionsExtension.matching';
import { type SkillProofEntry, getSkillProofCount } from './proof.shared';
import {
  formatExperienceYears,
  formatProofLevel,
  formatProofScore,
  getProofDetailRows,
} from './proof.presentation';

interface ProofStorage {
  visible: boolean;
  proofs: SkillProofEntry[];
}

const proofPluginKey = new PluginKey('skill-proofs');

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getProofTone(level: string | undefined): 'high' | 'medium' | 'low' {
  const normalized = String(level || '').trim().toLowerCase();
  if (normalized === 'high') return 'high';
  if (normalized === 'medium') return 'medium';
  return 'low';
}

function updateDropdownPosition(wrapper: HTMLElement, dropdown: HTMLElement): void {
  dropdown.classList.remove('is-align-right', 'is-above');

  const wrapperRect = wrapper.getBoundingClientRect();
  const dropdownRect = dropdown.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  if (wrapperRect.left + dropdownRect.width > viewportWidth - 16) {
    dropdown.classList.add('is-align-right');
  }

  if (
    wrapperRect.bottom + 10 + dropdownRect.height > viewportHeight - 16
    && wrapperRect.top - 10 - dropdownRect.height > 16
  ) {
    dropdown.classList.add('is-above');
  }
}

function appendDetailRows(
  container: HTMLElement,
  rows: Array<{ label: string; value: string }>,
): void {
  if (rows.length === 0) {
    return;
  }

  const details = document.createElement('dl');
  details.className = 'proof-deco-dropdown-list';

  rows.forEach((row) => {
    const detailRow = document.createElement('div');
    detailRow.className = 'proof-deco-dropdown-row';

    const dt = document.createElement('dt');
    dt.className = 'proof-deco-dropdown-label';
    dt.textContent = row.label;

    const dd = document.createElement('dd');
    dd.className = 'proof-deco-dropdown-value';
    dd.textContent = row.value;

    detailRow.append(dt, dd);
    details.appendChild(detailRow);
  });

  container.appendChild(details);
}

function appendNoteSection(container: HTMLElement, title: string, text: string, emphasis = false): void {
  const section = document.createElement('div');
  section.className = emphasis
    ? 'proof-deco-section proof-deco-section-emphasis'
    : 'proof-deco-section';

  const heading = document.createElement('div');
  heading.className = 'proof-deco-section-title';
  heading.textContent = title;

  const note = document.createElement('div');
  note.className = 'proof-deco-note';
  note.textContent = text;

  section.append(heading, note);
  container.appendChild(section);
}

function createProofWidget(proof: SkillProofEntry): HTMLElement {
  const tone = getProofTone(proof.proofLevel || proof.proof?.proofLevel);
  const detailRows = getProofDetailRows(proof);
  const wrapper = document.createElement('span');
  wrapper.className = 'proof-deco-badge';
  wrapper.setAttribute('contenteditable', 'false');

  const pill = document.createElement('button');
  pill.type = 'button';
  pill.className = `proof-deco-pill proof-deco-pill-${tone}`;
  pill.setAttribute('aria-label', `Preuve pour ${proof.name}`);
  pill.innerHTML = `<span class="proof-deco-pill-dot"></span><span class="proof-deco-badge-score">${escapeHtml(formatProofScore(proof.evidenceScore ?? proof.proofScore))}</span><span class="proof-deco-badge-level">${escapeHtml(formatProofLevel(proof.proofLevel || proof.proof?.proofLevel))}</span>`;
  wrapper.appendChild(pill);

  const dropdown = document.createElement('div');
  dropdown.className = 'proof-deco-dropdown';

  const header = document.createElement('div');
  header.className = 'proof-deco-dropdown-header';

  const titleBlock = document.createElement('div');
  titleBlock.className = 'proof-deco-dropdown-title-block';

  const title = document.createElement('span');
  title.className = 'proof-deco-dropdown-title';
  title.textContent = proof.name;

  const subtitle = document.createElement('span');
  subtitle.className = 'proof-deco-dropdown-subtitle';
  subtitle.textContent = proof.category === 'tool' ? 'Outil prouve' : 'Competence prouvee';

  titleBlock.append(title, subtitle);

  const closeBtn = document.createElement('button');
  closeBtn.className = 'proof-deco-dropdown-close';
  closeBtn.type = 'button';
  closeBtn.textContent = 'x';

  header.append(titleBlock, closeBtn);
  dropdown.appendChild(header);

  const metrics = document.createElement('div');
  metrics.className = 'proof-deco-dropdown-metrics';
  const metricItems = [
    { label: 'Preuve', value: formatProofScore(proof.evidenceScore ?? proof.proofScore) },
    { label: 'Confiance', value: typeof proof.confidence === 'number' ? formatProofScore(proof.confidence) : 'n/a' },
    { label: 'Experience', value: formatExperienceYears(proof) },
  ];

  metricItems.forEach((metric) => {
    const card = document.createElement('div');
    card.className = 'proof-deco-metric-card';

    const metricLabel = document.createElement('span');
    metricLabel.className = 'proof-deco-metric-label';
    metricLabel.textContent = metric.label;

    const metricValue = document.createElement('span');
    metricValue.className = 'proof-deco-metric-value';
    metricValue.textContent = metric.value;

    card.append(metricLabel, metricValue);
    metrics.appendChild(card);
  });

  dropdown.appendChild(metrics);

  const quickFacts = document.createElement('div');
  quickFacts.className = 'proof-deco-facts';
  const factItems = [
    { label: 'Recence', value: detailRows.find((row) => row.label === 'Recence')?.value },
    { label: 'Profondeur', value: detailRows.find((row) => row.label === "Profondeur d'usage")?.value },
    { label: 'Occurrences', value: detailRows.find((row) => row.label === 'Occurrences utiles')?.value },
    { label: 'Contextes', value: detailRows.find((row) => row.label === "Contextes d'usage")?.value },
  ].filter((fact) => fact.value);

  factItems.forEach((fact) => {
    const factChip = document.createElement('div');
    factChip.className = 'proof-deco-fact-chip';
    factChip.innerHTML = `<span class="proof-deco-fact-label">${escapeHtml(fact.label)}</span><span class="proof-deco-fact-value">${escapeHtml(String(fact.value))}</span>`;
    quickFacts.appendChild(factChip);
  });

  if (quickFacts.childElementCount > 0) {
    dropdown.appendChild(quickFacts);
  }

  const sources = proof.proof?.evidenceSources?.length
    ? proof.proof.evidenceSources
    : proof.evidence?.sourceTypes;
  if (sources?.length) {
    const sourcesBlock = document.createElement('div');
    sourcesBlock.className = 'proof-deco-section';

    const sourcesTitle = document.createElement('div');
    sourcesTitle.className = 'proof-deco-section-title';
    sourcesTitle.textContent = 'Sources';

    const sourcesChips = document.createElement('div');
    sourcesChips.className = 'proof-deco-chip-list';
    sources.forEach((source) => {
      const chip = document.createElement('span');
      chip.className = 'proof-deco-chip';
      chip.textContent = source.replace(/_/g, ' ');
      sourcesChips.appendChild(chip);
    });

    sourcesBlock.append(sourcesTitle, sourcesChips);
    dropdown.appendChild(sourcesBlock);
  }

  if (proof.evidence?.projects?.length) {
    const projectsBlock = document.createElement('div');
    projectsBlock.className = 'proof-deco-section';

    const projectsTitle = document.createElement('div');
    projectsTitle.className = 'proof-deco-section-title';
    projectsTitle.textContent = 'Projets';

    const projectList = document.createElement('div');
    projectList.className = 'proof-deco-chip-list';
    proof.evidence.projects.forEach((project) => {
      const chip = document.createElement('span');
      chip.className = 'proof-deco-chip proof-deco-chip-project';
      chip.textContent = project;
      projectList.appendChild(chip);
    });

    projectsBlock.append(projectsTitle, projectList);
    dropdown.appendChild(projectsBlock);
  }

  appendDetailRows(
    dropdown,
    detailRows.filter((row) => ['Niveau de preuve', "Confiance d'estimation"].includes(row.label)),
  );

  if (proof.proof?.experienceEstimationBasis) {
    appendNoteSection(dropdown, "Base d'estimation", proof.proof.experienceEstimationBasis);
  }

  const justification = proof.justification || proof.proof?.justification;
  if (justification) {
    appendNoteSection(dropdown, 'Justification', justification, true);
  }

  appendDetailRows(
    dropdown,
    detailRows.filter((row) => ![
      'Score de preuve',
      'Confiance',
      'Experience estimee',
      'Recence',
      "Profondeur d'usage",
      'Occurrences utiles',
      "Contextes d'usage",
      'Sources',
      'Projets',
      'Niveau de preuve',
      "Confiance d'estimation",
      "Base d'estimation",
      'Justification',
    ].includes(row.label)),
  );

  wrapper.appendChild(dropdown);

  pill.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    const willOpen = !dropdown.classList.contains('is-open');

    document
      .querySelectorAll('.proof-deco-dropdown.is-open')
      .forEach((element) => element.classList.remove('is-open'));

    if (willOpen) {
      dropdown.classList.add('is-open');
      updateDropdownPosition(wrapper, dropdown);
      window.setTimeout(() => {
        document.addEventListener(
          'click',
          () => {
            dropdown.classList.remove('is-open');
          },
          { once: true },
        );
      }, 0);
    }
  });

  closeBtn.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    dropdown.classList.remove('is-open');
  });

  return wrapper;
}

function isBoundaryCharacter(char: string | undefined): boolean {
  if (!char) return true;
  return !/[a-zA-Z0-9À-ÿ]/.test(char);
}

function findBestSkillsSection(doc: ProseMirrorNode): { from: number; to: number } | null {
  const candidates: Array<{ pos: number; node: ProseMirrorNode; score: number }> = [];
  const headings: Array<{ pos: number; level: number }> = [];

  doc.descendants((node, pos) => {
    if (!node.isBlock) return;
    if (node.type.name === 'heading') {
      headings.push({ pos, level: Number((node.attrs as Record<string, unknown>).level || 6) });
    }
    if (node.type.name !== 'heading' && node.type.name !== 'paragraph') return;

    const rawText = node.textContent.trim();
    if (!rawText) return;

    const score = scoreMatch(node, normalizeText(rawText), rawText.length, SECTION_DEFS.skills);
    if (score >= MIN_MATCH_SCORE) {
      candidates.push({ pos, node, score });
    }
  });

  if (!candidates.length) return null;

  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];

  if (best.node.type.name === 'heading') {
    const bestLevel = Number((best.node.attrs as Record<string, unknown>).level || 6);
    const nextHeading = headings
      .filter((heading) => heading.pos > best.pos && heading.level <= bestLevel)
      .sort((a, b) => a.pos - b.pos)[0];

    return {
      from: best.pos + best.node.nodeSize,
      to: nextHeading ? nextHeading.pos : doc.content.size,
    };
  }

  return {
    from: best.pos,
    to: best.pos + best.node.nodeSize,
  };
}

function buildProofDecorations(doc: ProseMirrorNode, storage: ProofStorage): DecorationSet {
  if (!storage.visible || !storage.proofs?.length || getSkillProofCount(storage.proofs) === 0) {
    return DecorationSet.empty;
  }

  const sectionRange = findBestSkillsSection(doc);
  if (!sectionRange || sectionRange.from >= sectionRange.to) {
    return DecorationSet.empty;
  }

  const proofs = [...storage.proofs]
    .filter((proof) => proof.name.trim())
    .sort((a, b) => b.name.length - a.name.length);

  const decorations: Decoration[] = [];

  doc.nodesBetween(sectionRange.from, sectionRange.to, (node, pos) => {
    if (!node.isText || !node.text) return;

    const lowerText = node.text.toLowerCase();
    const occupiedRanges: Array<{ from: number; to: number }> = [];

    for (const proof of proofs) {
      const needle = proof.name.toLowerCase();
      let searchIndex = 0;

      while (searchIndex < lowerText.length) {
        const matchIndex = lowerText.indexOf(needle, searchIndex);
        if (matchIndex === -1) break;

        const before = lowerText[matchIndex - 1];
        const after = lowerText[matchIndex + needle.length];
        const localFrom = matchIndex;
        const localTo = matchIndex + needle.length;
        const overlaps = occupiedRanges.some((range) => localFrom < range.to && localTo > range.from);

        if (!overlaps && isBoundaryCharacter(before) && isBoundaryCharacter(after)) {
          const from = pos + localFrom;
          const to = pos + localTo;
          occupiedRanges.push({ from: localFrom, to: localTo });
          decorations.push(
            Decoration.inline(from, to, { class: 'proof-inline-highlight' }),
          );
          decorations.push(
            Decoration.widget(to, () => createProofWidget(proof), {
              side: 1,
              key: `proof-${proof.category}-${proof.name}-${from}`,
            }),
          );
        }

        searchIndex = matchIndex + needle.length;
      }
    }
  });

  return decorations.length ? DecorationSet.create(doc, decorations) : DecorationSet.empty;
}

export interface ProofOptions {
  proofs: SkillProofEntry[];
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    skillProofs: {
      setSkillProofs: (proofs: SkillProofEntry[]) => ReturnType;
      toggleSkillProofs: () => ReturnType;
    };
  }
}

export const ProofExtension = Extension.create<ProofOptions, ProofStorage>({
  name: 'skillProofs',

  addOptions() {
    return {
      proofs: [] as SkillProofEntry[],
    };
  },

  addStorage() {
    return {
      visible: false,
      proofs: this.options.proofs || [],
    };
  },

  addCommands() {
    return {
      setSkillProofs:
        (proofs: SkillProofEntry[]) =>
        ({ tr, dispatch }) => {
          this.storage.proofs = proofs;
          if (dispatch) {
            dispatch(tr.setMeta(proofPluginKey, { type: 'update' }));
          }
          return true;
        },
      toggleSkillProofs:
        () =>
        ({ tr, dispatch }) => {
          this.storage.visible = !this.storage.visible;
          if (dispatch) {
            dispatch(tr.setMeta(proofPluginKey, { type: 'toggle' }));
          }
          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    const storage = this.storage;

    return [
      new Plugin({
        key: proofPluginKey,
        state: {
          init(_, { doc }) {
            return buildProofDecorations(doc, storage);
          },
          apply(tr, old, _, newState) {
            if (tr.getMeta(proofPluginKey) || tr.docChanged) {
              return buildProofDecorations(newState.doc, storage);
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
