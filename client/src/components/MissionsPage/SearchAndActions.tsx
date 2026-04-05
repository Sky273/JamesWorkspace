import { ArrowPathIcon, PlusIcon, XMarkIcon } from '@heroicons/react/24/outline';

import SearchField from '../page/SearchField';

interface SearchAndActionsProps {
  searchTerm: string;
  resultsLabel?: string;
  onSearchChange: (value: string) => void;
  onRefresh: () => void;
  onAddMission: () => void;
  onReset?: () => void;
  t: (key: string, fallback?: string) => string;
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
    <div className="cv-search-shell mb-6 rounded-[2rem] p-4 sm:p-5">
      <div className="mb-4 flex flex-col items-start justify-between gap-3 lg:flex-row lg:items-center">
        <div className="space-y-2">
          <div className="cv-kicker">{t('missions.title')}</div>
          <div className="text-sm text-slate-600 dark:text-[var(--cv-muted)]">
            {hasSearch
              ? t('missions.searchActive', 'Résultats filtrés en direct par titre, client, interlocuteur ou affaire.')
              : t('missions.subtitle')}
          </div>
          {resultsLabel ? (
            <div className="inline-flex items-center rounded-full bg-white/70 px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm ring-1 ring-slate-200/70 dark:bg-white/5 dark:text-[var(--cv-muted)] dark:ring-white/10">
              {resultsLabel}
            </div>
          ) : null}
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          {onReset && hasSearch ? (
            <button
              onClick={onReset}
              className="cv-ghost-button inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors"
              title={t('common.resetFilters')}
            >
              <XMarkIcon className="h-4 w-4" />
              <span>{t('common.resetFilters')}</span>
            </button>
          ) : null}
          <button
            onClick={onRefresh}
            className="cv-ghost-button inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors"
            title={t('missions.refresh')}
          >
            <ArrowPathIcon className="h-4 w-4" />
            <span>{t('missions.refresh')}</span>
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <SearchField
          value={searchTerm}
          onChange={onSearchChange}
          placeholder={t('missions.searchPlaceholder')}
        />
        <button
          onClick={onAddMission}
          className="cv-gradient-button inline-flex min-h-14 w-full shrink-0 items-center justify-center gap-2 rounded-[1.4rem] px-6 text-sm font-bold transition-all lg:w-auto"
        >
          <PlusIcon className="h-5 w-5" />
          {t('missions.addMission')}
        </button>
      </div>
    </div>
  );
};

export default SearchAndActions;
