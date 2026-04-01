import {
  SUGGESTION_SECTION_LABELS,
  SUGGESTION_SECTION_ORDER,
  type SuggestionsBySection,
} from './suggestions.shared';

export function createBadgeWidget(
  sectionKey: string,
  suggestions: string[],
): HTMLElement {
  const wrapper = document.createElement('span');
  wrapper.className = 'suggestion-deco-badge';
  wrapper.setAttribute('contenteditable', 'false');

  const pill = document.createElement('span');
  pill.className = 'suggestion-deco-pill';
  pill.textContent = `ðŸ’¡ ${suggestions.length}`;
  wrapper.appendChild(pill);

  const dropdown = document.createElement('div');
  dropdown.className = 'suggestion-deco-dropdown';

  const header = document.createElement('div');
  header.className = 'suggestion-deco-dropdown-header';

  const titleEl = document.createElement('span');
  titleEl.className = 'suggestion-deco-dropdown-title';
  titleEl.textContent =
    SUGGESTION_SECTION_LABELS[
      sectionKey as keyof typeof SUGGESTION_SECTION_LABELS
    ] || 'Suggestions';

  const countEl = document.createElement('span');
  countEl.className = 'suggestion-deco-dropdown-count';
  countEl.textContent = String(suggestions.length);

  const closeBtn = document.createElement('button');
  closeBtn.className = 'suggestion-deco-dropdown-close';
  closeBtn.textContent = 'âœ•';
  closeBtn.type = 'button';

  header.append(titleEl, countEl, closeBtn);
  dropdown.appendChild(header);

  const list = document.createElement('ul');
  list.className = 'suggestion-deco-dropdown-list';
  suggestions.forEach((suggestion) => {
    const li = document.createElement('li');
    li.textContent = suggestion;
    list.appendChild(li);
  });
  dropdown.appendChild(list);
  wrapper.appendChild(dropdown);

  pill.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    document
      .querySelectorAll('.suggestion-deco-dropdown.is-open')
      .forEach((element) => {
        if (element !== dropdown) element.classList.remove('is-open');
      });
    dropdown.classList.toggle('is-open');
  });

  closeBtn.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    dropdown.classList.remove('is-open');
  });

  return wrapper;
}

export function createGlobalPanel(
  suggestions: SuggestionsBySection,
): HTMLElement | null {
  const entries: Array<{ key: string; label: string; items: string[] }> = [];

  for (const key of SUGGESTION_SECTION_ORDER) {
    const items = suggestions[key];
    if (!items?.length) continue;

    entries.push({
      key,
      label:
        SUGGESTION_SECTION_LABELS[
          key as keyof typeof SUGGESTION_SECTION_LABELS
        ] || key,
      items,
    });
  }

  if (entries.length === 0) return null;

  const totalCount = entries.reduce((sum, entry) => sum + entry.items.length, 0);

  const panel = document.createElement('div');
  panel.className = 'suggestion-deco-panel';
  panel.setAttribute('contenteditable', 'false');

  const header = document.createElement('div');
  header.className = 'suggestion-deco-panel-header';

  const headerIcon = document.createElement('span');
  headerIcon.className = 'suggestion-deco-panel-icon';
  headerIcon.textContent = 'ðŸ’¡';

  const headerText = document.createElement('span');
  headerText.textContent = "Suggestions d'amÃ©lioration";

  const headerCount = document.createElement('span');
  headerCount.className = 'suggestion-deco-panel-count';
  headerCount.textContent = String(totalCount);

  header.append(headerIcon, headerText, headerCount);
  panel.appendChild(header);

  for (const entry of entries) {
    const section = document.createElement('div');
    section.className = 'suggestion-deco-panel-section';

    const title = document.createElement('div');
    title.className = 'suggestion-deco-panel-section-title';

    const titleLabel = document.createElement('span');
    titleLabel.textContent = entry.label;

    const titleCount = document.createElement('span');
    titleCount.className = 'suggestion-deco-panel-section-count';
    titleCount.textContent = String(entry.items.length);

    title.append(titleLabel, titleCount);
    section.appendChild(title);

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
