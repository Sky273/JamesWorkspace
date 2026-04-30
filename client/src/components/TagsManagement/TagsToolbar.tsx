import {
  ArrowPathIcon,
  BeakerIcon,
  DocumentTextIcon,
  GlobeEuropeAfricaIcon,
} from '@heroicons/react/24/outline';
import type { TabType } from './types';
import SearchField from '../page/SearchField';
import ResponsivePageTabs, { type ResponsivePageTabOption } from '../page/ResponsivePageTabs';

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
  const tabOptions: ResponsivePageTabOption<TabType>[] = [
    {
      value: 'raw',
      label: `${t('tags.tabs.raw')} ${totalTags}`,
      icon: DocumentTextIcon,
    },
    {
      value: 'cleaned',
      label: `${t('tags.tabs.cleaned')} ${totalCleanedTags}`,
      icon: BeakerIcon,
    },
    {
      value: 'esco',
      label: `${t('tags.tabs.esco')} ${totalEscoTags}`,
      icon: GlobeEuropeAfricaIcon,
    },
  ];

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

      <ResponsivePageTabs
        minItemWidthRem={10.5}
        onChange={onTabChange}
        options={tabOptions}
        value={activeTab}
      />

      <SearchField
        containerClassName="relative max-w-xl"
        placeholder={t('tags.searchPlaceholder')}
        value={searchTerm}
        onChange={onSearchChange}
      />
    </div>
  );
}
