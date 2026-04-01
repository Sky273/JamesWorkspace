import { describe, expect, it } from 'vitest';
import { getSuggestionsCount, parseSuggestions } from './suggestions.shared';
import { removeSuggestionMarkers } from './suggestionsHtml';

describe('suggestions shared helpers', () => {
  it('parses nested suggestion payloads into normalized sections', () => {
    expect(
      parseSuggestions({
        executiveSummary: [{ text: 'Resume plus clair' }, ''],
        skills: {
          primary: ['React', 'TypeScript'],
          backup: { message: 'Node.js' },
        },
      }),
    ).toEqual({
      executiveSummary: ['Resume plus clair'],
      skills: ['React', 'TypeScript', 'Node.js'],
    });
  });

  it('counts only populated suggestion items', () => {
    expect(
      getSuggestionsCount({
        executiveSummary: ['A', 'B'],
        skills: [],
        atsOptimization: ['C'],
      }),
    ).toBe(3);
  });

  it('removes suggestion wrappers while keeping document content', () => {
    expect(
      removeSuggestionMarkers(
        '<div class="suggestion-panel"><ul><li>Tip</li></ul></div><div class="suggestion-highlight"><p>Body</p><span style="color:#F59E0B">[!] 2</span></div>',
      ),
    ).toBe('<p>Body</p>');
  });
});
