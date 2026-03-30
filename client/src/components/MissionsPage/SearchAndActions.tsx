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
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 mb-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between p-4 gap-4">
        <SearchField
          value={searchTerm}
          onChange={onSearchChange}
          placeholder={t('missions.searchPlaceholder')}
        />

        <div className="flex items-center gap-3">
          <button
            onClick={onRefresh}
            className="p-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            title={t('missions.refresh')}
          >
            <ArrowPathIcon className="w-5 h-5" />
          </button>
          {onReset && searchTerm ? (
            <button
              onClick={onReset}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              title={t('common.resetFilters')}
            >
              <XMarkIcon className="w-4 h-4" />
              <span className="hidden sm:inline">{t('common.resetFilters')}</span>
            </button>
          ) : null}
          <button
            onClick={onAddMission}
            className="btn btn-primary flex items-center gap-2 px-4 py-2"
          >
            <PlusIcon className="h-5 w-5" />
            {t('missions.addMission')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SearchAndActions;
