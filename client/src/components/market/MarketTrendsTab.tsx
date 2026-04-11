/**
 * MarketTrendsTab - Market Trends Analysis for Market Radar
 */

import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';

import {
  MarketCollectionOverlay,
  MarketTrendsFiltersPanel,
  MarketTrendsHeader,
  MarketTrendsResults,
  MarketTrendsSummaryCards,
} from './MarketTrendsTab.components';
import { useMarketTrendsDashboard } from './useMarketTrendsDashboard';

export default function MarketTrendsTab({ className = '' }: { className?: string }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canCollectMarketTrends = user?.role === 'admin';
  const dashboard = useMarketTrendsDashboard();

  if (dashboard.loading && Object.keys(dashboard.trendsByType).length === 0) {
    return (
      <div className={`flex items-center justify-center py-12 ${className}`}>
        <ArrowPathIcon className="h-8 w-8 text-indigo-600 dark:text-indigo-400 animate-spin" />
        <span className="ml-2 text-gray-600 dark:text-gray-400">{t('marketRadar.trends.loading')}</span>
      </div>
    );
  }

  return (
    <>
      <MarketCollectionOverlay collecting={dashboard.collecting} collectingSuccess={dashboard.collectingSuccess} />

      <div className={`space-y-6 ${className}`}>
        <MarketTrendsHeader
          canCollectMarketTrends={canCollectMarketTrends}
          error={dashboard.error}
          loading={dashboard.loading}
          onCollect={dashboard.handleCollect}
          onCollectDynamics={dashboard.handleCollectDynamics}
          onRefresh={() => {
            void dashboard.refreshAll();
          }}
        />

        <MarketTrendsSummaryCards
          summary={dashboard.summary}
          typeFilter={dashboard.typeFilter}
          onTypeFilterChange={dashboard.setTypeFilter}
        />

        <MarketTrendsFiltersPanel
          filters={dashboard.filters}
          filtersLoading={dashboard.filtersLoading}
          regionFilter={dashboard.regionFilter}
          romeFilter={dashboard.romeFilter}
          romeLabelsMap={dashboard.romeLabelsMap}
          typeFilter={dashboard.typeFilter}
          onRegionFilterChange={dashboard.setRegionFilter}
          onReset={dashboard.resetFilters}
          onRomeFilterChange={dashboard.setRomeFilter}
          onTypeFilterChange={dashboard.setTypeFilter}
        />

        <MarketTrendsResults
          countsByType={dashboard.countsByType}
          currentPage={dashboard.currentPage}
          isGrouped={dashboard.isGrouped}
          loading={dashboard.loading}
          summary={dashboard.summary}
          totalCount={dashboard.totalCount}
          totalPages={dashboard.totalPages}
          trendsByType={dashboard.trendsByType}
          romeLabelsMap={dashboard.romeLabelsMap}
          onPageChange={dashboard.setCurrentPage}
        />
      </div>
    </>
  );
}
