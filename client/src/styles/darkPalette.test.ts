import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const readStyle = (fileName: string): string =>
  readFileSync(resolve(__dirname, fileName), 'utf8');

describe('soft dark palette styles', () => {
  it('defines the global dark theme from the compact anthracite palette', () => {
    const variables = readStyle('_variables.css');

    expect(variables).toContain('--app-bg: #181b20');
    expect(variables).toContain('--surface-primary: #22262e');
    expect(variables).toContain('--surface-muted: #2a2f38');
    expect(variables).toContain('--border-subtle: #343a46');
    expect(variables).toContain('--text-primary: #f4f5f7');
  });

  it('keeps migrated shells on the same soft dark surfaces', () => {
    expect(readStyle('editorialPages.css')).toContain('--cv-surface-base-start: #181b20');
    expect(readStyle('resumesEditorial.css')).toContain('--cv-bg: #181b20');
  });

  it('keeps direct CVtheque loads dark against global important shell defaults', () => {
    const resumesEditorial = readStyle('resumesEditorial.css');

    expect(resumesEditorial).toContain('.dark .resumes-editorial-shell .cv-surface');
    expect(resumesEditorial).toContain('background: #181b20 !important');
    expect(resumesEditorial).toContain('background: #22262e !important');
    expect(resumesEditorial).toContain('border-color: #343a46 !important');
  });

  it('highlights active dark tabs with the usual violet accent', () => {
    const editorialPages = readStyle('editorialPages.css');
    const resumesEditorial = readStyle('resumesEditorial.css');

    expect(editorialPages).toContain(
      ".dark .editorial-migrated-shell button.segmented-control__item.segmented-control__item--active[type='button']"
    );
    expect(editorialPages).toContain('background: #7c5cff !important');
    expect(resumesEditorial).toContain(
      ".dark .resumes-editorial-shell button.segmented-control__item.segmented-control__item--active[type='button']"
    );
    expect(resumesEditorial).toContain('background: #7c5cff !important');
  });

  it('applies the soft dark palette to app chrome', () => {
    expect(readStyle('../components/Layout.tsx')).toContain('dark:bg-[#22262e]');
    expect(readStyle('../components/Layout.tsx')).toContain('dark:border-[#343a46]');
    expect(readStyle('../components/Footer.tsx')).toContain('dark:bg-[#22262e]');
    expect(readStyle('../components/Footer.tsx')).toContain('dark:text-[#f4f5f7]');
  });
});
