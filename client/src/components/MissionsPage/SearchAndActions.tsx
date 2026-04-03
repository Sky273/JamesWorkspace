import { ArrowPathIcon, PlusIcon, XMarkIcon } from '@heroicons/react/24/outline';

import SearchField from '../page/SearchField';

interface SearchAndActionsProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  onRefresh: () => void;
  onAddMission: () => void;
  onReset?: () => void;
  t: (key: string) => string;
}

const SearchAndActions = ({
  searchTerm,
  onSearchChange,
  onRefresh,
  onAddMission,
  onReset,
  t,
}: SearchAndActionsProps): JSX.Element => {
  const hasSearch = searchTerm !== '';

  return (
    <div className="cv-search-shell mb-6 rounded-[2rem] p-4 sm:p-5">
      <div className="mb-4 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <div className="cv-kicker mb-2">{t('missions.title')}</div>
          <div className="text-sm text-slate-600 dark:text-[var(--cv-muted)]">{hasSearch ? t('missions.searchPlaceholder') : t('missions.subtitle')}</div>
        </div>
        {onReset && hasSearch ? (
          <button
            onClick={onReset}
            className="cv-ghost-button inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition-colors"
            title={t('common.resetFilters')}
          >
            <XMarkIcon className="w-4 h-4" />
            <span>{t('common.resetFilters')}</span>
          </button>
        ) : null}
      </div>

      <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
        <div className="flex-1">
          <div className="flex flex-col gap-3 lg:flex-row">
        <SearchField
          value={searchTerm}
          onChange={onSearchChange}
          placeholder={t('missions.searchPlaceholder')}
        />
            <button
              onClick={onAddMission}
              className="cv-gradient-button inline-flex min-h-16 w-full items-center justify-center gap-2 rounded-[1.4rem] px-6 text-sm font-bold transition-all lg:w-auto"
            >
              <PlusIcon className="h-5 w-5" />
              {t('missions.addMission')}
            </button>
          </div>
        </div>

        <div className="flex w-full items-center gap-3 xl:w-auto">
          <button
            onClick={onRefresh}
            className="cv-ghost-button inline-flex min-h-12 min-w-12 items-center justify-center rounded-[1.1rem] p-3 transition-colors"
            title={t('missions.refresh')}
          >
            <ArrowPathIcon className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default SearchAndActions;
