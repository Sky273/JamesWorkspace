import type { TagsByCategory } from './dealsGrouped.types';

export const CATEGORY_ORDER = ['Skills', 'Industries', 'Tools', 'Soft Skills'] as const;
export const CATEGORY_PREVIEW_LIMIT = 8;

export interface VisibleFilterCategory {
  category: string;
  allTags: string[];
  filteredTags: string[];
  previewTags: string[];
}

export function normalizeTagValue(value: string) {
  return value.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').trim();
}

export function sortTags(tags: string[], selectedTags: string[]) {
  const selected = new Set(selectedTags);

  return [...tags].sort((left, right) => {
    const leftSelected = selected.has(left);
    const rightSelected = selected.has(right);

    if (leftSelected !== rightSelected) {
      return leftSelected ? -1 : 1;
    }

    return left.localeCompare(right, undefined, { sensitivity: 'base' });
  });
}

export function getVisibleFilterCategories(
  allTags: TagsByCategory,
  selectedTags: string[],
  globalTagQuery: string,
  categoryQueries: Record<string, string>
): VisibleFilterCategory[] {
  const normalizedGlobalQuery = normalizeTagValue(globalTagQuery);

  return CATEGORY_ORDER.map((category) => {
    const categoryTags = allTags[category] || [];
    const localQuery = categoryQueries[category] || '';
    const normalizedLocalQuery = normalizeTagValue(localQuery);
    const filteredTags = sortTags(
      categoryTags.filter((tag) => {
        const normalizedTag = normalizeTagValue(tag);

        if (normalizedGlobalQuery && !normalizedTag.includes(normalizedGlobalQuery)) {
          return false;
        }

        if (normalizedLocalQuery && !normalizedTag.includes(normalizedLocalQuery)) {
          return false;
        }

        return true;
      }),
      selectedTags
    );

    return {
      category,
      allTags: categoryTags,
      filteredTags,
      previewTags: filteredTags.slice(0, CATEGORY_PREVIEW_LIMIT),
    };
  }).filter(
    ({ allTags: categoryTags, filteredTags }) =>
      categoryTags.length > 0 && (normalizedGlobalQuery ? filteredTags.length > 0 : true)
  );
}

export function getActiveFilterCategory(
  activeCategory: string | null,
  visibleCategories: VisibleFilterCategory[],
  allTags: TagsByCategory,
  selectedTags: string[]
): VisibleFilterCategory | null {
  if (!activeCategory) {
    return null;
  }

  return (
    visibleCategories.find(({ category }) => category === activeCategory) || {
      category: activeCategory,
      allTags: allTags[activeCategory] || [],
      filteredTags: sortTags(allTags[activeCategory] || [], selectedTags),
      previewTags: [],
    }
  );
}
