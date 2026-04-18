import {
  ArrowPathIcon,
  BeakerIcon,
  DocumentTextIcon,
  GlobeEuropeAfricaIcon,
} from '@heroicons/react/24/outline';
import type { TabType } from './types';
import SearchField from '../page/SearchField';

interface TagsToolbarProps {
  activeTab: TabType;
  canRunAdminRecalculations: boolean;
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
  canRunAdminRecalculations,
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
  t,
}: TagsToolbarProps): JSX.Element {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-950 dark:text-[var(--cv-text)]">
            {t(`tags.tabs.${activeTab}`)}
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {t('tags.searchPlaceholder')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canRunAdminRecalculations && activeTab === 'cleaned' && (
            <button
              onClick={onRecalculateCleanedTags}
              disabled={savingCleanedTags}
              className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savingCleanedTags ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <ArrowPathIcon className="h-4 w-4" />
              )}
              {t('tags.recalculateCleanedTags')}
            </button>
          )}
          {canRunAdminRecalculations && activeTab === 'esco' && (
            <button
              onClick={onRecalculateEscoTags}
              disabled={convertingToEsco}
              className="app-primary-action inline-flex min-h-11 items-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
            >
              {convertingToEsco ? (
                <ArrowPathIcon className="h-4 w-4 animate-spin" />
              ) : (
                <GlobeEuropeAfricaIcon className="h-4 w-4" />
              )}
              {t('tags.recalculateEscoTags')}
            </button>
          )}
          <button
            onClick={onRefresh}
            className="cv-ghost-button inline-flex min-h-11 items-center gap-2 px-4 py-2 text-sm font-medium"
          >
            <ArrowPathIcon className="h-4 w-4" />
            {t('tags.refresh')}
          </button>
        </div>
      </div>

      <div className="rounded-[1.75rem] border border-slate-200/80 bg-white/70 p-2 dark:border-slate-700/80 dark:bg-slate-900/40">
        <nav className="flex flex-wrap gap-2">
          <button
            onClick={() => onTabChange('raw')}
            className={`inline-flex min-h-11 items-center gap-2 rounded-2xl px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'raw'
                ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <DocumentTextIcon className="h-5 w-5" />
            {t('tags.tabs.raw')}
            <span className="rounded-full bg-white/90 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-900 dark:text-slate-300">
              {totalTags}
            </span>
          </button>
          <button
            onClick={() => onTabChange('cleaned')}
            className={`inline-flex min-h-11 items-center gap-2 rounded-2xl px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'cleaned'
                ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <BeakerIcon className="h-5 w-5" />
            {t('tags.tabs.cleaned')}
            <span className="rounded-full bg-white/90 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-900 dark:text-slate-300">
              {totalCleanedTags}
            </span>
          </button>
          <button
            onClick={() => onTabChange('esco')}
            className={`inline-flex min-h-11 items-center gap-2 rounded-2xl px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'esco'
                ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <GlobeEuropeAfricaIcon className="h-5 w-5" />
            {t('tags.tabs.esco')}
            <span className="rounded-full bg-white/90 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-900 dark:text-slate-300">
              {totalEscoTags}
            </span>
          </button>
        </nav>
      </div>

      <SearchField
        containerClassName="relative max-w-xl"
        placeholder={t('tags.searchPlaceholder')}
        value={searchTerm}
        onChange={onSearchChange}
      />
    </div>
  );
}
