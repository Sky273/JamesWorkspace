import { ArrowPathIcon, BeakerIcon, DocumentTextIcon, GlobeEuropeAfricaIcon } from '@heroicons/react/24/outline';
import type { TabType } from './types';
import SearchField from '../page/SearchField';

interface TagsToolbarProps {
  activeTab: TabType;
  searchTerm: string;
  totalTags: number;
  totalCleanedTags: number;
  totalEscoTags: number;
  savingCleanedTags: boolean;
  convertingToEsco: boolean;
  onTabChange: (tab: TabType) => void;
  onSearchChange: (value: string) => void;
  onRecalculateCleanedTags: () => void;
  onRecalculateEscoTags: () => void;
  onRefresh: () => void;
  t: (key: string) => string;
}

export default function TagsToolbar({
  activeTab,
  searchTerm,
  totalTags,
  totalCleanedTags,
  totalEscoTags,
  savingCleanedTags,
  convertingToEsco,
  onTabChange,
  onSearchChange,
  onRecalculateCleanedTags,
  onRecalculateEscoTags,
  onRefresh,
  t
}: TagsToolbarProps): JSX.Element {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-6">
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex -mb-px">
          <button
            onClick={() => onTabChange('raw')}
            className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'raw'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 hover:border-gray-300'
            }`}
          >
            <DocumentTextIcon className="w-5 h-5" />
            {t('tags.tabs.raw')}
            <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">{totalTags}</span>
          </button>
          <button
            onClick={() => onTabChange('cleaned')}
            className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'cleaned'
                ? 'border-green-500 text-green-600 dark:text-green-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 hover:border-gray-300'
            }`}
          >
            <BeakerIcon className="w-5 h-5" />
            {t('tags.tabs.cleaned')}
            <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">{totalCleanedTags}</span>
          </button>
          <button
            onClick={() => onTabChange('esco')}
            className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'esco'
                ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 hover:border-gray-300'
            }`}
          >
            <GlobeEuropeAfricaIcon className="w-5 h-5" />
            {t('tags.tabs.esco')}
            <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">{totalEscoTags}</span>
          </button>
        </nav>
      </div>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between p-4 gap-4">
        <SearchField
          containerClassName="relative flex-1 max-w-md"
          placeholder={t('tags.searchPlaceholder')}
          value={searchTerm}
          onChange={onSearchChange}
        />
        <div className="flex gap-2">
          {activeTab === 'cleaned' && (
            <button
              onClick={onRecalculateCleanedTags}
              disabled={savingCleanedTags}
              className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {savingCleanedTags ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <ArrowPathIcon className="w-5 h-5" />
              )}
              {t('tags.recalculateCleanedTags')}
            </button>
          )}
          {activeTab === 'esco' && (
            <button
              onClick={onRecalculateEscoTags}
              disabled={convertingToEsco}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {convertingToEsco ? (
                <ArrowPathIcon className="w-5 h-5 animate-spin" />
              ) : (
                <GlobeEuropeAfricaIcon className="w-5 h-5" />
              )}
              {t('tags.recalculateEscoTags')}
            </button>
          )}
          <button onClick={onRefresh} className="btn btn-primary flex items-center gap-2 px-4 py-2">
            <ArrowPathIcon className="w-5 h-5" />
            {t('tags.refresh')}
          </button>
        </div>
      </div>
    </div>
  );
}
