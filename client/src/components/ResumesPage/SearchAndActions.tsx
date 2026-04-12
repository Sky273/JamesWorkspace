import {
  FunnelIcon,
  ArrowPathIcon,
  PlusIcon,
  ChevronDownIcon,
  XMarkIcon,
  FolderArrowDownIcon,
} from '@heroicons/react/24/outline';

import type { TFunction } from 'i18next';

import SearchField from '../page/SearchField';

interface SearchAndActionsProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  isFilterExpanded: boolean;
  onToggleFilter: () => void;
  selectedTagsCount: number;
  onRefresh: () => void;
  onUpload: () => void;
  onBatchUpload?: () => void;
  onReset?: () => void;
  t: TFunction;
}

const SearchAndActions = ({
  searchQuery,
  onSearchChange,
  isFilterExpanded,
  onToggleFilter,
  selectedTagsCount,
  onRefresh,
  onUpload,
  onBatchUpload,
  onReset,
  t,
}: SearchAndActionsProps): JSX.Element => {
  const hasActiveFilters = searchQuery !== '' || selectedTagsCount > 0;

  return (
    <div className="cv-search-shell rounded-[2rem] p-4 sm:p-5">
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="cv-kicker">{t('resumes.filterButton')}</div>
          <div className="space-y-1">
            <h2 className="cv-display text-xl font-bold text-slate-950 dark:text-[#dee5ff]">
              {t('resumes.listHeading', 'Parcourez votre CVthèque')}
            </h2>
            <p className="max-w-2xl text-sm text-slate-600 dark:text-[#a3aac4]">
              {selectedTagsCount > 0
                ? t('resumes.activeFiltersSummary', { count: selectedTagsCount, defaultValue: `${selectedTagsCount} filtres actifs pour affiner la sélection.` })
                : t('resumes.listDescription', 'Recherchez, filtrez et organisez rapidement les profils disponibles.')}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 self-start">
          {hasActiveFilters && onReset ? (
            <button
              type="button"
              onClick={onReset}
              className="cv-ghost-button inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition-colors"
              title={t('common.resetFilters')}
            >
              <XMarkIcon className="w-4 h-4" />
              <span>{t('common.resetFilters')}</span>
            </button>
          ) : null}
          <button
            type="button"
            onClick={onRefresh}
            className="cv-ghost-button inline-flex min-h-12 min-w-12 items-center justify-center rounded-[1.1rem] p-3 transition-colors"
            title={t('resumes.refresh')}
            aria-label={t('resumes.refresh')}
          >
            <ArrowPathIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
        <div className="flex flex-col gap-3 lg:flex-row">
          <SearchField
            value={searchQuery}
            onChange={onSearchChange}
            placeholder={t('resumes.searchPlaceholder')}
          />
          <button
            type="button"
            onClick={onUpload}
            className="cv-gradient-button inline-flex min-h-16 w-full items-center justify-center gap-2 rounded-[1.4rem] px-6 text-sm font-bold transition-all lg:w-auto"
          >
            <PlusIcon className="w-5 h-5" />
            <span>{t('resumes.uploadButton')}</span>
          </button>
        </div>

        <div className="flex w-full flex-wrap items-center gap-3 xl:w-auto xl:justify-end">
          <button
            type="button"
            onClick={onToggleFilter}
            className={`inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-[1.1rem] px-4 py-3 text-sm font-semibold transition-all sm:flex-none ${
              isFilterExpanded || selectedTagsCount > 0
                ? 'border border-[var(--cv-outline)] bg-[var(--cv-primary-soft)] text-[var(--cv-text)] shadow-[0_12px_30px_var(--cv-shadow)]'
                : 'cv-ghost-button'
            }`}
          >
            <FunnelIcon className="w-5 h-5" />
            <span>{t('resumes.filterButton')}</span>
            {selectedTagsCount > 0 ? <span className="rounded-full bg-[var(--cv-primary)] px-2 py-0.5 text-xs font-bold text-[#060e20]">{selectedTagsCount}</span> : null}
            <ChevronDownIcon className={`w-4 h-4 transition-transform ${isFilterExpanded ? 'rotate-180' : ''}`} />
          </button>
          {onBatchUpload ? (
            <button
              type="button"
              onClick={onBatchUpload}
              className="cv-ghost-button inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-[1.1rem] px-4 py-3 text-sm font-semibold transition-colors sm:flex-none"
              title={t('resumes.batchUploadButton')}
            >
              <FolderArrowDownIcon className="w-5 h-5" />
              <span>{t('resumes.batchUploadButton')}</span>
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default SearchAndActions;
