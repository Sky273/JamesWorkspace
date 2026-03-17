/**
 * Search and Actions Component for Resumes Page
 * TypeScript version
 */

import { ChangeEvent } from 'react';
import { 
  MagnifyingGlassIcon,
  FunnelIcon,
  ArrowPathIcon,
  PlusIcon,
  ChevronDownIcon,
  XMarkIcon,
  FolderArrowDownIcon
} from '@heroicons/react/24/outline';

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
  t: (key: string) => string;
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
  t 
}: SearchAndActionsProps): JSX.Element => {
  const hasActiveFilters = searchQuery !== '' || selectedTagsCount > 0;
  const handleSearchChange = (e: ChangeEvent<HTMLInputElement>): void => {
    onSearchChange(e.target.value);
  };

  return (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between p-4 gap-4">
      <div className="relative flex-1 max-w-md">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={handleSearchChange}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
          placeholder={t('resumes.searchPlaceholder')}
        />
      </div>

      <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
        <button
          onClick={onToggleFilter}
          className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-2 border rounded-lg transition-colors text-sm sm:text-base ${
            isFilterExpanded || selectedTagsCount > 0
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
              : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
        >
          <FunnelIcon className="w-5 h-5" />
          <span className="hidden xs:inline">{t('resumes.filterButton')}</span>
          {selectedTagsCount > 0 && (
            <span className="px-1.5 py-0.5 text-xs bg-blue-500 text-white rounded-full">{selectedTagsCount}</span>
          )}
          <ChevronDownIcon className={`w-4 h-4 transition-transform ${isFilterExpanded ? 'rotate-180' : ''}`} />
        </button>
        <button
          onClick={onRefresh}
          className="p-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          title={t('resumes.refresh')}
        >
          <ArrowPathIcon className="w-5 h-5" />
        </button>
        {onReset && hasActiveFilters && (
          <button
            onClick={onReset}
            className="inline-flex items-center gap-1.5 px-2 sm:px-3 py-2 text-sm font-medium rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            title={t('common.resetFilters')}
          >
            <XMarkIcon className="w-4 h-4" />
            <span className="hidden sm:inline">{t('common.resetFilters')}</span>
          </button>
        )}
        {onBatchUpload && (
          <button
            onClick={onBatchUpload}
            className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors text-sm sm:text-base"
            title={t('resumes.batchUploadButton')}
          >
            <FolderArrowDownIcon className="w-5 h-5" />
            <span className="hidden sm:inline">{t('resumes.batchUploadButton')}</span>
          </button>
        )}
        <button
          onClick={onUpload}
          className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm sm:text-base"
        >
          <PlusIcon className="w-5 h-5" />
          <span className="hidden xs:inline">{t('resumes.uploadButton')}</span>
        </button>
      </div>
    </div>
  );
};

export default SearchAndActions;
