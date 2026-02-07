/**
 * Search and Actions Component for Missions Page
 * TypeScript version
 */

import { ChangeEvent } from 'react';
import { 
  MagnifyingGlassIcon,
  ArrowPathIcon,
  PlusIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';

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
  t 
}: SearchAndActionsProps): JSX.Element => {
  const handleSearchChange = (e: ChangeEvent<HTMLInputElement>): void => {
    onSearchChange(e.target.value);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between p-4 gap-4">
        <div className="relative flex-1 max-w-md">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder={t('missions.searchPlaceholder')}
            value={searchTerm}
            onChange={handleSearchChange}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onRefresh}
            className="p-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            title={t('missions.refresh')}
          >
            <ArrowPathIcon className="w-5 h-5" />
          </button>
          {onReset && searchTerm && (
            <button
              onClick={onReset}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              title={t('common.resetFilters')}
            >
              <XMarkIcon className="w-4 h-4" />
              <span className="hidden sm:inline">{t('common.resetFilters')}</span>
            </button>
          )}
          <button
            onClick={onAddMission}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
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
