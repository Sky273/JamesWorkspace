/* eslint-disable react-refresh/only-export-components */
import {
  BuildingOfficeIcon,
  ChevronRightIcon,
  DocumentPlusIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  SparklesIcon,
  UserGroupIcon,
  WrenchScrewdriverIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { AnimatePresence, motion, type Variants } from 'framer-motion';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import EmptyStateCard from '../components/page/EmptyStateCard';
import DealResumeCard from '../components/ResumesPage/DealResumeCard';
import { SkeletonResumeList } from '../components/ui/Skeleton';
import type { ResumeBasic } from '../components/ResumesPage/dealsGrouped.types';
import type { Resume } from '../types/entities';
import { getResumePreviewTags, type TagsByCategory } from './ResumesPage.data';

export const filterContentVariants: Variants = {
  expanded: {
    height: 'auto',
    opacity: 1,
    marginBottom: '2rem',
    transition: {
      height: { duration: 0.3 },
      opacity: { duration: 0.2 },
    },
  },
  collapsed: {
    height: 0,
    opacity: 0,
    marginBottom: 0,
    transition: {
      height: { duration: 0.3 },
      opacity: { duration: 0.2 },
    },
  },
};

export const tagColorMap: Record<string, string> = {
  Skills: 'cv-chip-skills',
  Industries: 'cv-chip-industries',
  Tools: 'cv-chip-tools',
  'Soft Skills': 'cv-chip-soft',
};

export const categoryHeaderColors: Record<string, { dot: string; text: string; accent: string }> = {
  Skills: { dot: 'bg-[var(--cv-tertiary)]', text: 'text-slate-950 dark:text-[#dee5ff]', accent: 'text-[var(--cv-tertiary)]' },
  Industries: { dot: 'bg-[var(--cv-primary)]', text: 'text-slate-950 dark:text-[#dee5ff]', accent: 'text-[var(--cv-primary)]' },
  Tools: { dot: 'bg-[var(--cv-cyan)]', text: 'text-slate-950 dark:text-[#dee5ff]', accent: 'text-[var(--cv-cyan)]' },
  'Soft Skills': { dot: 'bg-[var(--cv-secondary)]', text: 'text-slate-950 dark:text-[#dee5ff]', accent: 'text-[var(--cv-secondary)]' },
};

export const tagFilterColors: Record<string, { selected: string; unselected: string }> = {
  Skills: {
    selected: 'cv-filter-chip cv-filter-chip-selected cv-filter-chip-skills',
    unselected: 'cv-filter-chip cv-filter-chip-skills',
  },
  Industries: {
    selected: 'cv-filter-chip cv-filter-chip-selected cv-filter-chip-industries',
    unselected: 'cv-filter-chip cv-filter-chip-industries',
  },
  Tools: {
    selected: 'cv-filter-chip cv-filter-chip-selected cv-filter-chip-tools',
    unselected: 'cv-filter-chip cv-filter-chip-tools',
  },
  'Soft Skills': {
    selected: 'cv-filter-chip cv-filter-chip-selected cv-filter-chip-soft',
    unselected: 'cv-filter-chip cv-filter-chip-soft',
  },
};

const categoryIcons = {
  Skills: SparklesIcon,
  Industries: BuildingOfficeIcon,
  Tools: WrenchScrewdriverIcon,
  'Soft Skills': UserGroupIcon,
} as const;

const CATEGORY_ORDER = ['Skills', 'Industries', 'Tools', 'Soft Skills'] as const;
const CATEGORY_PREVIEW_LIMIT = 8;

function normalizeTagValue(value: string) {
  return value.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').trim();
}

function sortTags(tags: string[], selectedTags: string[]) {
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

export function classNames(...classes: Array<string | boolean | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export function getStatusBadgeClass(status?: string) {
  switch (status?.toLowerCase()) {
    case 'improved':
      return 'cv-status-pill cv-status-success';
    case 'analyzed':
      return 'cv-status-pill cv-status-primary';
    case 'processing':
      return 'cv-status-pill cv-status-warning';
    case 'pending':
      return 'cv-status-pill cv-status-warning';
    case 'error':
    case 'failed':
      return 'cv-status-pill cv-status-danger';
    case 'archived':
      return 'cv-status-pill cv-status-secondary';
    default:
      return 'cv-status-pill cv-status-neutral';
  }
}

export function ResumeFiltersPanel({
  clearFilters,
  getTagCategory,
  handleTagClick,
  isFilterExpanded,
  selectedTags,
  tagsByCategory,
}: {
  clearFilters: () => void;
  getTagCategory: (tag: string) => string;
  handleTagClick: (tag: string) => void;
  isFilterExpanded: boolean;
  selectedTags: string[];
  tagsByCategory: TagsByCategory;
}): JSX.Element | null {
  const { t } = useTranslation();
  const [globalTagQuery, setGlobalTagQuery] = useState('');
  const [categoryQueries, setCategoryQueries] = useState<Record<string, string>>({});
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const totalTags = useMemo(
    () => Object.values(tagsByCategory).reduce((sum, tags) => sum + tags.length, 0),
    [tagsByCategory]
  );

  const visibleCategories = useMemo(() => {
    const normalizedGlobalQuery = normalizeTagValue(globalTagQuery);

    return CATEGORY_ORDER.map((category) => {
      const allCategoryTags = tagsByCategory[category] || [];
      const localQuery = categoryQueries[category] || '';
      const normalizedLocalQuery = normalizeTagValue(localQuery);
      const filtered = sortTags(
        allCategoryTags.filter((tag) => {
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
        allTags: allCategoryTags,
        filteredTags: filtered,
        previewTags: filtered.slice(0, CATEGORY_PREVIEW_LIMIT),
      };
    }).filter(({ allTags, filteredTags }) => allTags.length > 0 && (normalizedGlobalQuery ? filteredTags.length > 0 : true));
  }, [categoryQueries, globalTagQuery, selectedTags, tagsByCategory]);

  const activeCategoryData = useMemo(() => {
    if (!activeCategory) {
      return null;
    }

    return visibleCategories.find(({ category }) => category === activeCategory)
      || {
        category: activeCategory,
        allTags: tagsByCategory[activeCategory] || [],
        filteredTags: sortTags(tagsByCategory[activeCategory] || [], selectedTags),
        previewTags: [],
      };
  }, [activeCategory, selectedTags, tagsByCategory, visibleCategories]);

  if (!isFilterExpanded) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        variants={filterContentVariants}
        initial="collapsed"
        animate="expanded"
        exit="collapsed"
        className="mt-4 rounded-[0.95rem] border border-slate-200/70 bg-white/80 px-4 pb-4 dark:border-white/6 dark:bg-[#091328]"
      >
        <div className="space-y-5 pt-4">
          <div className="flex flex-col gap-4 rounded-[0.85rem] border border-slate-200/70 bg-white/70 p-4 dark:border-white/8 dark:bg-white/[0.03] lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="cv-kicker mb-2 inline-flex items-center gap-2">
                <FunnelIcon className="h-4 w-4" />
                {t('resumes.filterButton')}
              </div>
              <p className="max-w-2xl text-sm text-slate-600 dark:text-[#a3aac4]">
                {t('resumes.filterDescription', 'Combinez plusieurs tags pour faire émerger les profils les plus pertinents par affaire.')}
              </p>
            </div>
            <div className="inline-flex w-fit items-center rounded-full bg-[var(--cv-primary-soft)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--cv-primary)]">
              {totalTags} {t('resumes.tagsCountLabel', 'tags')}
            </div>
          </div>

          <div className="flex flex-col gap-3 lg:flex-row">
            <label className="relative flex-1">
              <MagnifyingGlassIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={globalTagQuery}
                onChange={(event) => setGlobalTagQuery(event.target.value)}
                placeholder={t('resumes.filterSearchPlaceholder', 'Rechercher dans tous les tags...')}
                className="w-full rounded-[0.85rem] border border-slate-200/80 bg-white/90 py-3 pl-11 pr-4 text-sm text-slate-900 outline-none transition focus:border-[var(--cv-primary)] focus:ring-2 focus:ring-[var(--cv-primary)]/15 dark:border-white/10 dark:bg-white/[0.03] dark:text-[var(--cv-text)]"
              />
            </label>
            {selectedTags.length > 0 ? (
              <button
                onClick={clearFilters}
                className="cv-ghost-button inline-flex items-center justify-center gap-2 rounded-[0.85rem] px-4 py-3 text-sm font-semibold"
              >
                <XMarkIcon className="h-4 w-4" />
                {t('common.resetFilters')}
              </button>
            ) : null}
          </div>

          {selectedTags.length > 0 ? (
            <div className="rounded-[0.85rem] border border-slate-200/70 bg-white/70 p-4 dark:border-white/8 dark:bg-white/[0.03]">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold text-slate-700 dark:text-[#dee5ff]">
                  {t('resumes.activeFilters')} ({selectedTags.length})
                </span>
                <button onClick={clearFilters} className="cv-filter-more text-sm font-semibold">
                  {t('common.resetFilters')}
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedTags.map((tag) => {
                  const category = getTagCategory(tag);
                  return (
                    <span key={tag} className={`cv-active-filter-chip inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm ${tagColorMap[category]}`}>
                      {tag}
                      <button onClick={() => handleTagClick(tag)} className="cv-active-filter-remove">
                        <XMarkIcon className="w-3 h-3" />
                      </button>
                    </span>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 2xl:grid-cols-4">
            {visibleCategories.map(({ category, allTags, filteredTags, previewTags }) => {
              const localQuery = categoryQueries[category] || '';
              const hasMore = filteredTags.length > CATEGORY_PREVIEW_LIMIT;
              const Icon = categoryIcons[category] || SparklesIcon;
              return (
                <section key={category} className="cv-filter-category-card rounded-[0.95rem] border border-slate-200/70 bg-white/75 p-4 dark:border-white/8 dark:bg-white/[0.03]">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="cv-filter-section-title">
                        <span className={`cv-filter-section-icon-shell ${categoryHeaderColors[category]?.dot || 'bg-gray-400'}`}>
                          <Icon className="cv-filter-section-icon" />
                        </span>
                        <span className={`cv-filter-section-text ${categoryHeaderColors[category]?.text || 'text-gray-700 dark:text-gray-300'}`}>
                          {t(`resumes.filters.${category.toLowerCase().replace(' ', '')}`)}
                        </span>
                      </h3>
                      <p className="mt-2 text-sm text-slate-500 dark:text-[#8f99b8]">
                        {allTags.length} {t('resumes.availableTags', 'tags disponibles')}
                      </p>
                    </div>
                  </div>

                  <label className="relative mb-4 block">
                    <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      value={localQuery}
                      onChange={(event) =>
                        setCategoryQueries((previousState) => ({
                          ...previousState,
                          [category]: event.target.value,
                        }))
                      }
                      placeholder={t('resumes.filterSearchInCategory', {
                        category: t(`resumes.filters.${category.toLowerCase().replace(' ', '')}`),
                        defaultValue: `Rechercher dans ${category}`,
                      })}
                      className="w-full rounded-[1rem] border border-slate-200/80 bg-white/90 py-2.5 pl-10 pr-3 text-sm text-slate-900 outline-none transition focus:border-[var(--cv-primary)] focus:ring-2 focus:ring-[var(--cv-primary)]/15 dark:border-white/10 dark:bg-white/[0.03] dark:text-[var(--cv-text)]"
                    />
                  </label>

                  <div className="flex min-h-[12rem] flex-wrap content-start gap-2.5">
                    {previewTags.map((tag) => (
                      <button
                        key={tag}
                        onClick={() => handleTagClick(tag)}
                        className={`inline-flex items-center rounded-full px-4 py-2 text-sm transition-all ${
                          selectedTags.includes(tag)
                            ? tagFilterColors[category]?.selected || 'bg-blue-500 text-white'
                            : tagFilterColors[category]?.unselected || 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        {tag}
                      </button>
                    ))}
                    {previewTags.length === 0 ? (
                      <p className="text-sm italic text-slate-400 dark:text-[#7f8ab0]">
                        {t('resumes.noTagsForSearch', 'Aucun tag ne correspond à cette recherche.')}
                      </p>
                    ) : null}
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3">
                    <p className="text-xs text-slate-500 dark:text-[#8f99b8]">
                      {previewTags.length > 0
                        ? t('resumes.filterPreviewSummary', {
                            shown: previewTags.length,
                            total: filteredTags.length,
                            defaultValue: `${previewTags.length} sur ${filteredTags.length}`,
                          })
                        : ''}
                    </p>
                    {hasMore || filteredTags.length > 0 ? (
                      <button
                        onClick={() => setActiveCategory(category)}
                        className="cv-filter-more inline-flex items-center gap-2 rounded-full border border-dashed border-slate-300 px-3 py-2 text-sm font-semibold dark:border-white/10"
                      >
                        {hasMore
                          ? `+${filteredTags.length - CATEGORY_PREVIEW_LIMIT} ${t('resumes.more')}`
                          : t('resumes.viewAllTags', 'Voir tout')}
                      </button>
                    ) : null}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      </motion.div>

      {activeCategoryData ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-end bg-slate-950/55 p-4 backdrop-blur-sm">
          <motion.aside
            initial={{ opacity: 0, x: 32 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 32 }}
            className="flex h-[min(92vh,880px)] w-full max-w-2xl flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-[#091328] shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-white/10 p-5">
              <div className="min-w-0">
                <div className="cv-kicker mb-2">{t('resumes.viewAllTags', 'Voir tout')}</div>
                <h3 className="text-xl font-semibold text-[#dee5ff]">
                  {t(`resumes.filters.${activeCategoryData.category.toLowerCase().replace(' ', '')}`)}
                </h3>
                <p className="mt-2 text-sm text-[#8f99b8]">
                  {activeCategoryData.filteredTags.length} {t('resumes.availableTags', 'tags disponibles')}
                </p>
              </div>
              <button
                onClick={() => setActiveCategory(null)}
                className="cv-ghost-button inline-flex h-11 w-11 items-center justify-center rounded-2xl"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="border-b border-white/10 p-5">
              <label className="relative block">
                <MagnifyingGlassIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={categoryQueries[activeCategoryData.category] || ''}
                  onChange={(event) =>
                    setCategoryQueries((previousState) => ({
                      ...previousState,
                      [activeCategoryData.category]: event.target.value,
                    }))
                  }
                  placeholder={t('resumes.filterSearchInCategory', {
                    category: t(`resumes.filters.${activeCategoryData.category.toLowerCase().replace(' ', '')}`),
                    defaultValue: `Rechercher dans ${activeCategoryData.category}`,
                  })}
                  className="w-full rounded-[1.2rem] border border-white/10 bg-white/[0.04] py-3 pl-11 pr-4 text-sm text-[#dee5ff] outline-none transition focus:border-[var(--cv-primary)] focus:ring-2 focus:ring-[var(--cv-primary)]/15"
                />
              </label>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              <div className="flex flex-wrap gap-2.5">
                {activeCategoryData.filteredTags.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => handleTagClick(tag)}
                      className={`inline-flex items-center rounded-full px-4 py-2 text-sm transition-all ${
                        selectedTags.includes(tag)
                          ? tagFilterColors[activeCategoryData.category]?.selected || 'bg-blue-500 text-white'
                          : tagFilterColors[activeCategoryData.category]?.unselected || 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
              </div>
            </div>
          </motion.aside>
        </div>
      ) : null}
    </AnimatePresence>
  );
}

function ResultsCollectionHeader({
  count,
  hasActiveFilters,
  loading,
}: {
  count: number;
  hasActiveFilters: boolean;
  loading: boolean;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-3 border-b border-slate-200/70 px-5 py-5 dark:border-white/6 sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <div>
        <div className="cv-kicker mb-2">{t('resumes.resultsLabel', 'Résultats')}</div>
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600 dark:text-[#a3aac4]">
          <span className="cv-display text-lg font-bold text-slate-950 dark:text-[#dee5ff]">
            {loading ? t('common.loading') : t('resumes.resultsSummary', { count, defaultValue: `${count} résultats` })}
          </span>
          {hasActiveFilters ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--cv-primary-soft)] px-3 py-1 text-xs font-semibold text-[var(--cv-primary)]">
              <FunnelIcon className="h-3.5 w-3.5" />
              {t('resumes.filteredResults', 'Filtres appliqués')}
            </span>
          ) : null}
        </div>
      </div>
      <div className="text-sm text-slate-500 dark:text-[#8f99b8]">
        {hasActiveFilters
          ? t('resumes.filteredHint', 'Affinez ou réinitialisez vos filtres pour élargir la sélection.')
          : t('resumes.resultsHint', 'Cliquez sur un CV pour ouvrir son analyse complète.')}
      </div>
    </div>
  );
}

export function ResumesResultsGrid({
  clearFilters,
  filteredResumes,
  goToUpload,
  handleDownloadResume,
  handleResumeClick,
  loading,
  onDeleteResume,
  onRefresh,
  searchQuery,
  selectedTags,
}: {
  clearFilters: () => void;
  filteredResumes: Resume[];
  goToUpload: () => void;
  handleDownloadResume: (resume: Resume, event: React.MouseEvent) => Promise<void>;
  handleResumeClick: (resume: Resume) => void;
  loading: boolean;
  onDeleteResume: (resume: Resume, event: React.MouseEvent) => void;
  onRefresh: () => Promise<void>;
  searchQuery: string;
  selectedTags: string[];
}) {
  const { t } = useTranslation();
  const hasActiveFilters = searchQuery.length > 0 || selectedTags.length > 0;

  const listItems = useMemo(() => {
    return filteredResumes.map((resume) => ({
      raw: resume,
      basic: {
        id: resume.id,
        name: resume.Name || resume.name || resume['Resume File']?.[0]?.filename || t('resumes.untitled'),
        title: resume.Title || resume.title || resume.adapted_title || undefined,
        status: String(resume.Status || resume.status || 'new').toLowerCase(),
        global_rating: Number(resume['Global Rating'] ?? 0) || 0,
        improved_global_rating: Number(resume['Improved Global Rating'] ?? 0) || undefined,
        created_at: String(resume['Created At'] || ''),
        file_name: (resume['File Name'] as string | undefined) || resume.fileName || resume.file_name || undefined,
        original_name: (resume['Original Name'] as string | undefined) || resume.originalName || undefined,
        firm_name: (resume.FirmName as string | undefined) || undefined,
        candidate_name: resume.candidate_name || undefined,
        candidate_email: resume.candidate_email || undefined,
        consent_status: resume.consent_status || undefined,
        consent_token_expires_at: resume.consent_token_expires_at || undefined,
        retention_until: resume.retention_until || undefined,
        skills: (resume.Skills as string | undefined) || undefined,
        industries: (resume.Industries as string | undefined) || undefined,
        tools: (resume.Tools as string | undefined) || undefined,
        soft_skills: (resume['Soft Skills'] as string | undefined) || undefined,
      } satisfies ResumeBasic,
    }));
  }, [filteredResumes, t]);

  const getResumeTags = useMemo(() => {
    return (resume: ResumeBasic): Record<string, string[]> => ({
      skills: getResumePreviewTags({
        Skills: resume.skills,
      } as Resume, 'Skills'),
      industries: getResumePreviewTags({
        Industries: resume.industries,
      } as Resume, 'Industries'),
      tools: getResumePreviewTags({
        Tools: resume.tools,
      } as Resume, 'Tools'),
      soft_skills: getResumePreviewTags({
        'Soft Skills': resume.soft_skills,
      } as Resume, 'Soft Skills'),
    });
  }, []);

  const getDownloadTitle = useMemo(() => {
    return (resume: ResumeBasic) => {
      const lines = [t('resumes.downloadResume')];
      if (resume.original_name) {
        lines.push(resume.original_name);
      } else if (resume.file_name) {
        lines.push(resume.file_name);
      }
      return lines.join('\n');
    };
  }, [t]);

  if (loading) {
    return (
      <div className="cv-panel overflow-hidden rounded-[0.95rem]">
        <ResultsCollectionHeader count={filteredResumes.length} hasActiveFilters={hasActiveFilters} loading={true} />
        <div className="p-5 sm:p-6">
          <SkeletonResumeList count={6} />
        </div>
      </div>
    );
  }

  if (filteredResumes.length === 0) {
    return (
      <div className="cv-panel overflow-hidden rounded-[0.95rem]">
        <ResultsCollectionHeader count={0} hasActiveFilters={hasActiveFilters} loading={false} />
        <div className="p-6 sm:p-8">
          <EmptyStateCard
            icon={hasActiveFilters ? FunnelIcon : DocumentPlusIcon}
            title={t('resumes.noResults')}
            description={hasActiveFilters ? t('resumes.noResultsFiltered') : t('resumes.uploadFirst')}
            containerClassName="rounded-[0.95rem] border border-dashed border-slate-200/80 bg-white/50 p-10 text-center dark:border-white/10 dark:bg-white/[0.02]"
          />
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={hasActiveFilters ? clearFilters : goToUpload}
              className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-slate-900 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100"
            >
              {hasActiveFilters ? <ChevronRightIcon className="h-4 w-4" /> : <DocumentPlusIcon className="h-4 w-4" />}
              <span>{hasActiveFilters ? t('common.resetFilters') : t('resumes.uploadButton')}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="cv-panel overflow-hidden rounded-[0.95rem]">
      <ResultsCollectionHeader count={filteredResumes.length} hasActiveFilters={hasActiveFilters} loading={false} />
      <div className="p-5 sm:p-6">
        <div className="space-y-3">
          {listItems.map(({ raw, basic }, index) => (
            <DealResumeCard
              key={basic.id}
              resume={basic}
              sourceDealId={null}
              isDragging={false}
              dropping={false}
              draggableEnabled={false}
              onDragStart={() => undefined}
              onDragEnd={() => undefined}
              onClick={() => handleResumeClick(raw)}
              onDownload={(_resumeBasic, event) => {
                void handleDownloadResume(raw, event);
              }}
              onDelete={(_resumeBasic, event) => onDeleteResume(raw, event)}
              onDealChange={onRefresh}
              getResumeTags={getResumeTags}
              getDownloadTitle={getDownloadTitle}
              index={index}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
