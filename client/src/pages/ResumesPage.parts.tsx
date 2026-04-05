/* eslint-disable react-refresh/only-export-components */
import {
  ArrowDownTrayIcon,
  BuildingOfficeIcon,
  CalendarIcon,
  ChartBarIcon,
  ChevronRightIcon,
  DocumentPlusIcon,
  DocumentTextIcon,
  EyeIcon,
  FunnelIcon,
  SparklesIcon,
  TrashIcon,
  UserGroupIcon,
  WrenchScrewdriverIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { AnimatePresence, motion, type Variants } from 'framer-motion';
import { useTranslation } from 'react-i18next';

import EmptyStateCard from '../components/page/EmptyStateCard';
import ConsentBadge from '../components/ConsentBadge';
import { ManageResumeDealsModal } from '../components/ResumesPage';
import { SkeletonResumeList } from '../components/ui/Skeleton';
import type { Resume } from '../types/entities';
import { getResumePreviewTags, type ExpandedCategories, type TagsByCategory } from './ResumesPage.hooks';

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
  expandedCategories,
  getTagCategory,
  handleTagClick,
  isFilterExpanded,
  onToggleTagExpansion,
  selectedTags,
  tagsByCategory,
}: {
  clearFilters: () => void;
  expandedCategories: ExpandedCategories;
  getTagCategory: (tag: string) => string;
  handleTagClick: (tag: string) => void;
  isFilterExpanded: boolean;
  onToggleTagExpansion: (category: string) => void;
  selectedTags: string[];
  tagsByCategory: TagsByCategory;
}): JSX.Element | null {
  const { t } = useTranslation();

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
        className="mt-4 rounded-[1.6rem] border border-slate-200/70 bg-white/80 px-4 pb-4 dark:border-white/6 dark:bg-[#091328]"
      >
        <div className="pt-4 space-y-4">
          {selectedTags.length > 0 ? (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-slate-600 dark:text-[#a3aac4]">{t('resumes.activeFilters')}:</span>
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

          {Object.entries(tagsByCategory).map(([category, tags]) => {
            if (tags.length === 0) {
              return null;
            }

            const isExpanded = expandedCategories[category];
            const displayedTags = isExpanded ? tags : tags.slice(0, 15);
            const hasMore = tags.length > 15;

            return (
              <div key={category} className="cv-filter-category-block">
                <h3 className="cv-filter-section-title mb-3">
                  <span className={`cv-filter-section-icon-shell ${categoryHeaderColors[category]?.dot || 'bg-gray-400'}`}>
                    {(() => {
                      const Icon = categoryIcons[category as keyof typeof categoryIcons] || SparklesIcon;
                      return <Icon className="cv-filter-section-icon" />;
                    })()}
                  </span>
                  <span className={`cv-filter-section-text ${categoryHeaderColors[category]?.text || 'text-gray-700 dark:text-gray-300'}`}>
                    {t(`resumes.filters.${category.toLowerCase().replace(' ', '')}`)}
                  </span>
                </h3>
                <div className="flex flex-wrap gap-2.5">
                  {displayedTags.map((tag) => (
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
                  {hasMore ? (
                    <button
                      onClick={() => onToggleTagExpansion(category)}
                      className="cv-filter-more py-2 text-sm font-semibold"
                    >
                      {isExpanded ? t('resumes.showLess') : `+${tags.length - 15} ${t('resumes.more')}`}
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
          {selectedTags.length > 0 ? (
            <button onClick={clearFilters} className="hidden" />
          ) : null}
        </div>
      </motion.div>
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
  formatResumeDate,
  goToUpload,
  handleDownloadResume,
  handleResumeClick,
  loading,
  onDeleteResume,
  searchQuery,
  selectedTags,
}: {
  clearFilters: () => void;
  filteredResumes: Resume[];
  formatResumeDate: (dateString?: string) => string;
  goToUpload: () => void;
  handleDownloadResume: (resume: Resume, event: React.MouseEvent) => Promise<void>;
  handleResumeClick: (resume: Resume) => void;
  loading: boolean;
  onDeleteResume: (resume: Resume, event: React.MouseEvent) => void;
  searchQuery: string;
  selectedTags: string[];
}) {
  const { t } = useTranslation();
  const hasActiveFilters = searchQuery.length > 0 || selectedTags.length > 0;

  if (loading) {
    return (
      <div className="cv-panel overflow-hidden rounded-[2rem]">
        <ResultsCollectionHeader count={filteredResumes.length} hasActiveFilters={hasActiveFilters} loading={true} />
        <div className="p-5 sm:p-6">
          <SkeletonResumeList count={6} />
        </div>
      </div>
    );
  }

  if (filteredResumes.length === 0) {
    return (
      <div className="cv-panel overflow-hidden rounded-[2rem]">
        <ResultsCollectionHeader count={0} hasActiveFilters={hasActiveFilters} loading={false} />
        <div className="p-6 sm:p-8">
          <EmptyStateCard
            icon={hasActiveFilters ? FunnelIcon : DocumentPlusIcon}
            title={t('resumes.noResults')}
            description={hasActiveFilters ? t('resumes.noResultsFiltered') : t('resumes.uploadFirst')}
            containerClassName="rounded-[1.75rem] border border-dashed border-slate-200/80 bg-white/50 p-10 text-center dark:border-white/10 dark:bg-white/[0.02]"
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
    <div className="cv-panel overflow-hidden rounded-[2rem]">
      <ResultsCollectionHeader count={filteredResumes.length} hasActiveFilters={hasActiveFilters} loading={false} />
      <div className="p-5 sm:p-6">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
      {filteredResumes.map((resume, index) => (
        <motion.div
          key={resume.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}
          className="cv-card group overflow-hidden rounded-[2rem] transition-all cursor-pointer"
          onClick={() => handleResumeClick(resume)}
        >
          <div className="border-b border-slate-200/70 p-5 dark:border-white/6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-[var(--cv-primary-soft)] text-[var(--cv-primary)]">
                    <DocumentTextIcon className="w-5 h-5" />
                  </div>
                  <h3 className="cv-display truncate text-lg font-bold text-slate-950 dark:text-[#dee5ff]">
                    {resume.Name || resume['Resume File']?.[0]?.filename || t('resumes.untitled')}
                  </h3>
                </div>
                {resume.Title ? <p className="mt-2 truncate pl-12 text-sm text-slate-600 dark:text-[#a3aac4]">{resume.Title}</p> : null}
              </div>
              <span className={classNames('cv-pill inline-flex w-fit flex-shrink-0 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] sm:ml-2', getStatusBadgeClass(resume.Status))}>
                {t(`resumes.status.${resume.Status?.toLowerCase() || 'new'}`)}
              </span>
            </div>
          </div>

          <div className="p-5">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <ChartBarIcon className="w-5 h-5 text-slate-400 dark:text-[#7f8ab0]" />
                <span className="text-sm text-slate-600 dark:text-[#a3aac4]">{t('resumes.score_label')}</span>
              </div>
              <div className="flex items-center gap-2 self-start sm:self-auto">
                {resume['Improved Global Rating'] && resume['Improved Global Rating'] !== resume['Global Rating'] ? (
                  <>
                    <span className="text-sm text-slate-400 line-through dark:text-[#6f7a98]">{resume['Global Rating'] != null ? `${resume['Global Rating']}%` : '0%'}</span>
                    <span className="cv-display text-2xl font-bold text-[var(--cv-tertiary)]">{resume['Improved Global Rating'] != null ? `${resume['Improved Global Rating']}%` : '0%'}</span>
                  </>
                ) : (
                  <span className="cv-display text-2xl font-bold text-slate-950 dark:text-[#dee5ff]">{resume['Global Rating'] != null ? `${resume['Global Rating']}%` : '0%'}</span>
                )}
              </div>
            </div>

            <div className="cv-score-track mb-4 h-2 overflow-hidden rounded-full">
              <div
                className="cv-score-fill h-full rounded-full"
                style={{ width: `${resume['Improved Global Rating'] ?? resume['Global Rating'] ?? 0}%` }}
              />
            </div>

            <div className="mb-3 flex flex-col gap-2 text-sm text-slate-500 dark:text-[#a3aac4] sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <CalendarIcon className="w-4 h-4" />
                {formatResumeDate(resume['Created At'])}
              </div>
              {resume.consent_status ? (
                <ConsentBadge
                  status={resume.consent_status}
                  candidateName={resume.candidate_name}
                  candidateEmail={resume.candidate_email}
                  consentTokenExpiresAt={resume.consent_token_expires_at}
                  retentionUntil={resume.retention_until}
                  compact={true}
                />
              ) : null}
            </div>

            {resume.FirmName ? (
              <div className="mb-4 flex items-center gap-1">
                <BuildingOfficeIcon className="w-3 h-3 text-slate-400 dark:text-[#7f8ab0]" />
                <span className="text-xs text-slate-500 dark:text-[#8f99b8]">{resume.FirmName}</span>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              {(['Skills', 'Industries', 'Tools', 'Soft Skills'] as const).flatMap((category) =>
                getResumePreviewTags(resume, category).slice(0, 2).map((tag, tagIndex) => (
                  <span key={`${category}-${tagIndex}`} className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] ${tagColorMap[category]}`}>
                    {tag}
                  </span>
                ))
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 p-5 pt-0 sm:flex-nowrap">
            <button
              onClick={(event) => {
                event.stopPropagation();
                handleResumeClick(resume);
              }}
              className="cv-ghost-button flex min-h-12 w-full items-center justify-center gap-1 rounded-2xl px-3 py-3 text-sm transition-colors cursor-pointer sm:flex-1"
            >
              <EyeIcon className="w-5 h-5" />
              {t('resumes.view')}
            </button>
            {resume['Resume File']?.[0] ? (
              <button
                onClick={(event) => void handleDownloadResume(resume, event)}
                className="cv-ghost-button min-h-12 min-w-12 rounded-2xl p-3 text-[var(--cv-primary)] transition-colors cursor-pointer"
                title={resume['File Name'] || resume['Resume File']?.[0]?.filename || t('resumes.downloadResume')}
              >
                <ArrowDownTrayIcon className="w-5 h-5" />
              </button>
            ) : null}
            <ManageResumeDealsModal resumeId={resume.id} />
            <button
              onClick={(event) => onDeleteResume(resume, event)}
              className="cv-ghost-button min-h-12 min-w-12 rounded-2xl p-3 text-[#ff8ca5] transition-colors cursor-pointer"
              title={t('resumes.deleteResume')}
            >
              <TrashIcon className="w-5 h-5" />
            </button>
          </div>
        </motion.div>
      ))}
        </div>
      </div>
    </div>
  );
}
