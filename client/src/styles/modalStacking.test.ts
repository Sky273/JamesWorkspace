import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const readStyle = (fileName: string): string =>
  readFileSync(resolve(__dirname, fileName), 'utf8');

describe('modal stacking styles', () => {
  it('does not isolate page surfaces that can contain fixed modal overlays', () => {
    expect(readStyle('editorialPages.css')).not.toMatch(/\.editorial-migrated-shell \.cv-surface\s*{[^}]*isolation:\s*isolate/s);
    expect(readStyle('resumesEditorial.css')).not.toMatch(/\.resumes-editorial-shell \.cv-surface\s*{[^}]*isolation:\s*isolate/s);
  });

  it('keeps fullscreen modal overlays above the app chrome', () => {
    expect(readStyle('_base.css')).toContain('z-index: 10000 !important');
  });
});
