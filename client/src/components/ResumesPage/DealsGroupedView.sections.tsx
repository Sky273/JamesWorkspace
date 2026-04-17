import { AnimatePresence, motion } from 'framer-motion';
import {
  AdjustmentsHorizontalIcon,
  ArrowUturnLeftIcon,
  BriefcaseIcon,
  BuildingOfficeIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  DocumentMagnifyingGlassIcon,
  DocumentTextIcon,
  FolderOpenIcon,
  MagnifyingGlassIcon,
  SparklesIcon,
  UserGroupIcon,
  WrenchScrewdriverIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import type { TFunction } from 'i18next';
import { useMemo, useState } from 'react';
import type { ResumeBasic, DealGroup, GroupedData, TagsByCategory } from './dealsGrouped.types';
import {
  CATEGORY_HEADER_COLORS,
  FILTER_CONTENT_VARIANTS,
  INITIAL_RESUMES_LIMIT,
  TAG_FILTER_COLORS,
} from './dealsGrouped.types';
import {
  CATEGORY_PREVIEW_LIMIT,
  getActiveFilterCategory,
  getVisibleFilterCategories,
} from './DealsGroupedView.filters';
import DealSection from './DealSection';

const categoryIcons = {
  Skills: SparklesIcon,
  Industries: BuildingOfficeIcon,
  Tools: WrenchScrewdriverIcon,
  'Soft Skills': UserGroupIcon,
} as const;

interface FilterPanelProps {
  allTags: TagsByCategory;
  getTagCategory: (tag: string) => string;
  handleTagClick: (tag: string) => void;
  isFilterExpanded: boolean;
  selectedTags: string[];
  t: TFunction;
  visibleData: GroupedData;
}

export function FilterPanel({
  allTags,
  getTagCategory,
  handleTagClick,
  isFilterExpanded,
  selectedTags,
  t,
  visibleData,
}: FilterPanelProps): JSX.Element | null {
  const [globalTagQuery, setGlobalTagQuery] = useState('');
  const [categoryQueries, setCategoryQueries] = useState<Record<string, string>>({});
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const sanitizedSelectedTags = useMemo(
    () => Array.from(new Set(selectedTags.map((tag) => tag.trim()).filter((tag) => tag.length > 0))),
    [selectedTags],
  );

  const totalTags = useMemo(
    () => Object.values(allTags).reduce((sum, tags) => sum + tags.length, 0),
    [allTags]
  );

  const visibleCategories = useMemo(() => {
    return getVisibleFilterCategories(allTags, selectedTags, globalTagQuery, categoryQueries);
  }, [allTags, categoryQueries, globalTagQuery, selectedTags]);

  const activeCategoryData = useMemo(() => {
    return getActiveFilterCategory(activeCategory, visibleCategories, allTags, selectedTags);
  }, [activeCategory, allTags, selectedTags, visibleCategories]);

  if (!isFilterExpanded || (visibleData.totalAssigned <= 0 && visibleData.totalUnassigned <= 0 && !Object.values(allTags).some((tags) => tags.length > 0))) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        variants={FILTER_CONTENT_VARIANTS}
        initial="collapsed"
        animate="expanded"
        exit="collapsed"
        className="mt-4 overflow-hidden rounded-[1.8rem] border border-slate-200/70 bg-white/80 shadow-[0_18px_40px_rgba(15,23,42,0.06)] dark:border-white/6 dark:bg-[#091328]"
      >
        <div className="border-b border-slate-200/70 px-4 py-4 dark:border-white/6 sm:px-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-1">
              <div className="cv-kicker flex items-center gap-2">
                <AdjustmentsHorizontalIcon className="h-4 w-4" />
                <span>{t('resumes.filterButton')}</span>
              </div>
              <p className="text-sm text-slate-600 dark:text-[#a3aac4]">
                {t('resumes.filterDescription', { defaultValue: 'Combinez plusieurs tags pour faire émerger les profils les plus pertinents par affaire.' })}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="cv-count-pill cv-count-pill-primary rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]">
                {totalTags} {t('resumes.tagsCountLabel', 'tags')}
              </span>
              {selectedTags.length > 0 ? (
                <span className="cv-count-pill cv-count-pill-success rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]">
                  {selectedTags.length} actif{selectedTags.length > 1 ? 's' : ''}
                </span>
              ) : null}
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 lg:flex-row">
            <label className="relative flex-1">
              <MagnifyingGlassIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={globalTagQuery}
                onChange={(event) => setGlobalTagQuery(event.target.value)}
                placeholder={t('resumes.filterSearchPlaceholder', 'Rechercher dans tous les tags...')}
                className="w-full rounded-[1.2rem] border border-slate-200/80 bg-white/90 py-3 pl-11 pr-4 text-sm text-slate-900 outline-none transition focus:border-[var(--cv-primary)] focus:ring-2 focus:ring-[var(--cv-primary)]/15 dark:border-white/10 dark:bg-white/[0.03] dark:text-[#dee5ff]"
              />
            </label>
          </div>

          {selectedTags.length > 0 ? (
            <div className="mt-4 rounded-[1.4rem] border border-slate-200/70 bg-white/70 p-4 dark:border-white/8 dark:bg-white/[0.03]">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold text-slate-700 dark:text-[#dee5ff]">
                  {t('resumes.activeFilters')} ({selectedTags.length})
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                {sanitizedSelectedTags.map((tag) => {
                  const category = getTagCategory(tag);
                  const colorClass = TAG_FILTER_COLORS[category]?.selected || 'bg-blue-500 text-white';
                  return (
                    <span key={tag} className={`cv-active-filter-chip inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm ${colorClass}`}>
                      <span className="truncate max-w-[220px]">{tag}</span>
                      <button onClick={() => handleTagClick(tag)} className="cv-active-filter-remove" aria-label={`${t('common.remove', { defaultValue: 'Retirer' })} ${tag}`}>
                        <XMarkIcon className="h-3 w-3" />
                      </button>
                    </span>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>

        <div className="grid gap-4 px-4 py-4 sm:px-5 lg:grid-cols-2 2xl:grid-cols-4">
          {visibleCategories.map(({ category, allTags: categoryTags, filteredTags, previewTags }) => {
            const canExpand = filteredTags.length > CATEGORY_PREVIEW_LIMIT;
            const Icon = categoryIcons[category as keyof typeof categoryIcons] || SparklesIcon;

            return (
              <section key={category} className="rounded-[1.4rem] border border-slate-200/70 bg-white/70 p-4 shadow-[0_18px_36px_rgba(15,23,42,0.08)] dark:border-white/6 dark:bg-white/[0.03]">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="cv-filter-section-title flex items-center gap-2">
                      <span className={`cv-filter-section-icon-shell ${CATEGORY_HEADER_COLORS[category]?.dot || 'bg-gray-400'}`}>
                        <Icon className="cv-filter-section-icon" />
                      </span>
                      <span className={`cv-filter-section-text ${CATEGORY_HEADER_COLORS[category]?.text || 'text-gray-700 dark:text-gray-300'}`}>
                        {t(`resumes.filters.${category.toLowerCase().replace(' ', '')}`)}
                      </span>
                    </h3>
                    <p className="mt-1 text-xs text-slate-500 dark:text-[#8f99b8]">{categoryTags.length} {t('resumes.availableTags', 'tags disponibles')}</p>
                  </div>
                </div>

                <label className="relative mb-4 block">
                  <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={categoryQueries[category] || ''}
                    onChange={(event) =>
                      setCategoryQueries((prev) => ({
                        ...prev,
                        [category]: event.target.value,
                      }))
                    }
                    placeholder={t('resumes.filterSearchInCategory', {
                      category: t(`resumes.filters.${category.toLowerCase().replace(' ', '')}`),
                      defaultValue: `Rechercher dans ${category}`,
                    })}
                    className="w-full rounded-[1rem] border border-slate-200/80 bg-white/90 py-2.5 pl-10 pr-3 text-sm text-slate-900 outline-none transition focus:border-[var(--cv-primary)] focus:ring-2 focus:ring-[var(--cv-primary)]/15 dark:border-white/10 dark:bg-white/[0.03] dark:text-[#dee5ff]"
                  />
                </label>

                <div className="flex min-h-[11.5rem] flex-wrap content-start gap-2.5">
                  {Array.from(new Set(previewTags.map((tag) => tag.trim()).filter((tag) => tag.length > 0))).map((tag) => (
                    <button
                      key={tag}
                      onClick={() => handleTagClick(tag)}
                      className={`inline-flex max-w-full items-center rounded-full px-4 py-2 text-sm transition-all ${
                        selectedTags.includes(tag)
                          ? TAG_FILTER_COLORS[category]?.selected || 'bg-blue-500 text-white'
                          : TAG_FILTER_COLORS[category]?.unselected || 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      <span className="truncate">{tag}</span>
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
                  {canExpand || filteredTags.length > 0 ? (
                    <button
                      onClick={() => setActiveCategory(category)}
                      className="cv-filter-more rounded-full border border-dashed border-slate-300 px-3 py-2 text-sm font-semibold dark:border-white/10"
                    >
                      {canExpand ? `+${filteredTags.length - CATEGORY_PREVIEW_LIMIT} ${t('resumes.more')}` : t('resumes.viewAllTags', 'Voir tout')}
                    </button>
                  ) : null}
                </div>
              </section>
            );
          })}
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
                    setCategoryQueries((prev) => ({
                      ...prev,
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
                {Array.from(new Set(activeCategoryData.filteredTags.map((tag) => tag.trim()).filter((tag) => tag.length > 0))).map((tag) => (
                  <button
                    key={tag}
                    onClick={() => handleTagClick(tag)}
                    className={`inline-flex items-center rounded-full px-4 py-2 text-sm transition-all ${
                      selectedTags.includes(tag)
                        ? TAG_FILTER_COLORS[activeCategoryData.category]?.selected || 'bg-blue-500 text-white'
                        : TAG_FILTER_COLORS[activeCategoryData.category]?.unselected || 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
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

export function SummaryBar({ t, visibleData }: { t: TFunction; visibleData: GroupedData }): JSX.Element {
  const hasResults = visibleData.totalAssigned + visibleData.totalUnassigned > 0;

  return (
    <div className="cv-panel rounded-[1.8rem] px-4 py-4 sm:px-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="grid gap-3 sm:grid-cols-3 lg:flex lg:flex-wrap lg:items-center">
          <div className="flex items-center gap-3 rounded-[1.1rem] bg-white/60 px-3 py-3 dark:bg-white/[0.03]">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--cv-primary-soft)] text-[var(--cv-primary)]">
              <BriefcaseIcon className="h-5 w-5" />
            </span>
            <div>
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-[#8f99b8]">{t('resumes.groupedView.deals')}</div>
              <div className="cv-display text-lg font-bold text-slate-950 dark:text-[#dee5ff]">{visibleData.totalDeals}</div>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-[1.1rem] bg-white/60 px-3 py-3 dark:bg-white/[0.03]">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--cv-secondary-soft)] text-[var(--cv-secondary)]">
              <DocumentTextIcon className="h-5 w-5" />
            </span>
            <div>
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-[#8f99b8]">{t('resumes.groupedView.assigned')}</div>
              <div className="cv-display text-lg font-bold text-slate-950 dark:text-[#dee5ff]">{visibleData.totalAssigned}</div>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-[1.1rem] bg-white/60 px-3 py-3 dark:bg-white/[0.03]">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--cv-tertiary-soft)] text-[var(--cv-tertiary)]">
              <FolderOpenIcon className="h-5 w-5" />
            </span>
            <div>
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-[#8f99b8]">{t('resumes.groupedView.unassigned')}</div>
              <div className="cv-display text-lg font-bold text-slate-950 dark:text-[#dee5ff]">{visibleData.totalUnassigned}</div>
            </div>
          </div>
        </div>
        <p className="max-w-xl text-sm text-slate-600 dark:text-[#a3aac4]">
          {hasResults
            ? t('resumes.groupedView.summaryHint', { defaultValue: 'Repérez rapidement les affaires actives, les CV rattachés et les profils encore non classés.' })
            : t('resumes.groupedView.summaryEmpty', { defaultValue: 'Les indicateurs se rempliront dès que des CV ou des affaires seront disponibles.' })}
        </p>
      </div>
    </div>
  );
}

interface DealsSectionsProps {
  autoExpandedDealIds: Set<string>;
  data: GroupedData;
  dragOverDealId: string | null;
  draggedResume: { resumeId: string; sourceDealId: string | null } | null;
  dropping: boolean;
  expandedDeals: Set<string>;
  fetchGroupedData: () => Promise<void>;
  getDownloadTitle: (resume: ResumeBasic) => string;
  getResumeTags: (resume: ResumeBasic) => Record<string, string[]>;
  handleDelete: (resume: ResumeBasic, event: React.MouseEvent) => void;
  handleDownload: (resume: ResumeBasic, event: React.MouseEvent) => Promise<void>;
  handleDragEnd: (event: React.DragEvent) => void;
  handleDragEnterDeal: (event: React.DragEvent, dealId: string) => void;
  handleDragLeaveDeal: (event: React.DragEvent, dealId: string) => void;
  handleDragOverDeal: (event: React.DragEvent) => void;
  handleDragStart: (event: React.DragEvent, resumeId: string, sourceDealId: string | null) => void;
  handleDropOnDeal: (event: React.DragEvent, dealId: string) => Promise<void>;
  handleExportDeal: (deal: DealGroup) => void;
  handleResumeClick: (resumeId: string) => void;
  hasActiveFilters: boolean;
  saveViewState: () => void;
  toggleDeal: (dealId: string) => void;
  visibleData: GroupedData;
}

export function DealsSections(props: DealsSectionsProps): JSX.Element {
  const {
    autoExpandedDealIds,
    data,
    dragOverDealId,
    draggedResume,
    dropping,
    expandedDeals,
    fetchGroupedData,
    getDownloadTitle,
    getResumeTags,
    handleDelete,
    handleDownload,
    handleDragEnd,
    handleDragEnterDeal,
    handleDragLeaveDeal,
    handleDragOverDeal,
    handleDragStart,
    handleDropOnDeal,
    handleExportDeal,
    handleResumeClick,
    hasActiveFilters,
    saveViewState,
    toggleDeal,
    visibleData,
  } = props;

  return (
    <div className="space-y-4">
      {visibleData.deals.map((deal) => {
        const originalDeal = data.deals.find((candidate) => candidate.id === deal.id) || deal;
        const isExpanded = hasActiveFilters ? autoExpandedDealIds.has(deal.id) : expandedDeals.has(deal.id);

        return (
          <DealSection
            key={deal.id}
            deal={deal}
            originalDeal={originalDeal}
            isExpanded={isExpanded}
            hasActiveFilters={hasActiveFilters}
            isDragOver={dragOverDealId === deal.id}
            isSourceDeal={draggedResume?.sourceDealId === deal.id}
            isDragging={!!draggedResume}
            draggedResumeId={draggedResume?.resumeId || null}
            dropping={dropping}
            onToggle={() => toggleDeal(deal.id)}
            onDragEnter={handleDragEnterDeal}
            onDragLeave={handleDragLeaveDeal}
            onDragOver={handleDragOverDeal}
            onDrop={handleDropOnDeal}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onResumeClick={handleResumeClick}
            onDownload={handleDownload}
            onDelete={handleDelete}
            onDealChange={fetchGroupedData}
            onExportDeal={handleExportDeal}
            getResumeTags={getResumeTags}
            getDownloadTitle={getDownloadTitle}
            saveViewState={saveViewState}
          />
        );
      })}
    </div>
  );
}

interface UnassignedSectionProps {
  data: GroupedData;
  expandedResumeSections: Set<string>;
  hasActiveFilters: boolean;
  renderResumeCard: (resume: ResumeBasic, sourceDealId: string | null, index: number) => JSX.Element;
  setExpandedResumeSections: React.Dispatch<React.SetStateAction<Set<string>>>;
  setUnassignedExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  t: TFunction;
  unassignedExpanded: boolean;
  visibleData: GroupedData;
}

export function UnassignedSection({
  data,
  expandedResumeSections,
  hasActiveFilters,
  renderResumeCard,
  setExpandedResumeSections,
  setUnassignedExpanded,
  t,
  unassignedExpanded,
  visibleData,
}: UnassignedSectionProps): JSX.Element | null {
  if (visibleData.unassigned.length <= 0) {
    return null;
  }

  const isFullyExpanded = expandedResumeSections.has('unassigned');
  const displayedResumes = isFullyExpanded ? visibleData.unassigned : visibleData.unassigned.slice(0, INITIAL_RESUMES_LIMIT);
  const hiddenCount = visibleData.unassigned.length - INITIAL_RESUMES_LIMIT;

  return (
    <div className="cv-card overflow-hidden rounded-[2rem]">
      <button
        onClick={() => {
          if (!hasActiveFilters) {
            setUnassignedExpanded(!unassignedExpanded);
          }
        }}
        className="flex w-full flex-col items-start justify-between gap-4 px-4 py-4 text-left transition-colors hover:bg-slate-50 dark:hover:bg-[color:color-mix(in_srgb,var(--cv-panel-end)_86%,black)] sm:flex-row sm:items-center sm:px-5"
      >
        <div className="flex min-w-0 items-center gap-3">
          {hasActiveFilters || unassignedExpanded ? (
            <ChevronDownIcon className="h-5 w-5 flex-shrink-0 text-slate-400 dark:text-[#7f8ab0]" />
          ) : (
            <ChevronRightIcon className="h-5 w-5 flex-shrink-0 text-slate-400 dark:text-[#7f8ab0]" />
          )}
          <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-[var(--cv-tertiary-soft)] text-[var(--cv-tertiary)]">
            <FolderOpenIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h3 className="cv-display text-lg font-semibold text-slate-900 dark:text-[#dee5ff]">
              {t('resumes.groupedView.unassignedTitle')}
            </h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-[#8f99b8]">
              {t('resumes.groupedView.unassignedHint', { defaultValue: 'Profils disponibles à rattacher à une affaire quand le besoin se précise.' })}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <span className="cv-count-pill cv-count-pill-success rounded-full px-3 py-1 text-sm font-medium">
            {hasActiveFilters && visibleData.unassigned.length !== data.unassigned.length
              ? `${visibleData.unassigned.length} / ${data.unassigned.length} CV${data.unassigned.length !== 1 ? 's' : ''}`
              : `${visibleData.unassigned.length} CV${visibleData.unassigned.length !== 1 ? 's' : ''}`}
          </span>
        </div>
      </button>

      <AnimatePresence>
        {(hasActiveFilters || unassignedExpanded) && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-slate-200/70 px-4 pb-4 dark:border-white/6 sm:px-5">
              <div className="space-y-3 pt-4">
                {displayedResumes.map((resume, index) => renderResumeCard(resume, null, index))}
                {!isFullyExpanded && hiddenCount > 0 ? (
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      setExpandedResumeSections((prev) => new Set([...prev, 'unassigned']));
                    }}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-[1.1rem] border border-slate-200 bg-white/70 px-4 py-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-white/8 dark:bg-white/[0.03] dark:text-[#dee5ff] dark:hover:bg-white/[0.05]"
                  >
                    {t('resumes.groupedView.showMore', { count: hiddenCount })}
                  </button>
                ) : null}
                {isFullyExpanded && visibleData.unassigned.length > INITIAL_RESUMES_LIMIT ? (
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      setExpandedResumeSections((prev) => {
                        const next = new Set(prev);
                        next.delete('unassigned');
                        return next;
                      });
                    }}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-[1.1rem] border border-dashed border-slate-300 px-4 py-3 text-sm text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700 dark:border-white/10 dark:text-[#a3aac4] dark:hover:bg-white/[0.05] dark:hover:text-[#dee5ff]"
                  >
                    <ArrowUturnLeftIcon className="h-4 w-4" />
                    {t('resumes.groupedView.showLess')}
                  </button>
                ) : null}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface DeleteConfirmModalProps {
  deleting: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  resume: ResumeBasic;
  t: TFunction;
}

export function DeleteConfirmModal({ deleting, onClose, onConfirm, resume, t }: DeleteConfirmModalProps): JSX.Element {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 12 }}
        className="cv-panel w-full max-w-md overflow-hidden rounded-[2rem]"
      >
        <div className="border-b border-slate-200/70 px-6 py-5 dark:border-white/6">
          <div className="cv-kicker text-[var(--cv-danger)]">{t('common.delete')}</div>
          <h3 className="mt-2 text-xl font-semibold text-slate-950 dark:text-[#dee5ff]">
            {t('resumes.confirmDelete')}
          </h3>
        </div>
        <div className="px-6 py-5">
          <p className="text-sm leading-6 text-slate-600 dark:text-[#a3aac4]">
            {t('resumes.confirmDeleteMessage', { filename: resume.name || t('resumes.untitled') })}
          </p>
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              onClick={onClose}
              className="cv-ghost-button rounded-[1rem] px-4 py-3 text-sm font-medium transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={onConfirm}
              disabled={deleting}
              className="rounded-[1rem] bg-[var(--cv-danger)] px-4 py-3 text-sm font-semibold text-white transition-colors hover:brightness-110 disabled:opacity-50"
            >
              {deleting ? t('common.deleting') : t('common.delete')}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export function EmptyDealsState({ hasActiveFilters, t, visibleData }: { hasActiveFilters: boolean; t: TFunction; visibleData: GroupedData }): JSX.Element | null {
  if (visibleData.deals.length === 0 && !hasActiveFilters) {
    return (
      <div className="cv-panel rounded-[2rem] p-10 text-center">
        <BriefcaseIcon className="mx-auto mb-4 h-14 w-14 text-slate-400 dark:text-[#7f8ab0]" />
        <h3 className="cv-display mb-2 text-xl font-semibold text-slate-950 dark:text-[#dee5ff]">
          {t('resumes.groupedView.noDeals')}
        </h3>
        <p className="mx-auto max-w-xl text-sm text-slate-600 dark:text-[#a3aac4]">
          {t('resumes.groupedView.noDealsHint', { defaultValue: 'Créez une affaire ou rattachez des CV existants pour structurer votre vivier par contexte commercial.' })}
        </p>
      </div>
    );
  }

  if (visibleData.deals.length === 0 && visibleData.unassigned.length === 0 && hasActiveFilters) {
    return (
      <div className="cv-panel rounded-[2rem] p-12 text-center">
        <DocumentMagnifyingGlassIcon className="mx-auto mb-4 h-16 w-16 text-slate-400 dark:text-[#7f8ab0]" />
        <h3 className="cv-display mb-2 text-xl font-semibold text-slate-950 dark:text-[#dee5ff]">
          {t('resumes.noResults')}
        </h3>
        <p className="mx-auto max-w-lg text-sm text-slate-600 dark:text-[#a3aac4]">
          {t('resumes.noResultsFiltered')}
        </p>
      </div>
    );
  }

  return null;
}
