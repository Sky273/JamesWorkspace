import { ArrowPathIcon, PlusIcon, XMarkIcon } from '@heroicons/react/24/outline';
import type { TFunction } from 'i18next';

import SearchField from '../page/SearchField';

interface SearchAndActionsProps {
  searchTerm: string;
  resultsLabel?: string;
  onSearchChange: (value: string) => void;
  onRefresh: () => void;
  onAddMission: () => void;
  onReset?: () => void;
  t: TFunction;
}

const SearchAndActions = ({
  searchTerm,
  onSearchChange,
  resultsLabel,
  onRefresh,
  onAddMission,
  onReset,
  t,
}: SearchAndActionsProps): JSX.Element => {
  const hasSearch = searchTerm !== '';

  return (
    <div className="cv-search-shell missions-toolbar mb-5 rounded-[13px] p-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="min-w-0 flex-1">
          <SearchField
            value={searchTerm}
            onChange={onSearchChange}
            placeholder={t('missions.searchPlaceholder')}
          />
        </div>
        {resultsLabel ? (
          <div className="inline-flex h-[38px] items-center rounded-[9px] border border-[var(--cv-outline)] bg-white px-3 text-xs font-semibold text-[var(--cv-muted)]">
            {resultsLabel}
          </div>
        ) : null}
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          {onReset && hasSearch ? (
            <button
              type="button"
              onClick={onReset}
              className="cv-ghost-button inline-flex h-[38px] items-center justify-center gap-2 rounded-[9px] px-3 text-xs font-medium transition-colors"
              title={t('common.resetFilters')}
            >
              <XMarkIcon className="h-4 w-4" />
              <span>{t('common.resetFilters')}</span>
            </button>
          ) : null}
          <button
            type="button"
            onClick={onRefresh}
            className="cv-ghost-button inline-flex h-[38px] items-center justify-center gap-2 rounded-[9px] px-3 text-xs font-medium transition-colors"
            title={t('missions.refresh')}
          >
            <ArrowPathIcon className="h-4 w-4" />
            <span>{t('missions.refresh')}</span>
          </button>
          <button
            type="button"
            onClick={onAddMission}
            className="cv-page-primary-action inline-flex h-[38px] w-full shrink-0 items-center justify-center gap-2 rounded-[9px] px-4 text-xs font-bold transition-all sm:w-auto"
          >
            <PlusIcon className="h-4 w-4" />
            {t('missions.addMission')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SearchAndActions;
