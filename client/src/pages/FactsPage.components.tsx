import { ArrowPathIcon, CheckCircleIcon, MapIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';

import ResponsivePageTabs from '../components/page/ResponsivePageTabs';
import type { MarketFact } from '../services/marketRadarService';
import type { FactsStats, TabType } from './FactsPage.hooks';
import { FACTS_TAB_OPTIONS } from './FactsPage.constants';
import {
  FactsAdminCollectionPanel,
  FactsEmptyState,
  FactsFiltersPanel,
  FactsLastUpdatedFooter,
  FactsStatsCards,
  FactsTable,
} from './FactsPage.parts';

interface FactsTabsProps {
  activeTab: TabType;
  onChange: (tab: TabType) => void;
}

interface FactsCollectionOverlayProps {
  collecting: boolean;
  collectingSuccess: boolean;
}

interface FactsMapPlaceholderProps {
  onEnable: () => void;
}

interface FactsDataTabProps {
  facts: MarketFact[];
  loading: boolean;
  error: string | null;
  collecting: boolean;
  isAdmin: boolean;
  sourceFilter: string;
  setSourceFilter: (value: string) => void;
  keywordFilter: string;
  setKeywordFilter: (value: string) => void;
  regionFilter: string;
  setRegionFilter: (value: string) => void;
  uniqueKeywords: string[];
  uniqueRegions: string[];
  romeLabelsMap: Record<string, string>;
  stats: FactsStats;
  currentPage: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  setCurrentPage: (page: number) => void;
  onCollect: (source: 'france_travail' | 'adzuna') => void;
  onClearFilters: () => void;
}

export const TabLoader = () => (
  <div className="flex items-center justify-center py-12">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
  </div>
);

export const FactsCollectionOverlay = ({ collecting, collectingSuccess }: FactsCollectionOverlayProps): JSX.Element | null => {
  const { t } = useTranslation();

  if (!collecting) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-8 max-w-md mx-4 text-center">
        {collectingSuccess ? (
          <>
            <CheckCircleIcon className="h-16 w-16 text-green-500 mx-auto mb-4 animate-bounce" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
              {t('marketRadar.collection.launched', 'Collecte lancée !')}
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              {t('marketRadar.collection.redirecting', 'Redirection vers les jobs...')}
            </p>
          </>
        ) : (
          <>
            <ArrowPathIcon className="h-16 w-16 text-indigo-600 dark:text-indigo-400 animate-spin mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
              {t('marketRadar.collection.starting', 'Lancement de la collecte...')}
            </h3>
          </>
        )}
      </div>
    </div>
  );
};

export const FactsTabs = ({ activeTab, onChange }: FactsTabsProps): JSX.Element => {
  const { t } = useTranslation();

  const tabs = FACTS_TAB_OPTIONS.map(({ value, labelKey, icon }) => ({
    value,
    label: t(labelKey),
    icon,
  })) satisfies Array<{ value: TabType; label: string; icon: typeof MapIcon }>;

  return (
    <ResponsivePageTabs
      label={t('marketRadar.sections.title', 'Sections')}
      minItemWidthRem={10}
      onChange={onChange}
      options={tabs}
      value={activeTab}
    />
  );
};

export const FactsMapPlaceholder = ({ onEnable }: FactsMapPlaceholderProps): JSX.Element => {
  const { t } = useTranslation();

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300">
          <MapIcon className="h-8 w-8" />
        </div>
        <h3 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
          {t('marketRadar.map.title')}
        </h3>
        <p className="mt-3 max-w-2xl text-sm text-gray-600 dark:text-gray-400">
          {t('marketRadar.map.subtitle')}
        </p>
        <div className="mt-6 grid w-full gap-3 text-left text-sm text-gray-600 dark:text-gray-400 md:grid-cols-3">
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/40">
            <div className="font-medium text-gray-900 dark:text-gray-100">{t('marketRadar.map.lazyLoadingTitle')}</div>
            <div className="mt-1">{t('marketRadar.map.lazyLoadingBody')}</div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/40">
            <div className="font-medium text-gray-900 dark:text-gray-100">{t('marketRadar.map.defaultMapTitle')}</div>
            <div className="mt-1">{t('marketRadar.map.defaultMapBody')}</div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/40">
            <div className="font-medium text-gray-900 dark:text-gray-100">{t('marketRadar.map.fullInteractionTitle')}</div>
            <div className="mt-1">{t('marketRadar.map.fullInteractionBody')}</div>
          </div>
        </div>
        <button
          type="button"
          onClick={onEnable}
          className="app-primary-action mt-8 inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-medium"
        >
          <MapIcon className="h-5 w-5" />
          {t('marketRadar.map.loadInteractive', 'Charger la carte interactive')}
        </button>
      </div>
    </div>
  );
};

export const FactsDataTab = ({
  facts,
  loading,
  error,
  collecting,
  isAdmin,
  sourceFilter,
  setSourceFilter,
  keywordFilter,
  setKeywordFilter,
  regionFilter,
  setRegionFilter,
  uniqueKeywords,
  uniqueRegions,
  romeLabelsMap,
  stats,
  currentPage,
  totalPages,
  totalCount,
  pageSize,
  setCurrentPage,
  onCollect,
  onClearFilters,
}: FactsDataTabProps): JSX.Element => {
  const { t } = useTranslation();

  return (
    <>
      {isAdmin && (
        <FactsAdminCollectionPanel collecting={collecting} error={error} onCollect={onCollect} />
      )}

      <FactsFiltersPanel
        sourceFilter={sourceFilter}
        setSourceFilter={setSourceFilter}
        keywordFilter={keywordFilter}
        setKeywordFilter={setKeywordFilter}
        regionFilter={regionFilter}
        setRegionFilter={setRegionFilter}
        uniqueKeywords={uniqueKeywords}
        uniqueRegions={uniqueRegions}
        romeLabelsMap={romeLabelsMap}
        onClearFilters={onClearFilters}
      />

      <FactsStatsCards stats={stats} />

      {loading && (
        <div className="flex items-center justify-center py-12">
          <ArrowPathIcon className="h-8 w-8 text-indigo-600 dark:text-indigo-400 animate-spin" />
          <span className="ml-2 text-gray-600 dark:text-gray-400">{t('common.loading')}</span>
        </div>
      )}

      {!loading && facts.length === 0 && <FactsEmptyState />}

      {!loading && facts.length > 0 && (
        <FactsTable
          facts={facts}
          currentPage={currentPage}
          totalPages={totalPages}
          totalCount={totalCount}
          pageSize={pageSize}
          loading={loading}
          onPageChange={setCurrentPage}
          romeLabelsMap={romeLabelsMap}
        />
      )}

      <FactsLastUpdatedFooter />
    </>
  );
};
