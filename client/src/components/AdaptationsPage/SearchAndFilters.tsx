import { ChangeEvent } from 'react';
import {
  FunnelIcon,
  ArrowPathIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

import SearchField from '../page/SearchField';

interface SearchAndFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  filterStatus: string;
  onFilterChange: (value: string) => void;
  onRefresh: () => void;
  onReset?: () => void;
  t: (key: string) => string;
}

const SearchAndFilters = ({
  searchTerm,
  onSearchChange,
  filterStatus,
  onFilterChange,
  onRefresh,
  onReset,
  t,
}: SearchAndFiltersProps): JSX.Element => {
  const hasActiveFilters = searchTerm !== '' || filterStatus !== 'all';

  const handleFilterChange = (event: ChangeEvent<HTMLSelectElement>): void => {
    onFilterChange(event.target.value);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <SearchField
          containerClassName="flex-1 relative max-w-md"
          value={searchTerm}
          onChange={onSearchChange}
          placeholder={t('adaptations.searchPlaceholder')}
        />

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <FunnelIcon className="w-5 h-5 text-gray-400" />
            <select
              value={filterStatus}
              onChange={handleFilterChange}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">{t('adaptations.filterStatus')}</option>
              <option value="Completed">{t('adaptations.status.completed')}</option>
              <option value="Processing">{t('adaptations.status.processing')}</option>
              <option value="Failed">{t('adaptations.status.failed')}</option>
            </select>
          </div>
          <button
            onClick={onRefresh}
            className="p-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            title={t('adaptations.refresh')}
          >
            <ArrowPathIcon className="w-5 h-5" />
          </button>
          {onReset && hasActiveFilters ? (
            <button
              onClick={onReset}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              title={t('common.resetFilters')}
            >
              <XMarkIcon className="w-4 h-4" />
              <span className="hidden sm:inline">{t('common.resetFilters')}</span>
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default SearchAndFilters;
