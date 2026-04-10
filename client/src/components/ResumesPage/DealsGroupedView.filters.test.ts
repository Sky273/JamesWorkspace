import { describe, expect, it } from 'vitest';

import {
  getActiveFilterCategory,
  getVisibleFilterCategories,
  normalizeTagValue,
  sortTags,
} from './DealsGroupedView.filters';

describe('DealsGroupedView.filters', () => {
  it('normalizes tags and keeps selected tags first', () => {
    expect(normalizeTagValue('  Développement API  ')).toBe('developpement api');
    expect(sortTags(['Node', 'React', 'API'], ['API', 'React'])).toEqual(['API', 'React', 'Node']);
  });

  it('filters categories with global and local search', () => {
    const categories = getVisibleFilterCategories(
      {
        Skills: ['React', 'Node'],
        Industries: ['Banque'],
        Tools: ['Postman', 'Jira'],
        'Soft Skills': ['Leadership'],
      },
      ['Jira'],
      'ji',
      { Tools: '' }
    );

    expect(categories).toHaveLength(1);
    expect(categories[0]).toMatchObject({
      category: 'Tools',
      filteredTags: ['Jira'],
      previewTags: ['Jira'],
    });
  });

  it('resolves the active category from visible or fallback data', () => {
    const visible = getVisibleFilterCategories(
      {
        Skills: ['React'],
        Industries: [],
        Tools: ['Jira'],
        'Soft Skills': [],
      },
      [],
      '',
      {}
    );

    expect(getActiveFilterCategory('Tools', visible, { Skills: [], Industries: [], Tools: ['Jira'], 'Soft Skills': [] }, [])?.filteredTags).toEqual(['Jira']);
    expect(
      getActiveFilterCategory(
        'Industries',
        visible,
        { Skills: [], Industries: ['Banque', 'Assurance'], Tools: [], 'Soft Skills': [] },
        ['Assurance']
      )?.filteredTags
    ).toEqual(['Assurance', 'Banque']);
  });
});
