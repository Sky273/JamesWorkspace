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
    <div className="cv-search-shell mb-[18px] rounded-[13px] p-0">
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
        <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center">
          <SearchField
            value={searchQuery}
            onChange={onSearchChange}
            placeholder={t('resumes.searchPlaceholder')}
            className="cv-search-input mb-0 h-[38px] w-full rounded-[10px] py-0 pr-3 text-[13px] font-normal text-[var(--cv-text)] placeholder:text-[var(--cv-subtle)]"
            containerClassName="relative min-w-0 flex-1"
          />
          <button
            type="button"
            onClick={onUpload}
            className="cv-page-primary-action inline-flex h-[38px] w-full items-center justify-center gap-1.5 rounded-[10px] px-[15px] text-[13px] font-medium transition-all lg:w-auto"
          >
            <PlusIcon className="w-5 h-5" />
            <span>{t('resumes.uploadButton')}</span>
          </button>
        </div>

        <div className="flex w-full flex-wrap items-center gap-2 xl:w-auto xl:justify-end">
          {hasActiveFilters && onReset ? (
            <button
              type="button"
              onClick={onReset}
              className="cv-ghost-button inline-flex h-[38px] items-center gap-1.5 rounded-[10px] px-[15px] text-[13px] font-medium transition-colors"
              title={t('common.resetFilters')}
            >
              <XMarkIcon className="w-4 h-4" />
              <span className="hidden sm:inline">{t('common.resetFilters')}</span>
            </button>
          ) : null}
          <button
            type="button"
            onClick={onToggleFilter}
            className={`inline-flex h-[38px] flex-1 items-center justify-center gap-1.5 rounded-[10px] px-[15px] text-[13px] font-medium transition-all sm:flex-none ${
              isFilterExpanded || selectedTagsCount > 0
                ? 'cv-filter-button-active border border-[var(--cv-outline-strong)] text-[var(--cv-text)]'
                : 'cv-ghost-button'
            }`}
          >
            <FunnelIcon className="w-5 h-5" />
            <span>{t('resumes.filterButton')}</span>
            {selectedTagsCount > 0 ? (
              <span className="rounded-full bg-[var(--cv-primary)] px-2 py-0.5 text-xs font-bold text-white dark:text-[#060e20]">
                {selectedTagsCount}
              </span>
            ) : null}
            <ChevronDownIcon className={`w-4 h-4 transition-transform ${isFilterExpanded ? 'rotate-180' : ''}`} />
          </button>
          {onBatchUpload ? (
            <button
              type="button"
              onClick={onBatchUpload}
              className="cv-ghost-button inline-flex h-[38px] flex-1 items-center justify-center gap-1.5 rounded-[10px] px-[15px] text-[13px] font-medium transition-colors sm:flex-none"
              title={t('resumes.batchUploadButton')}
            >
              <FolderArrowDownIcon className="w-5 h-5" />
              <span>{t('resumes.batchUploadButton')}</span>
            </button>
          ) : null}
          <button
            type="button"
            onClick={onRefresh}
            className="cv-ghost-button inline-flex h-[38px] min-w-[38px] items-center justify-center rounded-[10px] p-2 transition-colors"
            title={t('resumes.refresh')}
            aria-label={t('resumes.refresh')}
          >
            <ArrowPathIcon className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default SearchAndActions;
